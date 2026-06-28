/**
 * BuildFlow — Tally Prime XML export service.
 *
 * Exports invoices as Sales vouchers and bills as Purchase vouchers in
 * Tally Prime-compatible import XML format.
 *
 * Ledger name mapping is configurable via env (TALLY_LEDGER_MAP JSON).
 */
import { prisma } from '../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
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

function fmtDate(d: Date): string {
  // Tally expects YYYYMMDD
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function fmtNum(n: Decimal | number): string {
  const v = typeof n === 'number' ? n : Number(n);
  // Tally wants decimal point, no thousands separators
  return v.toFixed(2);
}

/** Build a single sales voucher XML (one per invoice). */
function buildSalesVoucher(
  inv: {
    id: string;
    invoiceNumber: string;
    clientName: string;
    invoiceDate: Date;
    subtotal: Decimal;
    cgstAmount: Decimal;
    sgstAmount: Decimal;
    igstAmount: Decimal;
    tdsAmount: Decimal;
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

  // CGST
  if (Number(inv.cgstAmount) > 0) {
    lines.push('    <ALLLEDGERENTRIES.LIST>');
    lines.push(`      <LEDGERNAME>${esc(m.cgst ?? 'CGST')}</LEDGERNAME>`);
    lines.push(`      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>`);
    lines.push(`      <AMOUNT>-${fmtNum(inv.cgstAmount)}</AMOUNT>`);
    lines.push('    </ALLLEDGERENTRIES.LIST>');
  }
  // SGST
  if (Number(inv.sgstAmount) > 0) {
    lines.push('    <ALLLEDGERENTRIES.LIST>');
    lines.push(`      <LEDGERNAME>${esc(m.sgst ?? 'SGST')}</LEDGERNAME>`);
    lines.push(`      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>`);
    lines.push(`      <AMOUNT>-${fmtNum(inv.sgstAmount)}</AMOUNT>`);
    lines.push('    </ALLLEDGERENTRIES.LIST>');
  }
  // IGST
  if (Number(inv.igstAmount) > 0) {
    lines.push('    <ALLLEDGERENTRIES.LIST>');
    lines.push(`      <LEDGERNAME>${esc(m.igst ?? 'IGST')}</LEDGERNAME>`);
    lines.push(`      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>`);
    lines.push(`      <AMOUNT>-${fmtNum(inv.igstAmount)}</AMOUNT>`);
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

  lines.push('  </VOUCHER>');
  return lines.join('\n');
}

/** Build a single purchase voucher XML (one per bill). */
function buildPurchaseVoucher(
  bill: {
    id: string;
    billNumber: string;
    vendorName: string;
    billDate: Date;
    subtotal: Decimal;
    gstAmount: Decimal;
    tdsAmount: Decimal;
    total: Decimal;
  },
  m: TallyLedgerMap,
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

  // GST
  if (Number(bill.gstAmount) > 0) {
    lines.push('    <ALLLEDGERENTRIES.LIST>');
    lines.push(`      <LEDGERNAME>${esc(m.igst ?? 'IGST')}</LEDGERNAME>`);
    lines.push(`      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>`);
    lines.push(`      <AMOUNT>${fmtNum(bill.gstAmount)}</AMOUNT>`);
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

/** Export a project's invoices and bills as Tally Prime import XML. */
export async function exportProjectTallyXML(companyId: string, projectId: string): Promise<string> {
  const m = await resolveTallyLedgerMap(companyId);
  const [invoices, bills] = await Promise.all([
    prisma.invoice.findMany({
      where: { companyId, projectId, status: { in: ['SENT', 'PAID', 'OVERDUE'] } },
    }),
    prisma.bill.findMany({
      where: { companyId, projectId, status: { in: ['APPROVED', 'PAID'] } },
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
  parts.push('      </REQUESTDESC>');
  parts.push('      <REQUESTDATA>');
  for (const inv of invoices) parts.push(buildSalesVoucher(inv, m));
  for (const bill of bills) parts.push(buildPurchaseVoucher(bill, m));
  parts.push('      </REQUESTDATA>');
  parts.push('    </IMPORTDATA>');
  parts.push('  </BODY>');
  parts.push('</ENVELOP>');
  return parts.join('\n');
}