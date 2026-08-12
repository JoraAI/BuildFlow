/**
 * Tally Prime XML export - voucher balance + GST split (Round 40 TALLY-1).
 */
import { Decimal } from '@prisma/client/runtime/library';
import {
  buildSalesVoucher,
  buildPurchaseVoucher,
  normalizeStateCode,
  sumLedgerAmounts,
  exportProjectTallyXML,
} from '../../services/tally.service';
import { loginAs, authGet, getSeedProjectId } from './test-helpers';
import { prisma } from '../../lib/prisma';

const OWNER = 'owner@reddyconst.com';
const d = (n: number) => new Decimal(n);

describe('Tally voucher builders (unit)', () => {
  const ledgers = {
    sales: 'Sales',
    purchase: 'Purchases',
    cgst: 'CGST',
    sgst: 'SGST',
    igst: 'IGST',
    tdsPayable: 'TDS Payable',
    retention: 'Retention Money',
    advanceRecovery: 'Advance Recovery',
  };

  it('balances a sales voucher without retention', () => {
    const xml = buildSalesVoucher(
      {
        id: '1',
        invoiceNumber: 'INV-1',
        clientName: 'Client',
        invoiceDate: new Date('2025-03-01'),
        subtotal: d(100_000),
        cgstAmount: d(9_000),
        sgstAmount: d(9_000),
        igstAmount: d(0),
        tdsAmount: d(2_000),
        retentionAmount: d(0),
        total: d(116_000), // 100k + 18k − 2k
      },
      ledgers,
    );
    expect(sumLedgerAmounts(xml)).toBe(0);
  });

  it('balances a sales voucher with retention + TDS + CGST/SGST', () => {
    const xml = buildSalesVoucher(
      {
        id: '2',
        invoiceNumber: 'RA-1',
        clientName: 'NHAI',
        invoiceDate: new Date('2025-03-31'),
        subtotal: d(200_800),
        cgstAmount: d(18_072),
        sgstAmount: d(18_072),
        igstAmount: d(0),
        tdsAmount: d(4_016),
        retentionAmount: d(10_040),
        // netPayable = 200800+36144-4016 = 232928; total = 232928-10040 = 222888
        total: d(222_888),
      },
      ledgers,
    );
    expect(sumLedgerAmounts(xml)).toBe(0);
    expect(xml).toContain('Retention Money');
    expect(xml).toMatch(/<ISDEEMEDPOSITIVE>No<\/ISDEEMEDPOSITIVE>\s*<AMOUNT>10040\.00<\/AMOUNT>/);
  });

  it('uses IGST for inter-state purchase vouchers', () => {
    const companyState = normalizeStateCode('36AABCR1234A1Z5', 'Telangana'); // 36
    const xml = buildPurchaseVoucher(
      {
        id: 'b1',
        billNumber: 'BILL-IGST',
        vendorName: 'MH Vendor',
        vendorGstin: '27AABCT1332L1ZV', // Maharashtra
        billDate: new Date('2025-04-01'),
        subtotal: d(10_000),
        gstAmount: d(1_800),
        tdsAmount: d(200),
        total: d(11_600),
      },
      ledgers,
      companyState,
    );
    expect(sumLedgerAmounts(xml)).toBe(0);
    expect(xml).toContain('<LEDGERNAME>IGST</LEDGERNAME>');
    expect(xml).not.toContain('<LEDGERNAME>CGST</LEDGERNAME>');
  });

  it('splits CGST+SGST for intra-state purchase vouchers', () => {
    const companyState = normalizeStateCode('36AABCR1234A1Z5', 'Telangana');
    const xml = buildPurchaseVoucher(
      {
        id: 'b2',
        billNumber: 'BILL-CGST',
        vendorName: 'TG Vendor',
        vendorGstin: '36AABCS1234A1Z5', // Telangana
        billDate: new Date('2025-04-01'),
        subtotal: d(10_000),
        gstAmount: d(1_800),
        tdsAmount: d(0),
        total: d(11_800),
      },
      ledgers,
      companyState,
    );
    expect(sumLedgerAmounts(xml)).toBe(0);
    expect(xml).toContain('<LEDGERNAME>CGST</LEDGERNAME>');
    expect(xml).toContain('<LEDGERNAME>SGST</LEDGERNAME>');
    expect(xml).not.toContain('<LEDGERNAME>IGST</LEDGERNAME>');
    // halves: 900 + 900
    expect(xml).toMatch(/<AMOUNT>900\.00<\/AMOUNT>[\s\S]*<AMOUNT>900\.00<\/AMOUNT>/);
  });

  it('balances purchase voucher with retention + advance recovery + TDS', () => {
    const companyState = normalizeStateCode('36AABCR1234A1Z5', 'Telangana');
    const xml = buildPurchaseVoucher(
      {
        id: 'b3',
        billNumber: 'SC-WO-001',
        vendorName: 'Sharma Earthworks',
        vendorGstin: '36AABCS1234A1Z5',
        billDate: new Date('2025-03-01'),
        subtotal: d(180_000),
        gstAmount: d(0),
        tdsAmount: d(1_665),
        retentionAmount: d(9_000),
        advanceRecoveryAmount: d(5_000),
        total: d(164_335),
      },
      ledgers,
      companyState,
    );
    expect(sumLedgerAmounts(xml)).toBe(0);
    expect(xml).toContain('Retention Money');
    expect(xml).toContain('Advance Recovery');
  });

  it('normalizeStateCode maps state names when GSTIN is missing (R2-7)', () => {
    expect(normalizeStateCode(null, 'Telangana')).toBe('36');
    expect(normalizeStateCode(null, 'Maharashtra')).toBe('27');
    expect(normalizeStateCode('27XXXX', null)).toBe('27');
  });
});

