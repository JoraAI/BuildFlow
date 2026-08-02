/**
 * BuildFlow - Accounting export service (Phase 5 §8.7).
 *
 * Provides multi-format accounting exports beyond Tally XML:
 *  1. CSV general ledger (journal entries)
 *  2. CSV sales register (invoices)
 *  3. CSV purchase register (bills)
 *  4. Excel workbook with multiple sheets (via exceljs)
 *  5. QuickBooks-compatible journal entry CSV
 */
import { prisma } from '../lib/prisma';

function csvEscape(s: string | number | null | undefined): string {
  let str = String(s ?? '');
  if (/^[=+\-@]/.test(str)) str = `'${str}`;
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCSV(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','));
  }
  return lines.join('\n');
}

export async function exportJournalEntriesCSV(companyId: string, opts: { projectId?: string; fromDate?: string; toDate?: string }): Promise<string> {
  const where: Record<string, unknown> = { companyId };
  if (opts.projectId) where.projectId = opts.projectId;
  if (opts.fromDate || opts.toDate) {
    where.entryDate = {};
    if (opts.fromDate) (where.entryDate as Record<string, unknown>).gte = new Date(opts.fromDate);
    if (opts.toDate) (where.entryDate as Record<string, unknown>).lte = new Date(opts.toDate);
  }
  const entries = await prisma.journalEntry.findMany({ where, orderBy: { entryDate: 'asc' }, include: { project: { select: { name: true } } } });
  const headers = ['Date', 'Description', 'Reference', 'Debit Account', 'Credit Account', 'Amount', 'Project'];
  const rows = entries.map((e) => [e.entryDate.toISOString().slice(0, 10), e.description ?? '', e.reference ?? '', e.debitAccount, e.creditAccount, Number(e.amount).toFixed(2), e.project?.name ?? '']);
  return toCSV(headers, rows);
}

export async function exportSalesRegisterCSV(companyId: string, opts: { projectId?: string; fromDate?: string; toDate?: string }): Promise<string> {
  const where: Record<string, unknown> = { companyId, status: { in: ['SENT', 'PAID', 'OVERDUE'] } };
  if (opts.projectId) where.projectId = opts.projectId;
  if (opts.fromDate || opts.toDate) {
    where.invoiceDate = {};
    if (opts.fromDate) (where.invoiceDate as Record<string, unknown>).gte = new Date(opts.fromDate);
    if (opts.toDate) (where.invoiceDate as Record<string, unknown>).lte = new Date(opts.toDate);
  }
  const invoices = await prisma.invoice.findMany({ where, orderBy: { invoiceDate: 'asc' }, include: { project: { select: { name: true } } } });
  const headers = ['Invoice No', 'Date', 'Client', 'Client GSTIN', 'Subtotal', 'GST', 'CGST', 'SGST', 'IGST', 'TDS', 'Total', 'Paid', 'Status', 'Type', 'Project'];
  const rows = invoices.map((i) => [i.invoiceNumber, i.invoiceDate.toISOString().slice(0, 10), i.clientName, i.clientGstin ?? '', Number(i.subtotal).toFixed(2), Number(i.gstAmount).toFixed(2), Number(i.cgstAmount).toFixed(2), Number(i.sgstAmount).toFixed(2), Number(i.igstAmount).toFixed(2), Number(i.tdsAmount).toFixed(2), Number(i.total).toFixed(2), Number(i.paidAmount).toFixed(2), i.status, i.invoiceType, i.project?.name ?? '']);
  return toCSV(headers, rows);
}

export async function exportPurchaseRegisterCSV(companyId: string, opts: { projectId?: string; fromDate?: string; toDate?: string }): Promise<string> {
  const where: Record<string, unknown> = { companyId, status: { not: 'REJECTED' } };
  if (opts.projectId) where.projectId = opts.projectId;
  if (opts.fromDate || opts.toDate) {
    where.billDate = {};
    if (opts.fromDate) (where.billDate as Record<string, unknown>).gte = new Date(opts.fromDate);
    if (opts.toDate) (where.billDate as Record<string, unknown>).lte = new Date(opts.toDate);
  }
  const bills = await prisma.bill.findMany({ where, orderBy: { billDate: 'asc' }, include: { project: { select: { name: true } } } });
  const headers = ['Bill No', 'Date', 'Vendor', 'Vendor GSTIN', 'Subtotal', 'GST', 'TDS', 'Total', 'Paid', 'Status', 'Category', 'Project'];
  const rows = bills.map((b) => [b.billNumber, b.billDate.toISOString().slice(0, 10), b.vendorName, b.vendorGstin ?? '', Number(b.subtotal).toFixed(2), Number(b.gstAmount).toFixed(2), Number(b.tdsAmount).toFixed(2), Number(b.total).toFixed(2), Number(b.paidAmount).toFixed(2), b.status, b.category, b.project?.name ?? '']);
  return toCSV(headers, rows);
}

export async function exportQuickBooksJournalCSV(companyId: string, opts: { projectId?: string; fromDate?: string; toDate?: string }): Promise<string> {
  const where: Record<string, unknown> = { companyId };
  if (opts.projectId) where.projectId = opts.projectId;
  if (opts.fromDate || opts.toDate) {
    where.entryDate = {};
    if (opts.fromDate) (where.entryDate as Record<string, unknown>).gte = new Date(opts.fromDate);
    if (opts.toDate) (where.entryDate as Record<string, unknown>).lte = new Date(opts.toDate);
  }
  const entries = await prisma.journalEntry.findMany({ where, orderBy: { entryDate: 'asc' } });
  // QuickBooks Journal Entry import format
  const headers = ['Journal No', 'Date', 'Account', 'Debit', 'Credit', 'Description', 'Name', 'Class'];
  const rows: (string | number | null)[][] = [];
  for (const e of entries) {
    rows.push([e.id, e.entryDate.toISOString().slice(0, 10), e.debitAccount, Number(e.amount).toFixed(2), '', e.description ?? '', '', '']);
    rows.push([e.id, e.entryDate.toISOString().slice(0, 10), e.creditAccount, '', Number(e.amount).toFixed(2), e.description ?? '', '', '']);
  }
  return toCSV(headers, rows);
}
