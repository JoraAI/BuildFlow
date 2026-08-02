/**
 * BuildFlow - Owner analytics dashboard service.
 *
 * Aggregates cross-project KPIs for the company owner:
 *   - Project map pins (lat/lng + status color)
 *   - Revenue vs target (monthly)
 *   - Project progress race bars
 *   - Team productivity (reports submitted per user)
 *   - 30-day cash flow forecast
 *   - Budget burn gauges per project
 *   - Estimation accuracy leaderboard
 *   - Top material price trends (last 6 months)
 */
import { prisma } from '../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

function num(d: Decimal | number | null | undefined): number {
  if (d === null || d === undefined) return 0;
  return typeof d === 'number' ? d : Number(d);
}

export interface AnalyticsDashboard {
  kpis: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    delayedProjects: number;
    totalRevenue: number; // paid invoices
    totalOutstanding: number; // sent + overdue invoices
    totalBudget: number; // sum of project budgets
    avgProgress: number;
  };
  projectPins: {
    id: string;
    name: string;
    lat: number | null;
    lng: number | null;
    status: string;
    progress: number;
  }[];
  revenueVsTarget: { month: string; revenue: number; target: number }[];
  projectProgress: { id: string; name: string; progress: number; budget: number }[];
  teamProductivity: { userId: string; name: string; reportsCount: number; role: string }[];
  cashFlowForecast: { date: string; inflow: number; outflow: number; net: number; cumulative: number }[];
  budgetBurn: {
    projectId: string;
    projectName: string;
    budget: number;
    spent: number;
    burnPct: number;
  }[];
  estimationAccuracy: {
    projectId: string;
    projectName: string;
    estimated: number;
    actual: number;
    variancePct: number;
    accuracyScore: number; // 100 - abs(variancePct), floored at 0
  }[];
  materialTrends: {
    resourceId: string;
    name: string;
    unit: string;
    points: { date: string; rate: number }[];
  }[];
}

import { withCache, cacheKeys } from '../utils/cache';

// Dashboard is heavy (many aggregates); cache for 5 minutes per offline-first spec.
const DASHBOARD_TTL = 5 * 60;

export async function getOwnerDashboard(companyId: string): Promise<AnalyticsDashboard> {
  return withCache(cacheKeys.dashboard(companyId), DASHBOARD_TTL, () =>
    loadOwnerDashboard(companyId),
  );
}

