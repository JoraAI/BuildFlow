/**
 * Unit tests for the inventory AI service (INVENTORY_HORIZONTAL_PLATFORM Phase 7).
 *
 * Mocks resolveLlmConfig + global fetch for the extraction happy path and asserts:
 *  - 7.1 draft-bill fields (vendor, number, date, GST, lines with HSN + catalog
 *    match, PO/GRN match) and create-from-draft writes a DRAFT bill.
 *  - 7.2 import mapping preview (heuristic) + CATALOG confirm creates resources.
 *  - 7.3 anomaly hints flag a PO rate far above WAC/last buy.
 */
import { prisma } from '../../lib/prisma';

const COMPANY = '00000000-0000-0000-0000-000000000001';
const PROJECT = '00000000-0000-4000-8000-000000000001';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    company: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        subscriptionPlan: 'INVENTORY',
        defaultProjectId: '00000000-0000-4000-8000-000000000001',
      }),
      findFirst: jest.fn().mockResolvedValue(null),
      findFirstOrThrow: jest.fn().mockResolvedValue({ gstin: '36ABCDE1234F1Z5' }),
    },
    project: {
      findFirst: jest.fn().mockResolvedValue({
        id: '00000000-0000-4000-8000-000000000001',
        companyId: '00000000-0000-0000-0000-000000000001',
      }),
    },
    projectMember: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    resource: {
      findMany: jest.fn().mockResolvedValue([{ id: 'r1', name: 'OPC 53 Cement' }]),
      create: jest.fn().mockImplementation((args: { data: { name: string } }) =>
        Promise.resolve({ id: 'new-res', ...args.data }),
      ),
    },
    purchaseOrder: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'po1',
        poNumber: 'PO-100',
        vendorName: 'ABC Suppliers',
        totalAmount: 11800,
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    goodsReceiptNote: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'grn1',
        grnNumber: 'GRN-1',
        receivedDate: new Date('2025-04-01'),
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    goodsReceiptLine: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    stockCount: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    invoice: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    vendor: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    bill: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((args: unknown) =>
        Promise.resolve({
          id: 'bill1',
          billNumber: (args as { data: { billNumber: string } }).data.billNumber,
          vendorName: (args as { data: { vendorName: string } }).data.vendorName,
          total: 11800,
          project: { id: PROJECT, name: 'STORE' },
        }),
      ),
    },
  },
}));

jest.mock('../../services/integration.service', () => ({
  resolveLlmConfig: jest.fn().mockResolvedValue({
    apiUrl: 'http://mock',
    apiKey: 'mock-key',
    model: 'mock-model',
  }),
}));

// INVENTORY_HORIZONTAL_PLATFORM (Phase 8.1): mock server-side OCR so the image
// path is tested without spinning up Tesseract.
jest.mock('../../services/ocr.service', () => ({
  ocrImageToText: jest.fn(),
}));

// Stub global fetch to return our canned LLM JSON.
const mockLlmResponse = JSON.stringify({
  vendorName: 'ABC Suppliers',
  vendorGstin: '36ABCDE1234F1Z5',
  billNumber: 'INV-001',
  billDate: '2025-04-01',
  subtotal: 10000,
  gstAmount: 1800,
  tdsAmount: 0,
  total: 11800,
  category: 'MATERIAL',
  poNumberHint: 'PO-100',
  grnNumberHint: 'GRN-1',
  confidence: 0.92,
  notes: 'Two line items',
  lines: [
    { description: 'OPC 53 Cement', hsn: '2523', unit: 'bag', quantity: 500, rate: 20, gstRate: 18, amount: 10000 },
  ],
});

(globalThis as { fetch?: unknown }).fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({
    choices: [{ message: { content: mockLlmResponse } }],
  }),
});

import {
  extractInvoiceDraft,
  createBillFromDraft,
  previewImportMapping,
  confirmImport,
  getAnomalyHints,
} from '../../services/inventory-ai.service';


