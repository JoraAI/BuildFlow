/**
 * BuildFlow — Resource service (master + price history).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { recordAudit } from '../utils/audit';
import { withCache, invalidateCache, invalidatePattern, cacheKeys, hashQuery } from '../utils/cache';
import type {
  CreateResourceInput,
  UpdateResourceInput,
  ResourceQueryInput,
  CreatePriceHistoryInput,
} from '@buildflow/shared';

// Resources change infrequently; cache list for 1 hour per offline-first spec.
const RESOURCE_LIST_TTL = 60 * 60;

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

  // Skip cache for paginated inner pages > 1 to keep memory bounded; cache page 1 only.
  const cacheable = page === 1 && !search;
  const key = cacheKeys.resourcesList(companyId, hashQuery({ type, active }));

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
    return { rows, total, page, limit };
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
  return resource;
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

  return resource;
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

  return updated;
}

export async function deleteResource(
  companyId: string,
  userId: string,
  id: string,
  ipAddress?: string,
) {
  await getResource(companyId, id);
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

export async function getPriceHistory(companyId: string, resourceId: string) {
  await getResource(companyId, resourceId);
  const history = await prisma.materialPriceHistory.findMany({
    where: { resourceId, companyId },
    orderBy: { effectiveDate: 'desc' },
    include: { recordedByUser: { select: { name: true } } },
  });
  return history.map((h) => ({
    id: h.id,
    resourceId: h.resourceId,
    rate: Number(h.rate),
    effectiveDate: h.effectiveDate.toISOString(),
    notes: h.notes,
    recordedBy: h.recordedBy,
    recordedByName: h.recordedByUser.name,
    createdAt: h.createdAt.toISOString(),
  }));
}

export async function addPriceHistory(
  companyId: string,
  userId: string,
  resourceId: string,
  input: CreatePriceHistoryInput,
  ipAddress?: string,
) {
  const resource = await getResource(companyId, resourceId);

  // Archive current rate to price history with new entry
  const entry = await prisma.materialPriceHistory.create({
    data: {
      resourceId,
      companyId,
      rate: input.rate,
      effectiveDate: new Date(input.effectiveDate),
      notes: input.notes ?? null,
      recordedBy: userId,
    },
  });

  // Update master resource rate
  const oldRate = Number(resource.rate);
  await prisma.resource.update({
    where: { id: resourceId },
    data: { rate: input.rate, lastRateUpdatedAt: new Date() },
  });

  // Invalidate caches
  await invalidatePattern(`cache:${companyId}:resources:*`);
  await invalidatePattern(`cache:${companyId}:rate-analysis:*`);

  // Flag dependent rate analyses as stale
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

  await recordAudit({
    companyId,
    userId,
    action: 'UPDATE',
    entityType: 'resource_price',
    entityId: resourceId,
    oldValue: { rate: oldRate },
    newValue: { rate: input.rate },
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