describe('Tally export API (integration)', () => {
  let token: string;
  let projectId: string;
  let companyId: string;

  beforeAll(async () => {
    token = await loginAs(OWNER);
    projectId = await getSeedProjectId(token);
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { companyId: true },
    });
    companyId = project.companyId;
  });

  it('returns XML with only exportable invoices/bills and balanced vouchers', async () => {
    const res = await authGet(token, `/api/projects/${projectId}/financials/export-tally`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/xml/);
    const xml = res.text as string;
    expect(xml).toContain('<TALLYREQUEST>Import Data</TALLYREQUEST>');
    expect(xml).toContain('RA-2025-001');
    expect(xml).toContain('INV-2025-001');

    // Extract each VOUCHER and assert balance
    const vouchers = xml.match(/<VOUCHER[\s\S]*?<\/VOUCHER>/g) ?? [];
    expect(vouchers.length).toBeGreaterThan(0);
    for (const v of vouchers) {
      expect(Math.abs(sumLedgerAmounts(v))).toBeLessThanOrEqual(0.01);
    }

    // Seed RA has retention - debit Retention Money present
    const ra = vouchers.find((v) => v.includes('RA-2025-001'));
    expect(ra).toBeTruthy();
    expect(ra!).toContain('Retention Money');
  });

  it('excludes DRAFT invoices and non-APPROVED/PAID bills from export', async () => {
    const draftNumber = `DRAFT-TALLY-${Date.now()}`;
    await prisma.invoice.create({
      data: {
        projectId,
        companyId,
        invoiceNumber: draftNumber,
        clientName: 'Draft Client',
        invoiceDate: new Date('2025-05-01'),
        dueDate: new Date('2025-05-31'),
        status: 'DRAFT',
        subtotal: 1000,
        gstRate: 18,
        gstAmount: 180,
        total: 1180,
      },
    });

    try {
      const xml = await exportProjectTallyXML(companyId, projectId);
      expect(xml).not.toContain(draftNumber);
    } finally {
      await prisma.invoice.deleteMany({ where: { invoiceNumber: draftNumber } });
    }
  });
});