async function loadOwnerDashboard(companyId: string): Promise<AnalyticsDashboard> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

  const [
    projects,
    paidInvoices,
    outstandingInvoices,
    reports,
    approvedBills,
    cashInInvoices,
    cashOutBills,
    materials,
  ] = await Promise.all([
    prisma.project.findMany({
      where: { companyId, isDeleted: false, isTemporary: false },
      include: {
        tasks: { select: { progressPct: true } },
        estimates: {
          where: { status: 'APPROVED', parentId: null },
          select: { grandTotal: true },
          orderBy: { approvedAt: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.invoice.findMany({
      where: { companyId, status: 'PAID', invoiceDate: { gte: sixMonthsAgo } },
      select: { total: true, paidAmount: true, invoiceDate: true },
    }),
    prisma.invoice.findMany({
      where: { companyId, status: { in: ['SENT', 'OVERDUE'] } },
      select: { total: true, paidAmount: true },
    }),
    prisma.dailyReport.findMany({
      where: { project: { companyId }, reportDate: { gte: thirtyDaysAgo } },
      select: { reportedBy: true, reportedByUser: { select: { name: true, role: true } } },
    }),
    prisma.bill.findMany({
      where: { companyId, status: { in: ['APPROVED', 'PAID'] } },
      select: { projectId: true, total: true, paidAmount: true },
    }),
    // FIX (FIN-M9): All-time paid inflows for cash baseline (not 6-month invoiceDate window).
    prisma.invoice.findMany({
      where: { companyId, paidAmount: { gt: 0 } },
      select: { paidAmount: true },
    }),
    prisma.bill.findMany({
      where: { companyId, paidAmount: { gt: 0 } },
      select: { paidAmount: true },
    }),
    prisma.resource.findMany({
      where: { companyId, type: 'MATERIAL', isActive: true },
      select: {
        id: true,
        name: true,
        unit: true,
        priceHistory: {
          where: { effectiveDate: { gte: sixMonthsAgo } },
          orderBy: { effectiveDate: 'asc' },
          select: { rate: true, effectiveDate: true },
        },
      },
    }),
  ]);

  // ---- KPIs ----
  const active = projects.filter((p) => p.status === 'IN_PROGRESS' || p.status === 'PLANNING');
  const completed = projects.filter((p) => p.status === 'COMPLETED');
  const delayed = projects.filter((p) => p.status === 'ON_HOLD');
  const totalRevenue = paidInvoices.reduce((s, i) => s + num(i.paidAmount || i.total), 0);
  const totalOutstanding = outstandingInvoices.reduce((s, i) => s + (num(i.total) - num(i.paidAmount)), 0);
  const totalBudget = projects.reduce((s, p) => s + num(p.budget), 0);
  const allTasks = projects.flatMap((p) => p.tasks);
  const avgProgress = allTasks.length
    ? Math.round(allTasks.reduce((s, t) => s + num(t.progressPct), 0) / allTasks.length)
    : 0;

  // ---- Project pins ----
  const projectPins = projects
    .filter((p) => p.locationLat !== null && p.locationLng !== null)
    .map((p) => {
      const t = p.tasks;
      const progress = t.length ? Math.round(t.reduce((s, x) => s + num(x.progressPct), 0) / t.length) : 0;
      return {
        id: p.id,
        name: p.name,
        lat: p.locationLat ? num(p.locationLat) : null,
        lng: p.locationLng ? num(p.locationLng) : null,
        status: p.status,
        progress,
      };
    });

  // ---- Revenue vs target (last 6 months) ----
  const revenueByMonth = new Map<string, number>();
  paidInvoices.forEach((i) => {
    const m = i.invoiceDate.toISOString().slice(0, 7);
    revenueByMonth.set(m, (revenueByMonth.get(m) ?? 0) + num(i.paidAmount || i.total));
  });
  const revenueVsTarget: { month: string; revenue: number; target: number }[] = [];
  const monthlyTarget = totalRevenue / 6 || 1000000;
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.toISOString().slice(0, 7);
    revenueVsTarget.push({ month: m, revenue: revenueByMonth.get(m) ?? 0, target: Math.round(monthlyTarget) });
  }

  // ---- Project progress race bars ----
  const projectProgress = projects
    .map((p) => {
      const t = p.tasks;
      const progress = t.length ? Math.round(t.reduce((s, x) => s + num(x.progressPct), 0) / t.length) : 0;
      return { id: p.id, name: p.name, progress, budget: num(p.budget) };
    })
    .sort((a, b) => b.progress - a.progress);

  // ---- Team productivity ----
  interface ProductivityEntry {
    name: string;
    role: string;
    count: number;
  }
  const productivityMap = new Map<string, ProductivityEntry>();
  reports.forEach((r) => {
    const key = r.reportedBy;
    const existing = productivityMap.get(key);
    const e: ProductivityEntry = existing
      ? existing
      : { name: r.reportedByUser.name, role: r.reportedByUser.role, count: 0 };
    e.count += 1;
    productivityMap.set(key, e);
  });
  const teamProductivity = Array.from(productivityMap.entries())
    .map(([userId, v]) => ({ userId, name: v.name, role: v.role, reportsCount: v.count }))
    .sort((a, b) => b.reportsCount - a.reportsCount);

  // ---- Cash flow forecast (90 days, date-aware) ----
  // Build a daily calendar of projected inflows and outflows based on actual due dates.
  const forecastDays = 90;
  const dayMs = 24 * 60 * 60 * 1000;

  // Fetch outstanding invoices for inflow projection
  const dueInvoices = await prisma.invoice.findMany({
    where: {
      companyId,
      status: { in: ['SENT', 'OVERDUE'] },
    },
    select: { total: true, paidAmount: true, dueDate: true },
  });

  // Fetch bills for outflow projection (unpaid portion)
  const pendingBills = await prisma.bill.findMany({
    where: {
      companyId,
      status: { in: ['PENDING', 'APPROVED'] },
    },
    select: { total: true, paidAmount: true, billDate: true },
  });

  // Build daily buckets keyed by YYYY-MM-DD
  const inflowByDate = new Map<string, number>();
  const outflowByDate = new Map<string, number>();

  // Map each invoice's outstanding amount to its due date
  for (const inv of dueInvoices) {
    const remaining = num(inv.total) - num(inv.paidAmount);
    if (remaining > 0 && inv.dueDate) {
      const ds = inv.dueDate.toISOString().slice(0, 10);
      inflowByDate.set(ds, (inflowByDate.get(ds) ?? 0) + remaining);
    }
  }

  // Map each bill's outstanding amount to its bill date + 30 day terms
  for (const bill of pendingBills) {
    const remaining = num(bill.total) - num(bill.paidAmount);
    if (remaining > 0 && bill.billDate) {
      // Assume 30-day payment terms from bill date
      const payDate = new Date(bill.billDate.getTime() + 30 * dayMs);
      // Only include if within forecast window
      if (payDate >= now && payDate <= new Date(now.getTime() + forecastDays * dayMs)) {
        const ds = payDate.toISOString().slice(0, 10);
        outflowByDate.set(ds, (outflowByDate.get(ds) ?? 0) + remaining);
      }
    }
  }

  // FIX (FIN-M9): Cash baseline uses all-time actual paid amounts only.
  const paidInflowTotal = cashInInvoices.reduce((s, i) => s + num(i.paidAmount), 0);
  const paidOutflowTotal = cashOutBills.reduce((s, b) => s + num(b.paidAmount), 0);
  let cumulative = Math.round(paidInflowTotal - paidOutflowTotal);

  // Generate weekly buckets (13 weeks ≈ 90 days) for cleaner display
  const cashFlowForecast: { date: string; inflow: number; outflow: number; net: number; cumulative: number }[] = [];
  for (let week = 0; week < 13; week++) {
    const weekStart = new Date(now.getTime() + week * 7 * dayMs);
    const weekEnd = new Date(weekStart.getTime() + 6 * dayMs);
    let weekInflow = 0;
    let weekOutflow = 0;

    // Sum daily buckets within this week
    for (let d = new Date(weekStart); d <= weekEnd; d = new Date(d.getTime() + dayMs)) {
      const ds = d.toISOString().slice(0, 10);
      weekInflow += inflowByDate.get(ds) ?? 0;
      weekOutflow += outflowByDate.get(ds) ?? 0;
    }

    cumulative += Math.round(weekInflow - weekOutflow);
    cashFlowForecast.push({
      date: weekStart.toISOString().slice(0, 10),
      inflow: Math.round(weekInflow),
      outflow: Math.round(weekOutflow),
      net: Math.round(weekInflow - weekOutflow),
      cumulative,
    });
  }

  // ---- Budget burn gauges ----
  const spendByProject = new Map<string, number>();
  approvedBills.forEach((b) => {
    spendByProject.set(b.projectId, (spendByProject.get(b.projectId) ?? 0) + num(b.paidAmount));
  });
  const budgetBurn = projects
    .map((p) => {
      const spent = spendByProject.get(p.id) ?? 0;
      const budget = num(p.budget);
      return {
        projectId: p.id,
        projectName: p.name,
        budget,
        spent,
        burnPct: budget ? Math.round((spent / budget) * 100) : 0,
      };
    })
    .sort((a, b) => b.burnPct - a.burnPct);

  // ---- Estimation accuracy leaderboard ----
  const estimationAccuracy = projects
    .filter((p) => p.estimates.length > 0)
    .map((p) => {
      const estimated = num(p.estimates[0].grandTotal);
      const actual = spendByProject.get(p.id) ?? 0;
      const variancePct = estimated ? ((actual - estimated) / estimated) * 100 : 0;
      return {
        projectId: p.id,
        projectName: p.name,
        estimated,
        actual,
        variancePct: Math.round(variancePct * 10) / 10,
        accuracyScore: Math.max(0, Math.round(100 - Math.abs(variancePct))),
      };
    })
    .sort((a, b) => b.accuracyScore - a.accuracyScore);

  // ---- Material price trends (top 5 by history length) ----
  const materialTrends = materials
    .filter((m) => m.priceHistory.length > 0)
    .sort((a, b) => b.priceHistory.length - a.priceHistory.length)
    .slice(0, 5)
    .map((m) => ({
      resourceId: m.id,
      name: m.name,
      unit: m.unit ?? '',
      points: m.priceHistory.map((h) => ({
        date: h.effectiveDate.toISOString().slice(0, 10),
        rate: num(h.rate),
      })),
    }));

  return {
    kpis: {
      totalProjects: projects.length,
      activeProjects: active.length,
      completedProjects: completed.length,
      delayedProjects: delayed.length,
      totalRevenue,
      totalOutstanding,
      totalBudget,
      avgProgress,
    },
    projectPins,
    revenueVsTarget,
    projectProgress,
    teamProductivity,
    cashFlowForecast,
    budgetBurn,
    estimationAccuracy,
    materialTrends,
  };
}