/**
 * BuildFlow - Bill extraction service (PROC-B9).
 *
 * Reuses extractText + callLlmForExtraction from tender-extract.service.ts.
 * Does NOT write to DB — returns draft for human review before create.
 */
import { extractText, callLlmForExtraction } from './tender-extract.service';
import { logger } from '../config/logger';
import type { BillExtractedDraft, BillBulkExtractResult, BillUploadInput } from '@buildflow/shared';

const MAX_TEXT_CHARS = 24_000;

function buildBillExtractPrompt(text: string): string {
  const truncated = text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) + '\n…[truncated]' : text;
  return (
    'Extract the vendor bill (supplier tax invoice) data from the text below. ' +
    'Return JSON: {"vendorName": string, "vendorGstin": string|null, "billNumber": string|null, ' +
    '"billDate": "YYYY-MM-DD"|null, "dueDate": "YYYY-MM-DD"|null, "subtotal": number, "gstAmount": number, ' +
    '"tdsAmount": number, "category": "MATERIAL"|"LABOUR"|"EQUIPMENT"|"SUBCONTRACTOR"|"OTHER", ' +
    '"poNumberHint": string|null, "confidence": number(0-1), "notes": string|null}. ' +
    'If a field is not present, use null or 0 for numbers.\n\n' +
    `--- INVOICE TEXT ---\n${truncated}`
  );
}

/**
 * Extract a single vendor bill draft from an uploaded file.
 * Does NOT write to DB — returns draft for review.
 */
export async function extractBillFromFile(
  companyId: string,
  input: BillUploadInput,
): Promise<{ draft: BillExtractedDraft | null; notes: string }> {
  const text = await extractText(input.fileContent, input.contentType);
  const prompt = buildBillExtractPrompt(text);
  const llmRaw = await callLlmForExtraction(companyId, prompt);

  if (!llmRaw) {
    return {
      draft: null,
      notes: 'AI extraction is not available. Please enter the bill details manually.',
    };
  }

  try {
    const parsed = JSON.parse(llmRaw);
    const draft: BillExtractedDraft = {
      vendorName: String(parsed.vendorName || 'Unknown Vendor'),
      vendorGstin: parsed.vendorGstin || undefined,
      billNumber: parsed.billNumber || undefined,
      billDate: parsed.billDate || undefined,
      dueDate: parsed.dueDate || undefined,
      subtotal: Number(parsed.subtotal) || 0,
      gstAmount: Number(parsed.gstAmount) || 0,
      tdsAmount: Number(parsed.tdsAmount) || 0,
      category: parsed.category || 'MATERIAL',
      poNumberHint: parsed.poNumberHint || undefined,
      confidence: Number(parsed.confidence) || 0,
      notes: parsed.notes || undefined,
      filename: input.filename,
    };

    return {
      draft,
      notes: draft.confidence > 0.7
        ? 'High confidence extraction. Review before saving.'
        : 'Low confidence — please verify all fields carefully.',
    };
  } catch (err) {
    logger.warn('Bill extract JSON parse failed', { error: String(err), companyId });
    return {
      draft: null,
      notes: 'Failed to parse AI extraction result. Please enter manually.',
    };
  }
}

/**
 * Extract multiple vendor bills from uploaded files (bulk import).
 * Does NOT write to DB — returns drafts for review.
 */
export async function extractBillsFromFiles(
  companyId: string,
  files: BillUploadInput[],
): Promise<BillBulkExtractResult> {
  const MAX_FILES = 20;
  const batch = files.slice(0, MAX_FILES);
  const drafts: BillExtractedDraft[] = [];
  let failedCount = 0;

  for (const file of batch) {
    try {
      const { draft } = await extractBillFromFile(companyId, file);
      if (draft) {
        drafts.push(draft);
      } else {
        failedCount++;
      }
    } catch (err) {
      logger.warn('Bulk bill extract: file failed', { filename: file.filename, error: String(err) });
      failedCount++;
    }
  }

  const notes = failedCount > 0
    ? `${failedCount} file(s) could not be processed by AI. Enter manually.`
    : `${drafts.length} invoice(s) extracted. Review all fields before creating.`;

  return { drafts, notes };
}