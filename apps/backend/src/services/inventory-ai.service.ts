/**
 * BuildFlow - Inventory AI service (INVENTORY_HORIZONTAL_PLATFORM Phase 7).
 *
 * 7.1 Document OCR → draft vendor bill: reuses `extractText` + `callLlmForExtraction`
 *     (the same shared LLM/document pipeline as construction bill extract — D10),
 *     but returns line items with GST/HSN and soft-matches PO / GRN / catalog items.
 * 7.2 AI-assisted import column mapping for catalog / opening-stock CSV|XLSX.
 * 7.3 Anomaly hints (rules-first: PO rate vs WAC/last-buy band, stock-count
 *     variance, overdue invoice aging).
 *
 * Inventory routes are gated by `requireInventoryFeature('stock_adjustments')`
 * at the route layer — construction tenants get 403.
 */
import { prisma } from '../lib/prisma';
import { logger } from '../config/logger';
import { ApiError } from '../utils/errors';
import { assertProjectAccess } from '../middleware/project-access.middleware';
import { getDefaultProjectId } from './module-gate.service';
import { extractText, callLlmForExtraction } from './tender-extract.service';
import { ocrImageToText } from './ocr.service';
import { istToday } from './inventory-analytics.service';
import { netTotal, round2 } from './gst.service';
import { nextSequentialNumber } from '../lib/id-generator';
import { importOpeningStock } from './procurement.service';
import type {
  InvoiceUploadInput,
  InventoryBillDraft,
  InventoryBillDraftLine,
  ImportPreviewInput,
  ImportConfirmInput,
  ImportMapping,
  AnomalyHint,
} from '@buildflow/shared';

const MAX_TEXT_CHARS = 24_000;

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}

async function resolveProject(companyId: string, userId: string, role: string) {
  const projectId = await getDefaultProjectId(companyId);
  if (!projectId) throw ApiError.forbidden('This feature is not available on your plan.');
  await assertProjectAccess(companyId, userId, role as never, projectId);
  return projectId;
}

/* ── 7.1 Document OCR → draft bill ─────────────────────────────────── */

function buildInvoiceExtractPrompt(text: string): string {
  const truncated = text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) + '\n…[truncated]' : text;
  return (
    'Extract the supplier tax invoice (vendor bill) data from the text below. ' +
    'Return STRICT JSON with this shape (null or 0 when a field is absent):\n' +
    '{\n' +
    '  "vendorName": string, "vendorGstin": string|null, "billNumber": string|null,\n' +
    '  "billDate": "YYYY-MM-DD"|null, "dueDate": "YYYY-MM-DD"|null,\n' +
    '  "subtotal": number, "gstAmount": number, "tdsAmount": number, "total": number,\n' +
    '  "category": "MATERIAL"|"LABOUR"|"EQUIPMENT"|"SUBCONTRACTOR"|"OTHER",\n' +
    '  "poNumberHint": string|null, "grnNumberHint": string|null,\n' +
    '  "confidence": number(0-1), "notes": string|null,\n' +
    '  "lines": [{"description": string, "hsn": string|null, "unit": string|null, ' +
    '"quantity": number, "rate": number, "gstRate": number, "amount": number}]\n' +
    '}\n' +
    'List every item line exactly as printed (do not merge); compute amount = quantity × rate when missing.\n\n' +
    `--- INVOICE TEXT ---\n${truncated}`
  );
}

/** Soft-match a line description against the company catalog (substring both ways). */
async function matchLineToResource(
  description: string,
  resources: Array<{ id: string; name: string }>,
): Promise<{ resourceId: string | null; resourceName: string | null }> {
  const lower = description.toLowerCase().trim();
  if (!lower) return { resourceId: null, resourceName: null };
  const matches = resources.filter((r) => {
    const name = r.name.toLowerCase();
    return lower.includes(name) || name.includes(lower);
  });
  if (matches.length === 1) return { resourceId: matches[0]!.id, resourceName: matches[0]!.name };
  return { resourceId: null, resourceName: null };
}

