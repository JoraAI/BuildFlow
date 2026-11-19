/**
 * Multi-unit UOM validators (IM).
 */
import { z } from 'zod';

export const companyUnitCreateSchema = z.object({
  name: z.string().trim().min(1).max(20),
  symbol: z.string().trim().max(10).optional().nullable(),
});
export type CompanyUnitCreateInput = z.infer<typeof companyUnitCreateSchema>;

export const companyUnitUpdateSchema = z.object({
  name: z.string().trim().min(1).max(20).optional(),
  symbol: z.string().trim().max(10).optional().nullable(),
  isActive: z.boolean().optional(),
});
export type CompanyUnitUpdateInput = z.infer<typeof companyUnitUpdateSchema>;

export const companyUnitIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const resourceUnitInputSchema = z.object({
  companyUnitId: z.string().uuid().optional(),
  unitName: z.string().trim().min(1).max(20).optional(),
  isBase: z.boolean(),
  conversionToBase: z.number().positive().default(1),
  rate: z.number().min(0).nullable().optional(),
  distributorRate: z.number().min(0).nullable().optional(),
  customerRate: z.number().min(0).nullable().optional(),
}).refine((v) => Boolean(v.companyUnitId || v.unitName), {
  message: 'companyUnitId or unitName is required',
});
export type ResourceUnitInput = z.infer<typeof resourceUnitInputSchema>;
