/**
 * Shop unit-of-measure catalog + multi-unit helpers (IM).
 */
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import {
  DEFAULT_SHOP_UNITS,
  normalizeUnitName,
  toBaseQty,
  resolveSellRate,
  type BuyerRoleForRate,
  type CompanyUnitCreateInput,
  type CompanyUnitUpdateInput,
  type ResourceUnitInput,
} from '@buildflow/shared';

export async function getMultiUnitEnabled(companyId: string): Promise<boolean> {
  const c = await prisma.company.findUnique({
    where: { id: companyId },
    select: { multiUnitEnabled: true, subscriptionPlan: true },
  });
  if (!c || c.subscriptionPlan !== 'INVENTORY') return false;
  return Boolean(c.multiUnitEnabled);
}

export async function assertMultiUnitEnabled(companyId: string): Promise<void> {
  const on = await getMultiUnitEnabled(companyId);
  if (!on) {
    throw ApiError.unprocessable(
      'Multi-unit is off. Enable it in Inventory Settings to use alternate units.',
    );
  }
}

/** Seed default shop units when the catalog is empty. */
export async function ensureDefaultCompanyUnits(companyId: string) {
  const count = await prisma.companyUnit.count({ where: { companyId } });
  if (count > 0) return;
  const now = new Date();
  await prisma.companyUnit.createMany({
    data: DEFAULT_SHOP_UNITS.map((name) => ({
      companyId,
      name,
      isActive: true,
      updatedAt: now,
    })),
    skipDuplicates: true,
  });
}

export async function listCompanyUnits(companyId: string, opts?: { includeInactive?: boolean }) {
  await ensureDefaultCompanyUnits(companyId);
  return prisma.companyUnit.findMany({
    where: {
      companyId,
      ...(opts?.includeInactive ? {} : { isActive: true }),
    },
    orderBy: { name: 'asc' },
  });
}

export async function createCompanyUnit(companyId: string, input: CompanyUnitCreateInput) {
  await ensureDefaultCompanyUnits(companyId);
  const name = normalizeUnitName(input.name);
  if (!name) throw ApiError.badRequest('Unit name is required');
  const existing = await prisma.companyUnit.findFirst({
    where: { companyId, name },
  });
  if (existing) {
    if (!existing.isActive) {
      return prisma.companyUnit.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          symbol: input.symbol === undefined ? existing.symbol : input.symbol,
        },
      });
    }
    throw ApiError.conflict(`Unit "${name}" already exists`);
  }
  return prisma.companyUnit.create({
    data: {
      companyId,
      name,
      symbol: input.symbol ?? null,
    },
  });
}

export async function updateCompanyUnit(
  companyId: string,
  id: string,
  input: CompanyUnitUpdateInput,
) {
  const row = await prisma.companyUnit.findFirst({ where: { id, companyId } });
  if (!row) throw ApiError.notFound('Unit not found');

  if (input.isActive === false) {
    const inUse = await prisma.resourceUnit.count({ where: { companyUnitId: id } });
    if (inUse > 0) {
      throw ApiError.unprocessable(
        `Cannot deactivate "${row.name}" — it is used on ${inUse} item(s).`,
      );
    }
  }

  let nextName = row.name;
  if (input.name !== undefined) {
    nextName = normalizeUnitName(input.name);
    if (!nextName) throw ApiError.badRequest('Unit name is required');
    if (nextName !== row.name) {
      const clash = await prisma.companyUnit.findFirst({
        where: { companyId, name: nextName, NOT: { id } },
      });
      if (clash) throw ApiError.conflict(`Unit "${nextName}" already exists`);
    }
  }

  const updated = await prisma.companyUnit.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: nextName }),
      ...(input.symbol !== undefined && { symbol: input.symbol }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  });

  if (input.name !== undefined && nextName !== row.name) {
    await prisma.resourceUnit.updateMany({
      where: { companyUnitId: id },
      data: { unitName: nextName },
    });
    await prisma.resource.updateMany({
      where: { companyId, unit: row.name },
      data: { unit: nextName },
    });
  }

  return updated;
}

export async function deactivateCompanyUnit(companyId: string, id: string) {
  return updateCompanyUnit(companyId, id, { isActive: false });
}

