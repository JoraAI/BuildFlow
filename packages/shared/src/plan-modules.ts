/**
 * BuildFlow - Product mode & module catalog per subscription plan.
 *
 * INVENTORY_PRODUCT: a separate Inventory subscription product. Inventory
 * companies get a hidden default project (code `STORE`) and an inventory-only
 * app shell — no construction "Projects" concept for end users. Construction
 * plans (STARTER / PROFESSIONAL / ENTERPRISE) get every module.
 */
import type { SubscriptionPlanKey } from './pricing';

export type ProductMode = 'construction' | 'inventory';

export type AppModule =
  | 'inventory_shell'
  | 'procurement'
  | 'stock'
  | 'invoices' // client AR
  | 'bills' // vendor AP
  | 'tally'
  | 'assistant'
  | 'settings'
  | 'estimates'
  | 'proposals'
  | 'planning'
  | 'reports_ops'
  | 'subcontracts'
  | 'change_orders'
  | 'projects_ui'; // construction projects navigator

/** Every construction module (all plans except INVENTORY). */
const ALL_CONSTRUCTION_MODULES: readonly AppModule[] = [
  'inventory_shell',
  'procurement',
  'stock',
  'invoices',
  'bills',
  'tally',
  'assistant',
  'settings',
  'estimates',
  'proposals',
  'planning',
  'reports_ops',
  'subcontracts',
  'change_orders',
  'projects_ui',
];

export const PLAN_MODULES: Record<SubscriptionPlanKey, readonly AppModule[]> = {
  INVENTORY: [
    'inventory_shell',
    'procurement',
    'stock',
    'invoices',
    'bills',
    'tally',
    'assistant',
    'settings',
  ],
  STARTER: ALL_CONSTRUCTION_MODULES,
  PROFESSIONAL: ALL_CONSTRUCTION_MODULES,
  ENTERPRISE: ALL_CONSTRUCTION_MODULES,
};

/** Construction-only modules that inventory tenants must be blocked from. */
export const CONSTRUCTION_ONLY_MODULES: readonly AppModule[] = [
  'estimates',
  'proposals',
  'planning',
  'reports_ops',
  'subcontracts',
  'change_orders',
  'projects_ui',
];

export function getProductMode(plan: string): ProductMode {
  return plan === 'INVENTORY' ? 'inventory' : 'construction';
}

/** True when the plan grants access to the given module. */
export function isModuleEnabled(
  plan: string,
  module: AppModule,
): boolean {
  const planKey = (Object.keys(PLAN_MODULES) as SubscriptionPlanKey[]).find(
    (k) => k === plan,
  );
  if (!planKey) return true; // unknown plans default to full access
  return PLAN_MODULES[planKey].includes(module);
}

/** Default STORE project code + name for inventory companies. */
export const INVENTORY_DEFAULT_PROJECT = {
  code: 'STORE',
  name: 'Main Store',
} as const;

/* ------------------------------------------------------------------ */
/* Inventory horizontal feature flags (INVENTORY_HORIZONTAL_PLATFORM)  */
/* ------------------------------------------------------------------ */

/**
 * Phase-gated inventory features. All are OFF for every plan until their
 * roadmap phase ships (see docs/INVENTORY_HORIZONTAL_PLATFORM.md §4):
 *   - parties           → Phase 1.1 Customer/Vendor master
 *   - multi_warehouse   → Phase 3.1 multiple StockLocation per company
 *   - sales_orders      → Phase 2 sales order → challan → invoice path
 *   - stock_adjustments → Phase 1.3 ADJUST workflow (flip true when shipped)
 *   - barcode           → Phase 3.4 barcode scan / item codes
 * UI must gate new entry points behind `hasInventoryFeature` so no phase is
 * half-visible before its backend + tests land.
 */
export type InventoryFeatureFlag =
  | 'parties'
  | 'multi_warehouse'
  | 'sales_orders'
  | 'stock_adjustments'
  | 'barcode';

/** True only for the INVENTORY plan, and only for flags whose phase shipped. */
const INVENTORY_FEATURE_FLAGS: Record<InventoryFeatureFlag, boolean> = {
  // Phase 1.1 shipped: Customer/Vendor master + invoice/bill links (this pass).
  parties: true,
  // Phase 3.1 shipped: multi-warehouse + transfers + stock counts (this pass).
  multi_warehouse: true,
  // Phase 2.1 shipped: sales order + delivery challan → invoice (this pass).
  sales_orders: true,
  // Phase 1.3 shipped: ADJUST workflow + reasons (this pass).
  stock_adjustments: true,
  // Phase 3.4 shipped: barcode identify (this pass).
  barcode: true,
};

/**
 * Whether the given plan currently has access to an inventory feature flag.
 * Construction plans always return false (these are inventory-horizontal
 * features). Roll each flag to `true` in `INVENTORY_FEATURE_FLAGS` only when
 * its phase (backend + tests + UI) actually ships.
 */
export function hasInventoryFeature(
  plan: SubscriptionPlanKey,
  flag: InventoryFeatureFlag,
): boolean {
  return plan === 'INVENTORY' && INVENTORY_FEATURE_FLAGS[flag];
}
