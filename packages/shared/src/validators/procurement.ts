import { z } from 'zod';

export const requisitionLineSchema = z.object({
  resourceId: z.string().uuid(),
  boqItemId: z.string().uuid().optional(),
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1).max(20),
});

export const createRequisitionSchema = z.object({
  reqNumber: z.string().min(1).max(50),
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

export const createStockLocationSchema = z.object({
  name: z.string().min(1).max(100),
  projectId: z.string().uuid().optional(),
});
