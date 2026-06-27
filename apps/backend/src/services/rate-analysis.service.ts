/**
 * BuildFlow — Rate Analysis service.
 *
 * Cost-per-unit templates reusable across estimates.
 * Auto-recomputes total when components change.
 * Flagged stale when a referenced resource rate changes.
 */
import { Prisma, CostType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { recordAudit } from '../utils/audit';
import { logger } from '../config/logger';
import { withCache, invalidateCache, invalidatePattern, cacheKeys, hashQuery } from '../utils/cache';
import type {
  CreateRateAnalysisInput,
  UpdateRateAnalysisInput,
  RateAnalysisQueryInput,
  CreateRateAnalysisComponentInput,
} from '@buildflow/shared';

// Rate analyses change rarely; cache list 1 hour per spec.
const RATE_ANALYSIS_TTL = 60 * 60;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function computeComponentAmount(c: {
  quantityPerUnit: number;
  rate: number;
}): number {
  return Number((c.quantityPerUnit * c.rate).toFixed(2));
}

function computeTotal(components: Array<{ amount: number }>): number {
  return Number(components.reduce((s, c) => s + c.amount, 0).toFixed(2));
}

function breakdownByType(components: Array<{ type: CostType; amount: number }>) {
  const bd = { MATERIAL: 0, LABOUR: 0, EQUIPMENT: 0, SUBCONTRACTOR: 0, MISC: 0 };
  for (const c of components) {
    bd[c.type] += c.amount;
  }
  return bd;
}

async function persistComponents(
  rateAnalysisId: string,
  components: CreateRateAnalysisComponentInput[],
): Promise<{ amounts: number[]; total: number }> {
  // Delete old, insert new (full replace)
  await prisma.rateAnalysisComponent.deleteMany({ where: { rateAnalysisId } });

  const data = components.map((c) => {
    const amount = computeComponentAmount(c);
    return {
      rateAnalysisId,
      resourceId: c.resourceId ?? null,
      miscName: c.miscName ?? null,
      quantityPerUnit: c.quantityPerUnit,
      unit: c.unit,
      rate: c.rate,
      amount,
      type: c.type,
    };
  });

  await prisma.rateAnalysisComponent.createMany({ data });
  const amounts = data.map((d) => d.amount);
  return { amounts, total: computeTotal(data.map((d) => ({ amount: d.amount }))) };
}

/* ------------------------------------------------------------------ */
/* List & Get                                                          */
/* ------------------------------------------------------------------ */

async function loadRateAnalysisList(companyId: string, query: RateAnalysisQueryInput) {
  const { page, limit, search, stale } = query;
  const where: Prisma.RateAnalysisWhereInput = { companyId };
  if (stale !== undefined) where.stale = stale === 'true';
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.rateAnalysis.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        components: {
          include: { resource: { select: { name: true } } },
        },
      },
    }),
    prisma.rateAnalysis.count({ where }),
  ]);

  return {
    rows: rows.map((r) => {
      const breakdown = breakdownByType(
        r.components.map((c) => ({ type: c.type, amount: Number(c.amount) })),
      );
      return {
        id: r.id,
        name: r.name,
        unit: r.unit,
        description: r.description,
        totalRate: Number(r.totalRate),
        stale: r.stale,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        breakdown,
        components: r.components.map((c) => ({
          id: c.id,
          resourceId: c.resourceId,
          resourceName: c.resource?.name,
          miscName: c.miscName,
          quantityPerUnit: Number(c.quantityPerUnit),
          unit: c.unit,
          rate: Number(c.rate),
          amount: Number(c.amount),
          type: c.type,
        })),
      };
    }),
    total,
    page,
    limit,
  };
}

export async function listRateAnalyses(companyId: string, query: RateAnalysisQueryInput) {
  // Cache page 1, no search only (most common "library" view)
  const { page, search, stale } = query;
  const cacheable = page === 1 && !search && stale === undefined;
  const key = cacheKeys.rateAnalysisList(companyId, hashQuery({ stale }));

  if (cacheable) {
    return withCache(key, RATE_ANALYSIS_TTL, () => loadRateAnalysisList(companyId, query));
  }
  return loadRateAnalysisList(companyId, query);
}

export async function getRateAnalysis(companyId: string, id: string) {
  const r = await prisma.rateAnalysis.findFirst({
    where: { id, companyId },
    include: {
      components: {
        orderBy: { type: 'asc' },
        include: { resource: { select: { name: true } } },
      },
    },
  });
  if (!r) throw ApiError.notFound('Rate analysis not found');
  return r;
}

/* ------------------------------------------------------------------ */
/* CRUD                                                                */
/* ------------------------------------------------------------------ */

export async function createRateAnalysis(
  companyId: string,
  userId: string,
  input: CreateRateAnalysisInput,
  ipAddress?: string,
) {
  const { total } = await persistComponentsPreview(input.components);

  const r = await prisma.rateAnalysis.create({
    data: {
      companyId,
      name: input.name,
      unit: input.unit,
      description: input.description ?? null,
      totalRate: total,
      stale: false,
    },
  });

  await persistComponents(r.id, input.components);

  await invalidatePattern(`cache:${companyId}:rate-analysis:*`);

  await recordAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'rate_analysis',
    entityId: r.id,
    newValue: { name: r.name, totalRate: total },
    ipAddress,
  });

  return getRateAnalysis(companyId, r.id);
}

