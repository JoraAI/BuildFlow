/**
 * BuildFlow - Tender import extraction service.
 *
 * Two-stage pipeline:
 *   1. extractText() - parse PDF (pdf-parse) or Excel (exceljs) to raw text.
 *   2. extractItemsFromText() - call the LLM with catalog hints + JSON schema
 *      to produce structured line items, then soft/fuzzy-match to resources/RAs.
 *
 * Does NOT write estimate lines. Returns draft items for client review + confirm.
 */
import { prisma } from '../lib/prisma';
import { logger } from '../config/logger';
import { resolveLlmConfig } from './integration.service';
import type {
  TenderExtractionResult,
  TenderExtractedItem,
  TenderUploadInput,
} from '@buildflow/shared';

const MAX_TEXT_CHARS = 24_000;
const MAX_CATALOG_HINTS = 80;
const FUZZY_LINK_THRESHOLD = 0.55;
const FUZZY_REVIEW_THRESHOLD = 0.38;

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or', 'with',
  'per', 'mm', 'as', 'by', 'from', 'into', 'incl', 'including', 'complete',
]);

export async function extractText(
  fileContentBase64: string,
  contentType: string,
  filename?: string,
): Promise<string> {
  const buf = Buffer.from(fileContentBase64, 'base64');
  const lowerName = (filename ?? '').toLowerCase();
  const looksExcel =
    contentType.includes('spreadsheet') ||
    contentType.includes('excel') ||
    contentType.includes('sheet') ||
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls') ||
    lowerName.endsWith('.xlsm');

  // Prefer Excel when the filename/MIME says so — mobile often sends
  // application/octet-stream for .xlsx, which would otherwise hit pdf-parse first.
  if (looksExcel) {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
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
      const text = lines.join('\n');
      if (text.trim()) return text;
    } catch (err) {
      logger.debug('Excel parse failed', { error: String(err), filename });
    }
  }

  if (contentType.includes('pdf') || contentType.includes('octet-stream') || lowerName.endsWith('.pdf')) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParseModule = require('pdf-parse') as (buf: Buffer) => Promise<{ text?: string }>;
      const data = await pdfParseModule(buf);
      const text = data.text ?? '';
      if (text.trim()) return text;
    } catch (err) {
      logger.debug('pdf-parse failed', { error: String(err), filename });
    }
  }

  // Last-chance Excel if MIME was wrong but PDF returned nothing
  if (!looksExcel && (lowerName.includes('xls') || contentType.includes('octet-stream'))) {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
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
    } catch {
      /* fall through */
    }
  }

  return buf.toString('utf8');
}

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
        max_tokens: 4000,
        messages: [
          {
            role: 'system',
            content:
              'You are a tender BOQ extraction engine for Indian construction software. ' +
              'Extract line items and map them to the company catalog when wording differs. ' +
              'Return ONLY valid JSON matching the schema. No prose, markdown, or code fences.',
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

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9.\s]/g, ' ')
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 1 && !STOP_WORDS.has(t)),
  );
}

/** Jaccard similarity of significant tokens (handles different tender wording). */
export function tokenSimilarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

interface CatalogEntry {
  id: string;
  name: string;
  rate: number;
  kind: 'RESOURCE' | 'RATE_ANALYSIS';
}

