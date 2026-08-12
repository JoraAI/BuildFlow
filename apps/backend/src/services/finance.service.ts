/**
 * BuildFlow - Finance depth service (INVENTORY_HORIZONTAL_PLATFORM Phase 5).
 *
 * 5.1/5.2 Weighted-average cost (WAC): running `Resource.avgCost` per company,
 *     updated on stock IN; OUT movements carry the current WAC as metadata on
 *     `StockMovement.unitCost` / `inventoryValue`.
 * 5.3 Party ledgers (customer AR / vendor AP) with running balance.
 * 5.5 GST state split helper for credit/debit notes (CGST/SGST vs IGST).
 *
 * WAC v1 is company-wide (not per warehouse); FIFO deferred, LIFO not built.
 */
import { prisma } from '../lib/prisma';
import type { Prisma } from '@prisma/client';
import { normalizeStateCode } from './tally.service';

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/* ── 5.2 Weighted-average cost ────────────────────────────────────── */

/**
 * Update the running WAC on a stock IN. Standard weighted average:
 *   newAvg = (onHand × oldAvg + qty × unitCost) / (onHand + qty)
 * Returns the new average unit cost (rounded to 4dp).
 */
export async function updateWacOnIn(
  tx: Pick<typeof prisma, 'resource'>,
  resourceId: string,
  onHand: number,
  qty: number,
  unitCost: number,
): Promise<number> {
  const resource = await tx.resource.findUnique({
    where: { id: resourceId },
    select: { avgCost: true },
  });
  const oldAvg = Number(resource?.avgCost ?? 0);
  const totalQty = onHand + qty;
  const newAvg = totalQty > 0 ? (onHand * oldAvg + qty * unitCost) / totalQty : unitCost;
  const rounded = round4(newAvg);
  await tx.resource.update({ where: { id: resourceId }, data: { avgCost: rounded } });
  return rounded;
}

/** Current WAC unit cost for a resource (0 when never stocked). */
export async function getCurrentWac(resourceId: string): Promise<number> {
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    select: { avgCost: true },
  });
  return Number(resource?.avgCost ?? 0);
}

/** Round-trip a Decimal for ledger math. */
export function toNum(d: { toNumber(): number } | number | string | null | undefined): number {
  if (d == null) return 0;
  return Number(typeof d === 'number' ? d : d.toString());
}

/* ── 5.5 GST state split (credit/debit notes) ─────────────────────── */

export interface GstSplit {
  cgst: number;
  sgst: number;
  igst: number;
}

/**
 * Split a GST amount into CGST/SGST (same-state party) or IGST (inter-state).
 * Party state may be a 2-digit GST code, a full state name, or a GSTIN -
 * normalized the same way the tally export does.
 */
export function splitGstByState(
  companyState: string | null | undefined,
  companyGstin: string | null | undefined,
  partyState: string | null | undefined,
  partyGstin: string | null | undefined,
  gstAmount: number,
): GstSplit {
  const companyCode = normalizeStateCode(companyGstin, companyState);
  const partyCode = normalizeStateCode(partyGstin, partyState);
  const sameState = !!companyCode && companyCode === partyCode;
  if (sameState && gstAmount > 0) {
    const half = round2(gstAmount / 2);
    return { cgst: half, sgst: round2(gstAmount - half), igst: 0 };
  }
  return { cgst: 0, sgst: 0, igst: round2(gstAmount) };
}

/* ── 5.3 Party ledgers ────────────────────────────────────────────── */

export interface LedgerEntry {
  date: string;
  type: 'INVOICE' | 'PAYMENT' | 'CREDIT_NOTE' | 'BILL' | 'DEBIT_NOTE';
  refNumber: string;
  /** Signed: invoices/bills +, payments/notes −. */
  amount: number;
  /** Running balance after this entry. */
  balance: number;
}

export interface PartyLedger {
  partyId: string;
  partyName: string;
  outstanding: number;
  entries: LedgerEntry[];
}

