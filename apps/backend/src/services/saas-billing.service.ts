/**
 * BuildFlow - SaaS subscription billing (BuildFlow charges companies for plans).
 *
 * Uses platform SAAS_* env credentials - separate from tenant invoice payment integrations.
 */
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { BillingInterval, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import {
  PLAN_ANNUAL_INR,
  PLAN_PRICES_INR,
  quoteSaasPayment,
  type BillingInterval as SharedBillingInterval,
  type SaasQuote,
  type SubscriptionPlanKey,
} from '@buildflow/shared';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { notifyInternalOps } from './ops-notification.service';
import { ApiError } from '../utils/errors';

export { PLAN_PRICES_INR };

function saasRazorpayClient(): Razorpay | null {
  if (!env.SAAS_RAZORPAY_KEY_ID || !env.SAAS_RAZORPAY_KEY_SECRET) return null;
  return new Razorpay({
    key_id: env.SAAS_RAZORPAY_KEY_ID,
    key_secret: env.SAAS_RAZORPAY_KEY_SECRET,
  });
}

export interface SaasCheckoutResult {
  gateway: 'razorpay' | 'stripe';
  paymentUrl: string;
  referenceId: string;
  amount: number;
  currency: string;
  plan: SubscriptionPlan;
  interval: BillingInterval;
  quote: SaasQuote;
  scheduled?: boolean;
}

async function loadCompanyBilling(companyId: string) {
  return prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      gstin: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      billingInterval: true,
      pendingBillingInterval: true,
      trialEndsAt: true,
      lastPaymentAt: true,
      saasPaymentRef: true,
    },
  });
}

export function quoteCompanyInterval(
  company: {
    subscriptionPlan: SubscriptionPlan;
    subscriptionStatus: SubscriptionStatus;
    billingInterval: BillingInterval | null;
    trialEndsAt: Date | null;
    lastPaymentAt: Date | null;
  },
  requestedInterval: BillingInterval,
  now = new Date(),
): SaasQuote {
  return quoteSaasPayment({
    now,
    status: company.subscriptionStatus,
    billingInterval: company.billingInterval,
    paidUntil: company.trialEndsAt,
    lastPaymentAt: company.lastPaymentAt,
    plan: company.subscriptionPlan as SubscriptionPlanKey,
    requestedInterval: requestedInterval as SharedBillingInterval,
  });
}

export async function quoteSaasCheckout(
  companyId: string,
  interval: BillingInterval,
): Promise<SaasQuote> {
  const company = await loadCompanyBilling(companyId);
  return quoteCompanyInterval(company, interval);
}

export async function scheduleBillingInterval(
  companyId: string,
  interval: BillingInterval | null,
): Promise<{ pendingBillingInterval: BillingInterval | null; quote: SaasQuote | null }> {
  const company = await loadCompanyBilling(companyId);
  if (interval == null) {
    await prisma.company.update({
      where: { id: companyId },
      data: { pendingBillingInterval: null },
    });
    return { pendingBillingInterval: null, quote: null };
  }

  const quote = quoteCompanyInterval(company, interval);
  if (quote.mode !== 'schedule') {
    throw ApiError.badRequest(
      interval === BillingInterval.YEARLY
        ? 'Switching to yearly needs payment. Use checkout.'
        : 'This interval change cannot be scheduled. Use checkout if payment is due.',
    );
  }

  await prisma.company.update({
    where: { id: companyId },
    data: { pendingBillingInterval: interval },
  });
  return { pendingBillingInterval: interval, quote };
}

