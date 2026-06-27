/**
 * BuildFlow — Financial reports service.
 *
 * Provides:
 *  - P&L (income vs cost vs estimate)
 *  - Cash flow (monthly inflow/outflow)
 *  - Estimate vs Actual (section/category variance)
 *  - Company dashboard (cross-project summary)
 *  - GST report (GSTR-1 ready)
 *  - TDS report (Form 16A compatible)
 */
import { prisma } from '../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

function num(d: Decimal | number | null | undefined): number {
  if (d === null || d === undefined) return 0;
  return typeof d === 'number' ? d : Number(d);
}

// ---------------------------------------------------------------------------
// P&L
// ---------------------------------------------------------------------------
export interface ProfitLossRow {
  category: string;
  amount: number;
}
export interface ProfitLossReport {
  projectId: string;
  projectName: string;
  income: ProfitLossRow[];
  totalIncome: number;
  costs: ProfitLossRow[];
  totalCost: number;
  netProfit: number;
  estimateTotal: number;
  estimateVariance: number;
}

export async function getProfitLoss(companyId: string, projectId: string): Promise<ProfitLossReport> {
  const project = await prisma.project.findFirstOrThrow({
    where: { id: projectId, companyId },
    select: { id: true, name: true },
  });

  const [invoices, bills] = await Promise.all([
    prisma.invoice.findMany({
      where: { companyId, projectId, status: { in: ['SENT', 'PAID', 'OVERDUE'] } },
      select: { subtotal: true, tdsAmount: true },
    }),
    prisma.bill.findMany({
      where: { companyId, projectId, status: { in: ['APPROVED', 'PAID'] } },
      select: { subtotal: true, category: true, tdsAmount: true },
    }),
  ]);

  const totalIncome = invoices.reduce((s, i) => s + num(i.subtotal), 0);
  const incomeRows: ProfitLossRow[] = [{ category: 'Sales (Invoiced)', amount: totalIncome }];

  const costMap = new Map<string, number>();
  for (const b of bills) {
    const cat = b.category ?? 'OTHER';
    costMap.set(cat, (costMap.get(cat) ?? 0) + num(b.subtotal));
  }
  const costRows: ProfitLossRow[] = Array.from(costMap.entries()).map(([category, amount]) => ({
    category,
    amount,
  }));
  const totalCost = costRows.reduce((s, r) => s + r.amount, 0);

  // Approved estimate total for variance
  const approved = await prisma.estimate.findFirst({
    where: { companyId, projectId, status: 'APPROVED' },
    orderBy: { approvedAt: 'desc' },
    select: { grandTotal: true },
  });
  const estimateTotal = approved ? num(approved.grandTotal) : 0;

  return {
    projectId: project.id,
    projectName: project.name,
    income: incomeRows,
    totalIncome,
    costs: costRows,
    totalCost,
    netProfit: totalIncome - totalCost,
    estimateTotal,
    estimateVariance: estimateTotal ? totalCost - estimateTotal : 0,
  };
}

// ---------------------------------------------------------------------------
// Cash flow
// ---------------------------------------------------------------------------
export interface CashFlowMonth {
  month: string; // YYYY-MM
  inflow: number;
  outflow: number;
  net: number;
}
export interface CashFlowReport {
  projectId: string;
  months: CashFlowMonth[];
  totalInflow: number;
  totalOutflow: number;
}

export async function getCashFlow(companyId: string, projectId: string): Promise<CashFlowReport> {
  const [invoices, bills] = await Promise.all([
    prisma.invoice.findMany({
      where: { companyId, projectId, status: 'PAID' },
      select: { paidAmount: true, invoiceDate: true },
    }),
    prisma.bill.findMany({
      where: { companyId, projectId, status: 'PAID' },
      select: { total: true, billDate: true },
    }),
  ]);

  const map = new Map<string, CashFlowMonth>();
  function bump(key: string, inflow: number, outflow: number) {
    const row = map.get(key) ?? { month: key, inflow: 0, outflow: 0, net: 0 };
    row.inflow += inflow;
    row.outflow += outflow;
    row.net = row.inflow - row.outflow;
    map.set(key, row);
  }
  for (const inv of invoices) {
    const key = inv.invoiceDate.toISOString().slice(0, 7);
    bump(key, num(inv.paidAmount), 0);
  }
  for (const bill of bills) {
    const key = bill.billDate.toISOString().slice(0, 7);
    bump(key, 0, num(bill.total));
  }

  const months = Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  return {
    projectId,
    months,
    totalInflow: months.reduce((s, m) => s + m.inflow, 0),
    totalOutflow: months.reduce((s, m) => s + m.outflow, 0),
  };
}

