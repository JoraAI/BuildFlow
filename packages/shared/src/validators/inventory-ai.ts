/**
 * BuildFlow - Inventory AI validators (INVENTORY_HORIZONTAL_PLATFORM Phase 7).
 *
 * 7.1 Document OCR → draft vendor bill (header + lines with GST/HSN, PO/GRN match).
 * 7.2 AI-assisted catalog / opening-stock import column mapping.
 * 7.3 Anomaly hints (rules-first: PO rate band, stock-count variance, overdue invoices).
 *
 * All routes are inventory-gated server-side (construction → 403).
 */
import { z } from 'zod';

/* ── 7.1 Invoice upload → draft bill ───────────────────────────────── */

export const invoiceUploadSchema = z.object({
  fileContent: z.string().min(1),
  filename: z.string().min(1),
  contentType: z.string().default('application/octet-stream'),
  // Optional hints to improve PO/GRN matching against the STORE project.
  poNumberHint: z.string().max(100).optional(),
  grnNumberHint: z.string().max(100).optional(),
});
export type InvoiceUploadInput = z.infer<typeof invoiceUploadSchema>;

export const inventoryBillDraftLineSchema = z.object({
  description: z.string().min(1).max(500),
  hsn: z.string().max(20).optional(),
  unit: z.string().max(20).optional(),
  quantity: z.coerce.number().nonnegative(),
  rate: z.coerce.number().nonnegative(),
  gstRate: z.coerce.number().nonnegative().default(0),
  amount: z.coerce.number().nonnegative().default(0),
  matchedResourceId: z.string().uuid().nullable().optional(),
  matchedResourceName: z.string().max(200).nullable().optional(),
});
export type InventoryBillDraftLine = z.infer<typeof inventoryBillDraftLineSchema>;

export const inventoryBillDraftSchema = z.object({
  vendorName: z.string().min(1).max(200),
  vendorGstin: z.string().max(15).nullable().optional(),
  billNumber: z.string().max(50).nullable().optional(),
  billDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  subtotal: z.coerce.number().nonnegative(),
  gstAmount: z.coerce.number().nonnegative().default(0),
  tdsAmount: z.coerce.number().nonnegative().default(0),
  total: z.coerce.number().nonnegative().default(0),
  category: z.enum(['MATERIAL', 'LABOUR', 'EQUIPMENT', 'SUBCONTRACTOR', 'OTHER']).default('MATERIAL'),
  poNumberHint: z.string().nullable().optional(),
  grnNumberHint: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).default(0),
  notes: z.string().nullable().optional(),
  filename: z.string().nullable().optional(),
  lines: z.array(inventoryBillDraftLineSchema).default([]),
  matchedPO: z
    .object({ id: z.string().uuid(), poNumber: z.string(), vendorName: z.string(), totalAmount: z.number() })
    .nullable()
    .optional(),
  matchedGRN: z
    .object({ id: z.string().uuid(), grnNumber: z.string(), receivedDate: z.string() })
    .nullable()
    .optional(),
});
export type InventoryBillDraft = z.infer<typeof inventoryBillDraftSchema>;

export const createBillFromDraftSchema = z.object({
  draft: inventoryBillDraftSchema,
  // Optional user overrides applied on top of the extracted draft.
  vendorId: z.string().uuid().optional(),
  billNumber: z.string().min(1).max(50).optional(),
  billDate: z.string().optional(),
});
export type CreateBillFromDraftInput = z.infer<typeof createBillFromDraftSchema>;

/* ── 7.2 AI import column mapping ──────────────────────────────────── */

export const importPreviewSchema = z.object({
  fileContent: z.string().min(1),
  filename: z.string().min(1),
  contentType: z.string().default('application/octet-stream'),
  purpose: z.enum(['CATALOG', 'OPENING']).default('OPENING'),
});
export type ImportPreviewInput = z.infer<typeof importPreviewSchema>;

export const importMappingSchema = z.object({
  name: z.string().max(200).nullable().optional(),
  unit: z.string().max(40).nullable().optional(),
  rate: z.string().max(40).nullable().optional(),
  gstRate: z.string().max(40).nullable().optional(),
  hsn: z.string().max(40).nullable().optional(),
  sku: z.string().max(40).nullable().optional(),
  itemCode: z.string().max(40).nullable().optional(),
  barcode: z.string().max(40).nullable().optional(),
  reorderPoint: z.string().max(40).nullable().optional(),
  qty: z.string().max(40).nullable().optional(),
});
export type ImportMapping = z.infer<typeof importMappingSchema>;

export const importConfirmSchema = z.object({
  mode: z.enum(['CATALOG', 'OPENING']),
  mapping: importMappingSchema,
  headers: z.array(z.string().max(200)).optional(),
  rows: z.array(z.record(z.string(), z.string())).min(1).max(2000),
  locationId: z.string().uuid().optional(),
});
export type ImportConfirmInput = z.infer<typeof importConfirmSchema>;

/* ── 7.3 Anomaly hints ─────────────────────────────────────────────── */

export const anomalyHintSchema = z.object({
  type: z.enum(['PO_RATE', 'COUNT_VARIANCE', 'OVERDUE_INVOICE']),
  severity: z.enum(['high', 'medium', 'low']),
  title: z.string(),
  detail: z.string(),
  referenceId: z.string().optional(),
  referenceNumber: z.string().optional(),
});
export type AnomalyHint = z.infer<typeof anomalyHintSchema>;
