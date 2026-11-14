/**
 * BuildFlow - Inventory business profile + shop vertical enums.
 *
 * Profile: terminology / store type (RETAIL, WHOLESALE, …).
 * Vertical: capability lane — Retailer | Wholesaler | Manufacturer.
 */

export const InventoryBusinessProfile = {
  RETAIL: 'RETAIL',
  WHOLESALE: 'WHOLESALE',
  DISTRIBUTION: 'DISTRIBUTION',
  TRADING: 'TRADING',
  MATERIAL_SUPPLIER: 'MATERIAL_SUPPLIER',
  EQUIPMENT: 'EQUIPMENT',
  GENERAL: 'GENERAL',
} as const;
export type InventoryBusinessProfile =
  (typeof InventoryBusinessProfile)[keyof typeof InventoryBusinessProfile];

/** All valid profile values (ordered for dropdowns / validators). */
export const INVENTORY_PROFILE_VALUES: readonly InventoryBusinessProfile[] = [
  InventoryBusinessProfile.RETAIL,
  InventoryBusinessProfile.WHOLESALE,
  InventoryBusinessProfile.DISTRIBUTION,
  InventoryBusinessProfile.TRADING,
  InventoryBusinessProfile.MATERIAL_SUPPLIER,
  InventoryBusinessProfile.EQUIPMENT,
  InventoryBusinessProfile.GENERAL,
];

/**
 * Shop vertical - top-level IM mode.
 *
 * RETAILER     → product library + batch/expiry (FEFO)
 * WHOLESALER   → B2B dual prices (distributor / customer); generic IM
 * MANUFACTURER → recipes / production + buyer app (ice cream first demo)
 */
export const InventoryVertical = {
  RETAILER: 'RETAILER',
  WHOLESALER: 'WHOLESALER',
  MANUFACTURER: 'MANUFACTURER',
} as const;
export type InventoryVertical = (typeof InventoryVertical)[keyof typeof InventoryVertical];

export const INVENTORY_VERTICAL_VALUES: readonly InventoryVertical[] = [
  InventoryVertical.RETAILER,
  InventoryVertical.WHOLESALER,
  InventoryVertical.MANUFACTURER,
];

export const INVENTORY_VERTICAL_LABELS: Record<InventoryVertical, string> = {
  RETAILER: 'Retailer',
  WHOLESALER: 'Wholesaler',
  MANUFACTURER: 'Manufacturer (ice cream)',
};

export const INVENTORY_VERTICAL_HINTS: Record<InventoryVertical, string> = {
  RETAILER: 'Product library plus batch and expiry tracking',
  WHOLESALER: 'Distributor and customer sell prices; quotes, warehouses, stock',
  MANUFACTURER: 'Recipes, production batches, and Jora Trade buyer orders',
};

/** Human-readable labels for the Settings profile picker. */
export const INVENTORY_PROFILE_LABELS: Record<InventoryBusinessProfile, string> = {
  RETAIL: 'Retail store',
  WHOLESALE: 'Wholesale / cash & carry',
  DISTRIBUTION: 'Distributor / stockist',
  TRADING: 'Trader / trading company',
  MATERIAL_SUPPLIER: 'Material supplier (construction)',
  EQUIPMENT: 'Equipment dealer / rental',
  GENERAL: 'General business',
};

/** Dropdown options (value + label) for the inventory Settings screen. */
export const INVENTORY_PROFILE_OPTIONS = INVENTORY_PROFILE_VALUES.map((value) => ({
  value,
  label: INVENTORY_PROFILE_LABELS[value],
}));
