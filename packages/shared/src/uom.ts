/**
 * Multi-unit UOM helpers (IM). Stock qty is always in the item base unit;
 * rates are per selected transaction unit with role-aware fallbacks.
 * Blank alternate-unit prices scale as baseAmount × conversionToBase.
 */

export const DEFAULT_SHOP_UNITS = ['nos', 'kg', 'bag', 'ltr', 'box', 'mt', 'sqm', 'cum'] as const;

export function normalizeUnitName(name: string): string {
  return name.trim().toLowerCase();
}

export function toBaseQty(qty: number, conversionToBase: number): number {
  const q = Number(qty) || 0;
  const f = Number(conversionToBase) || 1;
  return Math.round(q * f * 1000) / 1000;
}

/** Derive txn-unit amount from a base-unit amount (1 alt = conversionToBase base). */
export function scaleFromBase(baseAmount: number, conversionToBase: number): number {
  const base = Number(baseAmount) || 0;
  const f = Number(conversionToBase) || 1;
  return Math.round(base * f * 1000) / 1000;
}

export type BuyerRoleForRate = 'DISTRIBUTOR' | 'CUSTOMER' | null | undefined;

export type ResourceUnitRateRow = {
  unitName: string;
  isBase?: boolean;
  conversionToBase?: number;
  rate?: number | null;
  distributorRate?: number | null;
  customerRate?: number | null;
  costPrice?: number | null;
};

export type ResourceRateSource = {
  unit: string;
  rate: number;
  distributorRate?: number | null;
  customerRate?: number | null;
  costPrice?: number | null;
  units?: ResourceUnitRateRow[] | null;
};

function unitRowFor(
  resource: ResourceRateSource,
  unitName?: string | null,
): { unitRow: ResourceUnitRateRow | null; factor: number; isBaseUnit: boolean } {
  const baseUnitKey = normalizeUnitName(resource.unit || '');
  const unitKey = normalizeUnitName(unitName || resource.unit || '');
  const units = resource.units ?? [];
  const unitRow =
    units.find((u) => normalizeUnitName(u.unitName) === unitKey) ??
    units.find((u) => u.isBase) ??
    null;

  const factor = unitRow ? Number(unitRow.conversionToBase) || 1 : unitKey === baseUnitKey ? 1 : 1;
  const isBaseUnit =
    !unitRow ||
    Boolean(unitRow.isBase) ||
    normalizeUnitName(unitRow.unitName) === baseUnitKey ||
    Number(unitRow.conversionToBase) === 1;

  return { unitRow, factor, isBaseUnit };
}

/**
 * Resolve sell rate for a transaction unit + buyer role.
 * Order: priceListOverride → unit role → unit sell →
 * scaled base role/sell (alt units) → base role → base rate.
 * Explicit unit prices always win; blank alts use base × conversionToBase.
 */
export function resolveSellRate(opts: {
  resource: ResourceRateSource;
  unitName?: string | null;
  buyerRole?: BuyerRoleForRate;
  priceListOverride?: number | null;
}): number {
  if (opts.priceListOverride != null && Number.isFinite(Number(opts.priceListOverride))) {
    return Number(opts.priceListOverride);
  }

  const { unitRow, factor, isBaseUnit } = unitRowFor(opts.resource, opts.unitName);
  const baseRate = Number(opts.resource.rate) || 0;
  const baseDist =
    opts.resource.distributorRate != null ? Number(opts.resource.distributorRate) : null;
  const baseCust =
    opts.resource.customerRate != null ? Number(opts.resource.customerRate) : null;
  const unitSell = unitRow?.rate != null ? Number(unitRow.rate) : null;

  if (opts.buyerRole === 'DISTRIBUTOR') {
    if (unitRow?.distributorRate != null) return Number(unitRow.distributorRate);
    if (unitSell != null) return unitSell;
    if (!isBaseUnit) {
      if (baseDist != null) return scaleFromBase(baseDist, factor);
      return scaleFromBase(baseRate, factor);
    }
    if (baseDist != null) return baseDist;
    return baseRate;
  }

  if (opts.buyerRole === 'CUSTOMER') {
    if (unitRow?.customerRate != null) return Number(unitRow.customerRate);
    if (unitSell != null) return unitSell;
    if (!isBaseUnit) {
      if (baseCust != null) return scaleFromBase(baseCust, factor);
      return scaleFromBase(baseRate, factor);
    }
    if (baseCust != null) return baseCust;
    return baseRate;
  }

  if (unitSell != null) return unitSell;
  if (!isBaseUnit) return scaleFromBase(baseRate, factor);
  return baseRate;
}

/**
 * Resolve buy/vendor cost for a transaction unit.
 * Order: unit costPrice override → (Resource.costPrice ?? 0) × conversionToBase.
 * Ledger WAC / Resource.costPrice remain per base unit.
 */
export function resolveBuyCost(opts: {
  resource: Pick<ResourceRateSource, 'unit' | 'costPrice' | 'units'>;
  unitName?: string | null;
}): number {
  const { unitRow, factor, isBaseUnit } = unitRowFor(
    {
      unit: opts.resource.unit,
      rate: 0,
      costPrice: opts.resource.costPrice,
      units: opts.resource.units,
    },
    opts.unitName,
  );
  if (unitRow?.costPrice != null) return Number(unitRow.costPrice);
  const baseCost = opts.resource.costPrice != null ? Number(opts.resource.costPrice) : 0;
  if (!isBaseUnit) return scaleFromBase(baseCost, factor);
  return baseCost;
}

export function findUnitFactor(
  resource: ResourceRateSource,
  unitName: string | null | undefined,
): number {
  const unitKey = normalizeUnitName(unitName || resource.unit || '');
  const units = resource.units ?? [];
  const row = units.find((u) => normalizeUnitName(u.unitName) === unitKey);
  if (row) return Number(row.conversionToBase) || 1;
  if (normalizeUnitName(resource.unit) === unitKey) return 1;
  return 1;
}