function serializeUnitRows(
  rows: Array<{
    id: string;
    companyUnitId: string;
    unitName: string;
    isBase: boolean;
    conversionToBase: { toNumber?: () => number } | number | string;
    rate: { toNumber?: () => number } | number | string | null;
    distributorRate: { toNumber?: () => number } | number | string | null;
    customerRate: { toNumber?: () => number } | number | string | null;
  }>,
) {
  const num = (v: { toNumber?: () => number } | number | string | null | undefined) => {
    if (v == null) return null;
    if (typeof v === 'object' && typeof v.toNumber === 'function') return v.toNumber();
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return rows.map((r) => ({
    id: r.id,
    companyUnitId: r.companyUnitId,
    unitName: r.unitName,
    isBase: r.isBase,
    conversionToBase: num(r.conversionToBase) ?? 1,
    rate: num(r.rate),
    distributorRate: num(r.distributorRate),
    customerRate: num(r.customerRate),
  }));
}

export async function loadResourceUnits(resourceId: string) {
  const rows = await prisma.resourceUnit.findMany({
    where: { resourceId },
    orderBy: [{ isBase: 'desc' }, { unitName: 'asc' }],
  });
  return serializeUnitRows(rows);
}

/**
 * Ensure company unit exists (create if needed) and return it.
 */
export async function ensureCompanyUnit(companyId: string, rawName: string) {
  const name = normalizeUnitName(rawName);
  if (!name) throw ApiError.badRequest('Unit name is required');
  const existing = await prisma.companyUnit.findFirst({ where: { companyId, name } });
  if (existing) {
    if (!existing.isActive) {
      return prisma.companyUnit.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
    }
    return existing;
  }
  return prisma.companyUnit.create({
    data: { companyId, name, isActive: true },
  });
}

/**
 * Replace resource unit rows. Requires exactly one base when `units` is provided.
 * When multi-unit is off, only the base row is kept.
 */
export async function syncResourceUnits(
  companyId: string,
  resourceId: string,
  units: ResourceUnitInput[] | undefined,
  fallbackBaseUnit: string,
) {
  const multiOn = await getMultiUnitEnabled(companyId);

  // No explicit units payload: ensure a base row exists / matches fallbackBaseUnit; keep alts.
  if (units === undefined) {
    const baseName = normalizeUnitName(fallbackBaseUnit) || 'nos';
    const cu = await ensureCompanyUnit(companyId, baseName);
    const existing = await prisma.resourceUnit.findMany({ where: { resourceId } });
    const currentBase = existing.find((r) => r.isBase);
    if (!currentBase) {
      await prisma.resourceUnit.create({
        data: {
          resourceId,
          companyUnitId: cu.id,
          unitName: cu.name,
          isBase: true,
          conversionToBase: 1,
        },
      });
    } else if (currentBase.companyUnitId !== cu.id) {
      // Re-point base; drop alt that would collide with new base unit.
      await prisma.resourceUnit.deleteMany({
        where: { resourceId, companyUnitId: cu.id, isBase: false },
      });
      await prisma.resourceUnit.update({
        where: { id: currentBase.id },
        data: { companyUnitId: cu.id, unitName: cu.name, conversionToBase: 1 },
      });
    }
    await prisma.resource.update({
      where: { id: resourceId },
      data: { unit: cu.name },
    });
    return loadResourceUnits(resourceId);
  }

  if (units.length === 0) {
    const baseName = normalizeUnitName(fallbackBaseUnit) || 'nos';
    const cu = await ensureCompanyUnit(companyId, baseName);
    await prisma.resourceUnit.deleteMany({ where: { resourceId } });
    await prisma.resourceUnit.create({
      data: {
        resourceId,
        companyUnitId: cu.id,
        unitName: cu.name,
        isBase: true,
        conversionToBase: 1,
      },
    });
    await prisma.resource.update({
      where: { id: resourceId },
      data: { unit: cu.name, secondaryUnit: null, conversionFactor: 1 },
    });
    return loadResourceUnits(resourceId);
  }

  const bases = units.filter((u) => u.isBase);
  if (bases.length !== 1) {
    throw ApiError.unprocessable('Exactly one base unit is required');
  }

  const resolved: Array<{
    companyUnitId: string;
    unitName: string;
    isBase: boolean;
    conversionToBase: number;
    rate: number | null;
    distributorRate: number | null;
    customerRate: number | null;
  }> = [];

  for (const u of units) {
    if (!u.isBase && !multiOn) {
      throw ApiError.unprocessable(
        'Multi-unit is off. Enable it in Settings to add alternate units.',
      );
    }
    const factor = u.isBase ? 1 : Number(u.conversionToBase) || 1;
    if (!(factor > 0)) throw ApiError.unprocessable('Conversion factor must be positive');

    let cu;
    if (u.companyUnitId) {
      cu = await prisma.companyUnit.findFirst({
        where: { id: u.companyUnitId, companyId, isActive: true },
      });
      if (!cu) throw ApiError.notFound(`Unit not found: ${u.companyUnitId}`);
    } else {
      cu = await ensureCompanyUnit(companyId, u.unitName || '');
    }

    resolved.push({
      companyUnitId: cu.id,
      unitName: cu.name,
      isBase: u.isBase,
      conversionToBase: factor,
      rate: u.rate === undefined ? null : u.rate,
      distributorRate: u.distributorRate === undefined ? null : u.distributorRate,
      customerRate: u.customerRate === undefined ? null : u.customerRate,
    });
  }

  const names = new Set(resolved.map((r) => r.unitName));
  if (names.size !== resolved.length) {
    throw ApiError.unprocessable('Duplicate units on the same item are not allowed');
  }

  const base = resolved.find((r) => r.isBase)!;

  await prisma.$transaction(async (tx) => {
    await tx.resourceUnit.deleteMany({ where: { resourceId } });
    for (const r of resolved) {
      await tx.resourceUnit.create({
        data: {
          resourceId,
          companyUnitId: r.companyUnitId,
          unitName: r.unitName,
          isBase: r.isBase,
          conversionToBase: r.conversionToBase,
          rate: r.rate,
          distributorRate: r.distributorRate,
          customerRate: r.customerRate,
        },
      });
    }
    await tx.resource.update({
      where: { id: resourceId },
      data: {
        unit: base.unitName,
        // Keep legacy secondary fields in sync with first alternate (read fallback).
        secondaryUnit: resolved.find((r) => !r.isBase)?.unitName ?? null,
        conversionFactor: resolved.find((r) => !r.isBase)?.conversionToBase ?? 1,
      },
    });
  });

  return loadResourceUnits(resourceId);
}

export type ResourceWithUnits = {
  id: string;
  unit: string;
  rate: number;
  distributorRate?: number | null;
  customerRate?: number | null;
  units: Array<{
    unitName: string;
    isBase: boolean;
    conversionToBase: number;
    rate: number | null;
    distributorRate: number | null;
    customerRate: number | null;
  }>;
};

/**
 * Resolve factor for a transaction unit. Rejects unknown units when multi-unit is on.
 */
export async function resolveUnitConversion(
  companyId: string,
  resourceId: string,
  unitName: string | null | undefined,
): Promise<{ factor: number; unitName: string; baseUnit: string }> {
  const resource = await prisma.resource.findFirst({
    where: { id: resourceId, companyId, isDeleted: false },
    include: { resourceUnits: true },
  });
  if (!resource) throw ApiError.notFound('Resource not found');

  const multiOn = await getMultiUnitEnabled(companyId);
  const requested = normalizeUnitName(unitName || resource.unit);
  const baseUnit = normalizeUnitName(resource.unit);

  // Feature off: stock always moves in base qty; ignore mismatched line labels.
  if (!multiOn) {
    return { factor: 1, unitName: baseUnit, baseUnit };
  }

  const units = resource.resourceUnits;
  if (units.length === 0) {
    if (requested === baseUnit) return { factor: 1, unitName: baseUnit, baseUnit };
    throw ApiError.unprocessable(`Unit "${requested}" is not configured for this item`);
  }

  const row = units.find((u) => normalizeUnitName(u.unitName) === requested);
  if (!row) {
    throw ApiError.unprocessable(`Unit "${requested}" is not configured for this item`);
  }
  return {
    factor: Number(row.conversionToBase) || 1,
    unitName: normalizeUnitName(row.unitName),
    baseUnit,
  };
}

export async function toBaseQuantity(
  companyId: string,
  resourceId: string,
  qty: number,
  unitName: string | null | undefined,
): Promise<number> {
  const { factor } = await resolveUnitConversion(companyId, resourceId, unitName);
  return toBaseQty(qty, factor);
}

/** Preload conversion factors for a batch of lines (resourceId + unit). */
export async function loadUnitFactors(
  companyId: string,
  lines: Array<{ resourceId: string; unit?: string | null }>,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (const l of lines) {
    const key = `${l.resourceId}::${normalizeUnitName(l.unit || '')}`;
    if (map.has(key)) continue;
    const { factor } = await resolveUnitConversion(companyId, l.resourceId, l.unit);
    map.set(key, factor);
  }
  return map;
}

export function unitFactorKey(resourceId: string, unit?: string | null): string {
  return `${resourceId}::${normalizeUnitName(unit || '')}`;
}

export { resolveSellRate, toBaseQty, type BuyerRoleForRate };
