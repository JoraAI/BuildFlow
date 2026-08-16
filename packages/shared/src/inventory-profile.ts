/**
 * BuildFlow - Inventory business profile enum.
 *
 * INVENTORY_HORIZONTAL_PLATFORM (Phase 0): optional per-company profile that
 * describes what kind of physical-goods business an inventory tenant runs.
 * Today it only drives *terminology* (see `inventory-labels.ts` - e.g. a
 * MATERIAL_SUPPLIER keeps construction-style "Materials" wording). Future phases
 * (price lists, barcode, batch/serial, reorder) will branch on it.
 *
 * Mirrors the Prisma enum `InventoryBusinessProfile` in schema.prisma.
 * Construction companies: the field is hidden/ignored (service returns null).
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
 * INVENTORY_KIRANA_RETAIL_WHOLESALE (Phase 11.1): vertical / catalog template.
 * K1 - KIRANA is a VERTICAL (starter catalog), NOT another business profile.
 * Set once on Company by applyCatalogTemplate; null elsewhere.
 */
export const InventoryVertical = {
  KIRANA: 'KIRANA',
} as const;
export type InventoryVertical = (typeof InventoryVertical)[keyof typeof InventoryVertical];

export const INVENTORY_VERTICAL_VALUES: readonly InventoryVertical[] = [InventoryVertical.KIRANA];

export const INVENTORY_VERTICAL_LABELS: Record<InventoryVertical, string> = {
  KIRANA: 'Kirana (retail / wholesale grocery)',
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