export async function extractInvoiceDraft(
  companyId: string,
  userId: string,
  role: string,
  input: InvoiceUploadInput,
): Promise<{ draft: InventoryBillDraft | null; notes: string }> {
  const projectId = await resolveProject(companyId, userId, role);

  // INVENTORY_HORIZONTAL_PLATFORM (Phase 8.1): scanned images go through
  // server-side OCR (tesseract.js) before the shared LLM extract. PDF/Excel/text
  // keep using the existing `extractText` path unchanged.
  const isImage =
    /^image\//.test(input.contentType) || /\.(jpe?g|png|webp|gif|bmp)$/i.test(input.filename);

  let text: string;
  if (isImage) {
    text = await ocrImageToText(Buffer.from(input.fileContent, 'base64'));
    if (!text.trim()) {
      return {
        draft: null,
        notes: 'OCR could not read this scanned image — the invoice may be blurry or low-contrast. Retake the photo or upload a text-based PDF/Excel invoice.',
      };
    }
  } else {
    text = await extractText(input.fileContent, input.contentType);
    if (!text.trim()) {
      return {
        draft: null,
        notes: 'No extractable text found in the uploaded file. Upload a clear PDF/Excel invoice or a readable scan.',
      };
    }
  }

  const prompt = buildInvoiceExtractPrompt(text);
  const llmRaw = await callLlmForExtraction(companyId, prompt);
  if (!llmRaw) {
    return {
      draft: null,
      notes: 'AI extraction is not configured for this company. Set up the LLM integration in Settings → Integrations, or enter the bill manually.',
    };
  }

  try {
    const parsed = JSON.parse(llmRaw) as Record<string, unknown>;
    const rawLines = Array.isArray(parsed.lines) ? (parsed.lines as Array<Record<string, unknown>>) : [];

    const resources = await prisma.resource.findMany({
      where: { companyId, isDeleted: false },
      select: { id: true, name: true },
    });

    const lines: InventoryBillDraftLine[] = [];
    for (const raw of rawLines) {
      const description = str(raw.description);
      if (!description) continue;
      const quantity = num(raw.quantity);
      const rate = num(raw.rate);
      if (quantity <= 0 && rate <= 0) continue;
      const gstRate = num(raw.gstRate);
      const match = await matchLineToResource(description, resources);
      lines.push({
        description,
        hsn: str(raw.hsn) ?? undefined,
        unit: str(raw.unit) ?? undefined,
        quantity,
        rate,
        gstRate,
        amount: round2(num(raw.amount) || quantity * rate),
        matchedResourceId: match.resourceId,
        matchedResourceName: match.resourceName,
      });
    }

    const subtotal = round2(num(parsed.subtotal));
    const gstAmount = round2(num(parsed.gstAmount));
    const tdsAmount = round2(num(parsed.tdsAmount));
    const poHint = str(parsed.poNumberHint) ?? (input.poNumberHint || null);
    const grnHint = str(parsed.grnNumberHint) ?? (input.grnNumberHint || null);

    const [matchedPO, matchedGRN] = await Promise.all([
      poHint
        ? prisma.purchaseOrder.findFirst({
            where: { poNumber: poHint, companyId, projectId },
            select: { id: true, poNumber: true, vendorName: true, totalAmount: true },
          })
        : Promise.resolve(null),
      grnHint
        ? prisma.goodsReceiptNote.findFirst({
            where: { grnNumber: grnHint, companyId, projectId },
            select: { id: true, grnNumber: true, receivedDate: true },
          })
        : Promise.resolve(null),
    ]);

    const draft: InventoryBillDraft = {
      vendorName: str(parsed.vendorName) ?? 'Unknown Vendor',
      vendorGstin: str(parsed.vendorGstin),
      billNumber: str(parsed.billNumber),
      billDate: str(parsed.billDate),
      dueDate: str(parsed.dueDate),
      subtotal,
      gstAmount,
      tdsAmount,
      total: round2(num(parsed.total) || netTotal(subtotal, gstAmount, tdsAmount)),
      category: (parsed.category as InventoryBillDraft['category']) ?? 'MATERIAL',
      poNumberHint: poHint,
      grnNumberHint: grnHint,
      confidence: num(parsed.confidence),
      notes: str(parsed.notes),
      filename: input.filename,
      lines,
      matchedPO: matchedPO
        ? {
            id: matchedPO.id,
            poNumber: matchedPO.poNumber,
            vendorName: matchedPO.vendorName,
            totalAmount: Number(matchedPO.totalAmount),
          }
        : null,
      matchedGRN: matchedGRN
        ? {
            id: matchedGRN.id,
            grnNumber: matchedGRN.grnNumber,
            receivedDate: matchedGRN.receivedDate.toISOString().slice(0, 10),
          }
        : null,
    };

    return {
      draft,
      notes:
        (draft.confidence > 0.7
          ? 'High confidence extraction. Review before saving.'
          : 'Low confidence — please verify all fields carefully.') +
        (draft.matchedPO || draft.matchedGRN
          ? ` Matched ${[draft.matchedPO?.poNumber, draft.matchedGRN?.grnNumber].filter(Boolean).join(' + ')}.`
          : ' No PO/GRN match found — the bill will be created unlinked.'),
    };
  } catch (err) {
    logger.warn('Inventory invoice extract JSON parse failed', { error: String(err), companyId });
    return { draft: null, notes: 'Failed to parse AI extraction result. Please enter manually.' };
  }
}