// ---------------------------------------------------------------------------
// Estimate vs Actual
// ---------------------------------------------------------------------------
export interface EstimateActualSection {
  section: string;
  type: string;
  estimated: number;
  actual: number;
  variance: number;
  variancePct: number;
}
export interface EstimateActualReport {
  projectId: string;
  projectName: string;
  completionPct: number;
  sections: EstimateActualSection[];
  totalEstimated: number;
  totalActual: number;
  totalVariance: number;
  flagged: string[];
}

export async function getEstimateVsActual(
  companyId: string,
  projectId: string,
): Promise<EstimateActualReport> {
  const project = await prisma.project.findFirstOrThrow({
    where: { id: projectId, companyId },
    select: { id: true, name: true },
  });

  // Tasks-based completion
  const tasks = await prisma.task.findMany({
    where: { projectId },
    select: { progressPct: true },
  });
  const completionPct =
    tasks.length > 0
      ? Math.round(tasks.reduce((s, t) => s + num(t.progressPct), 0) / tasks.length)
      : 0;

  // Approved estimate sections
  const estimate = await prisma.estimate.findFirst({
    where: { companyId, projectId, status: 'APPROVED' },
    orderBy: { approvedAt: 'desc' },
    include: {
      sections: {
        include: {
          items: { select: { amount: true, type: true } },
        },
        orderBy: { orderIndex: 'asc' },
      },
    },
  });

  // Actual bills grouped by category
  const bills = await prisma.bill.findMany({
    where: { companyId, projectId, status: { in: ['APPROVED', 'PAID'] } },
    select: { subtotal: true, category: true },
  });
  const actualByCategory = new Map<string, number>();
  for (const b of bills) {
    const cat = b.category ?? 'OTHER';
    actualByCategory.set(cat, (actualByCategory.get(cat) ?? 0) + num(b.subtotal));
  }

  const sections: EstimateActualSection[] = [];
  const flagged: string[] = [];
  let totalEstimated = 0;
  let totalActual = 0;

  if (estimate) {
    for (const sec of estimate.sections) {
      const estimated = sec.items.reduce((s, i) => s + num(i.amount), 0);
      const dominantType =
        sec.items.length > 0
          ? (sec.items
              .map((i) => i.type)
              .reduce((acc, t) => {
                acc[t] = (acc[t] ?? 0) + 1;
                return acc;
              }, {} as Record<string, number>),
            Object.entries(
              sec.items.reduce((acc, i) => {
                acc[i.type] = (acc[i.type] ?? 0) + 1;
                return acc;
              }, {} as Record<string, number>),
            ).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'OTHER')
          : 'OTHER';
      const actual = actualByCategory.get(dominantType) ?? 0;
      const variance = actual - estimated;
      const variancePct = estimated ? (variance / estimated) * 100 : 0;
      sections.push({
        section: sec.name,
        type: dominantType,
        estimated,
        actual,
        variance,
        variancePct,
      });
      totalEstimated += estimated;
      totalActual += actual;
      if (estimated > 0 && Math.abs(variancePct) > 15) {
        flagged.push(
          `${sec.name} ${variancePct > 0 ? 'over' : 'under'} budget by ${Math.abs(
            variancePct,
          ).toFixed(1)}%`,
        );
      }
    }
  }

  return {
    projectId: project.id,
    projectName: project.name,
    completionPct,
    sections,
    totalEstimated,
    totalActual,
    totalVariance: totalActual - totalEstimated,
    flagged,
  };
}

// ---------------------------------------------------------------------------
// Company dashboard
// ---------------------------------------------------------------------------
export interface CompanyDashboard {
  totalProjects: number;
  activeProjects: number;
  totalInvoiced: number;
  totalCollected: number;
  totalBilled: number;
  totalPaid: number;
  outstandingReceivable: number;
  outstandingPayable: number;
  projectSummaries: Array<{
    id: string;
    name: string;
    status: string;
    budget: number;
    billed: number;
    collected: number;
    variance: number;
  }>;
}

export async function getCompanyDashboard(companyId: string): Promise<CompanyDashboard> {
  const projects = await prisma.project.findMany({
    where: { companyId },
    select: {
      id: true,
      name: true,
      status: true,
      budget: true,
      invoices: { select: { total: true, paidAmount: true, status: true } },
      bills: { select: { total: true, status: true } },
    },
  });

  let totalInvoiced = 0;
  let totalCollected = 0;
  let totalBilled = 0;
  let totalPaid = 0;

  const projectSummaries = projects.map((p) => {
    const billed = p.invoices.reduce((s, i) => s + num(i.total), 0);
    const collected = p.invoices.reduce((s, i) => s + num(i.paidAmount), 0);
    const billTotal = p.bills.reduce((s, b) => s + num(b.total), 0);
    totalInvoiced += billed;
    totalCollected += collected;
    totalBilled += billTotal;
    if (p.bills.some((b) => b.status === 'PAID')) totalPaid += billTotal;
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      budget: num(p.budget),
      billed,
      collected,
      variance: num(p.budget) - billed,
    };
  });

  return {
    totalProjects: projects.length,
    activeProjects: projects.filter((p) => p.status === 'IN_PROGRESS' || p.status === 'PLANNING').length,
    totalInvoiced,
    totalCollected,
    totalBilled,
    totalPaid,
    outstandingReceivable: totalInvoiced - totalCollected,
    outstandingPayable: totalBilled - totalPaid,
    projectSummaries,
  };
}

