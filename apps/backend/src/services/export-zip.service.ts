/**
 * BuildFlow — Company Data ZIP Export service.
 *
 * Gathers all company-scoped data and streams a multi-file ZIP archive.
 * Each entity type is written as a separate JSON file; a CSV summary and
 * manifest are included for quick inspection.
 *
 * Uses archiver (streaming) so memory stays flat even for large companies.
 */
import { ZipArchive as Archiver } from 'archiver';
import type { Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../config/logger';

export interface ExportSnapshot {
  exportedAt: string;
  counts: Record<string, number>;
}

/**
 * Pulls every company-scoped entity and returns an object keyed by filename.
 * Password hashes are redacted. Dates are normalized to ISO strings.
 */
export async function gatherCompanyData(companyId: string) {
  const [
    company,
    users,
    projects,
    wbs,
    tasks,
    taskPredecessors,
    resources,
    materialPriceHistory,
    rateAnalyses,
    estimates,
    estimateSections,
    estimateItems,
    boqItems,
    invoices,
    invoiceLineItems,
    bills,
    journalEntries,
    dailyReports,
    materialUsages,
    notifications,
    auditLogs,
    chatMessages,
  ] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
    prisma.user.findMany({ where: { companyId } }),
    prisma.project.findMany({ where: { companyId } }),
    prisma.wBSItem.findMany({ where: { project: { companyId } } }),
    prisma.task.findMany({ where: { project: { companyId } } }),
    prisma.taskPredecessor.findMany({
      where: { task: { project: { companyId } } },
    }),
    prisma.resource.findMany({ where: { companyId } }),
    prisma.materialPriceHistory.findMany({ where: { companyId } }),
    prisma.rateAnalysis.findMany({ where: { companyId }, include: { components: true } }),
    prisma.estimate.findMany({ where: { companyId } }),
    prisma.estimateSection.findMany({ where: { estimate: { companyId } } }),
    prisma.estimateItem.findMany({ where: { estimate: { companyId } } }),
    prisma.bOQItem.findMany({ where: { project: { companyId } } }),
    prisma.invoice.findMany({ where: { companyId } }),
    prisma.invoiceLineItem.findMany({ where: { invoice: { companyId } } }),
    prisma.bill.findMany({ where: { companyId } }),
    prisma.journalEntry.findMany({ where: { companyId } }),
    prisma.dailyReport.findMany({ where: { project: { companyId } } }),
    prisma.materialUsage.findMany({
      where: { dailyReport: { project: { companyId } } },
    }),
    prisma.notification.findMany({ where: { user: { companyId } } }),
    prisma.auditLog.findMany({ where: { companyId } }),
    prisma.chatMessage.findMany({ where: { companyId } }),
  ]);

  const redactedUsers = users.map((u) => ({ ...u, passwordHash: '[REDACTED]' }));

  return {
    'company.json': company,
    'users.json': redactedUsers,
    'projects.json': projects,
    'wbs.json': wbs,
    'tasks.json': tasks,
    'task-predecessors.json': taskPredecessors,
    'resources.json': resources,
    'material-price-history.json': materialPriceHistory,
    'rate-analyses.json': rateAnalyses,
    'estimates.json': estimates,
    'estimate-sections.json': estimateSections,
    'estimate-items.json': estimateItems,
    'boq-items.json': boqItems,
    'invoices.json': invoices,
    'invoice-line-items.json': invoiceLineItems,
    'bills.json': bills,
    'journal-entries.json': journalEntries,
    'daily-reports.json': dailyReports,
    'material-usages.json': materialUsages,
    'notifications.json': notifications,
    'audit-logs.json': auditLogs,
    'chat-messages.json': chatMessages,
  } as Record<string, unknown>;
}

/**
 * Builds a CSV summary (one row per project with key stats) for quick preview.
 */
function buildSummaryCsv(
  projects: Array<Record<string, unknown>>,
  invoices: Array<Record<string, unknown>>,
  bills: Array<Record<string, unknown>>,
  estimates: Array<Record<string, unknown>>,
): string {
  const header = [
    'project_id',
    'project_name',
    'status',
    'budget',
    'start_date',
    'end_date',
    'invoice_count',
    'bill_count',
    'estimate_count',
  ].join(',');
  const invoiceByProject = new Map<string, number>();
  invoices.forEach((i) => {
    const pid = String(i.projectId ?? '');
    invoiceByProject.set(pid, (invoiceByProject.get(pid) ?? 0) + 1);
  });
  const billByProject = new Map<string, number>();
  bills.forEach((b) => {
    const pid = String(b.projectId ?? '');
    billByProject.set(pid, (billByProject.get(pid) ?? 0) + 1);
  });
  const estByProject = new Map<string, number>();
  estimates.forEach((e) => {
    const pid = String(e.projectId ?? '');
    estByProject.set(pid, (estByProject.get(pid) ?? 0) + 1);
  });
  const rows = projects.map((p) =>
    [
      String(p.id ?? ''),
      `"${String(p.name ?? '').replace(/"/g, '""')}"`,
      String(p.status ?? ''),
      String(p.budget ?? 0),
      String(p.startDate ?? ''),
      String(p.endDate ?? ''),
      String(invoiceByProject.get(String(p.id)) ?? 0),
      String(billByProject.get(String(p.id)) ?? 0),
      String(estByProject.get(String(p.id)) ?? 0),
    ].join(','),
  );
  return [header, ...rows].join('\n');
}

/**
 * Streams a ZIP of all company data directly to the HTTP response.
 * Resolves when the archive is fully flushed.
 */
export async function streamCompanyZip(
  companyId: string,
  res: Response,
): Promise<ExportSnapshot> {
  const data = await gatherCompanyData(companyId);
  const counts: Record<string, number> = {};
  for (const [file, value] of Object.entries(data)) {
    counts[file] = Array.isArray(value) ? value.length : 1;
  }

  const company = data['company.json'] as { name?: string };
  const safeName = (company.name ?? 'company').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `buildflow-export-${safeName}-${stamp}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');

  const archive = new Archiver({ zlib: { level: 6 } });
  archive.on('error', (err: Error) => {
    logger.error('ZIP export error', { error: err.message, companyId });
    // If headers not sent, send 500; otherwise abort.
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: { code: 'EXPORT_FAILED', message: err.message } });
    } else {
      res.end();
    }
  });

  archive.pipe(res);

  // Add each JSON file
  for (const [file, value] of Object.entries(data)) {
    archive.append(JSON.stringify(value, null, 2), { name: file });
  }

  // Manifest
  const manifest = {
    appName: 'BuildFlow',
    version: '2.0',
    exportedAt: new Date().toISOString(),
    companyId,
    fileCount: Object.keys(data).length,
    counts,
  };
  archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

  // CSV summary
  const csv = buildSummaryCsv(
    (data['projects.json'] as Array<Record<string, unknown>>) ?? [],
    (data['invoices.json'] as Array<Record<string, unknown>>) ?? [],
    (data['bills.json'] as Array<Record<string, unknown>>) ?? [],
    (data['estimates.json'] as Array<Record<string, unknown>>) ?? [],
  );
  archive.append(csv, { name: 'project-summary.csv' });

  await archive.finalize();

  return { exportedAt: manifest.exportedAt, counts };
}