/** Create a DRAFT vendor bill from a reviewed AI-extracted draft (7.1). */
export async function createBillFromDraft(
  companyId: string,
  userId: string,
  role: string,
  input: { draft: InventoryBillDraft; vendorId?: string; billNumber?: string; billDate?: string },
) {
  const projectId = await resolveProject(companyId, userId, role);
  const draft = input.draft;

  // Resolve the vendor: explicit vendorId, else soft-match saved parties by name/GSTIN.
  let vendorId: string | null = null;
  if (input.vendorId) {
    const vendor = await prisma.vendor.findFirst({
      where: { id: input.vendorId, companyId },
      select: { id: true },
    });
    if (!vendor) throw ApiError.notFound('Vendor not found');
    vendorId = vendor.id;
  } else if (draft.vendorGstin) {
    const vendor = await prisma.vendor.findFirst({
      where: { companyId, gstin: draft.vendorGstin },
      select: { id: true },
    });
    vendorId = vendor?.id ?? null;
  } else if (draft.vendorName && draft.vendorName !== 'Unknown Vendor') {
    const vendor = await prisma.vendor.findFirst({
      where: { companyId, name: { equals: draft.vendorName, mode: 'insensitive' } },
      select: { id: true },
    });
    vendorId = vendor?.id ?? null;
  }

  // Validate PO/GRN links belong to this company + project.
  const purchaseOrderId = draft.matchedPO?.id
    ? ((await prisma.purchaseOrder.findFirst({
        where: { id: draft.matchedPO.id, companyId, projectId },
        select: { id: true },
      }))?.id ?? null)
    : null;
  let goodsReceiptId: string | null = null;
  if (draft.matchedGRN?.id) {
    const grn = await prisma.goodsReceiptNote.findFirst({
      where: { id: draft.matchedGRN.id, companyId, projectId },
      select: { id: true },
    });
    // `@@unique([goodsReceiptId])` — the auto GRN draft bill may already exist.
    const existingBill = grn
      ? await prisma.bill.findFirst({ where: { goodsReceiptId: grn.id }, select: { id: true } })
      : null;
    if (grn && !existingBill) goodsReceiptId = grn.id;
  }

  const subtotal = round2(draft.subtotal);
  const gstAmount = round2(draft.gstAmount);
  const tdsAmount = round2(draft.tdsAmount);
  const total = netTotal(subtotal, gstAmount, tdsAmount);
  const billDate = input.billDate
    ? new Date(input.billDate)
    : draft.billDate
      ? new Date(draft.billDate)
      : new Date();

  const snapshot = {
    capturedAt: new Date().toISOString(),
    source: 'AI_EXTRACT',
    filename: draft.filename ?? null,
    poNumber: draft.matchedPO?.poNumber ?? null,
    grnNumber: draft.matchedGRN?.grnNumber ?? null,
    lines: draft.lines.map((l) => ({
      description: l.description,
      hsn: l.hsn ?? null,
      unit: l.unit ?? null,
      quantity: l.quantity,
      rate: l.rate,
      gstRate: l.gstRate,
      amount: l.amount,
      matchedResourceId: l.matchedResourceId ?? null,
    })),
  };

  const billNumber = input.billNumber || draft.billNumber || (await nextSequentialNumber(companyId, 'bill'));

  const bill = await prisma.bill.create({
    data: {
      projectId,
      companyId,
      billNumber,
      vendorName: draft.vendorName,
      ...(vendorId ? { vendorId } : {}),
      vendorGstin: draft.vendorGstin ?? null,
      billDate,
      dueDate: draft.dueDate ? new Date(draft.dueDate) : null,
      status: 'DRAFT',
      subtotal,
      gstAmount,
      tdsAmount,
      total,
      category: draft.category,
      purchaseOrderId,
      goodsReceiptId,
      billSnapshot: snapshot,
    },
    include: { project: { select: { id: true, name: true } } },
  });

  return {
    bill,
    linkedVendor: Boolean(vendorId),
    linkedPO: Boolean(purchaseOrderId),
    linkedGRN: Boolean(goodsReceiptId),
  };
}


