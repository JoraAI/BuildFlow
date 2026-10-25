/**
 * Inventory cash book + daily sales summary (all inventory verticals).
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { round2 } from './gst.service';
import type { CreateCashBookEntryInput } from '@buildflow/shared';
import { assertInventoryFeature } from './module-gate.service';

function dayBounds(dateStr: string): { start: Date; end: Date } {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(`${dateStr}T23:59:59.999Z`);
  return { start, end };
}

async function assertCashBook(companyId: string) {
  await assertInventoryFeature(companyId, 'cash_book');
}

function serializeEntry(e: {
  id: string;
  entryDate: Date;
  direction: string;
  entryType: string;
  paymentMode: string;
  amount: { toNumber?(): number } | number;
  description: string;
  reference: string | null;
  category?: string | null;
  invoiceId: string | null;
  customerId: string | null;
  billId?: string | null;
  vendorId?: string | null;
  createdAt: Date;
}) {
  return {
    id: e.id,
    entryDate: e.entryDate,
    direction: e.direction,
    entryType: e.entryType,
    paymentMode: e.paymentMode,
    amount: Number(e.amount),
    description: e.description,
    reference: e.reference,
    category: e.category ?? null,
    invoiceId: e.invoiceId,
    customerId: e.customerId,
    billId: e.billId ?? null,
    vendorId: e.vendorId ?? null,
    createdAt: e.createdAt,
  };
}

/**
 * Post a cash-book row for inventory tenants when money actually moves
 * (invoice collection or vendor bill payment). Skips construction and CARD.
 */
export async function postAutoInventoryCashBook(
  tx: Prisma.TransactionClient,
  opts: {
    companyId: string;
    recordedBy: string;
    entryDate: Date;
    direction: 'IN' | 'OUT';
    entryType: 'SALE_COLLECTION' | 'VENDOR_PAYMENT';
    method?: string;
    amount: number;
    description: string;
    reference?: string | null;
    category?: string | null;
    invoiceId?: string | null;
    customerId?: string | null;
    billId?: string | null;
    vendorId?: string | null;
  },
): Promise<void> {
  const method = opts.method ?? 'BANK';
  if (method === 'CARD') return;
  const company = await tx.company.findFirst({
    where: { id: opts.companyId },
    select: { subscriptionPlan: true },
  });
  if (company?.subscriptionPlan !== 'INVENTORY') return;

  const paymentMode =
    method === 'UPI' ? 'UPI' : method === 'BANK' ? 'BANK' : method === 'OTHER' ? 'OTHER' : 'CASH';

  await tx.inventoryCashBookEntry.create({
    data: {
      companyId: opts.companyId,
      entryDate: opts.entryDate,
      direction: opts.direction,
      entryType: opts.entryType,
      paymentMode,
      amount: opts.amount,
      description: opts.description,
      reference: opts.reference ?? null,
      category: opts.category ?? null,
      invoiceId: opts.invoiceId ?? null,
      customerId: opts.customerId ?? null,
      billId: opts.billId ?? null,
      vendorId: opts.vendorId ?? null,
      recordedBy: opts.recordedBy,
    },
  });
}

export async function listCashBookDay(companyId: string, dateStr: string) {
  await assertCashBook(companyId);
  const { start, end } = dayBounds(dateStr);
  const entries = await prisma.inventoryCashBookEntry.findMany({
    where: { companyId, entryDate: { gte: start, lte: end } },
    orderBy: [{ createdAt: 'asc' }],
  });

  let opening = 0;
  let inTotal = 0;
  let outTotal = 0;
  for (const e of entries) {
    const amt = Number(e.amount);
    if (e.entryType === 'OPENING') opening += e.direction === 'IN' ? amt : -amt;
    else if (e.direction === 'IN') inTotal += amt;
    else outTotal += amt;
  }
  const closing = round2(opening + inTotal - outTotal);

  return {
    date: dateStr,
    opening,
    inTotal: round2(inTotal),
    outTotal: round2(outTotal),
    closing,
    entries: entries.map(serializeEntry),
  };
}

export async function createCashBookEntry(
  companyId: string,
  userId: string,
  input: CreateCashBookEntryInput,
) {
  await assertCashBook(companyId);
  if (input.invoiceId) {
    const inv = await prisma.invoice.findFirst({
      where: { id: input.invoiceId, companyId },
      select: { id: true },
    });
    if (!inv) throw ApiError.notFound('Invoice not found');
  }
  if (input.customerId) {
    const c = await prisma.customer.findFirst({
      where: { id: input.customerId, companyId },
      select: { id: true },
    });
    if (!c) throw ApiError.notFound('Customer not found');
  }

  // Duplicate guard: same day + type + amount + description within 2 minutes.
  const since = new Date(Date.now() - 2 * 60 * 1000);
  const dup = await prisma.inventoryCashBookEntry.findFirst({
    where: {
      companyId,
      entryDate: input.entryDate,
      entryType: input.entryType,
      amount: input.amount,
      description: input.description.trim(),
      createdAt: { gte: since },
    },
  });
  if (dup) {
    throw ApiError.badRequest('Duplicate cash book entry detected — wait a moment or change the description');
  }

  const category =
    input.entryType === 'EXPENSE' ? (input.category ?? 'OTHER') : input.category ?? null;

  const row = await prisma.inventoryCashBookEntry.create({
    data: {
      companyId,
      entryDate: input.entryDate,
      direction: input.direction,
      entryType: input.entryType,
      paymentMode: input.paymentMode,
      amount: input.amount,
      description: input.description.trim(),
      reference: input.reference?.trim() || null,
      category,
      invoiceId: input.invoiceId,
      customerId: input.customerId,
      recordedBy: userId,
    },
  });
  return serializeEntry(row);
}

