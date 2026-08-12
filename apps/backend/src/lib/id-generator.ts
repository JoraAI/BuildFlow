/**
 * BuildFlow - Race-safe sequential ID generator.
 *
 * FIX: SEC-M14 / FIN-H1 / DAT-1.2 / EST-M5 — Replaces the old count()-based
 * approach (which raced under concurrency and reused numbers after deletion)
 * with an atomic per-company, per-year DocumentCounter row.
 *
 * Generates human-readable, prefixed sequential numbers for entities:
 *   IND-2025-0001  (indent/requisition)
 *   BILL-2025-0001 (bill)
 *   INV-2025-0001  (invoice)
 *   PO-2025-0001   (purchase order)
 *   GRN-2025-0001  (goods receipt note)
 *
 * The counter is incremented atomically via Prisma `upsert` with
 * `update: { increment: 1 }` inside a transaction, which serializes on the
 * `@@unique([companyId, type, year])` row — guaranteeing no gaps and no reuse.
 */
import { prisma } from './prisma';
import { Prisma } from '@prisma/client';

// FIX (NR-32): Dedicated counter types for RFIs and submittals — previously
// these reused the 'invoice' counter and string-replaced the prefix, which
// raced with invoice numbering and could collide.
type EntityType =
  | 'indent'
  | 'bill'
  | 'invoice'
  | 'po'
  | 'grn'
  | 'petty-cash'
  | 'rfi'
  | 'submittal'
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 2): transaction engine doc numbers.
  | 'so'
  | 'dc'
  | 'sales-return'
  | 'purchase-return'
  | 'credit-note'
  | 'debit-note'
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 3): warehouse ops doc numbers.
  | 'transfer'
  | 'stock-count'
  // INVENTORY_HORIZONTAL_PLATFORM (Phase 9.2): quote document numbers.
  | 'quote';

const PREFIXES: Record<EntityType, string> = {
  indent: 'IND',
  bill: 'BILL',
  invoice: 'INV',
  po: 'PO',
  grn: 'GRN',
  'petty-cash': 'PC',
  rfi: 'RFI',
  submittal: 'SUB',
  so: 'SO',
  dc: 'DC',
  'sales-return': 'SRET',
  'purchase-return': 'PRET',
  'credit-note': 'CN',
  'debit-note': 'DN',
  transfer: 'TF',
  'stock-count': 'SC',
  quote: 'QT',
};

function formatNumber(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Preview the next number without consuming the counter.
 * Safe for form prefills — create still allocates via nextSequentialNumber
 * or resolveSequentialNumber.
 */
export async function peekNextSequentialNumber(
  companyId: string,
  type: EntityType,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = PREFIXES[type];
  const counter = await prisma.documentCounter.findUnique({
    where: { companyId_type_year: { companyId, type, year } },
    select: { lastSeq: true },
  });
  return formatNumber(prefix, year, (counter?.lastSeq ?? 0) + 1);
}

/**
 * If `provided` matches {PREFIX}-{YYYY}-{NNNN} for the current year, bump the
 * company counter so subsequent peeks do not re-suggest a used sequence.
 * Custom formats are left alone.
 */
async function bumpCounterIfNeeded(
  companyId: string,
  type: EntityType,
  provided: string,
): Promise<void> {
  const year = new Date().getFullYear();
  const prefix = PREFIXES[type];
  const match = provided.match(new RegExp(`^${prefix}-(\\d{4})-(\\d+)$`));
  if (!match) return;
  const numYear = Number(match[1]);
  const seq = Number(match[2]);
  if (numYear !== year || !Number.isFinite(seq) || seq < 1) return;

  const existing = await prisma.documentCounter.findUnique({
    where: { companyId_type_year: { companyId, type, year } },
    select: { lastSeq: true },
  });
  if (!existing) {
    await prisma.documentCounter.create({
      data: { companyId, type, year, lastSeq: seq },
    });
    return;
  }
  if (existing.lastSeq < seq) {
    await prisma.documentCounter.update({
      where: { companyId_type_year: { companyId, type, year } },
      data: { lastSeq: seq },
    });
  }
}

/**
 * Use an optional user-supplied number, or allocate the next sequential one.
 * When the user keeps a peeked suggestion (or types a same-format override),
 * the counter is advanced so peeks stay in sync.
 */
export async function resolveSequentialNumber(
  companyId: string,
  type: EntityType,
  provided?: string | null,
): Promise<string> {
  const trimmed = provided?.trim();
  if (!trimmed) {
    return nextSequentialNumber(companyId, type);
  }
  await bumpCounterIfNeeded(companyId, type, trimmed);
  return trimmed;
}

/**
 * Generate the next sequential number for the given entity type.
 * Format: {PREFIX}-{YYYY}-{NNNN}
 * Scoped per-company, resets each calendar year.
 *
 * Race-safe: the `upsert` + `increment` is atomic at the DB level. Two
 * concurrent callers will get distinct sequence numbers.
 */
export async function nextSequentialNumber(
  companyId: string,
  type: EntityType,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = PREFIXES[type];

  const counter = await prisma.documentCounter.upsert({
    where: {
      companyId_type_year: { companyId, type, year },
    },
    update: {
      lastSeq: { increment: 1 },
    },
    create: {
      companyId,
      type,
      year,
      lastSeq: 1,
    },
    select: { lastSeq: true },
  });

  return formatNumber(prefix, year, counter.lastSeq);
}

/**
 * Transaction-aware variant: accepts a Prisma transaction client so the
 * counter increment participates in the caller's transaction. Use this when
 * the document number must be generated inside the same atomic block that
 * creates the document (e.g. invoice creation).
 */
export async function nextSequentialNumberTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  type: EntityType,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = PREFIXES[type];

  const counter = await tx.documentCounter.upsert({
    where: {
      companyId_type_year: { companyId, type, year },
    },
    update: {
      lastSeq: { increment: 1 },
    },
    create: {
      companyId,
      type,
      year,
      lastSeq: 1,
    },
    select: { lastSeq: true },
  });

  const seq = String(counter.lastSeq).padStart(4, '0');
  return `${prefix}-${year}-${seq}`;
}