function bestFuzzyMatch(
  description: string,
  catalog: CatalogEntry[],
): { entry: CatalogEntry; score: number } | null {
  const lowerDesc = description.toLowerCase();
  let best: { entry: CatalogEntry; score: number } | null = null;
  let second = 0;

  for (const entry of catalog) {
    const nameLower = entry.name.toLowerCase();
    let score = tokenSimilarity(description, entry.name);
    // Exact substring either direction (tender longer or catalog longer)
    if (lowerDesc.includes(nameLower) || nameLower.includes(lowerDesc)) {
      score = Math.max(score, 0.92);
    }
    // Grade / code boost (e.g. M25, M30, PCC, RCC)
    const gradeRe = /\b(?:M\d{1,2}|PCC|RCC|WMM|DBM|AAC|CM\s*\d+:\d+)\b/g;
    const grades: string[] = description.toUpperCase().match(gradeRe) ?? [];
    const nameGrades: string[] = entry.name.toUpperCase().match(gradeRe) ?? [];
    if (grades.length > 0 && nameGrades.some((g) => grades.includes(g))) {
      score = Math.min(1, score + 0.15);
    }

    if (!best || score > best.score) {
      second = best?.score ?? 0;
      best = { entry, score };
    } else if (score > second) {
      second = score;
    }
  }

  if (!best) return null;
  // Ambiguous: two close high scores → leave for user review
  if (best.score >= FUZZY_REVIEW_THRESHOLD && best.score - second < 0.08 && second >= FUZZY_REVIEW_THRESHOLD) {
    return { entry: best.entry, score: Math.min(best.score, FUZZY_REVIEW_THRESHOLD - 0.01) };
  }
  return best;
}

async function loadCatalog(companyId: string): Promise<CatalogEntry[]> {
  const [resources, analyses] = await Promise.all([
    prisma.resource.findMany({
      where: { companyId, isDeleted: false },
      select: { id: true, name: true, rate: true },
      take: 500,
      orderBy: { name: 'asc' },
    }),
    prisma.rateAnalysis.findMany({
      where: { companyId },
      select: { id: true, name: true, totalRate: true },
      take: 300,
      orderBy: { name: 'asc' },
    }),
  ]);
  return [
    ...analyses.map((a) => ({
      id: a.id,
      name: a.name,
      rate: Number(a.totalRate),
      kind: 'RATE_ANALYSIS' as const,
    })),
    ...resources.map((r) => ({
      id: r.id,
      name: r.name,
      rate: Number(r.rate),
      kind: 'RESOURCE' as const,
    })),
  ];
}

function buildExtractionPrompt(
  text: string,
  hint: string | undefined,
  catalog: CatalogEntry[],
): string {
  const truncated = text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) + '\n…[truncated]' : text;
  const hintLine = hint ? `Project type hint: ${hint}\n` : '';
  const raHints = catalog
    .filter((c) => c.kind === 'RATE_ANALYSIS')
    .slice(0, MAX_CATALOG_HINTS)
    .map((c) => c.name);
  const resHints = catalog
    .filter((c) => c.kind === 'RESOURCE')
    .slice(0, MAX_CATALOG_HINTS)
    .map((c) => c.name);

  return (
    `${hintLine}Extract all bill-of-quantities line items from the tender text below. ` +
    'Return JSON: {"items": [...], "notes": "optional observations"}. ' +
    'Each item: {"description": string (keep tender wording), "unit": string, "quantity": number, "rate": number, ' +
    '"type": "MATERIAL"|"LABOUR"|"EQUIPMENT"|"SUBCONTRACTOR"|"MISC", "section": string, ' +
    '"matchedRateAnalysisName": string|null, "matchedResourceName": string|null, "confidence": number}. ' +
    'When tender wording differs from the catalog (synonyms, extra adjectives, grade codes), still set ' +
    'matchedRateAnalysisName or matchedResourceName to the CLOSEST catalog name from the lists below. ' +
    'Prefer rate-analysis names for composite works (RCC, PCC, plaster, masonry, WMM, DBM). ' +
    'Prefer resource names for single materials (cement, sand, steel). ' +
    'If nothing is close, set both match fields to null. ' +
    'Omit headers, subtotals, and notes from items. Rates are in INR.\n\n' +
    `Rate analyses:\n${raHints.map((n) => `- ${n}`).join('\n') || '(none)'}\n\n` +
    `Materials / resources:\n${resHints.map((n) => `- ${n}`).join('\n') || '(none)'}\n\n` +
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
  matchedRateAnalysisName?: string | null;
  matchedResourceName?: string | null;
}

