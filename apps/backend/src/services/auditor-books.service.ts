/**
 * Pack-period books helpers: Tally-like groups, practical balance sheet, P&L, Excel.
 */
import { prisma } from '../lib/prisma';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Default ledger/account name → Tally-like group. */
export const DEFAULT_ACCOUNT_GROUP_MAP: Record<string, string> = {
  Sales: 'Sales Accounts',
  Purchase: 'Purchase Accounts',
  Purchases: 'Purchase Accounts',
  CGST: 'Duties & Taxes',
  SGST: 'Duties & Taxes',
  IGST: 'Duties & Taxes',
  'Input CGST': 'Duties & Taxes',
  'Input SGST': 'Duties & Taxes',
  'Input IGST': 'Duties & Taxes',
  'Output CGST': 'Duties & Taxes',
  'Output SGST': 'Duties & Taxes',
  'Output IGST': 'Duties & Taxes',
  Bank: 'Bank Accounts',
  'Bank/Cash': 'Bank Accounts',
  Cash: 'Cash-in-Hand',
  'Accounts Receivable': 'Sundry Debtors',
  'Accounts Payable': 'Sundry Creditors',
  Expense: 'Indirect Expenses',
  Expenses: 'Indirect Expenses',
  Rent: 'Indirect Expenses',
  Salary: 'Indirect Expenses',
  Wages: 'Direct Expenses',
  Freight: 'Direct Expenses',
  Retention: 'Sundry Debtors',
  'Retention Money': 'Sundry Debtors',
};

export type AccountGroupRollup = {
  group: string;
  debit: number;
  credit: number;
  net: number;
  accounts: Array<{ account: string; debit: number; credit: number; net: number }>;
};

export type GroupsAnalysis = {
  groups: AccountGroupRollup[];
  unmapped: string[];
};

export function resolveAccountGroup(
  account: string,
  override?: Record<string, string> | null,
): string | null {
  const key = account.trim();
  if (!key) return null;
  if (override?.[key]) return override[key]!;
  if (DEFAULT_ACCOUNT_GROUP_MAP[key]) return DEFAULT_ACCOUNT_GROUP_MAP[key]!;
  const lower = key.toLowerCase();
  for (const [k, g] of Object.entries(override ?? {})) {
    if (k.toLowerCase() === lower) return g;
  }
  for (const [k, g] of Object.entries(DEFAULT_ACCOUNT_GROUP_MAP)) {
    if (k.toLowerCase() === lower) return g;
  }
  if (/gst|cgst|sgst|igst|cess/i.test(key)) return 'Duties & Taxes';
  if (/bank/i.test(key)) return 'Bank Accounts';
  if (/cash/i.test(key)) return 'Cash-in-Hand';
  if (/sales|revenue/i.test(key)) return 'Sales Accounts';
  if (/purchase/i.test(key)) return 'Purchase Accounts';
  if (/receivable|debtor/i.test(key)) return 'Sundry Debtors';
  if (/payable|creditor/i.test(key)) return 'Sundry Creditors';
  if (/expense|rent|salary|wage|freight|utility/i.test(key)) return 'Indirect Expenses';
  return null;
}

