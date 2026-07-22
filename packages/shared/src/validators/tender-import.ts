/**
 * BuildFlow - Tender import validators.
 *
 * Used by the proposal-stage tender import flow (POST /api/proposals/:id/import-tender).
 * The flow: upload PDF/Excel → extract text → LLM produces structured items →
 * review → create estimate items.
 *
 * Extracted items can be either raw resources (matched by name) or rate-analysis
 * items, because client tenders often quote at a composite level (e.g. "RCC M25
 * per cum") rather than individual materials.
 */
import { z } from 'zod';

export const tenderItemTypeSchema = z.enum([
  'MATERIAL',
  'LABOUR',
  'EQUIPMENT',
  'SUBCONTRACTOR',
  'MISC',
]);

export const tenderExtractedItemSchema = z.object({
  description: z.string().min(1).max(500),
  unit: z.string().min(1).max(20),
  quantity: z.number().min(0),
  rate: z.number().min(0),
  amount: z.number().min(0).optional(),
  type: tenderItemTypeSchema.default('MISC'),
  section: z.string().max(200).optional(),
  /** Soft-matched resourceId from the company library (null if no match). */
  resourceId: z.string().uuid().nullable().optional(),
  /** If the tender line is a composite rate (e.g. "RCC M25"), link to a rate analysis. */
  rateAnalysisId: z.string().uuid().nullable().optional(),
  /** Confidence score 0–1 from the LLM for this extraction. */
  confidence: z.number().min(0).max(1).optional(),
});
export type TenderExtractedItem = z.infer<typeof tenderExtractedItemSchema>;

export const tenderUploadSchema = z.object({
  /** Base64-encoded file content (without the data-URL prefix). */
  fileContent: z.string().min(1, 'File content is required'),
  /** Original filename — used for extension detection + storage naming. */
  filename: z.string().min(1).max(255),
  /** MIME type, e.g. 'application/pdf' or 'application/vnd.openxmlformats…'. */
  contentType: z.string().min(1),
  /** Optional hint to the LLM about the tender's scope (improves extraction). */
  projectTypeHint: z.string().max(200).optional(),
});
export type TenderUploadInput = z.infer<typeof tenderUploadSchema>;

export const tenderExtractionResultSchema = z.object({
  items: z.array(tenderExtractedItemSchema),
  /** Free-text notes from the LLM (e.g. "document appears truncated", "rates in USD"). */
  notes: z.string().optional(),
  /** Source text length (for logging / debugging). */
  sourceTextLength: z.number().int().min(0),
});
export type TenderExtractionResult = z.infer<typeof tenderExtractionResultSchema>;