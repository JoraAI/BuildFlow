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
