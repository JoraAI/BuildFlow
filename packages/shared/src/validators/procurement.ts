import { z } from 'zod';
import { materialRateSourceSchema } from './material-rate';

export const requisitionLineSchema = z.object({
  // FIX (NR-13): resourceId is OPTIONAL so BOQ-only lines (no catalog resource)
  // can be saved instead of being silently dropped or failing the whole save.
  resourceId: z.string().uuid().optional(),
  boqItemId: z.string().uuid().optional(),
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1).max(20),
  expectedRate: z.coerce.number().nonnegative().optional(),
  rateSource: materialRateSourceSchema.optional(),
}).refine((data) => data.resourceId || data.boqItemId, {
  message: 'Either resourceId or boqItemId must be provided',
});

export const createRequisitionSchema = z.object({
  reqNumber: z.string().min(1).max(50).optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(requisitionLineSchema).min(1),
});
export type CreateRequisitionInput = z.infer<typeof createRequisitionSchema>;

/** Optional document number: empty/whitespace → server auto-assigns. */
const optionalDocNumber = z
  .string()
  .max(50)
  .optional()
  .transform((v) => {
    const t = v?.trim();
    return t ? t : undefined;
  });

export const createPurchaseOrderSchema = z.object({
  // Prefill suggested PO-YYYY-NNNN; omit/blank = server generates. User may override.
  poNumber: optionalDocNumber,
  vendorName: z.string().min(1).max(200),
  requisitionId: z.string().uuid().optional(),
  lines: z.array(
    z.object({
      resourceId: z.string().uuid(),
      boqItemId: z.string().uuid().optional(),
      quantity: z.coerce.number().positive(),
      unit: z.string().min(1).max(20),
      rate: z.coerce.number().nonnegative(),
    }),
  ).min(1),
});
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;

export const createGrnSchema = z.object({
  // Prefill suggested GRN-YYYY-NNNN; omit/blank = server generates. User may override.
  grnNumber: optionalDocNumber,
  purchaseOrderId: z.string().uuid(),
  receivedDate: z.coerce.date(),
  notes: z.string().max(2000).optional(),
  lines: z.array(
    z.object({
      resourceId: z.string().uuid(),
      quantity: z.coerce.number().positive(),
      unit: z.string().min(1).max(20),
    }),
  ).min(1),
});
export type CreateGrnInput = z.infer<typeof createGrnSchema>;

/** One issued material line in a multi-line stock issue (INVENTORY_UX_POLISH D9). */
export const issueStockLineSchema = z.object({
  resourceId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  /** Selling unit price for the draft sales invoice (ex-GST). Falls back to catalog rate. */
  unitPrice: z.coerce.number().nonnegative().optional(),
});
export type IssueStockLineInput = z.infer<typeof issueStockLineSchema>;

/**
 * Manual stock issue (OUT) for inventory / store operations.
 *
 * D9 (INVENTORY_UX_POLISH): accepts BOTH the legacy single-resource shape and
 * the preferred multi-line shape:
 *   - legacy: `{ resourceId, quantity, unitPrice?, customerName?, ... }`
 *   - multi:  `{ lines: [{ resourceId, quantity, unitPrice? }, ...], ... }`
 * The service normalizes both to a lines[] list.
 */
export const issueStockSchema = z
  .object({
    // Legacy single-line shape (kept for backward compatibility).
    resourceId: z.string().uuid().optional(),
    quantity: z.coerce.number().positive().optional(),
    unitPrice: z.coerce.number().nonnegative().optional(),
    // D9: preferred multi-line shape.
    lines: z.array(issueStockLineSchema).min(1).optional(),
    /** Optional buyer/customer for auto draft sales invoice (inventory). */
    customerName: z.string().min(1).max(200).optional(),
    // INVENTORY_UX_POLISH (D6): optional buyer contact for the draft invoice.
    customerPhone: z.string().max(20).optional(),
    customerAddress: z.string().max(500).optional(),
    notes: z.string().max(2000).optional(),
  })
  .superRefine((val, ctx) => {
    // Multi-line shape is self-sufficient; legacy requires resourceId + quantity.
    if (val.lines && val.lines.length > 0) return;
    if (!val.resourceId || !val.quantity) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provide either resourceId + quantity (single issue) or lines[] (multi issue)',
      });
    }
  });
export type IssueStockInput = z.infer<typeof issueStockSchema>;

export const createStockLocationSchema = z.object({
  name: z.string().min(1).max(100),
  projectId: z.string().uuid().optional(),
});
