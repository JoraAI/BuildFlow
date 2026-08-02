/**
 * BuildFlow - Labour management depth service (Phase 5 §8.8).
 *
 * Enhances existing attendance (geo-fence check-in/out) with:
 *  1. Daily/monthly attendance summary (present, absent, late, overtime hours)
 *  2. Labour cost tracking (wage × hours × headcount from daily reports)
 *  3. Productivity metrics (progress per worker-day)
 */
import { prisma } from '../lib/prisma';
import { assertProjectAccess } from '../middleware/project-access.middleware';

export interface AttendanceSummaryRow {
  date: string;
  presentCount: number;
  totalHeadcount: number;
  withinFenceCount: number;
  avgDistance: number;
  lateArrivals: number;
}

export async function getAttendanceSummary(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  opts: { fromDate?: string; toDate?: string },
): Promise<{ rows: AttendanceSummaryRow[]; totalPresent: number; totalHeadcount: number }> {
  await assertProjectAccess(companyId, userId, role as never, projectId);

  const where: Record<string, unknown> = { projectId };
  if (opts.fromDate || opts.toDate) {
    where.checkInAt = {};
    if (opts.fromDate) (where.checkInAt as Record<string, unknown>).gte = new Date(opts.fromDate);
    if (opts.toDate) (where.checkInAt as Record<string, unknown>).lte = new Date(opts.toDate);
  }

  const attendances = await prisma.attendance.findMany({
    where,
    orderBy: { checkInAt: 'asc' },
    select: { id: true, userId: true, checkInAt: true, checkOutAt: true, distanceFromSite: true, withinFence: true },
  });

  // Group by date
  const byDate = new Map<string, typeof attendances>();
  for (const a of attendances) {
    const dateKey = a.checkInAt.toISOString().slice(0, 10);
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push(a);
  }

  const rows: AttendanceSummaryRow[] = [];
  let totalPresent = 0;
  let totalHeadcount = 0;

  for (const [date, entries] of byDate) {
    // Get daily report headcount for this date
    const report = await prisma.dailyReport.findFirst({
      where: { projectId, reportDate: new Date(date) },
      select: { workersCount: true },
    }).catch(() => null);
    const headcount = report?.workersCount ?? entries.length;

    const withinFence = entries.filter((e) => e.withinFence).length;
    const avgDist = entries.length > 0
      ? Math.round(entries.reduce((s, e) => s + e.distanceFromSite, 0) / entries.length)
      : 0;
    const lateArrivals = entries.filter((e) => {
      const hour = e.checkInAt.getHours();
      return hour >= 10; // after 10 AM = late
    }).length;

    rows.push({
      date,
      presentCount: entries.length,
      totalHeadcount: headcount,
      withinFenceCount: withinFence,
      avgDistance: avgDist,
      lateArrivals,
    });
    totalPresent += entries.length;
    totalHeadcount += headcount;
  }

  return { rows, totalPresent, totalHeadcount };
}

export interface LabourCostRow {
  date: string;
  headcount: number;
  estimatedWageRate: number;
  estimatedDailyCost: number;
  taskProgressPct: number | null;
}

export async function getLabourCostTracking(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
  opts: { fromDate?: string; toDate?: string; wageRate?: number },
): Promise<{ rows: LabourCostRow[]; totalCost: number }> {
  await assertProjectAccess(companyId, userId, role as never, projectId);

  const wageRate = opts.wageRate ?? 500; // default ₹500/day

  const where: Record<string, unknown> = { projectId };
  if (opts.fromDate || opts.toDate) {
    where.reportDate = {};
    if (opts.fromDate) (where.reportDate as Record<string, unknown>).gte = new Date(opts.fromDate);
    if (opts.toDate) (where.reportDate as Record<string, unknown>).lte = new Date(opts.toDate);
  }

  const reports = await prisma.dailyReport.findMany({
    where,
    orderBy: { reportDate: 'asc' },
    select: { id: true, reportDate: true, workersCount: true, taskUpdates: { select: { progressPct: true } } },
  });

  const rows: LabourCostRow[] = reports.map((r) => {
    const avgProgress = r.taskUpdates.length > 0
      ? Math.round(r.taskUpdates.reduce((s, t) => s + t.progressPct, 0) / r.taskUpdates.length)
      : null;
    return {
      date: r.reportDate.toISOString().slice(0, 10),
      headcount: r.workersCount,
      estimatedWageRate: wageRate,
      estimatedDailyCost: Math.round(r.workersCount * wageRate),
      taskProgressPct: avgProgress,
    };
  });

  const totalCost = rows.reduce((s, r) => s + r.estimatedDailyCost, 0);
  return { rows, totalCost };
}

export async function getProductivityMetrics(
  companyId: string,
  userId: string,
  role: string,
  projectId: string,
): Promise<{ avgProductivity: number; totalWorkerDays: number; totalProgressDelta: number }> {
  await assertProjectAccess(companyId, userId, role as never, projectId);

  const reports = await prisma.dailyReport.findMany({
    where: { projectId },
    orderBy: { reportDate: 'asc' },
    select: { workersCount: true, taskUpdates: { select: { progressPct: true } } },
  });

  const totalWorkerDays = reports.reduce((s, r) => s + r.workersCount, 0);
  // Progress delta: sum of average daily progress changes
  let totalProgressDelta = 0;
  for (const r of reports) {
    if (r.taskUpdates.length > 0) {
      const avg = r.taskUpdates.reduce((s, t) => s + t.progressPct, 0) / r.taskUpdates.length;
      totalProgressDelta += avg;
    }
  }

  const avgProductivity = totalWorkerDays > 0 ? Math.round((totalProgressDelta / totalWorkerDays) * 100) / 100 : 0;

  return { avgProductivity, totalWorkerDays, totalProgressDelta: Math.round(totalProgressDelta) };
}