export async function deleteCashBookEntry(companyId: string, id: string) {
  await assertCashBook(companyId);
  const existing = await prisma.inventoryCashBookEntry.findFirst({
    where: { id, companyId },
  });
  if (!existing) throw ApiError.notFound('Cash book entry not found');
  if (existing.entryType === 'SALE_COLLECTION' && existing.invoiceId) {
    throw ApiError.badRequest('Cannot delete auto-posted collection entries; reverse via invoice payment flow');
  }
  if (existing.entryType === 'VENDOR_PAYMENT') {
    throw ApiError.badRequest('Cannot delete auto-posted vendor payments; reverse via the bill payment flow');
  }
  await prisma.inventoryCashBookEntry.delete({ where: { id } });
  return { deleted: true };
}

/** Daily sales summary: invoices for the day + cash book movement. */
export async function getDailySalesSummary(companyId: string, dateStr: string) {
  await assertCashBook(companyId);
  const { start, end } = dayBounds(dateStr);

  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      invoiceDate: { gte: start, lte: end },
      status: { not: 'DRAFT' },
    },
    select: {
      id: true,
      invoiceNumber: true,
      clientName: true,
      subtotal: true,
      discountAmount: true,
      gstAmount: true,
      total: true,
      paidAmount: true,
      status: true,
    },
    orderBy: { invoiceNumber: 'asc' },
  });

  const cash = await listCashBookDay(companyId, dateStr);

  const invoiceCount = invoices.length;
  const gross = round2(invoices.reduce((s, i) => s + Number(i.subtotal), 0));
  const discount = round2(invoices.reduce((s, i) => s + Number(i.discountAmount), 0));
  const gst = round2(invoices.reduce((s, i) => s + Number(i.gstAmount), 0));
  const net = round2(invoices.reduce((s, i) => s + Number(i.total), 0));
  const collected = round2(invoices.reduce((s, i) => s + Number(i.paidAmount), 0));

  const byMode: Record<string, number> = { CASH: 0, UPI: 0, BANK: 0, OTHER: 0 };
  for (const e of cash.entries) {
    if (e.direction !== 'IN' || e.entryType === 'OPENING') continue;
    byMode[e.paymentMode] = round2((byMode[e.paymentMode] ?? 0) + e.amount);
  }

  const expenses = round2(
    cash.entries
      .filter((e) => e.entryType === 'EXPENSE' || (e.direction === 'OUT' && e.entryType !== 'DEPOSIT'))
      .reduce((s, e) => s + e.amount, 0),
  );
  const deposits = round2(
    cash.entries.filter((e) => e.entryType === 'DEPOSIT').reduce((s, e) => s + e.amount, 0),
  );

  const expensesByCategory: Record<string, number> = {};
  for (const e of cash.entries) {
    if (e.entryType !== 'EXPENSE') continue;
    const cat = e.category ?? 'OTHER';
    expensesByCategory[cat] = round2((expensesByCategory[cat] ?? 0) + e.amount);
  }

  return {
    date: dateStr,
    sales: {
      invoiceCount,
      gross,
      discount,
      gst,
      net,
      collected,
      outstanding: round2(net - collected),
    },
    cash: {
      opening: cash.opening,
      collectionsByMode: byMode,
      expenses,
      expensesByCategory,
      deposits,
      closing: cash.closing,
    },
    invoices: invoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      clientName: i.clientName,
      subtotal: Number(i.subtotal),
      discountAmount: Number(i.discountAmount),
      gstAmount: Number(i.gstAmount),
      total: Number(i.total),
      paidAmount: Number(i.paidAmount),
      status: i.status,
    })),
    entries: cash.entries,
  };
}

/** Expense totals by category for a date range (Excel / reports). */
export async function getExpensesByCategory(
  companyId: string,
  fromStr: string,
  toStr: string,
) {
  await assertCashBook(companyId);
  const { start } = dayBounds(fromStr);
  const { end } = dayBounds(toStr);
  const entries = await prisma.inventoryCashBookEntry.findMany({
    where: {
      companyId,
      entryType: 'EXPENSE',
      entryDate: { gte: start, lte: end },
    },
    orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }],
  });
  const byCategory: Record<string, number> = {};
  for (const e of entries) {
    const cat = e.category ?? 'OTHER';
    byCategory[cat] = round2((byCategory[cat] ?? 0) + Number(e.amount));
  }
  return {
    from: fromStr,
    to: toStr,
    total: round2(Object.values(byCategory).reduce((s, n) => s + n, 0)),
    byCategory,
    entries: entries.map(serializeEntry),
  };
}