// ---------------------------------------------------------------------------
// GST report (GSTR-1 style)
// ---------------------------------------------------------------------------
export interface GstReportRow {
  invoiceNumber: string;
  invoiceDate: string;
  clientGstin: string;
  clientName: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  invoiceValue: number;
}
export interface GstReport {
  fromDate: string;
  toDate: string;
  rows: GstReportRow[];
  totalTaxableValue: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  totalInvoiceValue: number;
}

export async function getGstReport(
  companyId: string,
  from?: string,
  to?: string,
): Promise<GstReport> {
  const where: Record<string, unknown> = {
    companyId,
    status: { in: ['SENT', 'PAID', 'OVERDUE'] },
  };
  if (from || to) {
    where.invoiceDate = {};
    if (from) (where.invoiceDate as { gte?: string }).gte = from;
    if (to) (where.invoiceDate as { lte?: string }).lte = to;
  }

  const invoices = await prisma.invoice.findMany({
    where: where as never,
    orderBy: { invoiceDate: 'asc' },
  });

  const rows: GstReportRow[] = invoices.map((inv) => ({
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate.toISOString().slice(0, 10),
    clientGstin: inv.clientGstin ?? '',
    clientName: inv.clientName,
    taxableValue: num(inv.subtotal),
    cgst: num(inv.cgstAmount),
    sgst: num(inv.sgstAmount),
    igst: num(inv.igstAmount),
    totalTax: num(inv.cgstAmount) + num(inv.sgstAmount) + num(inv.igstAmount),
    invoiceValue: num(inv.total),
  }));

  return {
    fromDate: from ?? 'all',
    toDate: to ?? 'all',
    rows,
    totalTaxableValue: rows.reduce((s, r) => s + r.taxableValue, 0),
    totalCgst: rows.reduce((s, r) => s + r.cgst, 0),
    totalSgst: rows.reduce((s, r) => s + r.sgst, 0),
    totalIgst: rows.reduce((s, r) => s + r.igst, 0),
    totalTax: rows.reduce((s, r) => s + r.totalTax, 0),
    totalInvoiceValue: rows.reduce((s, r) => s + r.invoiceValue, 0),
  };
}

// ---------------------------------------------------------------------------
// TDS report (Form 16A style)
// ---------------------------------------------------------------------------
export interface TdsReportRow {
  billNumber: string;
  billDate: string;
  vendorName: string;
  vendorGstin: string;
  amountPaid: number;
  tdsRate: number;
  tdsAmount: number;
  category: string;
}
export interface TdsReport {
  fromDate: string;
  toDate: string;
  rows: TdsReportRow[];
  totalAmountPaid: number;
  totalTdsDeducted: number;
}

export async function getTdsReport(
  companyId: string,
  from?: string,
  to?: string,
): Promise<TdsReport> {
  const where: Record<string, unknown> = {
    companyId,
    status: { in: ['APPROVED', 'PAID'] },
  };
  if (from || to) {
    where.billDate = {};
    if (from) (where.billDate as { gte?: string }).gte = from;
    if (to) (where.billDate as { lte?: string }).lte = to;
  }

  const bills = await prisma.bill.findMany({
    where: where as never,
    orderBy: { billDate: 'asc' },
  });

  const rows: TdsReportRow[] = bills
    .filter((b) => num(b.tdsAmount) > 0)
    .map((b) => ({
      billNumber: b.billNumber,
      billDate: b.billDate.toISOString().slice(0, 10),
      vendorName: b.vendorName,
      vendorGstin: b.vendorGstin ?? '',
      amountPaid: num(b.subtotal),
      tdsRate: num(b.subtotal) > 0 ? Math.round((num(b.tdsAmount) / num(b.subtotal)) * 10000) / 100 : 0,
      tdsAmount: num(b.tdsAmount),
      category: b.category,
    }));

  return {
    fromDate: from ?? 'all',
    toDate: to ?? 'all',
    rows,
    totalAmountPaid: rows.reduce((s, r) => s + r.amountPaid, 0),
    totalTdsDeducted: rows.reduce((s, r) => s + r.tdsAmount, 0),
  };
}