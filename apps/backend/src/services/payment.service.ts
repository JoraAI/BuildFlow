/**
 * BuildFlow — Razorpay payment service.
 *
 *   createPaymentLink(invoiceId) -> Razorpay Payment Link + enqueues WhatsApp send
 *   verifyWebhookSignature(rawBody, signature) -> boolean (HMAC-SHA256)
 *   handlePaymentCaptured(paymentId, invoiceId) -> marks PAID + JournalEntry + notifies
 *
 * Idempotent: re-processing a captured payment is a no-op.
 */
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { notify } from './notification.service';

function num(d: Decimal | number | null | undefined): number {
  if (d === null || d === undefined) return 0;
  return typeof d === 'number' ? d : Number(d);
}

function client(): Razorpay | null {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return null;
  return new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });
}

export interface PaymentLinkResult {
  linkId: string;
  shortUrl: string;
  amount: number;
  currency: string;
}

/**
 * Create a Razorpay payment link for an invoice and (best-effort) WhatsApp the client.
 */
export async function createPaymentLink(
  companyId: string,
  invoiceId: string,
): Promise<PaymentLinkResult> {
  const invoice = await prisma.invoice.findFirstOrThrow({
    where: { id: invoiceId, companyId },
    include: { project: { select: { name: true, clientContact: true } } },
  });

  const rzp = client();
  if (!rzp) throw new Error('RAZORPAY_NOT_CONFIGURED');

  const amountPaise = Math.round(num(invoice.total) * 100);
  const link = await rzp.paymentLink.create({
    amount: amountPaise,
    currency: 'INR',
    description: `Payment for invoice ${invoice.invoiceNumber} (${invoice.project.name})`,
    reference_id: invoice.id,
    customer: {
      name: invoice.clientName,
      // contact/email optional in Razorpay; only pass if present
      ...(invoice.project.clientContact ? { contact: invoice.project.clientContact } : {}),
    },
    notify: { sms: true, email: false },
    reminder_enable: true,
  });

  // Best-effort WhatsApp to client (queued via notification job)
  if (invoice.project.clientContact) {
    try {
      await notify({
        userId: await getAnyCompanyIdUser(companyId),
        title: 'Invoice Payment Link',
        body: `Sent payment link ${link.short_url} to ${invoice.clientName}`,
        type: 'INVOICE_PAYMENT_LINK',
        referenceId: invoice.id,
        external: [
          {
            channel: 'WHATSAPP',
            to: invoice.project.clientContact,
            message: `Dear ${invoice.clientName}, your invoice ${invoice.invoiceNumber} for Rs ${num(invoice.total).toLocaleString('en-IN')} is ready. Pay here: ${link.short_url} — Reddy Constructions`,
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

/** Verify Razorpay webhook signature (HMAC-SHA256 of raw body). */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
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
        reference_id?: string; // = our invoice id
        amount?: number;
      };
    };
  };
}

/**
 * Handle `payment.captured` (or `payment_link.paid`). Idempotent.
 *   - Marks invoice PAID (paidAmount += captured)
 *   - Creates a balancing JournalEntry (Bank debit / Sales credit)
 *   - Notifies OWNER + ACCOUNTANT
 */
export async function handlePaymentCaptured(rawBody: string): Promise<{ handled: boolean; invoiceId?: string }> {
  const parsed = JSON.parse(rawBody) as RazorpayPaymentLinkPayload;
  const referenceId =
    parsed.payload?.payment_link?.entity?.reference_id ??
    parsed.payload?.payment?.entity?.notes?.invoice_id;
  if (!referenceId) return { handled: false };

  const invoice = await prisma.invoice.findFirst({
    where: { id: referenceId },
    include: { company: { select: { id: true } } },
  });
  if (!invoice) return { handled: false };

  // Idempotency: already fully paid
  if (invoice.status === 'PAID') return { handled: true, invoiceId: invoice.id };

  const capturedPaise = parsed.payload?.payment?.entity?.amount ?? num(invoice.total) * 100;
  const captured = capturedPaise / 100;

  await prisma.$transaction(async (tx) => {
    const newPaid = num(invoice.paidAmount) + captured;
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: newPaid,
        status: newPaid >= num(invoice.total) ? 'PAID' : invoice.status,
      },
    });
    await tx.journalEntry.create({
      data: {
        companyId: invoice.companyId,
        projectId: invoice.projectId,
        entryDate: new Date(),
        description: `Payment captured via Razorpay for ${invoice.invoiceNumber}`,
        reference: parsed.payload?.payment?.entity?.id ?? 'razorpay',
        debitAccount: 'Bank',
        creditAccount: 'Sales',
        amount: captured,
        createdBy: (await getAnyCompanyIdUser(invoice.companyId)),
      },
    });
  });

  // Notify finance roles
  const financeUsers = await prisma.user.findMany({
    where: { companyId: invoice.companyId, role: { in: ['OWNER', 'ACCOUNTANT'] } },
    select: { id: true },
  });
  await Promise.all(
    financeUsers.map((u) =>
      notify({
        userId: u.id,
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

/** Fallback helper to find an active user in a company (for created_by / journalEntry owned-by). */
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