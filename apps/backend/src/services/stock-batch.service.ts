/**
 * BuildFlow - Stock batch / expiry / FEFO service
 * (INVENTORY_KIRANA_RETAIL_WHOLESALE Phase 11.2, K6).
 *
 * Dual-write model: the aggregate `StockBalance` remains the single analytics
 * + construction-compatibility key. For `Resource.trackingMode === BATCH_EXPIRY`
 * items we ALSO maintain per-lot `StockBatchBalance` rows (batchCode + mfg/expiry
 * + qty). All IN flows call `applyBatchIn`, all OUT flows call `allocateBatchOut`
 * (FEFO: earliest expiry first, expired lots blocked unless `allowExpired`).
 *
 * Everything here is a no-op / never invoked for untracked (construction,
 * non-Kirana) items - those keep the pre-11.2 aggregate-only behaviour.
 */
import { Prisma } from '@prisma/client';
import { ApiError } from '../utils/errors';
import { prisma } from '../lib/prisma';
import { getDefaultProjectId } from './module-gate.service';

export type BatchTx = Prisma.TransactionClient;

const EPS = 1e-9;

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Is this item lot-tracked? (NONE → aggregate only, construction-safe.) */
export function isBatchTracked(trackingMode: string | null | undefined): boolean {
  return trackingMode === 'BATCH_EXPIRY';
}

export interface BatchInInput {
  locationId: string;
  resourceId: string;
  batchCode: string;
  quantity: number;
  manufacturedAt?: Date | null;
  expiresAt?: Date | null;
}

export interface BatchAllocation {
  batchCode: string;
  quantity: number;
  expiresAt: Date | null;
}

/**
 * IN (dual-write): upsert / increment a lot row. First receipt of a batchCode
 * wins for dates (later receipts of the same lot just add qty). The caller
 * still updates the aggregate StockBalance separately.
 */
export async function applyBatchIn(
  tx: BatchTx,
  input: BatchInInput,
): Promise<void> {
  const existing = await tx.stockBatchBalance.findUnique({
    where: {
      locationId_resourceId_batchCode: {
        locationId: input.locationId,
        resourceId: input.resourceId,
        batchCode: input.batchCode,
      },
    },
  });
  if (existing) {
    await tx.stockBatchBalance.update({
      where: { id: existing.id },
      data: { quantity: { increment: input.quantity } },
    });
  } else {
    await tx.stockBatchBalance.create({
      data: {
        locationId: input.locationId,
        resourceId: input.resourceId,
        batchCode: input.batchCode,
        manufacturedAt: input.manufacturedAt ?? null,
        expiresAt: input.expiresAt ?? null,
        quantity: input.quantity,
      },
    });
  }
}

/**
 * OUT (FEFO): allocate `quantity` from the earliest-expiring lots first.
 *
 * - Fresh (non-expired or no expiry) lots are always used first, oldest expiry
 *   first (nulls last), then receivedAt / batchCode for stability.
 * - Expired lots (`expiresAt <= now`) are ONLY touched when `allowExpired` is
 *   set (authorized override) - otherwise selling expired stock is rejected.
 * - Decrements the lot rows and returns the allocations so the caller can emit
 *   one OUT movement per lot (batchCode recorded on each movement).
 */
export async function allocateBatchOut(
  tx: BatchTx,
  input: {
    locationId: string;
    resourceId: string;
    resourceName: string;
    unit: string;
    quantity: number;
    allowExpired?: boolean;
  },
): Promise<BatchAllocation[]> {
  const now = new Date();
  const lots = await tx.stockBatchBalance.findMany({
    where: {
      locationId: input.locationId,
      resourceId: input.resourceId,
      quantity: { gt: 0 },
    },
    orderBy: [{ expiresAt: 'asc' }, { receivedAt: 'asc' }, { batchCode: 'asc' }],
  });

  const expired = lots.filter((l) => l.expiresAt && l.expiresAt <= now);
  const fresh = lots.filter((l) => !l.expiresAt || l.expiresAt > now);
  const candidates = input.allowExpired ? [...fresh, ...expired] : fresh;

  const totalUsable = candidates.reduce((s, l) => s + Number(l.quantity), 0);
  if (totalUsable + EPS < input.quantity) {
    const expiredQty = round3(expired.reduce((s, l) => s + Number(l.quantity), 0));
    const msg =
      expiredQty > 0
        ? `${input.resourceName}: only ${round3(totalUsable)} ${input.unit} available in non-expired lots (${expiredQty} ${input.unit} expired). Tick "Include expired" to sell it.`
        : `${input.resourceName}: only ${round3(totalUsable)} ${input.unit} available in tracked lots, requested ${round3(input.quantity)} ${input.unit}.`;
    throw ApiError.unprocessable(msg);
  }

  const allocations: BatchAllocation[] = [];
  let remaining = input.quantity;
  for (const lot of candidates) {
    if (remaining <= EPS) break;
    const lotQty = Number(lot.quantity);
    const take = round3(Math.min(lotQty, remaining));
    allocations.push({ batchCode: lot.batchCode, quantity: take, expiresAt: lot.expiresAt });
    await tx.stockBatchBalance.update({
      where: { id: lot.id },
      data: { quantity: { decrement: take } },
    });
    remaining -= take;
  }
  return allocations;
}

// ---------------------------------------------------------------------------
// Expiry buckets (11.2.8) - shared by the item detail + expiry summary API.
// ---------------------------------------------------------------------------

export type ExpiryBucket = 'EXPIRED' | '0_30' | '31_60' | '61_90' | 'OVER_90';

