/**
 * BuildFlow - Razorpay payment service (tenant invoice collection).
 *
 * Credentials resolve per company via integration.service with platform fallback.
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

export async function verifyWebhookSignature(
  companyId: string,
  rawBody: string,
  signature: string,
): Promise<boolean> {
  const cfg = await resolveRazorpayConfig(companyId);
  if (!cfg?.webhookSecret) return false;
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
