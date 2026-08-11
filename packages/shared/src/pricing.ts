/**
 * BuildFlow - SaaS plan pricing (INR, pre-GST).
 * Single source of truth for checkout and marketing display.
 *
 * INVENTORY_PRODUCT: aggressive India-friendly prices (ex-GST).
 * ENTERPRISE is contact-sales only: `null` (marketing shows "Custom",
 * no self-serve checkout amount).
 */
export const PLAN_PRICES_INR = {
  INVENTORY: 499,
  STARTER: 1999,
  PROFESSIONAL: 4999,
  ENTERPRISE: null as number | null, // contact sales
} as const;

/** Annual billing - 2 months free vs paying monthly × 12. */
export const PLAN_ANNUAL_INR = {
  INVENTORY: 4990,
  STARTER: 19990,
  PROFESSIONAL: 49990,
  ENTERPRISE: null as number | null, // contact sales
} as const;

export type SubscriptionPlanKey = keyof typeof PLAN_PRICES_INR;

/**
 * Monthly price (INR, ex-GST) for a plan. Returns `null` for contact-sales
 * plans (ENTERPRISE) so callers can render "Custom" / hide checkout.
 */
export function getPlanMonthlyPrice(plan: SubscriptionPlanKey): number | null {
  return PLAN_PRICES_INR[plan] ?? null;
}

/** Annual price (INR, ex-GST) for a plan. `null` = contact sales. */
export function getPlanAnnualPrice(plan: SubscriptionPlanKey): number | null {
  return PLAN_ANNUAL_INR[plan] ?? null;
}

/** Constant used by marketing copy - single source of truth is this file. */
export const GST_PRICING_NOTE = '+ 18% GST';
