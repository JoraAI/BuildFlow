/**
 * BuildFlow - Inventory terminology map (INVENTORY_HORIZONTAL_PLATFORM Phase 0).
 *
 * The horizontal platform serves both construction-style users (materials,
 * indents, stores) and generic trading/distribution users (items, purchase
 * requests, warehouses). This module is the single source for those labels.
 *
 * Wiring rule: the INVENTORY SHELL uses these labels only. The construction
 * `ProcurementTab` and construction screens keep construction wording untouched.
 *
 * Mode selection (see `getInventoryLabelMode`): generic by default; a tenant
 * with business profile `MATERIAL_SUPPLIER` keeps "Materials" wording.
 * The API identifiers (resource, requisition) are unchanged.
 */

export type InventoryLabelMode = 'generic' | 'materials';

export type InventoryLabelKey =
  | 'item'
  | 'item_plural'
  | 'catalog'
  | 'issue_bulk'
  | 'warehouse'
  | 'indent'
  | 'store';

export const INVENTORY_LABELS: Record<
  InventoryLabelMode,
  Record<InventoryLabelKey, string>
> = {
  // Generic trading / distribution wording.
  generic: {
    item: 'Item',
    item_plural: 'Items',
    catalog: 'Catalog',
    issue_bulk: 'Bulk issue',
    warehouse: 'Warehouse',
    indent: 'Purchase request',
    store: 'Store',
  },
  // Construction-style wording (kept for MATERIAL_SUPPLIER tenants).
  materials: {
    item: 'Material',
    item_plural: 'Materials',
    catalog: 'Catalog',
    issue_bulk: 'Bulk issue',
    warehouse: 'Warehouse',
    indent: 'Indent',
    store: 'Store',
  },
};

export function getInventoryLabel(key: InventoryLabelKey, mode: InventoryLabelMode): string {
  return INVENTORY_LABELS[mode][key];
}

/**
 * Pick the label mode for an inventory tenant from its business profile.
 * MATERIAL_SUPPLIER keeps construction-style "Materials" wording; everything
 * else (including unknown/null/GENERAL) uses generic wording.
 */
export function getInventoryLabelMode(profile?: string | null): InventoryLabelMode {
  return profile === 'MATERIAL_SUPPLIER' ? 'materials' : 'generic';
}

/**
 * Event / lighting quotation UX (Quotes tab, WhatsApp share, return scan).
 * Used by EQUIPMENT dealers and the EVENTS shop vertical (e.g. Lumina demo).
 */
export function usesEventLightingCopy(
  profile?: string | null,
  vertical?: string | null,
): boolean {
  return profile === 'EQUIPMENT' || vertical === 'EVENTS';
}

/** Ice cream manufacturer vertical: recipes, production, B2B buyer catalog. */
export function usesIceCreamManufacturerCopy(vertical?: string | null): boolean {
  return vertical === 'ICE_CREAM';
}

/**
 * GST classification code wording by shop type.
 * Stored field stays `hsnSacCode`; labels adapt for goods (HSN) vs services (SAC).
 */
export type GstTaxCodeLabels = {
  /** Short chip/tab: HSN | SAC | HSN/SAC */
  short: string;
  /** Form field label */
  field: string;
  /** Empty / missing callouts */
  missing: string;
};

export function getGstTaxCodeLabels(
  vertical?: string | null,
  profile?: string | null,
): GstTaxCodeLabels {
  // Event / equipment rental leans service (SAC) but lines may still be goods.
  if (usesEventLightingCopy(profile, vertical)) {
    return {
      short: 'HSN/SAC',
      field: 'HSN/SAC code',
      missing: 'Missing HSN/SAC',
    };
  }
  // Packaged goods verticals (ice cream, general retail/wholesale).
  if (vertical === 'ICE_CREAM' || profile === 'RETAIL' || profile === 'WHOLESALE' || profile === 'DISTRIBUTION' || profile === 'TRADING' || profile === 'MATERIAL_SUPPLIER') {
    return {
      short: 'HSN',
      field: 'HSN code',
      missing: 'Missing HSN',
    };
  }
  return {
    short: 'HSN/SAC',
    field: 'HSN/SAC code',
    missing: 'Missing HSN/SAC',
  };
}

/** Plural of the indent label for section titles ("Indents" / "Purchase requests"). */
export function getIndentPlural(mode: InventoryLabelMode): string {
  const label = getInventoryLabel('indent', mode);
  return label === 'Indent' ? 'Indents' : 'Purchase requests';
}
