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

export const createPurchaseOrderSchema = z.object({
  poNumber: z.string().min(1).max(50),
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
  grnNumber: z.string().min(1).max(50),
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

/** Manual stock issue (OUT) for inventory / store operations. */
export const issueStockSchema = z.object({
  resourceId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  /** Selling unit price for the draft sales invoice (ex-GST). Falls back to catalog rate. */
  unitPrice: z.coerce.number().nonnegative().optional(),
  /** Optional buyer/customer for auto draft sales invoice (inventory). */
  customerName: z.string().min(1).max(200).optional(),
  notes: z.string().max(2000).optional(),
});
export type IssueStockInput = z.infer<typeof issueStockSchema>;

export const createStockLocationSchema = z.object({
  name: z.string().min(1).max(100),
  projectId: z.string().uuid().optional(),
});