export const EXPIRY_BUCKET_LABELS: Record<ExpiryBucket, string> = {
  EXPIRED: 'Expired',
  '0_30': '0–30 days',
  '31_60': '31–60 days',
  '61_90': '61–90 days',
  OVER_90: '> 90 days',
};

/** null = no expiry date on the lot (not bucketable). */
export function expiryBucket(expiresAt: Date | null, now: Date = new Date()): ExpiryBucket | null {
  if (!expiresAt) return null;
  const ms = expiresAt.getTime() - now.getTime();
  const days = Math.ceil(ms / 86_400_000);
  if (days < 0) return 'EXPIRED';
  if (days <= 30) return '0_30';
  if (days <= 60) return '31_60';
  if (days <= 90) return '61_90';
  return 'OVER_90';
}

// ---------------------------------------------------------------------------
// Read surfaces (11.2.8): per-item batch list + expiry buckets. Both scope to
// the company's stock locations (inventory = the default STORE project).
// ---------------------------------------------------------------------------

export interface ResourceBatchRow {
  id: string;
  locationId: string;
  locationName: string;
  batchCode: string;
  manufacturedAt: Date | null;
  expiresAt: Date | null;
  quantity: number;
  receivedAt: Date;
  daysToExpiry: number | null;
  bucket: ExpiryBucket | null;
}

async function scopeLocations(companyId: string) {
  const projectId = await getDefaultProjectId(companyId);
  const locationWhere: { companyId: string; projectId?: string } = { companyId };
  if (projectId) locationWhere.projectId = projectId;
  return locationWhere;
}

/** Batch rows for one item (tracked or not - empty for untracked items). */
export async function listResourceBatches(
  companyId: string,
  resourceId: string,
  locationId?: string,
): Promise<ResourceBatchRow[]> {
  const locationWhere = await scopeLocations(companyId);
  const rows = await prisma.stockBatchBalance.findMany({
    where: {
      resourceId,
      location: {
        ...locationWhere,
        ...(locationId ? { id: locationId } : {}),
      },
    },
    include: { location: { select: { id: true, name: true } } },
    orderBy: [{ expiresAt: 'asc' }, { batchCode: 'asc' }],
  });
  const now = new Date();
  return rows.map((r) => {
    const daysToExpiry = r.expiresAt
      ? Math.ceil((r.expiresAt.getTime() - now.getTime()) / 86_400_000)
      : null;
    return {
      id: r.id,
      locationId: r.locationId,
      locationName: r.location.name,
      batchCode: r.batchCode,
      manufacturedAt: r.manufacturedAt,
      expiresAt: r.expiresAt,
      quantity: Number(r.quantity),
      receivedAt: r.receivedAt,
      daysToExpiry,
      bucket: expiryBucket(r.expiresAt, now),
    };
  });
}

/** Correct optional manufacture/expiry metadata without altering lot quantity. */
export async function updateBatchMetadata(
  companyId: string,
  batchId: string,
  input: { manufacturedAt?: Date | null; expiresAt?: Date | null },
) {
  const locationWhere = await scopeLocations(companyId);
  const existing = await prisma.stockBatchBalance.findFirst({
    where: { id: batchId, location: locationWhere },
  });
  if (!existing) throw ApiError.notFound('Stock batch not found');
  const manufacturedAt =
    input.manufacturedAt === undefined ? existing.manufacturedAt : input.manufacturedAt;
  const expiresAt = input.expiresAt === undefined ? existing.expiresAt : input.expiresAt;
  if (manufacturedAt && expiresAt && expiresAt < manufacturedAt) {
    throw ApiError.unprocessable('Expiry date must be on or after manufacture date.');
  }
  return prisma.stockBatchBalance.update({
    where: { id: batchId },
    data: {
      ...(input.manufacturedAt !== undefined && { manufacturedAt: input.manufacturedAt }),
      ...(input.expiresAt !== undefined && { expiresAt: input.expiresAt }),
    },
  });
}

export interface ExpiryBucketSummary {
  EXPIRED: number;
  '0_30': number;
  '31_60': number;
  '61_90': number;
  OVER_90: number;
  totalTrackedLots: number;
  // INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.4): WAC values for the stock
  // home KPIs - expired stock value (danger) + expiring-soon value (0–30 days).
  EXPIRED_VALUE: number;
  '0_30_VALUE': number;
}

/** Quantity + WAC value totals per expiry bucket across tracked lots in scope. */
export async function expirySummary(
  companyId: string,
): Promise<ExpiryBucketSummary> {
  const locationWhere = await scopeLocations(companyId);
  const rows = await prisma.stockBatchBalance.findMany({
    where: { location: locationWhere, quantity: { gt: 0 } },
    include: { resource: { select: { avgCost: true } } },
  });
  const summary: ExpiryBucketSummary = {
    EXPIRED: 0,
    '0_30': 0,
    '31_60': 0,
    '61_90': 0,
    OVER_90: 0,
    totalTrackedLots: rows.length,
    EXPIRED_VALUE: 0,
    '0_30_VALUE': 0,
  };
  const now = new Date();
  for (const r of rows) {
    const bucket = expiryBucket(r.expiresAt, now);
    if (bucket) {
      const qty = Number(r.quantity);
      const value = qty * Number(r.resource.avgCost ?? 0);
      summary[bucket] += qty;
      if (bucket === 'EXPIRED') summary.EXPIRED_VALUE += value;
      if (bucket === '0_30') summary['0_30_VALUE'] += value;
    }
  }
  summary.EXPIRED_VALUE = round2(summary.EXPIRED_VALUE);
  summary['0_30_VALUE'] = round2(summary['0_30_VALUE']);
  return summary;
}
