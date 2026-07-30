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

type EntityType = 'indent' | 'bill' | 'invoice' | 'po' | 'grn';

const PREFIXES: Record<EntityType, string> = {
  indent: 'IND',
  bill: 'BILL',
  invoice: 'INV',
  po: 'PO',
  grn: 'GRN',
};

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

  const seq = String(counter.lastSeq).padStart(4, '0');
  return `${prefix}-${year}-${seq}`;
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