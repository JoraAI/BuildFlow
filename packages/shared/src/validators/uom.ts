/**
 * Multi-unit UOM validators (IM).
 */
import { z } from 'zod';

/** Reject pure numbers like "500" (usually meant as pack size / ml, not a UOM name). */
const unitNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .refine((v) => !/^\d+(\.\d+)?$/.test(v), {
    message: 'Unit name cannot be only a number (e.g. use "ml" or "pack", not "500")',
  });

export const companyUnitCreateSchema = z.object({
  name: unitNameSchema,
  symbol: z.string().trim().max(10).optional().nullable(),
});
export type CompanyUnitCreateInput = z.infer<typeof companyUnitCreateSchema>;

export const companyUnitUpdateSchema = z.object({
  name: unitNameSchema.optional(),
  symbol: z.string().trim().max(10).optional().nullable(),
  isActive: z.boolean().optional(),
});
export type CompanyUnitUpdateInput = z.infer<typeof companyUnitUpdateSchema>;

export const companyUnitIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const resourceUnitInputSchema = z.object({
  companyUnitId: z.string().uuid().optional(),
  unitName: unitNameSchema.optional(),
  isBase: z.boolean(),
  conversionToBase: z.number().positive().default(1),
  rate: z.number().min(0).nullable().optional(),
  distributorRate: z.number().min(0).nullable().optional(),
  customerRate: z.number().min(0).nullable().optional(),
  /** Optional buy/vendor cost for this unit; blank → base costPrice × conversion. */
  costPrice: z.number().min(0).nullable().optional(),
}).refine((v) => Boolean(v.companyUnitId || v.unitName), {
  message: 'companyUnitId or unitName is required',
});
export type ResourceUnitInput = z.infer<typeof resourceUnitInputSchema>;