function parseLlmResponse(raw: string): { items: RawLlmItem[]; notes?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
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
    matchKind: 'NONE',
    matchLabel: null,
    matchScore: null,
    suggestedAction: 'CREATE',
    libraryRate: null,
  };
}

function resolveByExactName(
  name: string | null | undefined,
  catalog: CatalogEntry[],
  kind: 'RESOURCE' | 'RATE_ANALYSIS',
): CatalogEntry | null {
  if (!name?.trim()) return null;
  const lower = name.trim().toLowerCase();
  const pool = catalog.filter((c) => c.kind === kind);
  return (
    pool.find((c) => c.name.toLowerCase() === lower) ??
    pool.find((c) => c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase())) ??
    null
  );
}

function applyMatch(
  item: TenderExtractedItem,
  entry: CatalogEntry,
  score: number,
): TenderExtractedItem {
  const linked = score >= FUZZY_LINK_THRESHOLD;
  return {
    ...item,
    resourceId: entry.kind === 'RESOURCE' ? entry.id : null,
    rateAnalysisId: entry.kind === 'RATE_ANALYSIS' ? entry.id : null,
    matchKind: entry.kind,
    matchLabel: entry.name,
    matchScore: Math.round(score * 100) / 100,
    suggestedAction: linked ? 'LINKED' : 'REVIEW',
    libraryRate: entry.rate,
    // If tender rate missing/zero, adopt library rate so estimate is usable.
    rate: item.rate > 0 ? item.rate : entry.rate,
    amount: Math.round((item.quantity * (item.rate > 0 ? item.rate : entry.rate)) * 100) / 100,
  };
}

/**
 * Full extraction pipeline: text → LLM (+ catalog hints) → fuzzy match → draft items.
 * Does NOT write to the database. Returns draft items for client review.
 */
export async function extractTenderItems(
  companyId: string,
  input: TenderUploadInput,
): Promise<TenderExtractionResult> {
  const text = await extractText(input.fileContent, input.contentType, input.filename);
  if (!text.trim()) {
    return { items: [], notes: 'No extractable text found in the uploaded file.', sourceTextLength: 0 };
  }

  const catalog = await loadCatalog(companyId);
  const prompt = buildExtractionPrompt(text, input.projectTypeHint, catalog);
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
    const base = normalizeItem(raw);
    if (!base) continue;

    // 1) Prefer LLM-suggested catalog names (handles different wording)
    let matched =
      resolveByExactName(raw.matchedRateAnalysisName, catalog, 'RATE_ANALYSIS') ??
      resolveByExactName(raw.matchedResourceName, catalog, 'RESOURCE');

    let score = matched
      ? Math.max(tokenSimilarity(base.description, matched.name), 0.7)
      : 0;

    // 2) Fuzzy fallback when LLM left matches null or name didn't resolve
    if (!matched) {
      const fuzzy = bestFuzzyMatch(base.description, catalog);
      if (fuzzy && fuzzy.score >= FUZZY_REVIEW_THRESHOLD) {
        matched = fuzzy.entry;
        score = fuzzy.score;
      }
    }

    if (matched) {
      items.push(applyMatch(base, matched, score));
    } else {
      items.push({
        ...base,
        resourceId: null,
        rateAnalysisId: null,
        amount: Math.round(base.quantity * base.rate * 100) / 100,
        matchKind: 'NONE',
        matchLabel: null,
        matchScore: null,
        suggestedAction: 'CREATE',
        libraryRate: null,
      });
    }
  }

  const reviewCount = items.filter((i) => i.suggestedAction === 'REVIEW').length;
  const createCount = items.filter((i) => i.suggestedAction === 'CREATE').length;
  const linkedCount = items.filter((i) => i.suggestedAction === 'LINKED').length;
  const autoNotes =
    `Matched ${linkedCount} to catalog, ${reviewCount} need review (wording differs), ` +
    `${createCount} unmatched (create or link manually). Confirm before finalizing.`;

  return {
    items,
    notes: notes ? `${notes}\n${autoNotes}` : autoNotes,
    sourceTextLength: text.length,
  };
}
