/**
 * BuildFlow - Resource service (master + price history).
 */
import { randomUUID } from 'crypto';
import { Prisma, Resource } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { recordAudit } from '../utils/audit';
import { withCache, invalidateCache, invalidatePattern, cacheKeys, hashQuery } from '../utils/cache';
import {
  buildS3Key,
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  keyToLogicalUrlForCompany,
  logicalUrlToKey,
} from '../lib/s3';
import type {
  CreateResourceInput,
  UpdateResourceInput,
  ResourceQueryInput,
  CreatePriceHistoryInput,
  ResourceImageUploadInput,
} from '@buildflow/shared';
import {
  compareDateOnly,
  dateOnlyFromDate,
  parseDateOnlyToDate,
  todayDateOnly,
} from '@buildflow/shared';

// Resources change infrequently; cache list for 1 hour per offline-first spec.
const RESOURCE_LIST_TTL = 60 * 60;

async function resolveResourceImageUrl(
  companyId: string,
  imageUrl: string | null,
): Promise<string | null> {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
  const parsed = logicalUrlToKey(imageUrl);
  if (!parsed) return null;
  try {
    return await getPresignedDownloadUrl({ companyId, key: parsed.key });
  } catch {
    return null;
  }
}

async function serializeResource(companyId: string, resource: Resource) {
  const imageUrl = await resolveResourceImageUrl(companyId, resource.imageUrl);
  return { ...resource, imageUrl };
}

export async function createResourceImageUploadUrl(
  companyId: string,
  input: ResourceImageUploadInput,
) {
  const ext = input.filename.split('.').pop() ?? 'jpg';
  const filename = `${randomUUID()}.${ext}`;
  const key = buildS3Key({ companyId, entityType: 'resources', filename });
  const uploadUrl = await getPresignedUploadUrl({
    companyId,
    key,
    contentType: input.contentType,
  });
  const imageUrl = await keyToLogicalUrlForCompany(companyId, key);
  return { uploadUrl, imageUrl };
}

/* ------------------------------------------------------------------ */
/* Resource CRUD                                                       */
/* ------------------------------------------------------------------ */

export async function listResources(companyId: string, query: ResourceQueryInput) {
  const { page, limit, type, search, active } = query;
  const where: Prisma.ResourceWhereInput = { companyId, isDeleted: false };
  if (type) where.type = type;
  if (active !== undefined) where.isActive = active === 'true';
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { category: { contains: search, mode: 'insensitive' } },
      { brandOrSpec: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Skip cache for paginated inner pages > 1 or search queries.
  const cacheable = page === 1 && !search;
  const key = cacheKeys.resourcesList(companyId, hashQuery({ type, active, page, limit }));

  const loader = async () => {
    const [rows, total] = await Promise.all([
      prisma.resource.findMany({
        where,
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.resource.count({ where }),
    ]);
    const serialized = await Promise.all(rows.map((row) => serializeResource(companyId, row)));
    return { rows: serialized, total, page, limit };
  };

  if (cacheable) {
    return withCache(key, RESOURCE_LIST_TTL, loader);
  }
  return loader();
}

export async function getResource(companyId: string, id: string) {
  const resource = await prisma.resource.findFirst({
    where: { id, companyId, isDeleted: false },
  });
  if (!resource) throw ApiError.notFound('Resource not found');
  return serializeResource(companyId, resource);
}

export async function createResource(
  companyId: string,
  userId: string,
  input: CreateResourceInput,
  ipAddress?: string,
) {
  const resource = await prisma.resource.create({
    data: {
      companyId,
      name: input.name,
      type: input.type,
      unit: input.unit,
      rate: input.rate,
      gstRate: input.gstRate ?? 0,
      hsnSacCode: input.hsnSacCode ?? null,
      brandOrSpec: input.brandOrSpec ?? null,
      category: input.category ?? null,
      imageUrl: input.imageUrl ?? null,
      lastRateUpdatedAt: new Date(),
    },
  });

  // Record initial price history
  await prisma.materialPriceHistory.create({
    data: {
      resourceId: resource.id,
      companyId,
      rate: resource.rate,
      effectiveDate: new Date(),
      notes: 'Initial rate',
      recordedBy: userId,
    },
  });

  await invalidatePattern(`cache:${companyId}:resources:*`);

  await recordAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'resource',
    entityId: resource.id,
    newValue: { name: resource.name, rate: Number(resource.rate) },
    ipAddress,
  });

  return serializeResource(companyId, resource);
}

export async function updateResource(
  companyId: string,
  userId: string,
  id: string,
  input: UpdateResourceInput,
  ipAddress?: string,
) {
  const existing = await getResource(companyId, id);

  // If rate changed, archive old rate to price history (handled separately by
  // price-history endpoint; here we just update the master).
  const rateChanged = input.rate !== undefined && input.rate !== Number(existing.rate);

  const updated = await prisma.resource.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.unit !== undefined && { unit: input.unit }),
      ...(input.rate !== undefined && { rate: input.rate }),
      ...(input.gstRate !== undefined && { gstRate: input.gstRate }),
      ...(input.hsnSacCode !== undefined && { hsnSacCode: input.hsnSacCode }),
      ...(input.brandOrSpec !== undefined && { brandOrSpec: input.brandOrSpec }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
      ...(rateChanged && { lastRateUpdatedAt: new Date() }),
    },
  });

  // If rate changed, flag dependent rate analyses as stale
  if (rateChanged) {
    const affected = await prisma.rateAnalysisComponent.findMany({
      where: { resourceId: id },
      select: { rateAnalysisId: true },
      distinct: ['rateAnalysisId'],
    });
    if (affected.length > 0) {
      await prisma.rateAnalysis.updateMany({
        where: { id: { in: affected.map((a) => a.rateAnalysisId) } },
        data: { stale: true },
      });
    }
  }

  // Resource mutation invalidates list cache + this item (rate analyses may change too).
  await invalidatePattern(`cache:${companyId}:resources:*`);
  await invalidatePattern(`cache:${companyId}:rate-analysis:*`);

  await recordAudit({
    companyId,
    userId,
    action: 'UPDATE',
    entityType: 'resource',
    entityId: id,
    oldValue: { name: existing.name, rate: Number(existing.rate) },
    newValue: { name: updated.name, rate: Number(updated.rate) },
    ipAddress,
  });

  return serializeResource(companyId, updated);
}