export async function createSaasCheckout(
  companyId: string,
  plan: SubscriptionPlan,
  gateway: 'razorpay' | 'stripe',
  interval: BillingInterval = BillingInterval.MONTHLY,
): Promise<SaasCheckoutResult> {
  const company = await loadCompanyBilling(companyId);
  const quote = quoteCompanyInterval({ ...company, subscriptionPlan: plan }, interval);

  if (quote.mode === 'schedule') {
    await prisma.company.update({
      where: { id: companyId },
      data: { pendingBillingInterval: interval },
    });
    return {
      gateway,
      paymentUrl: '',
      referenceId: '',
      amount: 0,
      currency: 'INR',
      plan,
      interval,
      quote,
      scheduled: true,
    };
  }

  if (!quote.requiresPayment) {
    await activateSubscription(companyId, plan, `saas-credit-${companyId}-${Date.now()}`, {
      interval,
      periodEnd: quote.periodEnd,
    });
    return {
      gateway,
      paymentUrl: '',
      referenceId: '',
      amount: 0,
      currency: 'INR',
      plan,
      interval,
      quote,
    };
  }

  const referenceId = `saas-${companyId.slice(0, 8)}-${interval[0]}-${Date.now()}`;

  if (gateway === 'stripe') {
    if (!env.SAAS_STRIPE_SECRET_KEY) throw new Error('SAAS_STRIPE_NOT_CONFIGURED');
    const returnPath = plan === SubscriptionPlan.INVENTORY ? '/inventory/settings' : '/settings/billing';
    const params = new URLSearchParams({
      mode: 'payment',
      success_url: `${env.APP_PUBLIC_URL}${returnPath}?paid=1`,
      cancel_url: `${env.APP_PUBLIC_URL}${returnPath}?cancelled=1`,
      'line_items[0][price_data][currency]': 'inr',
      'line_items[0][price_data][product_data][name]': `BuildFlow ${plan} ${interval} Plan`,
      'line_items[0][price_data][unit_amount]': String(quote.amountInr * 100),
      'line_items[0][quantity]': '1',
      'metadata[companyId]': companyId,
      'metadata[plan]': plan,
      'metadata[interval]': interval,
      'metadata[periodEnd]': quote.periodEnd,
      'metadata[referenceId]': referenceId,
    });
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SAAS_STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    if (!res.ok) {
      const text = await res.text();
      logger.warn('Stripe SaaS checkout failed', { status: res.status, error: text });
      throw new Error('SAAS_CHECKOUT_FAILED');
    }
    const session = (await res.json()) as { url?: string; id?: string };
    if (!session.url) throw new Error('SAAS_CHECKOUT_FAILED');

    await prisma.company.update({
      where: { id: companyId },
      data: { saasPaymentRef: referenceId },
    });

    return {
      gateway: 'stripe',
      paymentUrl: session.url,
      referenceId,
      amount: quote.amountInr,
      currency: 'INR',
      plan,
      interval,
      quote,
    };
  }

  const rzp = saasRazorpayClient();
  if (!rzp) throw new Error('SAAS_RAZORPAY_NOT_CONFIGURED');

  const returnPath = plan === SubscriptionPlan.INVENTORY ? '/inventory/settings' : '/settings/billing';
  const link = await rzp.paymentLink.create({
    amount: quote.amountInr * 100,
    currency: 'INR',
    description: `BuildFlow ${plan} ${interval.toLowerCase()} subscription - ${company.name}`,
    reference_id: referenceId,
    customer: { name: company.name },
    notify: { sms: false, email: false },
    reminder_enable: false,
    notes: {
      companyId,
      plan,
      interval,
      periodEnd: quote.periodEnd,
      amount: String(quote.amountInr),
    },
    callback_url: `${env.APP_PUBLIC_URL}${returnPath}?paid=1`,
    callback_method: 'get',
  });

  await prisma.company.update({
    where: { id: companyId },
    data: { saasPaymentRef: referenceId },
  });

  return {
    gateway: 'razorpay',
    paymentUrl: link.short_url,
    referenceId,
    amount: quote.amountInr,
    currency: 'INR',
    plan,
    interval,
    quote,
  };
}

