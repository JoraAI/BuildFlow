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
  BulkUpsertResourcesInput,
  BulkPriceUpdateInput,
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
  // FIX (EST-H7): Write a MaterialPriceHistory row when rate changes so
  // syncEffectiveResourceRate doesn't silently revert manual edits.
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

  // FIX (EST-H7): Record the new rate in price history.
  if (rateChanged) {
    await prisma.materialPriceHistory.create({
      data: {
        resourceId: id,
        companyId,
        rate: input.rate!,
        effectiveDate: new Date(),
        notes: 'Rate updated via resource edit',
        recordedBy: userId,
      },
    });

    // Flag dependent rate analyses as stale
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

  // INVENTORY_UX_POLISH (§1.3): keep soft-delete available for historical usage.
  // Blocks only what would truly orphan/strand data:
  //   - rate-analysis components & estimate lines (live costing references)
  //   - non-zero on-hand stock
  //   - lines on OPEN indents (DRAFT/SUBMITTED, or APPROVED with zero POs,
  //     i.e. still eligible for a new PO). APPROVED indents that already have a
  //     PO are historical and do NOT block. Historical PO lines never block:
  //     FKs stay valid under soft-delete, so once stock is zero and no open
  //     indent lines remain, the material may be soft-deleted.
  const [rateAnalysisRefs, estimateItemRefs, openIndentLines, stockBalances] = await Promise.all([
    prisma.rateAnalysisComponent.count({ where: { resourceId: id } }),
    prisma.estimateItem.count({ where: { resourceId: id } }),
    prisma.materialRequisitionLine.count({
      where: {
        resourceId: id,
        OR: [
          // Open in the approval workflow.
          { requisition: { status: { in: ['DRAFT', 'SUBMITTED'] } } },
          // Approved but still eligible for New PO (zero POs) = still "open".
          { requisition: { status: 'APPROVED', purchaseOrders: { none: {} } } },
        ],
      },
    }),
    // Non-zero on-hand stock cannot be deleted - it would orphan the balance.
    prisma.stockBalance.count({
      where: { resourceId: id, quantity: { gt: 0 } },
    }),
  ]);

  if (rateAnalysisRefs > 0 || estimateItemRefs > 0 || openIndentLines > 0 || stockBalances > 0) {
    const parts: string[] = [];
    if (rateAnalysisRefs > 0) parts.push(`${rateAnalysisRefs} rate analysis component(s)`);
    if (estimateItemRefs > 0) parts.push(`${estimateItemRefs} estimate line item(s)`);
    if (openIndentLines > 0) parts.push(`${openIndentLines} open indent line(s)`);
    if (stockBalances > 0) parts.push(`on-hand stock (${stockBalances} item(s))`);
    throw ApiError.conflict(
      `Cannot delete this material - it is used in ${parts.join(' and ')}. Receive/use it first, then try again.`,
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

/* ------------------------------------------------------------------ */
/* Bulk Upsert & Bulk Price Update                                     */
/* ------------------------------------------------------------------ */

/**
 * Bulk upsert resources by (companyId, name, type).
 * - Existing matches are updated (rate + all provided fields).
 * - Non-matches are created (and seeded with an initial price history row).
 * - Returns { created, updated, unchanged } counts + ids.
 */
export async function bulkUpsertResources(
  companyId: string,
  userId: string,
  rows: BulkUpsertResourcesInput['resources'],
  ipAddress?: string,
) {
  const created: string[] = [];
  const updated: string[] = [];
  const unchanged: string[] = [];

  for (const row of rows) {
    const existing = await prisma.resource.findFirst({
      where: { companyId, name: row.name, type: row.type, isDeleted: false },
    });

    if (existing) {
      const rateChanged = row.rate !== Number(existing.rate);
      await prisma.resource.update({
        where: { id: existing.id },
        data: {
          name: row.name,
          type: row.type,
          unit: row.unit,
          rate: row.rate,
          gstRate: row.gstRate ?? Number(existing.gstRate),
          hsnSacCode: row.hsnSacCode ?? existing.hsnSacCode,
          brandOrSpec: row.brandOrSpec ?? existing.brandOrSpec,
          category: row.category ?? existing.category,
          imageUrl: row.imageUrl ?? existing.imageUrl,
          ...(rateChanged && { lastRateUpdatedAt: new Date() }),
        },
      });
      if (rateChanged) {
        // FIX (EST-H7): Write a MaterialPriceHistory row on rate change here too
        // (matching createResource / updateResource). Without this, opening the
        // price-history screen overwrites the bulk-updated rate with the latest
        // history rate via syncEffectiveResourceRate.
        await prisma.materialPriceHistory.create({
          data: {
            resourceId: existing.id,
            companyId,
            rate: row.rate,
            effectiveDate: new Date(),
            notes: 'Bulk upsert — rate updated',
            recordedBy: userId,
          },
        });
        await flagStaleRateAnalyses(existing.id);
        updated.push(existing.id);
      } else {
        unchanged.push(existing.id);
      }
    } else {
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
      await prisma.materialPriceHistory.create({
        data: {
          resourceId: resource.id,
          companyId,
          rate: resource.rate,
          effectiveDate: new Date(),
          notes: 'Bulk upsert — initial rate',
          recordedBy: userId,
        },
      });
      created.push(resource.id);
    }
  }

  await invalidatePattern(`cache:${companyId}:resources:*`);
  await invalidatePattern(`cache:${companyId}:rate-analysis:*`);

  await recordAudit({
    companyId,
    userId,
    action: 'CUSTOM',
    entityType: 'resource_batch_upsert',
    entityId: companyId,
    newValue: { created: created.length, updated: updated.length, unchanged: unchanged.length },
    ipAddress,
  });

  return {
    created: created.length,
    updated: updated.length,
    unchanged: unchanged.length,
    createdIds: created,
    updatedIds: updated,
  };
}

/**
 * Bulk price update for resources (by id). Each change logs a
 * MaterialPriceHistory row and flags dependent rate analyses as stale.
 * `mode` = 'absolute' sets the new rate directly; 'percent' applies a relative
 * change (value may be negative for discounts).
 */
export async function bulkPriceUpdate(
  companyId: string,
  userId: string,
  input: BulkPriceUpdateInput,
  ipAddress?: string,
) {
  const effectiveDate = parseDateOnlyToDate(input.effectiveDate);
  const effectiveDateOnly = input.effectiveDate;
  const today = todayDateOnly();
  const isImmediate = compareDateOnly(effectiveDateOnly, today) <= 0;

  // Load all target resources in one shot.
  const ids = input.items.map((i: BulkPriceUpdateInput['items'][number]) => i.resourceId);
  const resources = await prisma.resource.findMany({
    where: { id: { in: ids }, companyId, isDeleted: false },
    select: { id: true, name: true, rate: true },
  });
  const byId = new Map(resources.map((r) => [r.id, r]));

  const applied: Array<{ resourceId: string; name: string; oldRate: number; newRate: number }> = [];
  const notFound: string[] = [];

  for (const item of input.items) {
    const resource = byId.get(item.resourceId);
    if (!resource) {
      notFound.push(item.resourceId);
      continue;
    }
    const oldRate = Number(resource.rate);
    const newRate =
      input.mode === 'percent'
        ? round2(oldRate * (1 + item.value / 100))
        : round2(item.value);

    if (newRate < 0) {
      throw ApiError.validation([
        {
          field: 'value',
          message: `Rate for "${resource.name}" would become negative (${newRate})`,
        },
      ]);
    }
    if (newRate === oldRate) continue; // no-op

    await prisma.materialPriceHistory.create({
      data: {
        resourceId: resource.id,
        companyId,
        rate: newRate,
        effectiveDate,
        notes: input.notes ?? `Bulk price update (${input.mode})`,
        recordedBy: userId,
      },
    });

    if (isImmediate) {
      await prisma.resource.update({
        where: { id: resource.id },
        data: { rate: newRate, lastRateUpdatedAt: effectiveDate },
      });
      await flagStaleRateAnalyses(resource.id);
    }
    applied.push({ resourceId: resource.id, name: resource.name, oldRate, newRate });
  }

  await invalidatePattern(`cache:${companyId}:resources:*`);
  if (isImmediate) {
    await invalidatePattern(`cache:${companyId}:rate-analysis:*`);
  }

  await recordAudit({
    companyId,
    userId,
    action: 'UPDATE',
    entityType: 'resource_price_batch',
    entityId: companyId,
    newValue: {
      mode: input.mode,
      count: applied.length,
      changes: applied.map((a) => ({
        resourceId: a.resourceId,
        name: a.name,
        oldRate: a.oldRate,
        newRate: a.newRate,
      })),
      ...(notFound.length > 0 ? { notFound } : {}),
    },
    ipAddress,
  });

  return {
    applied: applied.length,
    scheduled: isImmediate ? 0 : applied.length,
    notFound,
    changes: applied,
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