export async function getCustomerLedger(
  companyId: string,
  customerId: string,
): Promise<PartyLedger> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
    select: { id: true, name: true },
  });
  if (!customer) {
    const err = new Error('Customer not found') as Error & { status?: number };
    err.status = 404;
    throw err;
  }

  const [invoices, creditNotes] = await Promise.all([
    prisma.invoice.findMany({
      where: { companyId, customerId, status: { in: ['SENT', 'PAID', 'OVERDUE'] } },
      orderBy: { invoiceDate: 'asc' },
      select: { invoiceNumber: true, invoiceDate: true, total: true, paidAmount: true },
    }),
    prisma.creditNote.findMany({
      where: { companyId, customerId, status: 'ISSUED' },
      orderBy: { creditDate: 'asc' },
      select: { creditNoteNumber: true, creditDate: true, total: true },
    }),
  ]);

  const raw: Array<{ date: Date; type: LedgerEntry['type']; refNumber: string; amount: number }> = [];
  for (const inv of invoices) {
    const total = toNum(inv.total);
    const paid = toNum(inv.paidAmount);
    raw.push({ date: inv.invoiceDate, type: 'INVOICE', refNumber: inv.invoiceNumber, amount: total });
    if (paid > 0) {
      raw.push({ date: inv.invoiceDate, type: 'PAYMENT', refNumber: inv.invoiceNumber, amount: -paid });
    }
  }
  for (const cn of creditNotes) {
    raw.push({ date: cn.creditDate, type: 'CREDIT_NOTE', refNumber: cn.creditNoteNumber, amount: -toNum(cn.total) });
  }

  raw.sort((a, b) => a.date.getTime() - b.date.getTime());
  let running = 0;
  const entries = raw.map((e) => {
    running = round2(running + e.amount);
    return {
      date: e.date.toISOString().slice(0, 10),
      type: e.type,
      refNumber: e.refNumber,
      amount: round2(e.amount),
      balance: running,
    };
  });

  const outstanding = round2(
    invoices.reduce((s, i) => s + (toNum(i.total) - toNum(i.paidAmount)), 0) -
      creditNotes.reduce((s, c) => s + toNum(c.total), 0),
  );

  return { partyId: customer.id, partyName: customer.name, outstanding, entries };
}
export async function getVendorLedger(
  companyId: string,
  vendorId: string,
): Promise<PartyLedger> {
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, companyId },
    select: { id: true, name: true },
  });
  if (!vendor) {
    const err = new Error('Vendor not found') as Error & { status?: number };
    err.status = 404;
    throw err;
  }

  const [bills, debitNotes] = await Promise.all([
    prisma.bill.findMany({
      where: { companyId, vendorId, status: { in: ['PENDING', 'APPROVED', 'PAID'] } },
      orderBy: { billDate: 'asc' },
      select: { billNumber: true, billDate: true, total: true, paidAmount: true, paidAt: true },
    }),
    prisma.debitNote.findMany({
      where: { companyId, vendorId, status: 'ISSUED' },
      orderBy: { debitDate: 'asc' },
      select: { debitNoteNumber: true, debitDate: true, total: true },
    }),
  ]);

  const raw: Array<{ date: Date; type: LedgerEntry['type']; refNumber: string; amount: number }> = [];
  for (const b of bills) {
    const total = toNum(b.total);
    const paid = toNum(b.paidAmount);
    raw.push({ date: b.billDate, type: 'BILL', refNumber: b.billNumber, amount: total });
    if (paid > 0) {
      raw.push({ date: b.paidAt ?? b.billDate, type: 'PAYMENT', refNumber: b.billNumber, amount: -paid });
    }
  }
  for (const dn of debitNotes) {
    raw.push({ date: dn.debitDate, type: 'DEBIT_NOTE', refNumber: dn.debitNoteNumber, amount: -toNum(dn.total) });
  }

  raw.sort((a, b) => a.date.getTime() - b.date.getTime());
  let running = 0;
  const entries = raw.map((e) => {
    running = round2(running + e.amount);
    return {
      date: e.date.toISOString().slice(0, 10),
      type: e.type,
      refNumber: e.refNumber,
      amount: round2(e.amount),
      balance: running,
    };
  });

  const outstanding = round2(
    bills.reduce((s, b) => s + (toNum(b.total) - toNum(b.paidAmount)), 0) -
      debitNotes.reduce((s, d) => s + toNum(d.total), 0),
  );

  return { partyId: vendor.id, partyName: vendor.name, outstanding, entries };
}

/** Prisma transaction client shape used by WAC helpers. */
export type FinanceTx = Prisma.TransactionClient;

