/**
 * BuildFlow - Tender import extraction service.
 *
 * Two-stage pipeline:
 *   1. extractText() - parse PDF (pdf-parse) or Excel (exceljs) to raw text.
 *   2. extractItemsFromText() - call the LLM with a strict JSON-schema prompt
 *      to produce structured line items (description, unit, qty, rate, type,
 *      section, optional resourceId/rateAnalysisId match, confidence).
 *
 * The LLM call is delegated to `callLlmForExtraction` which reads the company's
 * BYOK config via `resolveLlmConfig` - same resolution as the assistant. When no
 * LLM is configured, the service returns an empty items list with a note so the
 * caller can surface a clear "AI not configured" message.
 *
 * This service does NOT write anything to the database. The controller:
 *   - stores the uploaded file via lib/storage (encrypted)
 *   - calls this service to get draft items
 *   - returns them to the client for review
 *   - the client then creates estimate items via the existing batch endpoint.
 */
import { prisma } from '../lib/prisma';
import { logger } from '../config/logger';
import { resolveLlmConfig } from './integration.service';
import type {
  TenderExtractionResult,
  TenderExtractedItem,
  TenderUploadInput,
} from '@buildflow/shared';

const MAX_TEXT_CHARS = 24_000; // Truncate before sending to LLM (token budget).

/**
 * Extract plain text from an uploaded tender file (PDF or Excel).
 * Supports: application/pdf, .xlsx/.xls (Excel), and plain text.
 */
export async function extractText(
  fileContentBase64: string,
  contentType: string,
): Promise<string> {
  const buf = Buffer.from(fileContentBase64, 'base64');

  if (contentType.includes('pdf') || contentType.includes('octet-stream')) {
    try {
      // pdf-parse has a quirky CJS export; use require to avoid type issues.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParseModule = require('pdf-parse') as (buf: Buffer) => Promise<{ text?: string }>;
      const data = await pdfParseModule(buf);
      return data.text ?? '';
    } catch (err) {
      logger.debug('pdf-parse failed, trying Excel fallback', { error: String(err) });
    }
  }

  if (
    contentType.includes('spreadsheet') ||
    contentType.includes('excel') ||
    contentType.includes('sheet')
  ) {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    // exceljs expects a Buffer/ArrayBuffer; cast to satisfy its typings.
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const lines: string[] = [];
    wb.eachSheet((sheet) => {
      sheet.eachRow((row) => {
        const vals = (row.values as unknown[])
          .filter((v) => v !== null && v !== undefined)
          .map((v) => String(v));
        if (vals.length) lines.push(vals.join('\t'));
      });
    });
    return lines.join('\n');
  }

  // Fallback: treat as plain text
  return buf.toString('utf8');
}

/**
 * Call the company's configured LLM to extract structured tender items.
 * Exported so tests can mock it.
 */
