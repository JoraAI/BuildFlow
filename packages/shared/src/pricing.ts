/**
 * BuildFlow - SaaS plan pricing (INR, pre-GST).
 * Single source of truth for checkout and marketing display.
 *
 * INVENTORY_PRODUCT: India-friendly prices (ex-GST).
 * ENTERPRISE is contact-sales only: `null` (marketing shows "Custom",
 * no self-serve checkout amount).
 */
export const PLAN_PRICES_INR = {
  INVENTORY: 799,
  STARTER: 1999,
  PROFESSIONAL: 4999,
  ENTERPRISE: null as number | null, // contact sales
} as const;

/** Annual billing - 2 months free vs paying monthly × 12. */
export const PLAN_ANNUAL_INR = {
  INVENTORY: 7990,
  STARTER: 19990,
  PROFESSIONAL: 49990,
  ENTERPRISE: null as number | null, // contact sales
} as const;

export type SubscriptionPlanKey = keyof typeof PLAN_PRICES_INR;
export type BillingInterval = 'MONTHLY' | 'YEARLY';
export type SubscriptionStatusKey = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';
export type SaasQuoteMode = 'new' | 'extend' | 'upgrade_prorate' | 'schedule';

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

export function getPlanPrice(plan: SubscriptionPlanKey, interval: BillingInterval): number | null {
  return interval === 'YEARLY' ? getPlanAnnualPrice(plan) : getPlanMonthlyPrice(plan);
}

/** Constant used by marketing copy - single source of truth is this file. */
export const GST_PRICING_NOTE = '+ 18% GST';

export function addBillingPeriod(from: Date, interval: BillingInterval): Date {
  const next = new Date(from.getTime());
  if (interval === 'YEARLY') next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

export interface SaasQuoteInput {
  now: Date;
  status: SubscriptionStatusKey;
  billingInterval: BillingInterval | null;
  paidUntil: Date | null;
  lastPaymentAt: Date | null;
  plan: SubscriptionPlanKey;
  requestedInterval: BillingInterval;
}

export interface SaasQuote {
  mode: SaasQuoteMode;
  amountInr: number;
  creditInr: number;
  periodStart: string;
  periodEnd: string;
  message: string;
  /** True when checkout should not charge Razorpay (yearly → monthly mid-cycle). */
  requiresPayment: boolean;
}

function inr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function unusedMonthlyCredit(input: SaasQuoteInput, monthlyPrice: number): number {
  const paidUntil = input.paidUntil;
  if (!paidUntil || paidUntil.getTime() <= input.now.getTime()) return 0;
  const start =
    input.lastPaymentAt && input.lastPaymentAt.getTime() < paidUntil.getTime()
      ? input.lastPaymentAt
      : new Date(paidUntil.getTime() - 30 * 86_400_000);
  const totalMs = Math.max(paidUntil.getTime() - start.getTime(), 1);
  const leftMs = Math.max(paidUntil.getTime() - input.now.getTime(), 0);
  return Math.min(monthlyPrice, Math.round(monthlyPrice * (leftMs / totalMs)));
}

/**
 * Quote a monthly/yearly SaaS payment without charging.
 *
 * - After trial / after paid period: full price, period starts now.
 * - Same frequency while still covered: pay full price, stack time after paidUntil.
 * - Monthly → yearly mid-cycle: credit unused monthly days, yearly starts now.
 * - Yearly → monthly mid-cycle: no charge, switch after paidUntil (no refund).
 */
export function quoteSaasPayment(input: SaasQuoteInput): SaasQuote {
  const price = getPlanPrice(input.plan, input.requestedInterval);
  if (price == null) {
    throw new Error('ENTERPRISE is contact-sales only. Please contact our sales team.');
  }
  const monthly = getPlanMonthlyPrice(input.plan) ?? 0;
  const paidUntil = input.paidUntil;
  const covered =
    input.status === 'ACTIVE' && !!paidUntil && paidUntil.getTime() > input.now.getTime();
  const currentInterval: BillingInterval | null = covered
    ? (input.billingInterval ?? 'MONTHLY')
    : input.billingInterval;

  if (!covered) {
    const periodEnd = addBillingPeriod(input.now, input.requestedInterval);
    return {
      mode: 'new',
      amountInr: price,
      creditInr: 0,
      periodStart: input.now.toISOString(),
      periodEnd: periodEnd.toISOString(),
      requiresPayment: true,
      message:
        input.requestedInterval === 'YEARLY'
          ? `Pay ${inr(price)} for 12 months. Period starts today.`
          : `Pay ${inr(price)} for 1 month. Period starts today.`,
    };
  }

  if (currentInterval === input.requestedInterval) {
    const periodEnd = addBillingPeriod(paidUntil!, input.requestedInterval);
    return {
      mode: 'extend',
      amountInr: price,
      creditInr: 0,
      periodStart: paidUntil!.toISOString(),
      periodEnd: periodEnd.toISOString(),
      requiresPayment: true,
      message:
        input.requestedInterval === 'YEARLY'
          ? `Pay ${inr(price)} to add 12 months after your current yearly period.`
          : `Pay ${inr(price)} to add 1 month after your current monthly period.`,
    };
  }

  if (currentInterval === 'MONTHLY' && input.requestedInterval === 'YEARLY') {
    const creditInr = unusedMonthlyCredit(input, monthly);
    const amountInr = Math.max(0, price - creditInr);
    const periodEnd = addBillingPeriod(input.now, 'YEARLY');
    return {
      mode: 'upgrade_prorate',
      amountInr,
      creditInr,
      periodStart: input.now.toISOString(),
      periodEnd: periodEnd.toISOString(),
      requiresPayment: amountInr > 0,
      message:
        creditInr > 0
          ? `${inr(creditInr)} unused monthly credit applied. Pay ${inr(amountInr)} for 12 months starting today.`
          : `Pay ${inr(amountInr)} for 12 months starting today.`,
    };
  }

  return {
    mode: 'schedule',
    amountInr: 0,
    creditInr: 0,
    periodStart: paidUntil!.toISOString(),
    periodEnd: addBillingPeriod(paidUntil!, 'MONTHLY').toISOString(),
    requiresPayment: false,
    message: `Monthly billing starts after your yearly period ends. You keep yearly access until then. Unused yearly time is not refunded.`,
  };
}
