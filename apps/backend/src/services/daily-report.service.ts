/**
 * BuildFlow - Daily Reports service.
 *
 * CRUD + calendar summary + material usage + S3 pre-signed photo uploads.
 */
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { recordAudit } from '../utils/audit';
import { getProject } from './project.service';
import { updateTaskProgress } from './task.service';
import { issueStockForDailyReport } from './procurement.service';
import { recordBoqMeasurement } from './boq.service';
import {
  buildS3Key,
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  keyToLogicalUrlForCompany,
  logicalUrlToKey,
} from '../lib/s3';
import { randomUUID } from 'crypto';
import type {
  CreateDailyReportInput,
  UpdateDailyReportInput,
} from '@buildflow/shared';

/* ------------------------------------------------------------------ */
/* List (with optional date filters)                                   */
/* ------------------------------------------------------------------ */

export async function listReports(
  companyId: string,
  projectId: string,
  opts: { fromDate?: string; toDate?: string } = {},
) {
  await getProject(companyId, projectId);

  const where: Record<string, unknown> = { projectId };
  if (opts.fromDate || opts.toDate) {
    where.reportDate = {};
    if (opts.fromDate) (where.reportDate as Record<string, unknown>).gte = new Date(opts.fromDate);
    if (opts.toDate) (where.reportDate as Record<string, unknown>).lte = new Date(opts.toDate);
  }

  const reports = await prisma.dailyReport.findMany({
    where: where as never,
    include: {
      reportedByUser: { select: { id: true, name: true } },
      materialUsages: { include: { resource: { select: { id: true, name: true, unit: true } } } },
    },
    orderBy: { reportDate: 'desc' },
  });

  return reports.map(serializeReport);
}

/* ------------------------------------------------------------------ */
/* Calendar view - which dates have reports                            */
/* ------------------------------------------------------------------ */

