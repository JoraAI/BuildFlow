/**
 * BuildFlow - Tally Prime XML export service.
 *
 * Exports invoices as Sales vouchers and bills as Purchase vouchers in
 * Tally Prime-compatible import XML format.
 *
 * Ledger name mapping is configurable via env (TALLY_LEDGER_MAP JSON).
 */
import { prisma } from '../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { INDIAN_STATES } from '@buildflow/shared';
import { resolveTallyLedgerMap, type TallyLedgerMap } from './integration.service';

const AMP = `&${'amp;'}`;
const LT = `&${'lt;'}`;
const GT = `&${'gt;'}`;
const QUOT = `&${'quot;'}`;

function esc(s: string): string {
  return s
    .replace(/&/g, AMP)
    .replace(/</g, LT)
    .replace(/>/g, GT)
    .replace(/"/g, QUOT);
}

/**
 * FIX (FIN-M3): Format a date in IST (Asia/Kolkata) for Tally, which expects
 * YYYYMMDD. Previously this used the server's local timezone (getMonth/
 * getDate), causing off-by-one-day errors when the server ran in UTC - a
 * voucher dated 2025-04-30 IST would export as 20250429 if the server was
 * still on 2025-04-29 UTC.
 */
function fmtDate(d: Date): string {
  const istStr = d.toLocaleString('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // en-CA produces YYYY-MM-DD; strip the dashes for Tally's YYYYMMDD format.
  return istStr.replace(/-/g, '');
}

function fmtNum(n: Decimal | number): string {
  const v = typeof n === 'number' ? n : Number(n);
  // Tally wants decimal point, no thousands separators
  return v.toFixed(2);
}

/**
 * FIX (NR-4/FIN-H5): Derive a party's state from an Indian GSTIN.
 * GSTIN format: 2-digit state code + 10-char PAN + 1 entity + 1 Z + 1 checksum.
 * Returns the state code (e.g. "27" for Maharashtra) or null if no GSTIN /
 * malformed GSTIN. Used to split bill GST into CGST/SGST (intra-state) vs
 * IGST (inter-state) without requiring a separate vendorState column.
 */
function stateFromGstin(gstin: string | null | undefined): string | null {
  if (!gstin) return null;
  const code = gstin.trim().slice(0, 2);
  return /^\d{2}$/.test(code) ? code : null;
}

const STATE_CODE_BY_NAME = new Map(
  INDIAN_STATES.map((s) => [s.name.toUpperCase(), s.code]),
);

/**
 * FIX (R2-7): Normalize company/vendor state to a 2-digit GST code when possible.
 */
export function normalizeStateCode(gstin: string | null | undefined, state: string | null | undefined): string {
  const fromGstin = stateFromGstin(gstin);
  if (fromGstin) return fromGstin;
  const s = (state ?? '').trim();
  if (/^\d{2}$/.test(s)) return s;
  return STATE_CODE_BY_NAME.get(s.toUpperCase()) ?? '';
}

/** Build a single sales voucher XML (one per invoice). */
export function buildSalesVoucher(
  inv: {
    id: string;
    invoiceNumber: string;
    clientName: string;
    invoiceDate: Date;
    subtotal: Decimal;
    gstAmount?: Decimal;
    cgstAmount: Decimal;
    sgstAmount: Decimal;
    igstAmount: Decimal;
    tdsAmount: Decimal;
    retentionAmount: Decimal;
    total: Decimal;
  },
  m: TallyLedgerMap,
): string {
  const party = inv.clientName;
  const lines: string[] = [];
  lines.push('  <VOUCHER VCHTYPE="Sales" ACTION="Create">');
  lines.push(`    <NAME>${esc(inv.invoiceNumber)}</NAME>`);
  lines.push(`    <DATE>${fmtDate(inv.invoiceDate)}</DATE>`);
  lines.push(`    <PARTYNAME>${esc(party)}</PARTYNAME>`);
  lines.push('    <NARRATION>BuildFlow export</NARRATION>');

  // Party ledger (debit = total receivable)
  lines.push('    <ALLLEDGERENTRIES.LIST>');
  lines.push(`      <LEDGERNAME>${esc(party)}</LEDGERNAME>`);
  lines.push(`      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>`);
  lines.push(`      <AMOUNT>${fmtNum(inv.total)}</AMOUNT>`);
  lines.push('    </ALLLEDGERENTRIES.LIST>');

  // Sales (credit)
  lines.push('    <ALLLEDGERENTRIES.LIST>');
  lines.push(`      <LEDGERNAME>${esc(m.sales ?? 'Sales')}</LEDGERNAME>`);
  lines.push(`      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>`);
  lines.push(`      <AMOUNT>-${fmtNum(inv.subtotal)}</AMOUNT>`);
  lines.push('    </ALLLEDGERENTRIES.LIST>');

  // Prefer split GST fields; fall back to gstAmount when splits were never persisted (seed / legacy).
  let cgst = Number(inv.cgstAmount);
  let sgst = Number(inv.sgstAmount);
  let igst = Number(inv.igstAmount);
  const gstTotal = Number(inv.gstAmount ?? 0);
  if (cgst + sgst + igst === 0 && gstTotal > 0) {
    igst = gstTotal;
  }

  // CGST
  if (cgst > 0) {
    lines.push('    <ALLLEDGERENTRIES.LIST>');
    lines.push(`      <LEDGERNAME>${esc(m.cgst ?? 'CGST')}</LEDGERNAME>`);
    lines.push(`      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>`);
    lines.push(`      <AMOUNT>-${fmtNum(cgst)}</AMOUNT>`);
    lines.push('    </ALLLEDGERENTRIES.LIST>');
  }
  // SGST
  if (sgst > 0) {
    lines.push('    <ALLLEDGERENTRIES.LIST>');
    lines.push(`      <LEDGERNAME>${esc(m.sgst ?? 'SGST')}</LEDGERNAME>`);
    lines.push(`      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>`);
    lines.push(`      <AMOUNT>-${fmtNum(sgst)}</AMOUNT>`);
    lines.push('    </ALLLEDGERENTRIES.LIST>');
  }
  // IGST
  if (igst > 0) {
    lines.push('    <ALLLEDGERENTRIES.LIST>');
    lines.push(`      <LEDGERNAME>${esc(m.igst ?? 'IGST')}</LEDGERNAME>`);
    lines.push(`      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>`);
    lines.push(`      <AMOUNT>-${fmtNum(igst)}</AMOUNT>`);
    lines.push('    </ALLLEDGERENTRIES.LIST>');
  }
  // TDS deducted
  if (Number(inv.tdsAmount) > 0) {
    lines.push('    <ALLLEDGERENTRIES.LIST>');
    lines.push(`      <LEDGERNAME>${esc(m.tdsPayable ?? 'TDS Payable')}</LEDGERNAME>`);
    lines.push(`      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>`);
    lines.push(`      <AMOUNT>${fmtNum(inv.tdsAmount)}</AMOUNT>`);
    lines.push('    </ALLLEDGERENTRIES.LIST>');
  }
  // FIX (FIN-H5 / Round 40): invoice.total is post-retention. Retention held by the
  // client is a receivable asset → debit Retention Money (not credit). Balance:
  // +total + retention + tds − subtotal − tax = 0.
  if (Number(inv.retentionAmount) > 0) {
    lines.push('    <ALLLEDGERENTRIES.LIST>');
    lines.push(`      <LEDGERNAME>${esc(m.retention ?? 'Retention Money')}</LEDGERNAME>`);
    lines.push(`      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>`);
    lines.push(`      <AMOUNT>${fmtNum(inv.retentionAmount)}</AMOUNT>`);
    lines.push('    </ALLLEDGERENTRIES.LIST>');
  }

  lines.push('  </VOUCHER>');
  return lines.join('\n');
}

/**
 * Build a single purchase voucher XML (one per bill).
 *
 * FIX (FIN-H5, FIN-L5, NR-4): Split bill GST into CGST/SGST vs IGST based on
 * whether the vendor is in the same state as the company (intra-state) or a
 * different state (inter-state). The vendor state is derived from vendorGstin
 * (first 2 digits = state code) - previously the code read a nonexistent
 * `bill.vendorState` field, so EVERY bill was mis-split as intra-state (CGST/
 * SGST) regardless of the vendor's actual state.
 *
 * Round 40: subcontract bills use
 * `total = subtotal + gst − retention − advanceRecovery − tds`. Credit
 * retention / advance-recovery ledgers so the voucher balances.
 */
export function buildPurchaseVoucher(
  bill: {
    id: string;
    billNumber: string;
    vendorName: string;
    vendorGstin: string | null;
    billDate: Date;
    subtotal: Decimal;
    gstAmount: Decimal;
    tdsAmount: Decimal;
    retentionAmount?: Decimal | null;
    advanceRecoveryAmount?: Decimal | null;
    total: Decimal;
  },
  m: TallyLedgerMap,
  companyStateCode: string,
): string {
  const party = bill.vendorName;
  const lines: string[] = [];
  lines.push('  <VOUCHER VCHTYPE="Purchase" ACTION="Create">');
  lines.push(`    <NAME>${esc(bill.billNumber)}</NAME>`);
  lines.push(`    <DATE>${fmtDate(bill.billDate)}</DATE>`);
  lines.push(`    <PARTYNAME>${esc(party)}</PARTYNAME>`);
  lines.push('    <NARRATION>BuildFlow export</NARRATION>');

  // Party (credit = payable)
  lines.push('    <ALLLEDGERENTRIES.LIST>');
  lines.push(`      <LEDGERNAME>${esc(party)}</LEDGERNAME>`);
  lines.push(`      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>`);
  lines.push(`      <AMOUNT>-${fmtNum(bill.total)}</AMOUNT>`);
  lines.push('    </ALLLEDGERENTRIES.LIST>');

  // Purchase (debit)
  lines.push('    <ALLLEDGERENTRIES.LIST>');
  lines.push(`      <LEDGERNAME>${esc(m.purchase ?? 'Purchases')}</LEDGERNAME>`);
  lines.push(`      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>`);
  lines.push(`      <AMOUNT>${fmtNum(bill.subtotal)}</AMOUNT>`);
  lines.push('    </ALLLEDGERENTRIES.LIST>');

  // FIX (FIN-H5/NR-4): Split GST based on the vendor's state derived from GSTIN.
  if (Number(bill.gstAmount) > 0) {
    const vendorStateCode = stateFromGstin(bill.vendorGstin);
    const companyCode = companyStateCode;
    // Inter-state if we know both states and they differ. If vendor has no
    // GSTIN (unregistered vendor) there is no GST to split anyway, so this only
    // matters when gstAmount > 0, which implies a registered vendor.
    const isInterState =
      !!vendorStateCode && !!companyCode && vendorStateCode !== companyCode;
    const gst = Number(bill.gstAmount);
    if (isInterState) {
      // IGST
      lines.push('    <ALLLEDGERENTRIES.LIST>');
      lines.push(`      <LEDGERNAME>${esc(m.igst ?? 'IGST')}</LEDGERNAME>`);
      lines.push(`      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>`);
      lines.push(`      <AMOUNT>${fmtNum(gst)}</AMOUNT>`);
      lines.push('    </ALLLEDGERENTRIES.LIST>');
    } else {
      // CGST + SGST (50/50 split)
      const half = Number((gst / 2).toFixed(2));
      lines.push('    <ALLLEDGERENTRIES.LIST>');
      lines.push(`      <LEDGERNAME>${esc(m.cgst ?? 'CGST')}</LEDGERNAME>`);
      lines.push(`      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>`);
      lines.push(`      <AMOUNT>${fmtNum(half)}</AMOUNT>`);
      lines.push('    </ALLLEDGERENTRIES.LIST>');
      lines.push('    <ALLLEDGERENTRIES.LIST>');
      lines.push(`      <LEDGERNAME>${esc(m.sgst ?? 'SGST')}</LEDGERNAME>`);
      lines.push(`      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>`);
      lines.push(`      <AMOUNT>${fmtNum(gst - half)}</AMOUNT>`);
      lines.push('    </ALLLEDGERENTRIES.LIST>');
    }
  }
  // Retention withheld from vendor (credit / liability)
  if (Number(bill.retentionAmount ?? 0) > 0) {
    lines.push('    <ALLLEDGERENTRIES.LIST>');
    lines.push(`      <LEDGERNAME>${esc(m.retention ?? 'Retention Money')}</LEDGERNAME>`);
    lines.push(`      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>`);
    lines.push(`      <AMOUNT>-${fmtNum(Number(bill.retentionAmount))}</AMOUNT>`);
    lines.push('    </ALLLEDGERENTRIES.LIST>');
  }
  // Advance recovered against this bill (credit)
  if (Number(bill.advanceRecoveryAmount ?? 0) > 0) {
    lines.push('    <ALLLEDGERENTRIES.LIST>');
    lines.push(`      <LEDGERNAME>${esc(m.advanceRecovery ?? 'Advance Recovery')}</LEDGERNAME>`);
    lines.push(`      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>`);
    lines.push(`      <AMOUNT>-${fmtNum(Number(bill.advanceRecoveryAmount))}</AMOUNT>`);
    lines.push('    </ALLLEDGERENTRIES.LIST>');
  }
  // TDS
  if (Number(bill.tdsAmount) > 0) {
    lines.push('    <ALLLEDGERENTRIES.LIST>');
    lines.push(`      <LEDGERNAME>${esc(m.tdsPayable ?? 'TDS Payable')}</LEDGERNAME>`);
    lines.push(`      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>`);
    lines.push(`      <AMOUNT>-${fmtNum(bill.tdsAmount)}</AMOUNT>`);
    lines.push('    </ALLLEDGERENTRIES.LIST>');
  }

  lines.push('  </VOUCHER>');
  return lines.join('\n');
}

/**
 * INVENTORY_HORIZONTAL_PLATFORM (Phase 2.4): Tally export hook - sales returns
 * appear as "Credit Note" vouchers and purchase returns as "Debit Note".
 * GST-aware: reduces/raises the party balance with the reverse GST split.
 */
function buildCreditNoteVoucher(
  cn: { creditNoteNumber: string; creditDate: Date; customerName: string; subtotal: Decimal; gstAmount: Decimal; cgstAmount?: Decimal; sgstAmount?: Decimal; igstAmount?: Decimal; total: Decimal },
  m: TallyLedgerMap,
): string {
  const party = cn.customerName;
  const lines: string[] = [];
  lines.push('  <VOUCHER VCHTYPE="Credit Note" ACTION="Create">');
  lines.push(`    <NAME>${esc(cn.creditNoteNumber)}</NAME>`);
  lines.push(`    <DATE>${fmtDate(cn.creditDate)}</DATE>`);
  lines.push(`    <PARTYNAME>${esc(party)}</PARTYNAME>`);
  lines.push('    <NARRATION>BuildFlow credit note (sales return)</NARRATION>');
  lines.push('    <ALLLEDGERENTRIES.LIST>');
  lines.push(`      <LEDGERNAME>${esc(party)}</LEDGERNAME>`);
  lines.push(`      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>`);
  lines.push(`      <AMOUNT>-${fmtNum(cn.total)}</AMOUNT>`);
  lines.push('    </ALLLEDGERENTRIES.LIST>');
  lines.push('    <ALLLEDGERENTRIES.LIST>');
  lines.push(`      <LEDGERNAME>${esc(m.sales ?? 'Sales')}</LEDGERNAME>`);
  lines.push(`      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>`);
  lines.push(`      <AMOUNT>${fmtNum(cn.subtotal)}</AMOUNT>`);
  lines.push('    </ALLLEDGERENTRIES.LIST>');
  pushNoteGstEntries(lines, m, cn, false);
  lines.push('  </VOUCHER>');
  return lines.join('\n');
}

/**
 * INVENTORY_HORIZONTAL_PLATFORM (Phase 5.5): emit the note's GST split
 * (CGST/SGST same-state, IGST inter-state). Falls back to flat IGST for notes
 * created before the split columns existed.
 */
function pushNoteGstEntries(
  lines: string[],
  m: TallyLedgerMap,
  gst: { gstAmount: Decimal | number; cgstAmount?: Decimal | number | null; sgstAmount?: Decimal | number | null; igstAmount?: Decimal | number | null },
  positive: boolean,
): void {
  let cgst = Number(gst.cgstAmount ?? 0);
  let sgst = Number(gst.sgstAmount ?? 0);
  let igst = Number(gst.igstAmount ?? 0);
  const gstTotal = Number(gst.gstAmount ?? 0);
  if (cgst + sgst + igst === 0 && gstTotal > 0) igst = gstTotal;
  const deem = positive ? 'Yes' : 'No';
  const push = (ledger: string | undefined, name: string, amount: number) => {
    if (amount <= 0) return;
    lines.push('    <ALLLEDGERENTRIES.LIST>');
    lines.push(`      <LEDGERNAME>${esc(ledger ?? name)}</LEDGERNAME>`);
    lines.push(`      <ISDEEMEDPOSITIVE>${deem}</ISDEEMEDPOSITIVE>`);
    lines.push(`      <AMOUNT>${fmtNum(amount)}</AMOUNT>`);
    lines.push('    </ALLLEDGERENTRIES.LIST>');
  };
  push(m.cgst, 'CGST', cgst);
  push(m.sgst, 'SGST', sgst);
  push(m.igst, 'IGST', igst);
}

function buildDebitNoteVoucher(
  dn: { debitNoteNumber: string; debitDate: Date; vendorName: string; subtotal: Decimal; gstAmount: Decimal; cgstAmount?: Decimal; sgstAmount?: Decimal; igstAmount?: Decimal; total: Decimal },
  m: TallyLedgerMap,
): string {
  const party = dn.vendorName;
  const lines: string[] = [];
  lines.push('  <VOUCHER VCHTYPE="Debit Note" ACTION="Create">');
  lines.push(`    <NAME>${esc(dn.debitNoteNumber)}</NAME>`);
  lines.push(`    <DATE>${fmtDate(dn.debitDate)}</DATE>`);
  lines.push(`    <PARTYNAME>${esc(party)}</PARTYNAME>`);
  lines.push('    <NARRATION>BuildFlow debit note (purchase return)</NARRATION>');
  lines.push('    <ALLLEDGERENTRIES.LIST>');
  lines.push(`      <LEDGERNAME>${esc(party)}</LEDGERNAME>`);
  lines.push(`      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>`);
  lines.push(`      <AMOUNT>-${fmtNum(dn.total)}</AMOUNT>`);
  lines.push('    </ALLLEDGERENTRIES.LIST>');
  lines.push('    <ALLLEDGERENTRIES.LIST>');
  lines.push(`      <LEDGERNAME>${esc(m.purchase ?? 'Purchases')}</LEDGERNAME>`);
  lines.push(`      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>`);
  lines.push(`      <AMOUNT>${fmtNum(dn.subtotal)}</AMOUNT>`);
  lines.push('    </ALLLEDGERENTRIES.LIST>');
  pushNoteGstEntries(lines, m, dn, true);
  lines.push('  </VOUCHER>');
  return lines.join('\n');
}

/** Export a project's invoices and bills as Tally Prime import XML. */
export async function exportProjectTallyXML(companyId: string, projectId: string): Promise<string> {
  const m = await resolveTallyLedgerMap(companyId);
  // FIX (NR-4): Derive the company's state CODE from its GSTIN so it compares
  // against the vendor's GSTIN-derived state code on the same basis.
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { gstin: true, state: true } });
  const companyStateCode = normalizeStateCode(company?.gstin, company?.state);

  const [invoices, bills, creditNotes, debitNotes] = await Promise.all([
    prisma.invoice.findMany({
      where: { companyId, projectId, status: { in: ['SENT', 'PAID', 'OVERDUE'] } },
    }),
    prisma.bill.findMany({
      where: { companyId, projectId, status: { in: ['APPROVED', 'PAID'] } },
    }),
    // INVENTORY_HORIZONTAL_PLATFORM (Phase 2.4): sales-return credit notes.
    prisma.creditNote.findMany({
      where: { companyId, projectId, status: 'ISSUED' },
      select: { creditNoteNumber: true, creditDate: true, customerName: true, subtotal: true, gstAmount: true, cgstAmount: true, sgstAmount: true, igstAmount: true, total: true },
    }),
    prisma.debitNote.findMany({
      where: { companyId, projectId, status: 'ISSUED' },
      select: { debitNoteNumber: true, debitDate: true, vendorName: true, subtotal: true, gstAmount: true, cgstAmount: true, sgstAmount: true, igstAmount: true, total: true },
    }),
  ]);

  const parts: string[] = [];
  parts.push('<ENVELOP>');
  parts.push('  <HEADER>');
  parts.push('    <TALLYREQUEST>Import Data</TALLYREQUEST>');
  parts.push('  </HEADER>');
  parts.push('  <BODY>');
  parts.push('    <IMPORTDATA>');
  parts.push('      <REQUESTDESC>');
  parts.push('        <TALLYIMPORTVCHTYPE>Sales</TALLYIMPORTVCHTYPE>');
  parts.push('        <TALLYIMPORTVCHTYPE>Purchase</TALLYIMPORTVCHTYPE>');
  parts.push('        <TALLYIMPORTVCHTYPE>Credit Note</TALLYIMPORTVCHTYPE>');
  parts.push('        <TALLYIMPORTVCHTYPE>Debit Note</TALLYIMPORTVCHTYPE>');
  parts.push('      </REQUESTDESC>');
  parts.push('      <REQUESTDATA>');
  for (const inv of invoices) parts.push(buildSalesVoucher(inv, m));
  for (const bill of bills) parts.push(buildPurchaseVoucher(bill, m, companyStateCode));
  for (const cn of creditNotes) parts.push(buildCreditNoteVoucher(cn, m));
  for (const dn of debitNotes) parts.push(buildDebitNoteVoucher(dn, m));
  parts.push('      </REQUESTDATA>');
  parts.push('    </IMPORTDATA>');
  parts.push('  </BODY>');
  parts.push('</ENVELOP>');
  return parts.join('\n');
}

/** Sum all `<AMOUNT>…</AMOUNT>` values in a voucher/XML fragment (balance check). */
export function sumLedgerAmounts(xml: string): number {
  let sum = 0;
  const re = /<AMOUNT>(-?\d+(?:\.\d+)?)<\/AMOUNT>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    sum += Number(m[1]);
  }
  return Math.round(sum * 100) / 100;
}