export async function deleteResource(
  companyId: string,
  userId: string,
  id: string,
  ipAddress?: string,
) {
  await getResource(companyId, id);

  const [rateAnalysisRefs, estimateItemRefs] = await Promise.all([
    prisma.rateAnalysisComponent.count({ where: { resourceId: id } }),
    prisma.estimateItem.count({ where: { resourceId: id } }),
  ]);

  if (rateAnalysisRefs > 0 || estimateItemRefs > 0) {
    const parts: string[] = [];
    if (rateAnalysisRefs > 0) parts.push(`${rateAnalysisRefs} rate analysis component(s)`);
    if (estimateItemRefs > 0) parts.push(`${estimateItemRefs} estimate line item(s)`);
    throw ApiError.conflict(
      `Cannot delete this material - it is used in ${parts.join(' and ')}. Remove those references first.`,
    );
  }

  // Soft delete
  await prisma.resource.update({ where: { id }, data: { isDeleted: true, isActive: false } });
  await invalidatePattern(`cache:${companyId}:resources:*`);
  await invalidateCache(cacheKeys.resource(companyId, id));
  await recordAudit({
    companyId,
    userId,
    action: 'DELETE',
    entityType: 'resource',
    entityId: id,
    ipAddress,
  });
}

/* ------------------------------------------------------------------ */
/* Price History                                                       */
/* ------------------------------------------------------------------ */

async function flagStaleRateAnalyses(resourceId: string) {
  const affected = await prisma.rateAnalysisComponent.findMany({
    where: { resourceId },
    select: { rateAnalysisId: true },
    distinct: ['rateAnalysisId'],
  });
  if (affected.length > 0) {
    await prisma.rateAnalysis.updateMany({
      where: { id: { in: affected.map((a) => a.rateAnalysisId) } },
      data: { stale: true },
    });
  }
}

/** Apply the latest due scheduled rate to the master resource record. */
async function syncEffectiveResourceRate(companyId: string, resourceId: string) {
  const todayDate = parseDateOnlyToDate(todayDateOnly());

  const latest = await prisma.materialPriceHistory.findFirst({
    where: {
      resourceId,
      companyId,
      effectiveDate: { lte: todayDate },
    },
    orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
  });
  if (!latest) return;

  const resource = await prisma.resource.findFirst({ where: { id: resourceId, companyId } });
  if (!resource) return;

  const latestRate = Number(latest.rate);
  if (Number(resource.rate) === latestRate) return;

  await prisma.resource.update({
    where: { id: resourceId },
    data: { rate: latestRate, lastRateUpdatedAt: latest.effectiveDate },
  });
  await flagStaleRateAnalyses(resourceId);
  await invalidatePattern(`cache:${companyId}:resources:*`);
  await invalidatePattern(`cache:${companyId}:rate-analysis:*`);
}

