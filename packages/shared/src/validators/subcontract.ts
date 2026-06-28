import { z } from 'zod';

export const createSubcontractorSchema = z.object({
  name: z.string().min(1).max(200),
  gstin: z.string().max(15).optional(),
  contactPhone: z.string().max(20).optional(),
});
export type CreateSubcontractorInput = z.infer<typeof createSubcontractorSchema>;

export const createWorkOrderSchema = z.object({
  subcontractorId: z.string().uuid(),
  woNumber: z.string().min(1).max(50),
  scope: z.string().min(1).max(2000),
  contractValue: z.coerce.number().nonnegative(),
  retentionPct: z.coerce.number().min(0).max(100).default(0),
  advanceAmount: z.coerce.number().nonnegative().default(0),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});
export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;

export const createMeasurementSchema = z.object({
  periodLabel: z.string().min(1).max(100),
  lines: z.array(
    z.object({
      description: z.string().min(1).max(500),
      quantity: z.coerce.number().positive(),
      unit: z.string().min(1).max(20),
      rate: z.coerce.number().nonnegative(),
    }),
  ).min(1),
});
export type CreateMeasurementInput = z.infer<typeof createMeasurementSchema>;
