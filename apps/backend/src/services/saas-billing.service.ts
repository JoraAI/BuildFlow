/**
 * BuildFlow - SaaS subscription billing (BuildFlow charges companies for plans).
 *
 * Uses platform SAAS_* env credentials - separate from tenant invoice payment integrations.
 */
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { PLAN_PRICES_INR } from '@buildflow/shared';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { notifyInternalOps } from './ops-notification.service';

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
}

export async function createSaasCheckout(
  companyId: string,
  plan: SubscriptionPlan,
  gateway: 'razorpay' | 'stripe',
): Promise<SaasCheckoutResult> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { id: true, name: true, gstin: true },
  });

  const amountInr = PLAN_PRICES_INR[plan];
  // INVENTORY_PRODUCT: ENTERPRISE is contact-sales only — no self-serve amount.
  if (amountInr === null) {
    throw new Error('ENTERPRISE is contact-sales only. Please contact our sales team.');
  }
  const referenceId = `saas-${companyId}-${plan}-${Date.now()}`;

  if (gateway === 'stripe') {
    if (!env.SAAS_STRIPE_SECRET_KEY) throw new Error('SAAS_STRIPE_NOT_CONFIGURED');
    const params = new URLSearchParams({
      mode: 'payment',
      success_url: `${env.APP_PUBLIC_URL}/settings/billing?paid=1`,
      cancel_url: `${env.APP_PUBLIC_URL}/settings/billing?cancelled=1`,
      'line_items[0][price_data][currency]': 'inr',
      'line_items[0][price_data][product_data][name]': `BuildFlow ${plan} Plan`,
      'line_items[0][price_data][unit_amount]': String(amountInr * 100),
      'line_items[0][quantity]': '1',
      'metadata[companyId]': companyId,
      'metadata[plan]': plan,
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
      amount: amountInr,
      currency: 'INR',
      plan,
    };
  }

  const rzp = saasRazorpayClient();
  if (!rzp) throw new Error('SAAS_RAZORPAY_NOT_CONFIGURED');

  const link = await rzp.paymentLink.create({
    amount: amountInr * 100,
    currency: 'INR',
    description: `BuildFlow ${plan} subscription - ${company.name}`,
    reference_id: referenceId,
    customer: { name: company.name },
    notify: { sms: false, email: false },
    reminder_enable: false,
    notes: { companyId, plan },
  });

  await prisma.company.update({
    where: { id: companyId },
    data: { saasPaymentRef: referenceId },
  });

  return {
    gateway: 'razorpay',
    paymentUrl: link.short_url,
    referenceId,
    amount: amountInr,
    currency: 'INR',
    plan,
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
): Promise<void> {
  const now = new Date();
  const renews = new Date(now);
  renews.setMonth(renews.getMonth() + 1);

  await prisma.company.update({
    where: { id: companyId },
    data: {
      subscriptionPlan: plan,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      lastPaymentAt: now,
      saasPaymentRef: paymentRef,
      trialEndsAt: renews,
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
    message: `SaaS payment received: ${company.name} upgraded to ${plan}`,
  });
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
  if (!companyId || !plan || !ref?.startsWith('saas-')) return false;

  // FIX (FIN-M10): Idempotency — check Redis before activating. A replayed
  // webhook (Razorpay retries up to 5x) would re-activate the subscription
  // and potentially duplicate the audit log + notifications.
  const { redis } = await import('../lib/redis');
  const idempKey = `saas:webhook:razorpay:${ref}`;
  const alreadyHandled = await redis.get(idempKey);
  if (alreadyHandled) return true; // already processed, return success

  await activateSubscription(companyId, plan, ref);
  // Mark as handled for 7 days (subscription TTL)
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

  // FIX (FIN-M10): Check payment_status — Stripe fires checkout.session.completed
  // even for unpaid sessions (e.g. deferred payment, Boleto, SEPA). Only activate
  // when the session is actually paid.
  const paymentStatus = event.data?.object?.payment_status;
  if (paymentStatus !== 'paid') return false;

  const meta = event.data?.object?.metadata ?? {};
  const companyId = meta.companyId;
  const plan = meta.plan as SubscriptionPlan | undefined;
  const ref = meta.referenceId;
  if (!companyId || !plan || !ref) return false;

  // FIX (FIN-M10): Idempotency — same Redis dedup as Razorpay.
  const { redis } = await import('../lib/redis');
  const idempKey = `saas:webhook:stripe:${ref}`;
  const alreadyHandled = await redis.get(idempKey);
  if (alreadyHandled) return true;

  await activateSubscription(companyId, plan, ref);
  await redis.set(idempKey, '1', 'EX', 7 * 24 * 60 * 60);
  return true;
}

export function getSaasBillingAvailability() {
  return {
    razorpay: !!(env.SAAS_RAZORPAY_KEY_ID && env.SAAS_RAZORPAY_KEY_SECRET),
    stripe: !!env.SAAS_STRIPE_SECRET_KEY,
    plans: PLAN_PRICES_INR,
  };
}
