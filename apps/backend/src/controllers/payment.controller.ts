/**
 * BuildFlow — Payment controller (Razorpay).
 *   POST /api/invoices/:id/payment-link  -> create link (auth)
 *   POST /api/webhooks/razorpay          -> public webhook (HMAC verified)
 */
import type { Request, Response } from 'express';
import {
  createPaymentLink,
  handlePaymentCaptured,
  verifyWebhookSignature,
} from '../services/payment.service';
import { ok } from '../utils/response';
import { ApiError } from '../utils/errors';

/** Authed: create a Razorpay payment link for an invoice. */
export async function createLink(req: Request, res: Response) {
  const companyId = req.user!.companyId;
  const invoiceId = req.params.id;
  try {
    const link = await createPaymentLink(companyId, invoiceId);
    return ok(res, link);
  } catch (err) {
    if (err instanceof Error && err.message === 'RAZORPAY_NOT_CONFIGURED') {
      throw ApiError.badRequest('Razorpay is not configured for this deployment');
    }
    throw err;
  }
}

/**
 * Public webhook. Express must be configured with `{ verify }` for this route so
 * `req.body` is the raw string for HMAC verification.
 */
export async function webhook(req: Request, res: Response) {
  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
  const signature = req.get('X-Razorpay-Signature') ?? '';
  if (!verifyWebhookSignature(raw, signature)) {
    return res.status(401).json({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature' } });
  }
  const result = await handlePaymentCaptured(raw);
  if (!result.handled) {
    return res.status(200).json({ success: true, data: { handled: false } });
  }
  return res.status(200).json({ success: true, data: result });
}