/**
 * Inventory cash book + daily sales summary (all inventory verticals).
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/errors';
import { recordAudit } from '../utils/audit';
import { round2 } from './gst.service';
import type {
  CreateCashBookCategoryInput,
  CreateCashBookEntryInput,
  UpdateCashBookCategoryInput,
} from '@buildflow/shared';
import { CASH_EXPENSE_CATEGORIES, slugifyCashCategory } from '@buildflow/shared';
import { assertInventoryFeature } from './module-gate.service';

function dayBounds(dateStr: string): { start: Date; end: Date } {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(`${dateStr}T23:59:59.999Z`);
  return { start, end };
}

async function assertCashBook(companyId: string) {
  await assertInventoryFeature(companyId, 'cash_book');
}

function presetLabel(slug: string): string {
  return slug
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

function serializeCategory(c: {
  id: string;
  name: string;
  slug: string;
  isPreset: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    isPreset: c.isPreset,
    archivedAt: c.archivedAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function serializeEntry(
  e: {
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
    recorder?: { name: string } | null;
  },
  categoryNames?: Record<string, string>,
) {
  const slug = e.category ?? null;
  return {
    id: e.id,
    entryDate: e.entryDate,
    direction: e.direction,
    entryType: e.entryType,
    paymentMode: e.paymentMode,
    amount: Number(e.amount),
    description: e.description,
    reference: e.reference,
    category: slug,
    categoryName: slug ? (categoryNames?.[slug] ?? presetLabel(slug)) : null,
    invoiceId: e.invoiceId,
    customerId: e.customerId,
    billId: e.billId ?? null,
    vendorId: e.vendorId ?? null,
    recordedByName: e.recorder?.name ?? null,
    createdAt: e.createdAt,
  };
}

type SerializedCashEntry = ReturnType<typeof serializeEntry>;

async function categoryNameMap(companyId: string): Promise<Record<string, string>> {
  const rows = await prisma.inventoryCashBookCategory.findMany({
    where: { companyId },
    select: { slug: true, name: true },
  });
  return Object.fromEntries(rows.map((r) => [r.slug, r.name]));
}

async function recordCashBookAudit(opts: {
  companyId: string;
  userId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: 'cash_book_entry' | 'cash_book_category';
  entityId: string;
  summary: string;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  await recordAudit({
    companyId: opts.companyId,
    userId: opts.userId,
    action: opts.action,
    entityType: opts.entityType,
    entityId: opts.entityId,
    oldValue: opts.oldValue,
    newValue: {
      summary: opts.summary,
      ...(opts.newValue && typeof opts.newValue === 'object' && !Array.isArray(opts.newValue)
        ? (opts.newValue as Record<string, unknown>)
        : {}),
    },
  });
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
): Promise<SerializedCashEntry | null> {
  const method = opts.method ?? 'BANK';
  if (method === 'CARD') return null;
  const company = await tx.company.findFirst({
    where: { id: opts.companyId },
    select: { subscriptionPlan: true },
  });
  if (company?.subscriptionPlan !== 'INVENTORY') return null;

  const paymentMode =
    method === 'UPI' ? 'UPI' : method === 'BANK' ? 'BANK' : method === 'OTHER' ? 'OTHER' : 'CASH';

  const row = await tx.inventoryCashBookEntry.create({
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
  return serializeEntry(row);
}

export async function auditAutoCashBookPost(
  companyId: string,
  userId: string,
  entry: SerializedCashEntry,
) {
  const kind = entry.entryType === 'VENDOR_PAYMENT' ? 'vendor payment' : 'sale collection';
  await recordCashBookAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'cash_book_entry',
    entityId: entry.id,
    summary: `posted ${kind} ₹${Number(entry.amount).toFixed(2)} — ${entry.description}`,
    newValue: {
      direction: entry.direction,
      entryType: entry.entryType,
      amount: entry.amount,
      description: entry.description,
      invoiceId: entry.invoiceId,
      billId: entry.billId,
    },
  });
}

export async function listCashBookDay(companyId: string, dateStr: string) {
  await assertCashBook(companyId);
  const { start, end } = dayBounds(dateStr);
  const [entries, names] = await Promise.all([
    prisma.inventoryCashBookEntry.findMany({
      where: { companyId, entryDate: { gte: start, lte: end } },
      orderBy: [{ createdAt: 'asc' }],
      include: { recorder: { select: { name: true } } },
    }),
    categoryNameMap(companyId),
  ]);

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
    entries: entries.map((e) => serializeEntry(e, names)),
  };
}

async function ensurePresetCategories(companyId: string, userId: string) {
  const count = await prisma.inventoryCashBookCategory.count({ where: { companyId } });
  if (count > 0) return;
  await prisma.inventoryCashBookCategory.createMany({
    data: CASH_EXPENSE_CATEGORIES.map((slug) => ({
      companyId,
      slug,
      name: presetLabel(slug),
      isPreset: true,
      createdBy: userId,
    })),
  });
}

export async function listCashBookCategories(companyId: string, userId: string) {
  await assertCashBook(companyId);
  await ensurePresetCategories(companyId, userId);
  const rows = await prisma.inventoryCashBookCategory.findMany({
    where: { companyId, archivedAt: null },
    orderBy: [{ isPreset: 'desc' }, { name: 'asc' }],
  });
  return rows.map(serializeCategory);
}

export async function createCashBookCategory(
  companyId: string,
  userId: string,
  input: CreateCashBookCategoryInput,
) {
  await assertCashBook(companyId);
  await ensurePresetCategories(companyId, userId);
  const name = input.name.trim();
  const slug = slugifyCashCategory(name);
  const existing = await prisma.inventoryCashBookCategory.findUnique({
    where: { companyId_slug: { companyId, slug } },
  });
  if (existing && !existing.archivedAt) {
    throw ApiError.conflict(`Category "${existing.name}" already exists`);
  }
  const row = existing
    ? await prisma.inventoryCashBookCategory.update({
        where: { id: existing.id },
        data: { name, archivedAt: null },
      })
    : await prisma.inventoryCashBookCategory.create({
        data: { companyId, name, slug, isPreset: false, createdBy: userId },
      });
  await recordCashBookAudit({
    companyId,
    userId,
    action: existing ? 'UPDATE' : 'CREATE',
    entityType: 'cash_book_category',
    entityId: row.id,
    summary: existing
      ? `restored cash book category "${row.name}"`
      : `added cash book category "${row.name}"`,
    newValue: { name: row.name, slug: row.slug },
  });
  return serializeCategory(row);
}

export async function updateCashBookCategory(
  companyId: string,
  userId: string,
  id: string,
  input: UpdateCashBookCategoryInput,
) {
  await assertCashBook(companyId);
  const existing = await prisma.inventoryCashBookCategory.findFirst({
    where: { id, companyId },
  });
  if (!existing) throw ApiError.notFound('Category not found');
  const name = input.name.trim();
  if (!name) throw ApiError.badRequest('Category name is required');
  const row = await prisma.inventoryCashBookCategory.update({
    where: { id },
    data: { name, archivedAt: null },
  });
  await recordCashBookAudit({
    companyId,
    userId,
    action: 'UPDATE',
    entityType: 'cash_book_category',
    entityId: row.id,
    summary: `renamed cash book category "${existing.name}" to "${row.name}"`,
    oldValue: { name: existing.name, slug: existing.slug },
    newValue: { name: row.name, slug: row.slug },
  });
  return serializeCategory(row);
}

export async function deleteCashBookCategory(companyId: string, userId: string, id: string) {
  await assertCashBook(companyId);
  const existing = await prisma.inventoryCashBookCategory.findFirst({
    where: { id, companyId },
  });
  if (!existing) throw ApiError.notFound('Category not found');
  const used = await prisma.inventoryCashBookEntry.count({
    where: { companyId, category: existing.slug },
  });
  if (used > 0) {
    const row = await prisma.inventoryCashBookCategory.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    await recordCashBookAudit({
      companyId,
      userId,
      action: 'DELETE',
      entityType: 'cash_book_category',
      entityId: row.id,
      summary: `hid cash book category "${existing.name}" (${used} existing entries kept)`,
      oldValue: { name: existing.name, slug: existing.slug, used },
    });
    return { deleted: false, archived: true, used };
  }
  await prisma.inventoryCashBookCategory.delete({ where: { id } });
  await recordCashBookAudit({
    companyId,
    userId,
    action: 'DELETE',
    entityType: 'cash_book_category',
    entityId: existing.id,
    summary: `deleted cash book category "${existing.name}"`,
    oldValue: { name: existing.name, slug: existing.slug },
  });
  return { deleted: true, archived: false, used: 0 };
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

  await ensurePresetCategories(companyId, userId);
  let category =
    input.entryType === 'EXPENSE' ? (input.category ?? 'OTHER') : input.category ?? null;
  if (input.entryType === 'EXPENSE' && category) {
    const slug = slugifyCashCategory(category);
    const cat = await prisma.inventoryCashBookCategory.findFirst({
      where: { companyId, slug, archivedAt: null },
    });
    if (!cat) throw ApiError.badRequest('Unknown or hidden expense category');
    category = cat.slug;
  }

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
    include: { recorder: { select: { name: true } } },
  });
  const names = await categoryNameMap(companyId);
  const serialized = serializeEntry(row, names);
  await recordCashBookAudit({
    companyId,
    userId,
    action: 'CREATE',
    entityType: 'cash_book_entry',
    entityId: row.id,
    summary: `recorded ${row.direction === 'IN' ? 'inflow' : 'outflow'} ₹${serialized.amount.toFixed(2)} (${row.entryType.replace(/_/g, ' ').toLowerCase()}${serialized.categoryName ? ` · ${serialized.categoryName}` : ''}) — ${row.description}`,
    newValue: {
      direction: row.direction,
      entryType: row.entryType,
      amount: serialized.amount,
      category: row.category,
      description: row.description,
    },
  });
  return serialized;
}

export async function deleteCashBookEntry(companyId: string, userId: string, id: string) {
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
  await recordCashBookAudit({
    companyId,
    userId,
    action: 'DELETE',
    entityType: 'cash_book_entry',
    entityId: existing.id,
    summary: `deleted cash book ${existing.direction === 'IN' ? 'inflow' : 'outflow'} ₹${Number(existing.amount).toFixed(2)} — ${existing.description}`,
    oldValue: {
      direction: existing.direction,
      entryType: existing.entryType,
      amount: Number(existing.amount),
      description: existing.description,
      category: existing.category,
    },
  });
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
    const cat = e.categoryName ?? e.category ?? 'OTHER';
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
  const [entries, names] = await Promise.all([
    prisma.inventoryCashBookEntry.findMany({
      where: {
        companyId,
        entryType: 'EXPENSE',
        entryDate: { gte: start, lte: end },
      },
      orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }],
      include: { recorder: { select: { name: true } } },
    }),
    categoryNameMap(companyId),
  ]);
  const byCategory: Record<string, number> = {};
  for (const e of entries) {
    const cat = names[e.category ?? ''] ?? e.category ?? 'OTHER';
    byCategory[cat] = round2((byCategory[cat] ?? 0) + Number(e.amount));
  }
  return {
    from: fromStr,
    to: toStr,
    total: round2(Object.values(byCategory).reduce((s, n) => s + n, 0)),
    byCategory,
    entries: entries.map((e) => serializeEntry(e, names)),
  };
}
