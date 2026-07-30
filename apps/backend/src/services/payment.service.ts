/**
 * BuildFlow - Razorpay payment service (tenant invoice collection).
 *
 * SECURITY (SEC-H7/FIN-C2): Webhook verification requires a PER-COMPANY
 * webhook secret — there is no platform fallback for tenant invoice payments.
 * `handlePaymentCaptured` is scoped to the verified `companyId`, requires an
 * explicit captured amount from the payload (never defaults to invoice.total),
 * dedupes on the Razorpay payment id for idempotency, and only transitions
 * invoice status forward.
 */
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { prisma } from '../lib/prisma';
import { logger } from '../config/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { notify } from './notification.service';
import { resolveRazorpayConfig } from './integration.service';

function num(d: Decimal | number | null | undefined): number {
  if (d === null || d === undefined) return 0;
  return typeof d === 'number' ? d : Number(d);
}

async function clientFor(companyId: string): Promise<Razorpay | null> {
  const cfg = await resolveRazorpayConfig(companyId);
  if (!cfg) return null;
  return new Razorpay({ key_id: cfg.keyId, key_secret: cfg.keySecret });
}

export interface PaymentLinkResult {
  linkId: string;
  shortUrl: string;
  amount: number;
  currency: string;
}

export async function createPaymentLink(
  companyId: string,
  invoiceId: string,
): Promise<PaymentLinkResult> {
  const invoice = await prisma.invoice.findFirstOrThrow({
    where: { id: invoiceId, companyId },
    include: {
      project: { select: { name: true, clientContact: true } },
      company: { select: { name: true } },
    },
  });

  const rzp = await clientFor(companyId);
  if (!rzp) throw new Error('RAZORPAY_NOT_CONFIGURED');

  const amountPaise = Math.round(num(invoice.total) * 100);
  const link = await rzp.paymentLink.create({
    amount: amountPaise,
    currency: 'INR',
    description: `Payment for invoice ${invoice.invoiceNumber} (${invoice.project.name})`,
    reference_id: invoice.id,
    customer: {
      name: invoice.clientName,
      ...(invoice.project.clientContact ? { contact: invoice.project.clientContact } : {}),
    },
    notify: { sms: true, email: false },
    reminder_enable: true,
  });

  if (invoice.project.clientContact) {
    try {
      await notify({
        userId: await getAnyCompanyIdUser(companyId),
        companyId,
        title: 'Invoice Payment Link',
        body: `Sent payment link ${link.short_url} to ${invoice.clientName}`,
        type: 'INVOICE_PAYMENT_LINK',
        referenceId: invoice.id,
        external: [
          {
            channel: 'WHATSAPP',
            to: invoice.project.clientContact,
            message: `Dear ${invoice.clientName}, your invoice ${invoice.invoiceNumber} for Rs ${num(invoice.total).toLocaleString('en-IN')} is ready. Pay here: ${link.short_url} - ${invoice.company.name}`,
          },
        ],
      });
    } catch (err) {
      logger.warn('WhatsApp client notify failed (non-fatal)', { error: String(err) });
    }
  }

  return {
    linkId: link.id,
    shortUrl: link.short_url,
    amount: num(invoice.total),
    currency: 'INR',
  };
}

/**
 * Verify the per-company Razorpay webhook HMAC signature.
 *
 * SECURITY (SEC-H7): A per-company `webhookSecret` is REQUIRED. We do NOT fall
 * back to the platform secret for tenant invoice payments — otherwise one
 * tenant could settle another's invoices.
 */
export async function verifyWebhookSignature(
  companyId: string,
  rawBody: string,
  signature: string,
): Promise<boolean> {
  const cfg = await resolveRazorpayConfig(companyId);
  // Require an explicit per-company webhook secret. No platform fallback.
  if (!cfg?.webhookSecret) {
    // Distinguish company-has-no-secret from a genuine signature mismatch for logs.
    logger.warn('Razorpay webhook rejected: no per-company webhook secret', { companyId });
    return false;
  }
  const expected = crypto.createHmac('sha256', cfg.webhookSecret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

interface RazorpayPaymentLinkPayload {
  event: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        amount?: number;
        notes?: { invoice_id?: string } | Record<string, string>;
      };
    };
    payment_link?: {
      entity?: {
        reference_id?: string;
        amount?: number;
      };
    };
  };
}