/* ── 7.2 AI import column mapping ─────────────────────────────────── */

const IMPORT_FIELDS = [
  'name',
  'unit',
  'rate',
  'gstRate',
  'hsn',
  'sku',
  'itemCode',
  'barcode',
  'reorderPoint',
  'qty',
] as const;

const HEADER_SYNONYMS: Record<(typeof IMPORT_FIELDS)[number], string[]> = {
  name: ['productname', 'itemname', 'name', 'item', 'material', 'product', 'description', 'itemdescription', 'goods'],
  hsn: ['hsn', 'hsncode', 'hsnsac', 'sac', 'hsnno'],
  qty: ['qty', 'quantity', 'openingqty', 'openingstock', 'stock', 'balance', 'onhand', 'closing', 'openingbalance', 'qtyonhand', 'opening'],
  unit: ['unit', 'uom', 'unitofmeasure'],
  rate: ['rate', 'price', 'cost', 'unitcost', 'unitprice', 'purchaseprice', 'rateperunit', 'catalograte'],
  gstRate: ['gst', 'gstrate', 'gstpercent', 'tax', 'taxrate'],
  sku: ['sku', 'skucode', 'itemsku', 'stockkeepingunit'],
  itemCode: ['itemcode', 'code', 'partno', 'partnumber', 'productcode', 'itemno'],
  barcode: ['barcode', 'ean', 'upc'],
  reorderPoint: ['reorderpoint', 'reorder', 'minstock', 'minqty', 'threshold', 'minimumstock', 'reorderlevel'],
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** RFC-4180-ish CSV parser (handles quoted commas / escaped quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

/** Parse an uploaded CSV or XLSX file into rows of string cells. */
async function parseSpreadsheet(contentType: string, base64: string): Promise<string[][]> {
  const buf = Buffer.from(base64, 'base64');
  if (
    contentType.includes('spreadsheet') ||
    contentType.includes('excel') ||
    contentType.includes('sheet') ||
    /\.xlsx?$/i.test(contentType)
  ) {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const rows: string[][] = [];
    wb.eachSheet((sheet) => {
      sheet.eachRow((row) => {
        const vals = (row.values as unknown[]).map((v) =>
          v === null || v === undefined ? '' : String(v).trim(),
        );
        // exceljs is 1-based; first column is index 1.
        const cells = vals.slice(1);
        if (cells.some((c) => c !== '')) rows.push(cells);
      });
    });
    return rows;
  }
  return parseCsv(buf.toString('utf8'));
}

/** Optional LLM refinement — only when the item-name column is ambiguous. */
async function llmRefineMapping(
  companyId: string,
  headers: string[],
  mapping: { name?: string | null; [k: string]: string | null | undefined },
): Promise<void> {
  if (mapping.name) return; // heuristics resolved the critical column
  const unmapped = IMPORT_FIELDS.filter((f) => !mapping[f]);
  if (unmapped.length === 0) return;
  const llmRaw = await callLlmForExtraction(
    companyId,
    'Map these CSV headers to import target fields. Target fields: ' +
      unmapped.join(', ') +
      '. Headers: ' +
      headers.join(' | ') +
      '. Return STRICT JSON {"mapping": {"<targetField>": "<exact header string>"}} only for confident matches. Do not invent headers that are not listed.',
  );
  if (!llmRaw) return;
  try {
    const parsed = JSON.parse(llmRaw) as { mapping?: Record<string, unknown> };
    const m = parsed.mapping ?? {};
    for (const field of unmapped) {
      if (mapping[field] || typeof m[field] !== 'string') continue;
      const hit = headers.find((h) => h.toLowerCase() === String(m[field]).toLowerCase());
      if (hit) mapping[field] = hit;
    }
  } catch {
    // Heuristic mapping stands.
  }
}


export async function previewImportMapping(companyId: string, input: ImportPreviewInput) {
  const rows = await parseSpreadsheet(input.contentType, input.fileContent);
  const headerRow = rows[0] ?? [];
  const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ''));

  const positions = headerRow.map((h, i) => ({ h: h.trim(), i })).filter((p) => p.h);
  const headers = positions.map((p) => p.h);
  if (headers.length === 0) {
    return {
      headers: [],
      mapping: {},
      sampleRows: [],
      rowCount: 0,
      purpose: input.purpose,
      notes: 'No header row detected — the first row must contain column names.',
    };
  }

  const mapping: ImportMapping = {};
  const used = new Set<string>();
  for (const p of positions) {
    const norm = normalizeHeader(p.h);
    for (const field of IMPORT_FIELDS) {
      if (used.has(field)) continue;
      if (HEADER_SYNONYMS[field].includes(norm)) {
        mapping[field] = p.h;
        used.add(field);
        break;
      }
    }
  }
  await llmRefineMapping(companyId, headers, mapping);

  const sampleRows = dataRows.slice(0, 3).map((r) =>
    Object.fromEntries(positions.map((p) => [p.h, r[p.i] ?? ''])),
  );

  return {
    headers,
    mapping,
    sampleRows,
    rowCount: dataRows.length,
    purpose: input.purpose,
    notes: mapping.name
      ? `Mapped ${Object.keys(mapping).length} column(s). Review and confirm to import ${dataRows.length} row(s).`
      : 'Could not find an item-name column automatically. Fix the mapping below before confirming.',
  };
}

