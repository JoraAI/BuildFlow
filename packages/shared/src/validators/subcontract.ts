import { z } from 'zod';
import { idSchema } from './common';

export const createSubcontractorSchema = z.object({
  name: z.string().min(1).max(200),
  gstin: z.string().max(15).optional(),
  contactPhone: z.string().max(20).optional(),
  defaultTdsRate: z.coerce.number().min(0).max(100).optional(),
});
export type CreateSubcontractorInput = z.infer<typeof createSubcontractorSchema>;

export const workOrderLineSchema = z.object({
  description: z.string().min(1).max(500),
  unit: z.string().min(1).max(20),
  contractQty: z.coerce.number().positive(),
  rate: z.coerce.number().nonnegative(),
  boqItemId: idSchema.optional(),
});

export const createWorkOrderSchema = z.object({
  subcontractorId: idSchema,
  woNumber: z.string().min(1).max(50),
  scope: z.string().min(1).max(2000),
  contractValue: z.coerce.number().nonnegative(),
  retentionPct: z.coerce.number().min(0).max(100).default(0),
  advanceAmount: z.coerce.number().nonnegative().default(0),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  boqItemId: idSchema.optional(),
  taskId: idSchema.optional(),
  lines: z.array(workOrderLineSchema).optional(),
});
export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;

export const createWorkOrderFromBoqSchema = z.object({
  subcontractorId: idSchema,
  woNumber: z.string().min(1).max(50),
  boqItemIds: z.array(idSchema).min(1),
  retentionPct: z.coerce.number().min(0).max(100).default(0),
  advanceAmount: z.coerce.number().nonnegative().default(0),
  taskId: idSchema.optional(),
});
export type CreateWorkOrderFromBoqInput = z.infer<typeof createWorkOrderFromBoqSchema>;

export const measurementLineSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1).max(20),
  rate: z.coerce.number().nonnegative(),
  boqItemId: idSchema.optional(),
  workOrderLineId: idSchema.optional(),
});

export const createMeasurementSchema = z.object({
  periodLabel: z.string().min(1).max(100),
  lines: z.array(measurementLineSchema).min(1),
});
export type CreateMeasurementInput = z.infer<typeof createMeasurementSchema>;

export const rejectMeasurementSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});
export type RejectMeasurementInput = z.infer<typeof rejectMeasurementSchema>;

export const createSubcontractorPortalSchema = z.object({
  subcontractorId: idSchema,
  workOrderId: idSchema.optional(),
  label: z.string().min(1).max(200),
  scopes: z.array(z.enum(['VIEW_WO', 'SUBMIT_MEASUREMENT', 'VIEW_PAYMENTS'])).min(1),
  expiresInDays: z.coerce.number().int().min(1).max(365).default(30),
});
export type CreateSubcontractorPortalInput = z.infer<typeof createSubcontractorPortalSchema>;

export const recordBillPaymentSchema = z.object({
  amount: z.coerce.number().positive(),
});
export type RecordBillPaymentInput = z.infer<typeof recordBillPaymentSchema>;
