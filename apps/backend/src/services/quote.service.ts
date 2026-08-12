/**
 * BuildFlow - Quote → Sales Order service (INVENTORY_HORIZONTAL_PLATFORM Phase 9.2).
 *
 * Optional quote path: DRAFT → SENT → ACCEPTED/REJECTED. An ACCEPTED quote can be
 * converted to a Sales Order (lines/rates/customer copied) via the existing
 * `createSalesOrder` — the Issue → Invoice and SO → DC → Invoice paths are kept.
 */
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { assertProjectAccess } from '../middleware/project-access.middleware';
import { getDefaultProjectId } from './module-gate.service';
import { nextSequentialNumber } from '../lib/id-generator';
import { createSalesOrder } from './sales-order.service';
import type { CreateQuoteInput, QuoteStatusActionInput } from '@buildflow/shared';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function resolveProject(companyId: string, userId: string, role: string) {
  const projectId = await getDefaultProjectId(companyId);
  if (!projectId) throw ApiError.forbidden('Quotes are not available on this plan.');
  await assertProjectAccess(companyId, userId, role as never, projectId);
  return projectId;
}

function serializeQuote(q: {
  id: string;
  quoteNumber: string;
  customerName: string;
  status: string;
  quoteDate: Date;
  validUntil: Date | null;
  subtotal: unknown;
  gstAmount: unknown;
  total: unknown;
  notes: string | null;
  createdAt: Date;
  salesOrderId: string | null;
  customer?: { id: string; name: string } | null;
  lines: Array<{
    id: string;
    resourceId: string;
    itemName: string;
    unit: string;
    quantity: unknown;
    rate: unknown;
    amount: unknown;
    gstRate: unknown;
  }>;
}) {
  return {
    id: q.id,
    quoteNumber: q.quoteNumber,
    customerId: q.customer?.id ?? null,
    customerName: q.customer?.name ?? q.customerName,
    status: q.status,
    quoteDate: q.quoteDate.toISOString().slice(0, 10),
    validUntil: q.validUntil ? q.validUntil.toISOString().slice(0, 10) : null,
    subtotal: Number(q.subtotal),
    gstAmount: Number(q.gstAmount),
    total: Number(q.total),
    notes: q.notes,
    salesOrderId: q.salesOrderId,
    createdAt: q.createdAt.toISOString(),
    lines: q.lines.map((l) => ({
      id: l.id,
      resourceId: l.resourceId,
      itemName: l.itemName,
      unit: l.unit,
      quantity: Number(l.quantity),
      rate: Number(l.rate),
      amount: Number(l.amount),
      gstRate: Number(l.gstRate),
    })),
  };
}

export async function createQuote(
  companyId: string,
  userId: string,
  role: string,
  input: CreateQuoteInput,
) {
  const projectId = await resolveProject(companyId, userId, role);

  let customerName = input.customerName.trim();
  if (input.customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: input.customerId, companyId },
      select: { name: true },
    });
    if (!customer) throw ApiError.notFound('Customer not found');
    customerName = customer.name;
  }

  const resources = await prisma.resource.findMany({
    where: { id: { in: input.lines.map((l) => l.resourceId) }, companyId },
    select: { id: true, name: true, unit: true },
  });
  const byId = new Map(resources.map((r) => [r.id, r]));

  let subtotal = 0;
  let gstAmount = 0;
  const lines = input.lines.map((l) => {
    const r = byId.get(l.resourceId);
    if (!r) throw ApiError.notFound('Resource not found');
    const amount = round2(l.quantity * l.rate);
    const gstRate = l.gstRate ?? 18;
    subtotal += amount;
    gstAmount += round2(amount * (gstRate / 100));
    return {
      resourceId: l.resourceId,
      itemName: r.name,
      unit: l.unit || r.unit,
      quantity: l.quantity,
      rate: l.rate,
      amount,
      gstRate,
    };
  });

  const quote = await prisma.quote.create({
    data: {
      companyId,
      projectId,
      quoteNumber: input.quoteNumber || (await nextSequentialNumber(companyId, 'quote')),
      customerId: input.customerId ?? null,
      customerName,
      status: 'DRAFT',
      quoteDate: input.quoteDate ?? new Date(),
      validUntil: input.validUntil ?? null,
      subtotal: round2(subtotal),
      gstAmount: round2(gstAmount),
      total: round2(subtotal + gstAmount),
      notes: input.notes?.trim() || null,
      lines: { create: lines },
    },
    include: { lines: true, customer: { select: { id: true, name: true } } },
  });
  return serializeQuote(quote);
}

export async function listQuotes(companyId: string, userId: string, role: string) {
  const projectId = await resolveProject(companyId, userId, role);
  const quotes = await prisma.quote.findMany({
    where: { companyId, projectId },
    include: { lines: true, customer: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return quotes.map(serializeQuote);
}

export async function getQuote(companyId: string, userId: string, role: string, quoteId: string) {
  await resolveProject(companyId, userId, role);
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, companyId },
    include: { lines: true, customer: { select: { id: true, name: true } } },
  });
  if (!quote) throw ApiError.notFound('Quote not found');
  return serializeQuote(quote);
}

export async function updateQuoteStatus(
  companyId: string,
  userId: string,
  role: string,
  quoteId: string,
  action: QuoteStatusActionInput['action'],
) {
  await resolveProject(companyId, userId, role);
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, companyId },
    include: { lines: true, customer: { select: { id: true, name: true } } },
  });
  if (!quote) throw ApiError.notFound('Quote not found');

  const next = action === 'send' ? 'SENT' : action === 'accept' ? 'ACCEPTED' : 'REJECTED';
  const allowed: Record<string, string[]> = {
    send: ['DRAFT'],
    accept: ['SENT', 'DRAFT'],
    reject: ['SENT', 'DRAFT'],
  };
  if (!allowed[action]!.includes(quote.status)) {
    throw ApiError.badRequest(`Cannot ${action} a ${quote.status} quote.`);
  }

  const updated = await prisma.quote.update({
    where: { id: quote.id },
    data: { status: next as never },
    include: { lines: true, customer: { select: { id: true, name: true } } },
  });
  return serializeQuote(updated);
}

/** Convert an ACCEPTED quote into a Sales Order (reuses createSalesOrder). */
export async function createSalesOrderFromQuote(
  companyId: string,
  userId: string,
  role: string,
  quoteId: string,
) {
  const projectId = await resolveProject(companyId, userId, role);
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, companyId, projectId },
    include: { lines: true },
  });
  if (!quote) throw ApiError.notFound('Quote not found');
  if (quote.status !== 'ACCEPTED') {
    throw ApiError.badRequest('Only ACCEPTED quotes can be converted to a sales order.');
  }
  if (quote.salesOrderId) {
    throw ApiError.badRequest('This quote has already been converted to a sales order.');
  }

  const salesOrder = await createSalesOrder(companyId, userId, role, {
    customerId: quote.customerId ?? undefined,
    customerName: quote.customerName,
    orderDate: quote.quoteDate,
    expectedDelivery: quote.validUntil ?? undefined,
    notes: quote.notes?.trim() || undefined,
    lines: quote.lines.map((l) => ({
      resourceId: l.resourceId,
      quantity: Number(l.quantity),
      unit: l.unit,
      rate: Number(l.rate),
      gstRate: Number(l.gstRate),
    })),
  });

  await prisma.quote.update({
    where: { id: quote.id },
    data: { salesOrderId: salesOrder.id },
  });

  return {
    salesOrder,
    quote: { ...serializeQuote({ ...quote, customer: null }), salesOrderId: salesOrder.id },
  };
}

