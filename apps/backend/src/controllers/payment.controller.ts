/**
 * BuildFlow — Payment controller (Razorpay invoice + SaaS billing webhooks).
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

/** Legacy platform webhook (no company id in path). */
export async function webhook(req: Request, res: Response) {
  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
  const signature = req.get('X-Razorpay-Signature') ?? '';
  // Try SaaS billing first
  if (verifySaasRazorpayWebhook(raw, signature)) {
    const handled = await handleSaasRazorpayWebhook(raw);
    return res.status(200).json({ success: true, data: { handled, type: 'saas' } });
  }
  const result = await handlePaymentCaptured(raw);
  if (!result.handled) {
    return res.status(200).json({ success: true, data: { handled: false } });
  }
  return res.status(200).json({ success: true, data: result });
}

/** Company-scoped Razorpay webhook for tenant invoice payments. */
export async function companyWebhook(req: Request, res: Response) {
  const companyId = req.params.companyId;
  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
  const signature = req.get('X-Razorpay-Signature') ?? '';
  if (!(await verifyWebhookSignature(companyId, raw, signature))) {
    return res.status(401).json({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature' } });
  }
  const result = await handlePaymentCaptured(raw);
  return res.status(200).json({ success: true, data: result });
}

export async function saasRazorpayWebhook(req: Request, res: Response) {
  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
  const signature = req.get('X-Razorpay-Signature') ?? '';
  if (!verifySaasRazorpayWebhook(raw, signature)) {
    return res.status(401).json({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature' } });
  }
  const handled = await handleSaasRazorpayWebhook(raw);
  return res.status(200).json({ success: true, data: { handled } });
}

export async function saasStripeWebhook(req: Request, res: Response) {
  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
  const signature = req.get('Stripe-Signature') ?? '';
  if (!verifySaasStripeWebhook(raw, signature)) {
    return res.status(401).json({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature' } });
  }
  const handled = await handleSaasStripeWebhook(raw);
  return res.status(200).json({ success: true, data: { handled } });
}

export async function companyStripeWebhook(_req: Request, res: Response) {
  // Stripe invoice webhooks for tenant — placeholder for future Stripe invoice flow
  return res.status(200).json({ success: true, data: { handled: false } });
}