export async function callLlmForExtraction(
  companyId: string,
  prompt: string,
): Promise<string | null> {
  const cfg = await resolveLlmConfig(companyId);
  if (!cfg) return null;

  try {
    const res = await fetch(`${cfg.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0,
        max_tokens: 3000,
        messages: [
          {
            role: 'system',
            content:
              'You are a tender BOQ extraction engine for Indian construction software. ' +
              'Extract line items from the tender text and return ONLY valid JSON matching the schema. ' +
              'Do not include any prose, markdown, or code fences.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) {
      logger.warn('Tender LLM call failed', { status: res.status, companyId });
      return null;
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    logger.warn('Tender LLM call error', { error: String(err), companyId });
    return null;
  }
}

function buildExtractionPrompt(text: string, hint?: string): string {
  const truncated = text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) + '\n…[truncated]' : text;
  const hintLine = hint ? `Project type hint: ${hint}\n` : '';
  return (
    `${hintLine}Extract all bill-of-quantities line items from the tender text below. ` +
    'Return JSON: {"items": [...], "notes": "optional observations"}. ' +
    'Each item: {"description": string, "unit": string, "quantity": number, "rate": number, ' +
    '"type": "MATERIAL"|"LABOUR"|"EQUIPMENT"|"SUBCONTRACTOR"|"MISC", "section": string (e.g. Substructure, Superstructure, Finishes)}. ' +
    'If a line is a composite rate (like "RCC M25"), still include it. ' +
    'Omit headers, subtotals, and notes from items. ' +
    'Use the description exactly as written. Rates are in INR.\n\n' +
    `--- TENDER TEXT ---\n${truncated}`
  );
}

interface RawLlmItem {
  description?: string;
  unit?: string;
  quantity?: number;
  rate?: number;
  type?: string;
  section?: string;
  confidence?: number;
}

function parseLlmResponse(raw: string): { items: RawLlmItem[]; notes?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Some models wrap JSON in prose; try to extract the first {...} block.
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        return { items: [] };
      }
    } else {
      return { items: [] };
    }
  }
  const obj = parsed as { items?: RawLlmItem[]; notes?: string };
  return { items: Array.isArray(obj.items) ? obj.items : [], notes: obj.notes };
}

function normalizeItem(raw: RawLlmItem): TenderExtractedItem | null {
  if (!raw.description || typeof raw.description !== 'string') return null;
  const qty = Number(raw.quantity ?? 0);
  const rate = Number(raw.rate ?? 0);
  if (!Number.isFinite(qty) || !Number.isFinite(rate)) return null;

  const type = ((): TenderExtractedItem['type'] => {
    const t = String(raw.type ?? '').toUpperCase();
    if (t === 'MATERIAL' || t === 'LABOUR' || t === 'EQUIPMENT' || t === 'SUBCONTRACTOR' || t === 'MISC') {
      return t;
    }
    return 'MISC';
  })();

  return {
    description: raw.description.slice(0, 500),
    unit: String(raw.unit ?? 'nos').slice(0, 20),
    quantity: Math.max(0, qty),
    rate: Math.max(0, rate),
    type,
    section: raw.section?.slice(0, 200),
    confidence: typeof raw.confidence === 'number' ? Math.min(1, Math.max(0, raw.confidence)) : undefined,
  };
}

/**
 * Soft-match an extracted item's description against the company's resource
 * library by name (case-insensitive substring). Returns the resourceId if a
 * unique match exists, else null.
 */
async function softMatchResource(
  companyId: string,
  description: string,
): Promise<string | null> {
  // FIX (EST-M9): The match direction was inverted. It searched for resources
  // whose NAME CONTAINS the description (e.g. a 50-char description would need
  // to be a substring of a resource name - almost never true). The correct
  // direction is: find resources whose NAME appears within the description.
  // We fetch candidate resources and filter in JS since Prisma can't express
  // "description contains name" as a WHERE clause.
  const lowerDesc = description.toLowerCase();
  const candidates = await prisma.resource.findMany({
    where: { companyId, isDeleted: false },
    select: { id: true, name: true },
  });
  const matches = candidates.filter((r) => lowerDesc.includes(r.name.toLowerCase()));
  if (matches.length === 1) return matches[0]!.id;
  return null;
}

/**
 * Soft-match against the company's rate-analysis library (composite rates like
 * "RCC M25"). Returns the rateAnalysisId if a unique match exists.
 */
async function softMatchRateAnalysis(
  companyId: string,
  description: string,
): Promise<string | null> {
  // FIX (EST-M9): Same inverted direction fix as softMatchResource.
  const lowerDesc = description.toLowerCase();
  const candidates = await prisma.rateAnalysis.findMany({
    where: { companyId },
    select: { id: true, name: true },
  });
  const matches = candidates.filter((r) => lowerDesc.includes(r.name.toLowerCase()));
  if (matches.length === 1) return matches[0]!.id;
  return null;
}

/**
 * Full extraction pipeline: text → LLM → structured + soft-matched items.
 * Does NOT write to the database. Returns draft items for client review.
 */
export async function extractTenderItems(
  companyId: string,
  input: TenderUploadInput,
): Promise<TenderExtractionResult> {
  const text = await extractText(input.fileContent, input.contentType);
  if (!text.trim()) {
    return { items: [], notes: 'No extractable text found in the uploaded file.', sourceTextLength: 0 };
  }

  const prompt = buildExtractionPrompt(text, input.projectTypeHint);
  const llmRaw = await callLlmForExtraction(companyId, prompt);

  if (!llmRaw) {
    return {
      items: [],
      notes:
        'AI extraction is not configured for this company. Set up the LLM integration in Settings → Integrations, or enter the items manually.',
      sourceTextLength: text.length,
    };
  }

  const { items: rawItems, notes } = parseLlmResponse(llmRaw);
  const items: TenderExtractedItem[] = [];
  for (const raw of rawItems) {
    const item = normalizeItem(raw);
    if (!item) continue;

    // Soft-match to resources / rate analysis (best-effort; client can override)
    const resourceId = await softMatchResource(companyId, item.description);
    const rateAnalysisId = resourceId ? null : await softMatchRateAnalysis(companyId, item.description);
    items.push({
      ...item,
      resourceId: resourceId ?? null,
      rateAnalysisId: rateAnalysisId ?? null,
      amount: Math.round(item.quantity * item.rate * 100) / 100,
    });
  }

  return {
    items,
    notes: notes ?? undefined,
    sourceTextLength: text.length,
  };
}