/**
 * Handle a verified `payment.captured` webhook.
 *
 * @param companyId The company resolved from the verified webhook path/secret.
 * @param rawBody   The raw webhook body (already signature-verified).
 *
 * Security invariants enforced here (FIN-C2):
 *  - Invoice is looked up by `id` AND `companyId` (the verified company).
 *  - An explicit captured amount from the payload is REQUIRED; we never default
 *    to `invoice.total`.
 *  - Idempotency: we dedupe on the Razorpay payment id so replays can't inflate
 *    `paidAmount`.
 *  - Status only moves forward (e.g. PARTIAL → PAID), never backward.
 */
export async function handlePaymentCaptured(
  companyId: string,
  rawBody: string,
): Promise<{ handled: boolean; invoiceId?: string }> {
  const parsed = JSON.parse(rawBody) as RazorpayPaymentLinkPayload;
  const paymentId = parsed.payload?.payment?.entity?.id;
  const referenceId =
    parsed.payload?.payment_link?.entity?.reference_id ??
    parsed.payload?.payment?.entity?.notes?.invoice_id;
  if (!referenceId) return { handled: false };

  // Scope the invoice to the VERIFIED company.
  const invoice = await prisma.invoice.findFirst({
    where: { id: referenceId, companyId },
    include: { company: { select: { id: true } } },
  });
  if (!invoice) return { handled: false };

  // Idempotency: if we've already recorded this Razorpay payment id, stop.
  if (paymentId) {
    const already = await prisma.journalEntry.findFirst({
      where: { companyId: invoice.companyId, reference: paymentId },
      select: { id: true },
    });
    if (already) return { handled: true, invoiceId: invoice.id };
  }

  // SECURITY (FIN-C2): require an explicit captured amount — never default to total.
  const capturedPaise = parsed.payload?.payment?.entity?.amount;
  if (capturedPaise === undefined || capturedPaise === null || !Number.isFinite(capturedPaise)) {
    logger.warn('Razorpay webhook rejected: missing/invalid captured amount', {
      invoiceId: invoice.id,
      paymentId,
    });
    return { handled: false };
  }
  const captured = capturedPaise / 100;
  if (captured <= 0) {
    logger.warn('Razorpay webhook rejected: non-positive captured amount', {
      invoiceId: invoice.id,
      paymentId,
      capturedPaise,
    });
    return { handled: false };
  }

  // Only transition status forward, and guard against overpayment.
  const invoiceTotal = num(invoice.total);
  const newPaid = Math.min(num(invoice.paidAmount) + captured, invoiceTotal);
  const newStatus = newPaid >= invoiceTotal ? 'PAID' : invoice.status === 'PAID' ? 'PAID' : invoice.status;

  await prisma.$transaction(async (tx) => {
    // Guarded update: only apply if the invoice is not already fully PAID.
    const updated = await tx.invoice.updateMany({
      where: { id: invoice.id, status: { not: 'PAID' } },
      data: { paidAmount: newPaid, status: newStatus },
    });
    if (updated.count === 0) {
      // Already PAID — treat as already-handled (idempotent).
      return;
    }
    await tx.journalEntry.create({
      data: {
        companyId: invoice.companyId,
        projectId: invoice.projectId,
        entryDate: new Date(),
        description: `Payment captured via Razorpay for ${invoice.invoiceNumber}`,
        reference: paymentId ?? 'razorpay',
        debitAccount: 'Bank',
        creditAccount: 'Sales',
        amount: captured,
        createdBy: await getAnyCompanyIdUser(invoice.companyId),
      },
    });
  });

  const financeUsers = await prisma.user.findMany({
    where: { companyId: invoice.companyId, role: { in: ['OWNER', 'ACCOUNTANT'] } },
    select: { id: true },
  });
  await Promise.all(
    financeUsers.map((u) =>
      notify({
        userId: u.id,
        companyId: invoice.companyId,
        title: 'Payment Received',
        body: `Rs ${captured.toLocaleString('en-IN')} received for invoice ${invoice.invoiceNumber}.`,
        type: 'PAYMENT_CAPTURED',
        referenceId: invoice.id,
        channels: ['PUSH', 'WHATSAPP'],
      }),
    ),
  );

  return { handled: true, invoiceId: invoice.id };
}

async function getAnyCompanyIdUser(companyId: string): Promise<string> {
  const u = await prisma.user.findFirst({
    where: { companyId, role: 'OWNER', isActive: true },
    select: { id: true },
  });
  if (u) return u.id;
  const anyUser = await prisma.user.findFirst({ where: { companyId, isActive: true }, select: { id: true } });
  if (anyUser) return anyUser.id;
  throw new Error(`No active user in company ${companyId}`);
}