export async function getReportCalendar(
  companyId: string,
  projectId: string,
  month: string, // YYYY-MM
) {
  await getProject(companyId, projectId);

  const start = new Date(`${month}-01T00:00:00Z`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  const reports = await prisma.dailyReport.findMany({
    where: { projectId, reportDate: { gte: start, lt: end } },
    select: { reportDate: true, id: true },
    orderBy: { reportDate: 'asc' },
  });

  return reports.map((r) => ({
    id: r.id,
    date: r.reportDate.toISOString().slice(0, 10),
  }));
}

/* ------------------------------------------------------------------ */
/* Get single report                                                   */
/* ------------------------------------------------------------------ */

export async function getReport(companyId: string, reportId: string) {
  const report = await prisma.dailyReport.findFirst({
    where: { id: reportId, project: { companyId } },
    include: {
      reportedByUser: { select: { id: true, name: true } },
      materialUsages: { include: { resource: { select: { id: true, name: true, unit: true } } } },
    },
  });
  if (!report) throw ApiError.notFound('Daily report not found');
  return serializeReport(report);
}

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

export async function createReport(
  companyId: string,
  userId: string,
  projectId: string,
  input: CreateDailyReportInput,
  ipAddress?: string,
  idempotencyKey?: string,
) {
  if (idempotencyKey) {
    const { redis } = await import('../lib/redis');
    const cached = await redis.get(`idempotency:report:${idempotencyKey}`);
    if (cached) return JSON.parse(cached) as ReturnType<typeof serializeReport>;
  }

  await getProject(companyId, projectId);

  const reportDate = new Date(input.reportDate);

  // Enforce one report per project per day
  const existing = await prisma.dailyReport.findFirst({
    where: { projectId, reportDate },
    select: { id: true },
  });
  if (existing) {
    throw ApiError.conflict('A daily report already exists for this date');
  }

  const { materialUsages, taskUpdates, deductStock, ...reportFields } = input;

  let report = await prisma.$transaction(async (tx) => {
    const created = await tx.dailyReport.create({
      data: {
        projectId,
        reportedBy: userId,
        reportDate,
        weather: reportFields.weather,
        workDone: reportFields.workDone,
        issues: reportFields.issues,
        photos: [],
        workersCount: reportFields.workersCount ?? 0,
        materialUsages: materialUsages?.length
          ? {
              create: materialUsages.map((m) => ({
                resourceId: m.resourceId,
                quantityUsed: m.quantityUsed,
                notes: m.notes,
                taskId: m.taskId ?? null,
                boqItemId: m.boqItemId ?? null,
              })),
            }
          : undefined,
        taskUpdates: taskUpdates?.length
          ? {
              create: taskUpdates.map((t) => ({
                taskId: t.taskId,
                progressPct: t.progressPct,
              })),
            }
          : undefined,
      },
      include: {
        reportedByUser: { select: { id: true, name: true } },
        materialUsages: {
          include: { resource: { select: { id: true, name: true, unit: true } } },
        },
        taskUpdates: { include: { task: { select: { id: true, name: true } } } },
      },
    });

    if (deductStock && materialUsages?.length) {
      await issueStockForDailyReport(
        companyId,
        projectId,
        created.id,
        materialUsages.map((m) => ({ resourceId: m.resourceId, quantityUsed: m.quantityUsed })),
        tx,
      );
    }

    return created;
  });

  if (taskUpdates?.length) {
    for (const tu of taskUpdates) {
      await updateTaskProgress(companyId, userId, tu.taskId, tu.progressPct, ipAddress);
    }
  }

  if (materialUsages?.length && report.materialUsages?.length) {
    for (let i = 0; i < materialUsages.length; i++) {
      const input = materialUsages[i]!;
      const usageRow = report.materialUsages[i];
      if (input.postToBoqMeasurement && input.boqItemId && usageRow) {
        await recordBoqMeasurement(
          companyId,
          userId,
          input.boqItemId,
          {
            quantity: input.quantityUsed,
            notes: `From daily report ${report.reportDate.toISOString().slice(0, 10)}`,
          },
          ipAddress,
        );
        await prisma.materialUsage.update({
          where: { id: usageRow.id },
          data: { boqMeasurementPosted: true },
        });
      }
    }
    const refreshed = await prisma.dailyReport.findFirst({
      where: { id: report.id },
      include: {
        reportedByUser: { select: { id: true, name: true } },
        materialUsages: {
          include: { resource: { select: { id: true, name: true, unit: true } } },
        },
        taskUpdates: { include: { task: { select: { id: true, name: true } } } },
      },
    });
    if (refreshed) {
      report = refreshed;
    }
  }

  await recordAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'daily_report',
    entityId: report.id,
    newValue: { date: report.reportDate, projectId },
    ipAddress,
  });

  const serialized = serializeReport(report);
  if (idempotencyKey) {
    const { redis } = await import('../lib/redis');
    await redis.set(`idempotency:report:${idempotencyKey}`, JSON.stringify(serialized), 'EX', 86_400);
  }

  return serialized;
}

/* ------------------------------------------------------------------ */
/* Update (same day only)                                              */
/* ------------------------------------------------------------------ */

export async function updateReport(
  companyId: string,
  userId: string,
  reportId: string,
  input: UpdateDailyReportInput,
  ipAddress?: string,
) {
  const existing = await prisma.dailyReport.findFirst({
    where: { id: reportId, project: { companyId } },
    include: { materialUsages: true },
  });
  if (!existing) throw ApiError.notFound('Daily report not found');

  const { materialUsages, ...reportFields } = input;

  const updated = await prisma.dailyReport.update({
    where: { id: reportId },
    data: {
      ...(reportFields.weather !== undefined && { weather: reportFields.weather }),
      ...(reportFields.workDone !== undefined && { workDone: reportFields.workDone }),
      ...(reportFields.issues !== undefined && { issues: reportFields.issues }),
      ...(reportFields.workersCount !== undefined && { workersCount: reportFields.workersCount }),
    },
    include: {
      reportedByUser: { select: { id: true, name: true } },
      materialUsages: { include: { resource: { select: { id: true, name: true, unit: true } } } },
    },
  });

  // Replace material usages if provided
  if (materialUsages !== undefined) {
    await prisma.materialUsage.deleteMany({ where: { dailyReportId: reportId } });
    if (materialUsages.length) {
      await prisma.materialUsage.createMany({
        data: materialUsages.map((m) => ({
          dailyReportId: reportId,
          resourceId: m.resourceId,
          quantityUsed: m.quantityUsed,
          notes: m.notes,
          taskId: m.taskId ?? null,
          boqItemId: m.boqItemId ?? null,
        })),
      });
    }
  }

  await recordAudit({
    companyId,
    userId,
    action: 'UPDATE',
    entityType: 'daily_report',
    entityId: reportId,
    oldValue: { workDone: existing.workDone, workersCount: existing.workersCount },
    newValue: { workDone: updated.workDone, workersCount: updated.workersCount },
    ipAddress,
  });

  return serializeReport(updated);
}