export async function getPriceHistory(companyId: string, resourceId: string) {
  await syncEffectiveResourceRate(companyId, resourceId);
  await getResource(companyId, resourceId);

  const history = await prisma.materialPriceHistory.findMany({
    where: { resourceId, companyId },
    orderBy: { effectiveDate: 'desc' },
    include: { recordedByUser: { select: { name: true } } },
  });
  const today = todayDateOnly();

  return history.map((h) => {
    const effective = dateOnlyFromDate(h.effectiveDate);
    return {
      id: h.id,
      resourceId: h.resourceId,
      rate: Number(h.rate),
      effectiveDate: h.effectiveDate.toISOString(),
      isScheduled: compareDateOnly(effective, today) > 0,
      notes: h.notes,
      recordedBy: h.recordedBy,
      recordedByName: h.recordedByUser.name,
      createdAt: h.createdAt.toISOString(),
    };
  });
}

export async function addPriceHistory(
  companyId: string,
  userId: string,
  resourceId: string,
  input: CreatePriceHistoryInput,
  ipAddress?: string,
) {
  await syncEffectiveResourceRate(companyId, resourceId);
  const resource = await getResource(companyId, resourceId);

  const today = todayDateOnly();
  const effectiveDateOnly = input.effectiveDate;
  const todayDate = parseDateOnlyToDate(today);

  if (compareDateOnly(effectiveDateOnly, today) < 0) {
    throw ApiError.validation([
      { field: 'effectiveDate', message: 'Effective date cannot be in the past' },
    ]);
  }

  const pendingFuture = await prisma.materialPriceHistory.findFirst({
    where: {
      resourceId,
      companyId,
      effectiveDate: { gt: todayDate },
    },
    orderBy: { effectiveDate: 'asc' },
  });

  if (pendingFuture) {
    const pendingOn = dateOnlyFromDate(pendingFuture.effectiveDate);
    throw ApiError.validation([
      {
        field: 'effectiveDate',
        message: `A rate is already scheduled for ${pendingOn}. Wait until it takes effect before adding another.`,
      },
    ]);
  }

  const effectiveDateObj = parseDateOnlyToDate(effectiveDateOnly);
  const isImmediate = compareDateOnly(effectiveDateOnly, today) <= 0;

  const entry = await prisma.materialPriceHistory.create({
    data: {
      resourceId,
      companyId,
      rate: input.rate,
      effectiveDate: effectiveDateObj,
      notes: input.notes ?? null,
      recordedBy: userId,
    },
  });

  const oldRate = Number(resource.rate);

  if (isImmediate) {
    await prisma.resource.update({
      where: { id: resourceId },
      data: { rate: input.rate, lastRateUpdatedAt: effectiveDateObj },
    });
    await flagStaleRateAnalyses(resourceId);
  }

  await invalidatePattern(`cache:${companyId}:resources:*`);
  if (isImmediate) {
    await invalidatePattern(`cache:${companyId}:rate-analysis:*`);
  }

  await recordAudit({
    companyId,
    userId,
    action: 'UPDATE',
    entityType: 'resource_price',
    entityId: resourceId,
    oldValue: { rate: oldRate },
    newValue: isImmediate
      ? { rate: input.rate, effectiveDate: effectiveDateOnly }
      : { rate: input.rate, effectiveDate: effectiveDateOnly, scheduled: true },
    ipAddress,
  });

  return entry;
}

/* ------------------------------------------------------------------ */
/* Bulk Import                                                         */
/* ------------------------------------------------------------------ */

export async function importResources(
  companyId: string,
  userId: string,
  rows: CreateResourceInput[],
  ipAddress?: string,
) {
  const created: string[] = [];
  for (const row of rows) {
    const resource = await prisma.resource.create({
      data: {
        companyId,
        name: row.name,
        type: row.type,
        unit: row.unit,
        rate: row.rate,
        gstRate: row.gstRate ?? 0,
        hsnSacCode: row.hsnSacCode ?? null,
        brandOrSpec: row.brandOrSpec ?? null,
        category: row.category ?? null,
        imageUrl: row.imageUrl ?? null,
        lastRateUpdatedAt: new Date(),
      },
    });
    created.push(resource.id);
  }

  await invalidatePattern(`cache:${companyId}:resources:*`);

  await recordAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'resource_batch',
    entityId: companyId,
    newValue: { count: created.length },
    ipAddress,
  });

  return { imported: created.length, ids: created };
}
