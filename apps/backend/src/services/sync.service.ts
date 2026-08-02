/**
 * BuildFlow - Offline sync service (Phase 5 §8.1).
 *
 * Provides:
 *  1. Delta sync: GET /api/sync/delta?since=<ISO>&projectIds=a,b,c
 *     Returns entities updated since the given timestamp for the user's company.
 *  2. Batch status: GET /api/sync/status
 *     Returns the server time + queue health (counts of recently modified entities).
 */
import { prisma } from '../lib/prisma';

export interface DeltaSyncResult {
  serverTime: string;
  since: string;
  changes: {
    dailyReports: unknown[];
    punchItems: unknown[];
    rfis: unknown[];
    submittals: unknown[];
    tasks: unknown[];
    boqItems: unknown[];
  };
}

/**
 * LIMITATION (§2.3 #3 / NR-38): DailyReport and Task have no `updatedAt`
 * column. Delta sync therefore uses `createdAt` only — edits to existing
 * records are NOT surfaced by this endpoint. The full offline-first spec
 * (§8.1) requires adding `updatedAt` to these models; until then `/api/sync`
 * is unmounted in app.ts (see §2.8).
 *
 * FIX (anti-pattern R2.0 #6): removed the `.catch(() => [])` swallows that hid
 * Prisma errors. Failures now propagate to the caller as real errors.
 */
export async function getDeltaSync(
  companyId: string,
  since: string,
  projectIds?: string[],
): Promise<DeltaSyncResult> {
  const sinceDate = new Date(since);
  // DailyReport and Task are scoped via the project relation (no companyId
  // column). Tenant-scoped entities (PunchItem/RFI/Submittal) carry companyId.
  const taskReportWhere = projectIds?.length
    ? { project: { companyId, id: { in: projectIds } } }
    : { project: { companyId } };
  const tenantWhere = projectIds?.length
    ? { companyId, projectId: { in: projectIds } }
    : { companyId };

  const [dailyReports, punchItems, rfis, submittals, tasks, boqItems] = await Promise.all([
    prisma.dailyReport.findMany({
      where: { ...taskReportWhere, createdAt: { gt: sinceDate } },
      take: 200,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.punchItem.findMany({
      where: { ...tenantWhere, updatedAt: { gt: sinceDate } },
      take: 200,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.rFI.findMany({
      where: { ...tenantWhere, updatedAt: { gt: sinceDate } },
      take: 200,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.submittal.findMany({
      where: { ...tenantWhere, updatedAt: { gt: sinceDate } },
      take: 200,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.task.findMany({
      where: { ...taskReportWhere, createdAt: { gt: sinceDate } },
      take: 500,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.bOQItem.findMany({
      where: { project: { companyId } },
      take: 500,
      orderBy: { itemCode: 'asc' },
    }),
  ]);

  return {
    serverTime: new Date().toISOString(),
    since,
    changes: { dailyReports, punchItems, rfis, submittals, tasks, boqItems },
  };
}

export async function getSyncStatus(companyId: string) {
  const [punchCount, rfiCount, reportCount] = await Promise.all([
    prisma.punchItem.count({ where: { companyId } }),
    prisma.rFI.count({ where: { companyId } }),
    prisma.dailyReport.count({ where: { project: { companyId } } }),
  ]);
  return {
    serverTime: new Date().toISOString(),
    entityCounts: { punchItems: punchCount, rfis: rfiCount, dailyReports: reportCount },
  };
}
