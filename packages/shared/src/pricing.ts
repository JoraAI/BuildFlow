/**
 * BuildFlow - SaaS plan pricing (INR, pre-GST).
 * Single source of truth for checkout and marketing display.
 */
export const PLAN_PRICES_INR = {
  STARTER: 4999,
  PROFESSIONAL: 13999,
  ENTERPRISE: 39999,
} as const;

/** Annual billing - 2 months free vs paying monthly × 12. */
export const PLAN_ANNUAL_INR = {
  STARTER: 49999,
  PROFESSIONAL: 139999,
} as const;

export type SubscriptionPlanKey = keyof typeof PLAN_PRICES_INR;
