/**
 * BuildFlow - BOQ Zod validators.
 */
import { z } from 'zod';

export const createBoqItemSchema = z.object({
  wbsId: z.string().uuid().optional(),
  itemCode: z.string().min(1).max(50),
  description: z.string().min(1).max(1000),
  unit: z.string().min(1).max(20),
  quantity: z.number().min(0),
  rate: z.number().min(0),
  category: z.string().max(100).optional(),
});

export type CreateBoqItemInput = z.infer<typeof createBoqItemSchema>;

export const updateBoqItemSchema = createBoqItemSchema.partial();
export type UpdateBoqItemInput = z.infer<typeof updateBoqItemSchema>;

export const boqItemIdParamsSchema = z.object({
  id: z.string().uuid(),
});

/** Bulk import row shape (CSV/JSON). */
export const boqImportRowSchema = z.object({
  itemCode: z.string().min(1),
  description: z.string().min(1),
  unit: z.string().min(1),
  quantity: z.coerce.number().min(0),
  rate: z.coerce.number().min(0),
  category: z.string().optional(),
});

export const boqImportSchema = z.array(boqImportRowSchema).min(1, 'At least one row required');
export type BoqImportInput = z.infer<typeof boqImportSchema>;

export const recordBoqMeasurementSchema = z.object({
  quantity: z.number().positive('Quantity must be greater than 0'),
  notes: z.string().max(500).optional(),
  measuredAt: z.string().datetime().optional(),
});
export type RecordBoqMeasurementInput = z.infer<typeof recordBoqMeasurementSchema>;