export function verifySaasRazorpayWebhook(rawBody: string, signature: string): boolean {
  if (!env.SAAS_RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac('sha256', env.SAAS_RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function verifySaasStripeWebhook(rawBody: string, signature: string): boolean {
  if (!env.SAAS_STRIPE_WEBHOOK_SECRET) return false;
  const parts = signature.split(',').reduce(
    (acc, part) => {
      const [k, v] = part.split('=');
      if (k && v) acc[k] = v;
      return acc;
    },
    {} as Record<string, string>,
  );
  const timestamp = parts.t;
  const sig = parts.v1;
  if (!timestamp || !sig) return false;
  const payload = `${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac('sha256', env.SAAS_STRIPE_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

export async function activateSubscription(
  companyId: string,
  plan: SubscriptionPlan,
  paymentRef: string,
  opts?: { interval?: BillingInterval; periodEnd?: string },
): Promise<void> {
  const now = new Date();
  const interval = opts?.interval ?? BillingInterval.MONTHLY;
  const parsedEnd = opts?.periodEnd ? new Date(opts.periodEnd) : null;
  const renews =
    parsedEnd && !Number.isNaN(parsedEnd.getTime())
      ? parsedEnd
      : addFallbackPeriod(now, interval);

  await prisma.company.update({
    where: { id: companyId },
    data: {
      subscriptionPlan: plan,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      lastPaymentAt: now,
      saasPaymentRef: paymentRef,
      trialEndsAt: renews,
      billingInterval: interval,
      pendingBillingInterval: null,
    },
  });

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { name: true, users: { where: { role: 'OWNER' }, select: { email: true } } },
  });

  await notifyInternalOps({
    event: 'SAAS_PAYMENT_RECEIVED',
    companyId,
    companyName: company.name,
    ownerEmail: company.users[0]?.email,
    message: `SaaS payment received: ${company.name} upgraded to ${plan} ${interval}`,
  });
}

function addFallbackPeriod(from: Date, interval: BillingInterval): Date {
  const next = new Date(from.getTime());
  if (interval === BillingInterval.YEARLY) next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

interface RazorpaySaasPayload {
  payload?: {
    payment_link?: { entity?: { reference_id?: string; notes?: Record<string, string> } };
    payment?: { entity?: { notes?: Record<string, string> } };
  };
}

export async function handleSaasRazorpayWebhook(rawBody: string): Promise<boolean> {
  const parsed = JSON.parse(rawBody) as RazorpaySaasPayload;
  const ref =
    parsed.payload?.payment_link?.entity?.reference_id ??
    parsed.payload?.payment?.entity?.notes?.referenceId;
  const notes =
    parsed.payload?.payment_link?.entity?.notes ??
    parsed.payload?.payment?.entity?.notes ??
    {};
  const companyId = notes.companyId;
  const plan = notes.plan as SubscriptionPlan | undefined;
  const interval = (notes.interval as BillingInterval | undefined) ?? BillingInterval.MONTHLY;
  if (!companyId || !plan || !ref?.startsWith('saas-')) return false;

  const current = await prisma.company.findUnique({
    where: { id: companyId },
    select: { saasPaymentRef: true },
  });
  if (current?.saasPaymentRef && current.saasPaymentRef !== ref) {
    logger.warn('Ignoring stale SaaS Razorpay payment', { companyId, ref });
    return true;
  }

  const { redis } = await import('../lib/redis');
  const idempKey = `saas:webhook:razorpay:${ref}`;
  const alreadyHandled = await redis.get(idempKey);
  if (alreadyHandled) return true;

  await activateSubscription(companyId, plan, ref, { interval, periodEnd: notes.periodEnd });
  await redis.set(idempKey, '1', 'EX', 7 * 24 * 60 * 60);
  return true;
}

interface StripeEvent {
  type: string;
  data?: { object?: { metadata?: Record<string, string>; payment_status?: string } };
}

export async function handleSaasStripeWebhook(rawBody: string): Promise<boolean> {
  const event = JSON.parse(rawBody) as StripeEvent;
  if (event.type !== 'checkout.session.completed') return false;

  const paymentStatus = event.data?.object?.payment_status;
  if (paymentStatus !== 'paid') return false;

  const meta = event.data?.object?.metadata ?? {};
  const companyId = meta.companyId;
  const plan = meta.plan as SubscriptionPlan | undefined;
  const ref = meta.referenceId;
  const interval = (meta.interval as BillingInterval | undefined) ?? BillingInterval.MONTHLY;
  if (!companyId || !plan || !ref) return false;

  const current = await prisma.company.findUnique({
    where: { id: companyId },
    select: { saasPaymentRef: true },
  });
  if (current?.saasPaymentRef && current.saasPaymentRef !== ref) {
    logger.warn('Ignoring stale SaaS Stripe payment', { companyId, ref });
    return true;
  }

  const { redis } = await import('../lib/redis');
  const idempKey = `saas:webhook:stripe:${ref}`;
  const alreadyHandled = await redis.get(idempKey);
  if (alreadyHandled) return true;

  await activateSubscription(companyId, plan, ref, { interval, periodEnd: meta.periodEnd });
  await redis.set(idempKey, '1', 'EX', 7 * 24 * 60 * 60);
  return true;
}

export function getSaasBillingAvailability() {
  return {
    razorpay: !!(env.SAAS_RAZORPAY_KEY_ID && env.SAAS_RAZORPAY_KEY_SECRET),
    stripe: !!env.SAAS_STRIPE_SECRET_KEY,
    plans: PLAN_PRICES_INR,
    annualPlans: PLAN_ANNUAL_INR,
  };
}
