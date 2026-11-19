/**
 * Multi-unit UOM helpers (IM). Stock qty is always in the item base unit;
 * rates are per selected transaction unit with role-aware fallbacks.
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

export type BuyerRoleForRate = 'DISTRIBUTOR' | 'CUSTOMER' | null | undefined;

export type ResourceUnitRateRow = {
  unitName: string;
  isBase?: boolean;
  conversionToBase?: number;
  rate?: number | null;
  distributorRate?: number | null;
  customerRate?: number | null;
};

export type ResourceRateSource = {
  unit: string;
  rate: number;
  distributorRate?: number | null;
  customerRate?: number | null;
  units?: ResourceUnitRateRow[] | null;
};

/**
 * Resolve sell rate for a transaction unit + buyer role.
 * Order: priceListOverride → unit role rate → unit sell rate →
 * (base unit only) base role rate → base rate.
 * Never apply base ₹/unit prices to an alternate UOM line.
 * Conversion does NOT auto-scale price.
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

  const baseUnitKey = normalizeUnitName(opts.resource.unit || '');
  const unitKey = normalizeUnitName(opts.unitName || opts.resource.unit || '');
  const units = opts.resource.units ?? [];
  const unitRow =
    units.find((u) => normalizeUnitName(u.unitName) === unitKey) ??
    units.find((u) => u.isBase) ??
    null;

  const isBaseUnit =
    !unitRow ||
    Boolean(unitRow.isBase) ||
    normalizeUnitName(unitRow.unitName) === baseUnitKey ||
    Number(unitRow.conversionToBase) === 1;

  const baseRate = Number(opts.resource.rate) || 0;
  const baseDist =
    opts.resource.distributorRate != null ? Number(opts.resource.distributorRate) : null;
  const baseCust =
    opts.resource.customerRate != null ? Number(opts.resource.customerRate) : null;
  const unitSell = unitRow?.rate != null ? Number(unitRow.rate) : null;

  if (opts.buyerRole === 'DISTRIBUTOR') {
    if (unitRow?.distributorRate != null) return Number(unitRow.distributorRate);
    if (!isBaseUnit && unitSell != null) return unitSell;
    if (baseDist != null) return baseDist;
    if (unitSell != null) return unitSell;
    return baseRate;
  }

  if (opts.buyerRole === 'CUSTOMER') {
    if (unitRow?.customerRate != null) return Number(unitRow.customerRate);
    if (!isBaseUnit && unitSell != null) return unitSell;
    if (baseCust != null) return baseCust;
    if (unitSell != null) return unitSell;
    return baseRate;
  }

  if (unitSell != null) return unitSell;
  return baseRate;
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
