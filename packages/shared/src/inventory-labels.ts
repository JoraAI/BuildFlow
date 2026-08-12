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

/** Plural of the indent label for section titles ("Indents" / "Purchase requests"). */
export function getIndentPlural(mode: InventoryLabelMode): string {
  const label = getInventoryLabel('indent', mode);
  return label === 'Indent' ? 'Indents' : 'Purchase requests';
}