export async function confirmImport(
  companyId: string,
  userId: string,
  role: string,
  input: ImportConfirmInput,
) {
  const nameKey = input.mapping.name ?? '';

  if (input.mode === 'CATALOG') {
    const names = input.rows.map((r) => str(r[nameKey]) ?? '').filter(Boolean);
    const existing = await prisma.resource.findMany({
      where: { companyId, name: { in: names }, isDeleted: false },
      select: { name: true },
    });
    const existingSet = new Set(existing.map((e) => e.name));
    let created = 0;
    let skipped = 0;
    for (const row of input.rows) {
      const name = str(row[nameKey]);
      if (!name) {
        skipped += 1;
        continue;
      }
      if (existingSet.has(name)) {
        skipped += 1;
        continue;
      }
      const rate = num(row[input.mapping.rate ?? '']);
      await prisma.resource.create({
        data: {
          companyId,
          name,
          type: 'MATERIAL',
          unit: str(row[input.mapping.unit ?? '']) ?? 'nos',
          rate,
          gstRate: num(row[input.mapping.gstRate ?? '']),
          hsnSacCode: str(row[input.mapping.hsn ?? '']),
          sku: str(row[input.mapping.sku ?? '']),
          itemCode: str(row[input.mapping.itemCode ?? '']),
          barcode: str(row[input.mapping.barcode ?? '']),
          reorderPoint: num(row[input.mapping.reorderPoint ?? '']) || null,
          lastRateUpdatedAt: rate > 0 ? new Date() : null,
        },
      });
      existingSet.add(name);
      created += 1;
    }
    return { mode: 'CATALOG', created, skipped };
  }

  // OPENING — reuse Phase 1 opening-stock import (name/SKU matching + WAC on IN).
  const lines = input.rows
    .map((row) => {
      const qty = num(row[input.mapping.qty ?? '']);
      const rate = num(row[input.mapping.rate ?? '']);
      return {
        name: str(row[nameKey]) ?? undefined,
        sku: str(row[input.mapping.sku ?? '']) ?? undefined,
        quantity: qty,
        rate: rate > 0 ? rate : undefined,
      };
    })
    .filter((l) => l.quantity > 0 && (l.name || l.sku));
  return importOpeningStock(companyId, userId, role, { lines, locationId: input.locationId });
}


/* ── 7.3 Anomaly hints (rules-first, no separate chat model) ───────── */

const ANOMALY_WINDOW_DAYS = 30;
/** PO rate vs WAC/last-buy flag band (±15%). */
export const PO_RATE_BAND_PCT = 0.15;