describe('inventory AI service (Phase 7)', () => {
  const invoiceFile = Buffer.from(
    'Invoice from ABC Suppliers Inv No: INV-001 Date: 2025-04-01 GSTIN: 36ABCDE1234F1Z5 ' +
      'Subtotal: Rs 10,000 GST 18%: Rs 1,800 Total: Rs 11,800 PO: PO-100 GRN: GRN-1 ' +
      'OPC 53 Cement 500 bags @20',
    'utf8',
  ).toString('base64');

  it('7.1 extracts a draft bill with lines (GST/HSN) + catalog + PO/GRN matches', async () => {
    const result = await extractInvoiceDraft(COMPANY, 'u1', 'OWNER', {
      fileContent: invoiceFile,
      filename: 'invoice.pdf',
      contentType: 'application/pdf',
    });

    expect(result.draft).toBeTruthy();
    const d = result.draft!;
    expect(d.vendorName).toBe('ABC Suppliers');
    expect(d.vendorGstin).toBe('36ABCDE1234F1Z5');
    expect(d.billNumber).toBe('INV-001');
    expect(d.billDate).toBe('2025-04-01');
    expect(d.subtotal).toBe(10000);
    expect(d.gstAmount).toBe(1800);
    expect(d.total).toBe(11800);

    expect(d.lines).toHaveLength(1);
    expect(d.lines[0]!.description).toBe('OPC 53 Cement');
    expect(d.lines[0]!.hsn).toBe('2523');
    expect(d.lines[0]!.gstRate).toBe(18);
    expect(d.lines[0]!.matchedResourceId).toBe('r1'); // catalog soft-match

    expect(d.matchedPO?.poNumber).toBe('PO-100');
    expect(d.matchedGRN?.grnNumber).toBe('GRN-1');
    expect(result.notes).toContain('Matched PO-100 + GRN-1');
  });

  it('7.1 createBillFromDraft writes a DRAFT bill with AI_EXTRACT snapshot + PO/GRN links', async () => {
    const preview = await extractInvoiceDraft(COMPANY, 'u1', 'OWNER', {
      fileContent: invoiceFile,
      filename: 'invoice.pdf',
      contentType: 'application/pdf',
    });
    const result = await createBillFromDraft(COMPANY, 'u1', 'OWNER', {
      draft: preview.draft!,
    });

    expect(result.linkedPO).toBe(true);
    expect(result.linkedGRN).toBe(true);
    const createArgs = (prisma.bill.create as jest.Mock).mock.calls.at(-1)![0] as {
      data: Record<string, unknown>;
    };
    expect(createArgs.data.status).toBe('DRAFT');
    expect(createArgs.data.purchaseOrderId).toBe('po1');
    expect(createArgs.data.goodsReceiptId).toBe('grn1');
    expect(createArgs.data.billSnapshot).toMatchObject({ source: 'AI_EXTRACT' });
    expect((createArgs.data.billSnapshot as { lines: unknown[] }).lines).toHaveLength(1);
  });

  it('7.1 reports "AI not configured" when resolveLlmConfig returns null', async () => {
    const { resolveLlmConfig } = require('../../services/integration.service') as {
      resolveLlmConfig: jest.Mock;
    };
    resolveLlmConfig.mockResolvedValueOnce(null);

    const result = await extractInvoiceDraft(COMPANY, 'u1', 'OWNER', {
      fileContent: invoiceFile,
      filename: 'invoice.pdf',
      contentType: 'application/pdf',
    });
    expect(result.draft).toBeNull();
    expect(result.notes).toMatch(/not configured/i);
  });

  it('7.2 previews heuristic column mapping for a catalog CSV (no LLM needed)', async () => {
    const csv = Buffer.from(
      'Product Name,Unit,HSN,Rate,GST %,Opening Qty\nCement,bags,2523,350,18,500\nSteel,kg,7208,88,18,1200',
      'utf8',
    ).toString('base64');

    const result = await previewImportMapping(COMPANY, {
      fileContent: csv,
      filename: 'catalog.csv',
      contentType: 'text/csv',
      purpose: 'CATALOG',
    });

    expect(result.headers).toEqual(['Product Name', 'Unit', 'HSN', 'Rate', 'GST %', 'Opening Qty']);
    expect(result.mapping).toMatchObject({
      name: 'Product Name',
      unit: 'Unit',
      hsn: 'HSN',
      rate: 'Rate',
      gstRate: 'GST %',
      qty: 'Opening Qty',
    });
    expect(result.rowCount).toBe(2);
    expect(result.sampleRows).toHaveLength(2);
    expect(result.sampleRows[0]).toMatchObject({ 'Product Name': 'Cement', HSN: '2523' });
  });

  it('7.2 CATALOG confirm creates resources (skipping duplicates)', async () => {
    (prisma.resource.findMany as jest.Mock).mockResolvedValueOnce([]);
    const result = (await confirmImport(COMPANY, 'u1', 'OWNER', {
      mode: 'CATALOG',
      mapping: { name: 'Product Name', unit: 'Unit', rate: 'Rate', hsn: 'HSN', gstRate: 'GST %' },
      rows: [
        { 'Product Name': 'Cement', Unit: 'bags', Rate: '350', HSN: '2523', 'GST %': '18' },
        { 'Product Name': 'Steel', Unit: 'kg', Rate: '88', HSN: '7208', 'GST %': '18' },
      ],
    })) as { mode: string; created: number; skipped: number };

    expect(result.mode).toBe('CATALOG');
    expect(result.created).toBe(2);
    expect((prisma.resource.create as jest.Mock).mock.calls).toHaveLength(2);
    const first = (prisma.resource.create as jest.Mock).mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(first.data).toMatchObject({ name: 'Cement', type: 'MATERIAL', unit: 'bags', rate: 350 });
  });

  it('7.3 flags a PO rate far above WAC/last buy as an anomaly', async () => {
    (prisma.purchaseOrder.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'po9',
        poNumber: 'PO-9',
        vendorName: 'Vendor A',
        lines: [{ resourceId: 'r1', rate: 500 }],
      },
    ]);
    (prisma.resource.findMany as jest.Mock).mockResolvedValue([
      { id: 'r1', name: 'OPC 53 Cement', avgCost: 100 },
    ]);
    (prisma.goodsReceiptLine.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.stockCount.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);

    const hints = await getAnomalyHints(COMPANY, 'u1', 'OWNER');
    const rateHint = hints.find((h) => h.type === 'PO_RATE');
    expect(rateHint).toBeTruthy();
    expect(rateHint!.title).toContain('PO-9');
    expect(rateHint!.detail).toContain('400%'); // (500/100 - 1) * 100
    expect(rateHint!.severity).toBe('high');
  });

  /* ── Phase 8.1: image OCR path ────────────────────────────────────── */

  it('8.1 image upload with mocked OCR → text → LLM extract → draft shape', async () => {
    const { ocrImageToText } = require('../../services/ocr.service') as {
      ocrImageToText: jest.Mock;
    };
    ocrImageToText.mockResolvedValue(
      'Invoice from ABC Suppliers Inv No: INV-001 Date: 2025-04-01 ' +
        'GSTIN: 36ABCDE1234F1Z5 Subtotal: Rs 10,000 GST 18%: Rs 1,800 Total: Rs 11,800 ' +
        'PO: PO-100 GRN: GRN-1 OPC 53 Cement 500 bags @20',
    );

    const result = await extractInvoiceDraft(COMPANY, 'u1', 'OWNER', {
      fileContent: 'aW1hZ2UtYnl0ZXM=',
      filename: 'scan.png',
      contentType: 'image/png',
    });

    expect(ocrImageToText).toHaveBeenCalled();
    expect(result.draft).toBeTruthy();
    expect(result.draft!.vendorName).toBe('ABC Suppliers');
    expect(result.draft!.billNumber).toBe('INV-001');
    expect(result.draft!.subtotal).toBe(10000);
    expect(result.draft!.gstAmount).toBe(1800);
    expect(result.draft!.matchedPO?.poNumber).toBe('PO-100');
    expect(result.draft!.matchedGRN?.grnNumber).toBe('GRN-1');
    expect(result.draft!.lines).toHaveLength(1);
  });

  it('8.1 image upload with empty OCR result returns a clear note', async () => {
    const { ocrImageToText } = require('../../services/ocr.service') as {
      ocrImageToText: jest.Mock;
    };
    ocrImageToText.mockResolvedValue('');

    const result = await extractInvoiceDraft(COMPANY, 'u1', 'OWNER', {
      fileContent: 'aW1hZ2UtYnl0ZXM=',
      filename: 'blurry.jpg',
      contentType: 'image/jpeg',
    });

    expect(result.draft).toBeNull();
    expect(result.notes).toMatch(/OCR could not read/i);
  });
});
