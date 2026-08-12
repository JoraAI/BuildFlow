/**
 * BuildFlow - Payment controller (Razorpay invoice + SaaS billing webhooks).
 *
 * Security: all webhook handlers verify an HMAC signature over the RAW body
 * bytes BEFORE any processing. Tenant-invoice webhooks require a per-company
 * secret (no platform fallback) and the invoice lookup is scoped to the path
 * `companyId`. See SEC-C1/FIN-C1/SEC-H9/SEC-H7/FIN-C2.
 */
import type { Request, Response } from 'express';
import {
  createPaymentLink,
  handlePaymentCaptured,
  verifyWebhookSignature,
} from '../services/payment.service';
import {
  verifySaasRazorpayWebhook,
  handleSaasRazorpayWebhook,
  verifySaasStripeWebhook,
  handleSaasStripeWebhook,
} from '../services/saas-billing.service';
import { ok } from '../utils/response';
import { ApiError } from '../utils/errors';

/** Decode the raw webhook body (express.raw gives a Buffer) into a UTF-8 string. */
function rawBodyToString(body: unknown): string {
  if (typeof body === 'string') return body;
  if (Buffer.isBuffer(body)) return body.toString('utf8');
  // Fallback for tests/proxies that already parsed JSON.
  if (body && typeof body === 'object') return JSON.stringify(body);
  return '';
}

export async function createLink(req: Request, res: Response) {
  const companyId = req.user!.companyId;
  const invoiceId = req.params.id;
  try {
    const link = await createPaymentLink(companyId, invoiceId);
    return ok(res, link);
  } catch (err) {
    if (err instanceof Error && err.message === 'RAZORPAY_NOT_CONFIGURED') {
      throw ApiError.badRequest('Razorpay is not configured for your company');
    }
    throw err;
  }
}

/**
 * Legacy platform webhook (`/api/webhooks/razorpay`).
 *
 * SECURITY (SEC-C1/FIN-C1): This path no longer processes tenant-invoice
 * payments without a verified per-company signature. It only handles SaaS
 * billing events (signed with the platform secret). Tenant invoice payments
 * must come through the company-scoped `/api/webhooks/razorpay/:companyId`
 * route so the per-company HMAC can be verified and the invoice looked up
 * within that company.
 */
export async function webhook(req: Request, res: Response) {
  const raw = rawBodyToString(req.body);
  const signature = req.get('X-Razorpay-Signature') ?? '';

  // Only SaaS billing is allowed on the legacy un-scoped path.
  if (verifySaasRazorpayWebhook(raw, signature)) {
    const handled = await handleSaasRazorpayWebhook(raw);
    return res.status(200).json({ success: true, data: { handled, type: 'saas' } });
  }

  // Do NOT fall through to handlePaymentCaptured here - that was the forgery.
  return res
    .status(401)
    .json({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature' } });
}

/** Company-scoped Razorpay webhook for tenant invoice payments. */
export async function companyWebhook(req: Request, res: Response) {
  const companyId = req.params.companyId;
  const raw = rawBodyToString(req.body);
  const signature = req.get('X-Razorpay-Signature') ?? '';
  if (!(await verifyWebhookSignature(companyId, raw, signature))) {
    return res
      .status(401)
      .json({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature' } });
  }
  const result = await handlePaymentCaptured(companyId, raw);
  return res.status(200).json({ success: true, data: result });
}

export async function saasRazorpayWebhook(req: Request, res: Response) {
  const raw = rawBodyToString(req.body);
  const signature = req.get('X-Razorpay-Signature') ?? '';
  if (!verifySaasRazorpayWebhook(raw, signature)) {
    return res
      .status(401)
      .json({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature' } });
  }
  const handled = await handleSaasRazorpayWebhook(raw);
  return res.status(200).json({ success: true, data: { handled } });
}

export async function saasStripeWebhook(req: Request, res: Response) {
  const raw = rawBodyToString(req.body);
  const signature = req.get('Stripe-Signature') ?? '';
  if (!verifySaasStripeWebhook(raw, signature)) {
    return res
      .status(401)
      .json({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature' } });
  }
  const handled = await handleSaasStripeWebhook(raw);
  return res.status(200).json({ success: true, data: { handled } });
}

export async function companyStripeWebhook(_req: Request, res: Response) {
  // Stripe invoice webhooks for tenant - placeholder for future Stripe invoice flow
  return res.status(200).json({ success: true, data: { handled: false } });
}