export async function getAnomalyHints(
  companyId: string,
  userId: string,
  role: string,
): Promise<AnomalyHint[]> {
  const projectId = await resolveProject(companyId, userId, role);
  const hints: AnomalyHint[] = [];
  const since = new Date(Date.now() - ANOMALY_WINDOW_DAYS * 86400000);

  // ── 1. Unusual PO rate vs WAC / last buy ───────────────────────────
  const [pos, resources, grnLines] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: {
        companyId,
        projectId,
        createdAt: { gte: since },
        status: { not: 'DRAFT' },
      },
      include: { lines: true },
    }),
    prisma.resource.findMany({
      where: { companyId, isDeleted: false },
      select: { id: true, name: true, avgCost: true },
    }),
    prisma.goodsReceiptLine.findMany({
      where: { grn: { companyId, projectId } },
      select: { resourceId: true, unitCost: true, grn: { select: { receivedDate: true } } },
      orderBy: { grn: { receivedDate: 'desc' } },
    }),
  ]);
  const resourceById = new Map(resources.map((r) => [r.id, r]));
  const lastBuyByResource = new Map<string, number>();
  for (const l of grnLines) {
    if (!lastBuyByResource.has(l.resourceId)) lastBuyByResource.set(l.resourceId, Number(l.unitCost));
  }

  for (const po of pos) {
    for (const line of po.lines) {
      const rate = Number(line.rate);
      if (rate <= 0) continue;
      const res = resourceById.get(line.resourceId);
      if (!res) continue;
      const wac = Number(res.avgCost ?? 0);
      const lastBuy = lastBuyByResource.get(line.resourceId) ?? 0;
      const refs = [wac, lastBuy].filter((v) => v > 0);
      if (refs.length === 0) continue;
      const baseline = Math.max(...refs);
      if (rate <= baseline * (1 + PO_RATE_BAND_PCT)) continue;
      const overPct = Math.round((rate / baseline - 1) * 100);
      hints.push({
        type: 'PO_RATE',
        severity: overPct >= 30 ? 'high' : 'medium',
        title: `PO ${po.poNumber} rate above last cost`,
        detail: `${res.name}: PO rate ₹${round4(rate)} is ${overPct}% above WAC/last-buy ₹${round4(baseline)}.`,
        referenceId: po.id,
        referenceNumber: po.poNumber,
      });
    }
  }

  // ── 2. Large stock variance after a stock count ────────────────────
  const counts = await prisma.stockCount.findMany({
    where: { companyId, projectId, status: 'APPROVED', approvedAt: { gte: since } },
    include: { lines: true, location: { select: { name: true } } },
  });
  for (const c of counts) {
    for (const line of c.lines) {
      const variance = Number(line.variance);
      if (variance === 0) continue;
      const sys = Number(line.systemQty);
      const abs = Math.abs(variance);
      const pct = sys > 0 ? abs / sys : abs;
      if (abs < 5 && pct < 0.25) continue;
      hints.push({
        type: 'COUNT_VARIANCE',
        severity: pct >= 0.5 ? 'high' : 'medium',
        title: `Large variance in count ${c.countNumber}`,
        detail: `${line.itemName}: system ${sys}, counted ${Number(line.countedQty)} (${variance > 0 ? '+' : ''}${variance}) at ${c.location.name}.`,
        referenceId: c.id,
        referenceNumber: c.countNumber,
      });
    }
  }

  // ── 3. Overdue invoice aging ───────────────────────────────────────
  const todayStr = istToday();
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      projectId,
      status: { in: ['SENT', 'OVERDUE'] },
      dueDate: { lt: new Date(`${todayStr}T00:00:00.000Z`) },
    },
    select: { id: true, invoiceNumber: true, clientName: true, total: true, dueDate: true },
  });
  for (const inv of invoices) {
    if (!inv.dueDate) continue;
    const days = Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86400000);
    hints.push({
      type: 'OVERDUE_INVOICE',
      severity: days > 30 ? 'high' : 'low',
      title: `Invoice ${inv.invoiceNumber} overdue`,
      detail: `${inv.clientName} · ₹${Number(inv.total)} · ${Math.max(days, 1)} day(s) past due.`,
      referenceId: inv.id,
      referenceNumber: inv.invoiceNumber,
    });
  }

  const severityOrder: Record<AnomalyHint['severity'], number> = { high: 0, medium: 1, low: 2 };
  return hints.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