export function buildGroupsAnalysis(
  journals: Array<{ debitAccount: string; creditAccount: string; amount: number }>,
  bank?: Array<{ paymentMode: string; direction: string; amount: number; entryType: string }>,
  override?: Record<string, string> | null,
): GroupsAnalysis {
  const byAccount = new Map<string, { debit: number; credit: number }>();
  const touch = (account: string, side: 'debit' | 'credit', amount: number) => {
    const key = account.trim() || '(blank)';
    const cur = byAccount.get(key) ?? { debit: 0, credit: 0 };
    cur[side] = round2(cur[side] + amount);
    byAccount.set(key, cur);
  };

  for (const j of journals) {
    touch(j.debitAccount, 'debit', Number(j.amount) || 0);
    touch(j.creditAccount, 'credit', Number(j.amount) || 0);
  }

  // Only overlay cash-book rows that do not already have auto journals
  // (SALE_COLLECTION / VENDOR_PAYMENT post both a journal and a cash-book line).
  const BANK_ONLY_TYPES = new Set(['EXPENSE', 'DEPOSIT', 'ADJUSTMENT']);
  if (bank) {
    for (const b of bank) {
      if (!BANK_ONLY_TYPES.has(String(b.entryType))) continue;
      const mode = (b.paymentMode || 'OTHER').toUpperCase();
      const ledger = mode === 'CASH' ? 'Cash' : 'Bank/Cash';
      const amt = Number(b.amount) || 0;
      if (b.direction === 'IN') touch(ledger, 'debit', amt);
      else touch(ledger, 'credit', amt);
    }
  }

  const groupMap = new Map<string, Map<string, { debit: number; credit: number }>>();
  const unmapped = new Set<string>();

  for (const [account, bal] of byAccount) {
    const group = resolveAccountGroup(account, override);
    if (!group) {
      unmapped.add(account);
      continue;
    }
    const accounts = groupMap.get(group) ?? new Map();
    const cur = accounts.get(account) ?? { debit: 0, credit: 0 };
    cur.debit = round2(cur.debit + bal.debit);
    cur.credit = round2(cur.credit + bal.credit);
    accounts.set(account, cur);
    groupMap.set(group, accounts);
  }

  const groups: AccountGroupRollup[] = [...groupMap.entries()]
    .map(([group, accounts]) => {
      const accountRows = [...accounts.entries()]
        .map(([account, bal]) => ({
          account,
          debit: bal.debit,
          credit: bal.credit,
          net: round2(bal.debit - bal.credit),
        }))
        .sort((a, b) => a.account.localeCompare(b.account));
      const debit = round2(accountRows.reduce((s, a) => s + a.debit, 0));
      const credit = round2(accountRows.reduce((s, a) => s + a.credit, 0));
      return {
        group,
        debit,
        credit,
        net: round2(debit - credit),
        accounts: accountRows,
      };
    })
    .sort((a, b) => a.group.localeCompare(b.group));

  return { groups, unmapped: [...unmapped].sort() };
}

export type PackPeriodPnL = {
  from: string;
  to: string;
  sales: number;
  cogs: number;
  grossMargin: number;
  expenses: number;
  expensesByCategory: Record<string, number>;
  estimatedProfit: number;
};

/** Sales stock OUT types (excludes transfers / purchase returns / adjustments). */
const SALES_OUT_TYPES = ['MANUAL_ISSUE', 'DELIVERY_CHALLAN'];

function movementValue(m: { quantity: unknown; unitCost: unknown; inventoryValue: unknown }): number {
  return Number(m.inventoryValue) || Number(m.quantity) * Number(m.unitCost ?? 0);
}