export async function updateRateAnalysis(
  companyId: string,
  userId: string,
  id: string,
  input: UpdateRateAnalysisInput,
  ipAddress?: string,
) {
  const existing = await getRateAnalysis(companyId, id);

  // Update metadata
  if (input.name || input.unit || input.description !== undefined) {
    await prisma.rateAnalysis.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.unit && { unit: input.unit }),
        ...(input.description !== undefined && { description: input.description }),
      },
    });
  }

  // Update components (full replace)
  let total = Number(existing.totalRate);
  if (input.components) {
    const result = await persistComponents(id, input.components);
    total = result.total;
    await prisma.rateAnalysis.update({ where: { id }, data: { totalRate: total, stale: false } });
  }

  await invalidatePattern(`cache:${companyId}:rate-analysis:*`);
  await invalidateCache(cacheKeys.rateAnalysis(companyId, id));

  await recordAudit({
    companyId,
    userId,
    action: 'UPDATE',
    entityType: 'rate_analysis',
    entityId: id,
    oldValue: { name: existing.name, totalRate: Number(existing.totalRate) },
    newValue: { totalRate: total },
    ipAddress,
  });

  return getRateAnalysis(companyId, id);
}

export async function deleteRateAnalysis(
  companyId: string,
  userId: string,
  id: string,
  ipAddress?: string,
) {
  await getRateAnalysis(companyId, id);
  await prisma.rateAnalysis.delete({ where: { id } });
  await invalidatePattern(`cache:${companyId}:rate-analysis:*`);
  await invalidateCache(cacheKeys.rateAnalysis(companyId, id));
  await recordAudit({
    companyId,
    userId,
    action: 'DELETE',
    entityType: 'rate_analysis',
    entityId: id,
    ipAddress,
  });
}

export async function duplicateRateAnalysis(
  companyId: string,
  userId: string,
  id: string,
  ipAddress?: string,
) {
  const source = await getRateAnalysis(companyId, id);
  const dup = await prisma.rateAnalysis.create({
    data: {
      companyId,
      name: `${source.name} (Copy)`,
      unit: source.unit,
      description: source.description,
      totalRate: source.totalRate,
      stale: source.stale,
    },
  });
  // Copy components
  const compData = source.components.map((c) => ({
    rateAnalysisId: dup.id,
    resourceId: c.resourceId,
    miscName: c.miscName,
    quantityPerUnit: c.quantityPerUnit,
    unit: c.unit,
    rate: c.rate,
    amount: c.amount,
    type: c.type,
  }));
  await prisma.rateAnalysisComponent.createMany({ data: compData });

  await invalidatePattern(`cache:${companyId}:rate-analysis:*`);

  await recordAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'rate_analysis',
    entityId: dup.id,
    newValue: { duplicatedFrom: id },
    ipAddress,
  });

  return getRateAnalysis(companyId, dup.id);
}

/* ------------------------------------------------------------------ */
/* Auto-recompute on resource rate change                              */
/* ------------------------------------------------------------------ */

/**
 * Recompute all rate analyses flagged stale.
 * Called by Bull queue or directly after resource rate update.
 */
export async function recomputeStaleRateAnalyses(companyId: string): Promise<number> {
  const stale = await prisma.rateAnalysis.findMany({
    where: { companyId, stale: true },
    include: { components: true },
  });

  let count = 0;
  for (const ra of stale) {
    // Re-fetch resource rates for each component
    const componentIds = ra.components.map((c) => c.id);
    const updated: number[] = [];

    for (const comp of ra.components) {
      if (comp.resourceId) {
        const res = await prisma.resource.findUnique({ where: { id: comp.resourceId } });
        if (res) {
          const newAmount = Number((Number(comp.quantityPerUnit) * Number(res.rate)).toFixed(2));
          await prisma.rateAnalysisComponent.update({
            where: { id: comp.id },
            data: { rate: res.rate, amount: newAmount },
          });
          updated.push(newAmount);
          continue;
        }
      }
      updated.push(Number(comp.amount));
    }

    const total = Number(updated.reduce((s, a) => s + a, 0).toFixed(2));
    await prisma.rateAnalysis.update({
      where: { id: ra.id },
      data: { totalRate: total, stale: false },
    });
    count++;
    void componentIds; // for logging
  }

  if (count > 0) {
    logger.info('Recomputed stale rate analyses', { companyId, count });
    await invalidatePattern(`cache:${companyId}:rate-analysis:*`);
  }
  return count;
}

/* ------------------------------------------------------------------ */
/* Internal helpers                                                    */
/* ------------------------------------------------------------------ */

function persistComponentsPreview(components: CreateRateAnalysisComponentInput[]) {
  const amounts = components.map((c) => computeComponentAmount(c));
  return Promise.resolve({ amounts, total: computeTotal(amounts.map((amount) => ({ amount }))) });
}