/* ------------------------------------------------------------------ */
/* Photo upload - pre-signed URL flow                                  */
/* ------------------------------------------------------------------ */

export async function createPhotoUploadUrl(
  companyId: string,
  userId: string,
  reportId: string,
  input: { filename: string; contentType: string },
) {
  const report = await prisma.dailyReport.findFirst({
    where: { id: reportId, project: { companyId } },
    select: { id: true, projectId: true },
  });
  if (!report) throw ApiError.notFound('Daily report not found');

  const ext = input.filename.split('.').pop() ?? 'jpg';
  const filename = `${randomUUID()}.${ext}`;
  const key = buildS3Key({
    companyId,
    entityType: 'daily-reports',
    projectId: report.projectId,
    filename,
  });

  const uploadUrl = await getPresignedUploadUrl({
    companyId,
    key,
    contentType: input.contentType,
  });

  await recordAudit({
    companyId,
    userId,
    action: 'CUSTOM',
    entityType: 'daily_report_photo_presign',
    entityId: reportId,
    newValue: { key },
  });

  return { key, uploadUrl };
}

export async function confirmPhotoUpload(
  companyId: string,
  userId: string,
  reportId: string,
  s3Keys: string[],
  ipAddress?: string,
) {
  const report = await prisma.dailyReport.findFirst({
    where: { id: reportId, project: { companyId } },
    select: { id: true, photos: true },
  });
  if (!report) throw ApiError.notFound('Daily report not found');

  const newPhotos = await Promise.all(
    s3Keys.map((k) => keyToLogicalUrlForCompany(companyId, k)),
  );
  const photos = [...report.photos, ...newPhotos].slice(0, 10); // max 10

  const updated = await prisma.dailyReport.update({
    where: { id: reportId },
    data: { photos },
    select: { photos: true },
  });

  await recordAudit({
    companyId,
    userId,
    action: 'UPDATE',
    entityType: 'daily_report_photos',
    entityId: reportId,
    newValue: { count: newPhotos.length },
    ipAddress,
  });

  return { photos: updated.photos };
}

/* ------------------------------------------------------------------ */
/* Resolve a stored logical S3 URL -> short-lived GET URL              */
/* ------------------------------------------------------------------ */

export async function resolvePhotoUrls(companyId: string, photos: string[]): Promise<string[]> {
  const urls: string[] = [];
  for (const p of photos) {
    const parsed = logicalUrlToKey(p);
    if (parsed) {
      urls.push(await getPresignedDownloadUrl({ companyId, key: parsed.key }));
    }
  }
  return urls;
}

export async function postMaterialUsageToBoq(
  companyId: string,
  userId: string,
  usageId: string,
  ipAddress?: string,
) {
  const usage = await prisma.materialUsage.findFirst({
    where: { id: usageId, dailyReport: { project: { companyId } } },
    include: { dailyReport: { select: { reportDate: true } } },
  });
  if (!usage) throw ApiError.notFound('Material usage not found');
  if (!usage.boqItemId) throw ApiError.badRequest('Link this material usage to a BOQ line first');
  if (usage.boqMeasurementPosted) {
    throw ApiError.badRequest('Already posted to measurement book');
  }

  await recordBoqMeasurement(
    companyId,
    userId,
    usage.boqItemId,
    {
      quantity: Number(usage.quantityUsed),
      notes: `From daily report ${usage.dailyReport.reportDate.toISOString().slice(0, 10)}`,
    },
    ipAddress,
  );

  await prisma.materialUsage.update({
    where: { id: usageId },
    data: { boqMeasurementPosted: true },
  });

  return { usageId, boqItemId: usage.boqItemId, posted: true };
}

/* ------------------------------------------------------------------ */
/* Serializer - normalise Decimals + ISO dates                         */
/* ------------------------------------------------------------------ */

function serializeReport<T extends { reportDate: Date }>(r: T): Omit<T, 'reportDate'> & { reportDate: string } {
  return {
    ...r,
    reportDate: r.reportDate.toISOString().slice(0, 10),
  } as Omit<T, 'reportDate'> & { reportDate: string };
}