/** Pack-scoped P&L without project-gate (auditor-safe). */
export async function buildPackPeriodPnL(
  companyId: string,
  from: string,
  to: string,
): Promise<PackPeriodPnL> {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T23:59:59.999Z`);

  const [invoices, creditNotes, expenseEntries, salesMoves] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        companyId,
        invoiceDate: { gte: start, lte: end },
        status: { not: 'DRAFT' },
      },
      select: { subtotal: true },
    }),
    prisma.creditNote.findMany({
      where: {
        companyId,
        status: 'ISSUED',
        creditDate: { gte: start, lte: end },
      },
      select: { subtotal: true },
    }),
    prisma.inventoryCashBookEntry.findMany({
      where: {
        companyId,
        entryType: 'EXPENSE',
        entryDate: { gte: start, lte: end },
      },
      select: { amount: true, category: true },
    }),
    // Sales OUT increases COGS; SALES_RETURN stock IN reverses COGS for returned goods.
    prisma.stockMovement.findMany({
      where: {
        location: { companyId },
        createdAt: { gte: start, lte: end },
        OR: [
          { type: 'OUT', referenceType: { in: SALES_OUT_TYPES } },
          { type: 'IN', referenceType: 'SALES_RETURN' },
        ],
      },
      select: { type: true, referenceType: true, quantity: true, unitCost: true, inventoryValue: true },
    }),
  ]);

  // Taxable / ex-GST sales, net of issued credit notes in the period.
  const grossSales = invoices.reduce((s, i) => s + Number(i.subtotal), 0);
  const cnTaxable = creditNotes.reduce((s, c) => s + Number(c.subtotal), 0);
  const sales = round2(Math.max(0, grossSales - cnTaxable));
  const cogs = round2(
    Math.max(
      0,
      salesMoves.reduce((s, m) => {
        const v = movementValue(m);
        return m.type === 'IN' && m.referenceType === 'SALES_RETURN' ? s - v : s + v;
      }, 0),
    ),
  );
  const expensesByCategory: Record<string, number> = {};
  for (const e of expenseEntries) {
    const cat = e.category ?? 'OTHER';
    expensesByCategory[cat] = round2((expensesByCategory[cat] ?? 0) + Number(e.amount));
  }
  const expenses = round2(Object.values(expensesByCategory).reduce((s, n) => s + n, 0));
  const grossMargin = round2(sales - cogs);
  const estimatedProfit = round2(grossMargin - expenses);

  return { from, to, sales, cogs, grossMargin, expenses, expensesByCategory, estimatedProfit };
}

export type PackBalanceSheet = {
  asOf: string;
  assets: {
    cashBank: number;
    receivables: number;
    stockValue: number;
    total: number;
  };
  liabilities: {
    payables: number;
    total: number;
  };
  equity: number;
};

/** Practical balance-sheet snapshot (not full CoA), as-of period end. */
export async function buildPackBalanceSheet(
  companyId: string,
  asOf: string,
  cashBankClosing: number | null,
): Promise<PackBalanceSheet> {
  const end = new Date(`${asOf}T23:59:59.999Z`);

  const [invoices, bills, creditNotes, debitNotes, collections, vendorPays, balances, laterMoves] =
    await Promise.all([
      prisma.invoice.findMany({
        where: { companyId, invoiceDate: { lte: end }, status: { not: 'DRAFT' } },
        select: { id: true, total: true, paidAmount: true },
      }),
      prisma.bill.findMany({
        where: {
          companyId,
          billDate: { lte: end },
          status: { notIn: ['DRAFT', 'REJECTED'] },
        },
        select: { id: true, total: true, paidAmount: true, paidAt: true },
      }),
      prisma.creditNote.findMany({
        where: { companyId, status: 'ISSUED', creditDate: { lte: end } },
        select: { total: true },
      }),
      prisma.debitNote.findMany({
        where: { companyId, status: 'ISSUED', debitDate: { lte: end } },
        select: { total: true },
      }),
      prisma.inventoryCashBookEntry.findMany({
        where: {
          companyId,
          entryType: 'SALE_COLLECTION',
          entryDate: { lte: end },
        },
        select: { invoiceId: true, amount: true },
      }),
      prisma.inventoryCashBookEntry.findMany({
        where: {
          companyId,
          entryType: 'VENDOR_PAYMENT',
          entryDate: { lte: end },
        },
        select: { billId: true, amount: true },
      }),
      prisma.stockBalance.findMany({
        where: { location: { companyId } },
        select: {
          resourceId: true,
          quantity: true,
          resource: { select: { avgCost: true } },
        },
      }),
      // Reverse movements after asOf so stock value is period-end, not live.
      prisma.stockMovement.findMany({
        where: { location: { companyId }, createdAt: { gt: end } },
        select: { resourceId: true, quantity: true, type: true },
      }),
    ]);

  const collectedByInvoice = new Map<string, number>();
  let unlinkedCollections = 0;
  for (const c of collections) {
    const amt = Number(c.amount) || 0;
    if (c.invoiceId) {
      collectedByInvoice.set(c.invoiceId, (collectedByInvoice.get(c.invoiceId) ?? 0) + amt);
    } else {
      unlinkedCollections += amt;
    }
  }
  const hasCollectionLinks = collections.some((c) => c.invoiceId);
  let receivableGross = 0;
  for (const inv of invoices) {
    const linkedPaid = collectedByInvoice.get(inv.id);
    const paid = hasCollectionLinks
      ? Math.min(Number(inv.total), linkedPaid ?? 0)
      : Number(inv.paidAmount);
    receivableGross += Math.max(0, Number(inv.total) - paid);
  }
  const receivables = round2(
    Math.max(
      0,
      receivableGross -
        unlinkedCollections -
        creditNotes.reduce((s, c) => s + Number(c.total), 0),
    ),
  );

  const paidByBill = new Map<string, number>();
  for (const p of vendorPays) {
    if (!p.billId) continue;
    paidByBill.set(p.billId, (paidByBill.get(p.billId) ?? 0) + (Number(p.amount) || 0));
  }
  let payableGross = 0;
  for (const b of bills) {
    let paid = 0;
    if (b.paidAt) {
      paid = b.paidAt.getTime() <= end.getTime() ? Number(b.paidAmount) : 0;
    } else if (paidByBill.has(b.id)) {
      paid = Math.min(Number(b.total), paidByBill.get(b.id) ?? 0);
    } else {
      paid = Number(b.paidAmount);
    }
    payableGross += Math.max(0, Number(b.total) - paid);
  }
  const payables = round2(
    Math.max(0, payableGross - debitNotes.reduce((s, d) => s + Number(d.total), 0)),
  );

  const qtyByResource = new Map<string, { qty: number; unitCost: number }>();
  for (const b of balances) {
    qtyByResource.set(b.resourceId, {
      qty: Number(b.quantity),
      unitCost: Number(b.resource.avgCost ?? 0),
    });
  }
  for (const m of laterMoves) {
    const cur = qtyByResource.get(m.resourceId) ?? { qty: 0, unitCost: 0 };
    const q = Number(m.quantity) || 0;
    // Undo post-period movement: OUT after asOf means stock was higher at asOf.
    cur.qty += m.type === 'OUT' ? q : -q;
    qtyByResource.set(m.resourceId, cur);
  }
  const stockValue = round2(
    [...qtyByResource.values()].reduce((s, r) => s + Math.max(0, r.qty) * r.unitCost, 0),
  );

  const cashBank = round2(cashBankClosing ?? 0);
  const assetsTotal = round2(cashBank + receivables + stockValue);
  const liabilitiesTotal = payables;
  const equity = round2(assetsTotal - liabilitiesTotal);

  return {
    asOf,
    assets: {
      cashBank,
      receivables,
      stockValue,
      total: assetsTotal,
    },
    liabilities: {
      payables,
      total: liabilitiesTotal,
    },
    equity,
  };
}

export type BankModeGroup = {
  paymentMode: string;
  in: number;
  out: number;
  net: number;
  rows: Array<{
    id: string;
    entryDate: string;
    paymentMode: string;
    entryType: string;
    direction: string;
    description: string;
    amount: number;
  }>;
};

export function groupBankByPaymentMode(
  bank: Array<{
    id: string;
    entryDate: string;
    paymentMode: string;
    entryType: string;
    direction: string;
    description: string;
    amount: number;
  }>,
): BankModeGroup[] {
  const map = new Map<string, BankModeGroup>();
  for (const row of bank) {
    const mode = (row.paymentMode || 'OTHER').toUpperCase();
    const cur = map.get(mode) ?? {
      paymentMode: mode,
      in: 0,
      out: 0,
      net: 0,
      rows: [],
    };
    cur.rows.push(row);
    if (row.entryType !== 'OPENING') {
      if (row.direction === 'IN') cur.in = round2(cur.in + row.amount);
      else cur.out = round2(cur.out + row.amount);
    }
    cur.net = round2(cur.in - cur.out);
    map.set(mode, cur);
  }
  const order = ['CASH', 'BANK', 'UPI', 'OTHER'];
  return [...map.values()].sort((a, b) => {
    const ai = order.indexOf(a.paymentMode);
    const bi = order.indexOf(b.paymentMode);
    const ao = ai === -1 ? 99 : ai;
    const bo = bi === -1 ? 99 : bi;
    if (ao !== bo) return ao - bo;
    return a.paymentMode.localeCompare(b.paymentMode);
  });
}

export async function buildPackBooksExcel(opts: {
  label: string;
  periodStart: string;
  periodEnd: string;
  openingCashBalance: number | null;
  bankClosing: number | null;
  bankIn: number;
  bankOut: number;
  bank: Array<{
    id: string;
    entryDate: string;
    paymentMode: string;
    entryType: string;
    direction: string;
    description: string;
    amount: number;
  }>;
  pnl: PackPeriodPnL;
  balanceSheet: PackBalanceSheet;
  groups: GroupsAnalysis;
}): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BuildFlow';

  const bankSheet = wb.addWorksheet('Bank');
  bankSheet.addRow(['Pack', opts.label]);
  bankSheet.addRow(['Period', `${opts.periodStart} → ${opts.periodEnd}`]);
  bankSheet.addRow(['Opening', opts.openingCashBalance ?? '']);
  bankSheet.addRow(['Cash in', opts.bankIn]);
  bankSheet.addRow(['Cash out', opts.bankOut]);
  bankSheet.addRow(['Closing', opts.bankClosing ?? '']);
  bankSheet.addRow([]);
  bankSheet.addRow(['Payment mode', 'In', 'Out', 'Net']);
  for (const g of groupBankByPaymentMode(opts.bank)) {
    bankSheet.addRow([g.paymentMode, g.in, g.out, g.net]);
  }
  bankSheet.addRow([]);
  bankSheet.addRow(['Date', 'Mode', 'Type', 'Direction', 'Amount', 'Description']);
  for (const r of opts.bank) {
    bankSheet.addRow([
      r.entryDate,
      r.paymentMode,
      r.entryType,
      r.direction,
      r.amount,
      r.description,
    ]);
  }
  bankSheet.getRow(1).font = { bold: true };

  const pnlSheet = wb.addWorksheet('P&L');
  pnlSheet.addRow(['From', opts.pnl.from]);
  pnlSheet.addRow(['To', opts.pnl.to]);
  pnlSheet.addRow([]);
  pnlSheet.addRow(['Sales', opts.pnl.sales]);
  pnlSheet.addRow(['COGS', opts.pnl.cogs]);
  pnlSheet.addRow(['Gross margin', opts.pnl.grossMargin]);
  pnlSheet.addRow(['Expenses', opts.pnl.expenses]);
  pnlSheet.addRow(['Estimated profit', opts.pnl.estimatedProfit]);
  pnlSheet.addRow([]);
  pnlSheet.addRow(['Category', 'Amount']);
  for (const [cat, amt] of Object.entries(opts.pnl.expensesByCategory)) {
    pnlSheet.addRow([cat, amt]);
  }

  const bs = opts.balanceSheet;
  const bsSheet = wb.addWorksheet('Balance sheet');
  bsSheet.addRow(['As of', bs.asOf]);
  bsSheet.addRow([]);
  bsSheet.addRow(['Assets', '']);
  bsSheet.addRow(['Cash / Bank', bs.assets.cashBank]);
  bsSheet.addRow(['Receivables', bs.assets.receivables]);
  bsSheet.addRow(['Stock value', bs.assets.stockValue]);
  bsSheet.addRow(['Total assets', bs.assets.total]);
  bsSheet.addRow([]);
  bsSheet.addRow(['Liabilities', '']);
  bsSheet.addRow(['Payables', bs.liabilities.payables]);
  bsSheet.addRow(['Total liabilities', bs.liabilities.total]);
  bsSheet.addRow([]);
  bsSheet.addRow(['Equity (balancing)', bs.equity]);

  const groupSheet = wb.addWorksheet('By group');
  groupSheet.addRow(['Group', 'Account', 'Debit', 'Credit', 'Net']);
  for (const g of opts.groups.groups) {
    groupSheet.addRow([g.group, '(total)', g.debit, g.credit, g.net]);
    for (const a of g.accounts) {
      groupSheet.addRow([g.group, a.account, a.debit, a.credit, a.net]);
    }
  }
  if (opts.groups.unmapped.length > 0) {
    groupSheet.addRow([]);
    groupSheet.addRow(['Unmapped accounts']);
    for (const a of opts.groups.unmapped) {
      groupSheet.addRow(['Unmapped', a]);
    }
  }
  groupSheet.getRow(1).font = { bold: true };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function buildBankOnlyExcel(opts: {
  label: string;
  periodStart: string;
  periodEnd: string;
  openingCashBalance: number | null;
  bankClosing: number | null;
  bankIn: number;
  bankOut: number;
  bank: Array<{
    id: string;
    entryDate: string;
    paymentMode: string;
    entryType: string;
    direction: string;
    description: string;
    amount: number;
  }>;
}): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Bank');
  sheet.addRow(['Pack', opts.label]);
  sheet.addRow(['Period', `${opts.periodStart} → ${opts.periodEnd}`]);
  sheet.addRow(['Opening', opts.openingCashBalance ?? '']);
  sheet.addRow(['Cash in', opts.bankIn]);
  sheet.addRow(['Cash out', opts.bankOut]);
  sheet.addRow(['Closing', opts.bankClosing ?? '']);
  sheet.addRow([]);
  sheet.addRow(['Payment mode', 'In', 'Out', 'Net']);
  for (const g of groupBankByPaymentMode(opts.bank)) {
    sheet.addRow([g.paymentMode, g.in, g.out, g.net]);
  }
  sheet.addRow([]);
  sheet.addRow(['Date', 'Mode', 'Type', 'Direction', 'Amount', 'Description']);
  for (const r of opts.bank) {
    sheet.addRow([r.entryDate, r.paymentMode, r.entryType, r.direction, r.amount, r.description]);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function buildPnLOnlyExcel(pnl: PackPeriodPnL, label: string): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('P&L');
  sheet.addRow(['Pack', label]);
  sheet.addRow(['From', pnl.from]);
  sheet.addRow(['To', pnl.to]);
  sheet.addRow([]);
  sheet.addRow(['Sales', pnl.sales]);
  sheet.addRow(['COGS', pnl.cogs]);
  sheet.addRow(['Gross margin', pnl.grossMargin]);
  sheet.addRow(['Expenses', pnl.expenses]);
  sheet.addRow(['Estimated profit', pnl.estimatedProfit]);
  sheet.addRow([]);
  sheet.addRow(['Category', 'Amount']);
  for (const [cat, amt] of Object.entries(pnl.expensesByCategory)) {
    sheet.addRow([cat, amt]);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
