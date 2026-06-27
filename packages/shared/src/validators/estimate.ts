/**
 * BuildFlow — Rate Analysis & Estimate Zod validators.
 */
import { z } from 'zod';
import { CostType } from '../enums';

const costTypeSchema = z.nativeEnum(CostType);

/* ------------------------------------------------------------------ */
/* Rate Analysis                                                        */
/* ------------------------------------------------------------------ */

export const createRateAnalysisComponentSchema = z.object({
  resourceId: z.string().uuid().optional(),
  miscName: z.string().max(200).optional(),
  quantityPerUnit: z.number().min(0),
  unit: z.string().min(1).max(20),
  rate: z.number().min(0),
  type: costTypeSchema,
}).refine(
  (v) => v.resourceId !== undefined || (v.miscName !== undefined && v.miscName.length > 0),
  { message: 'Either resourceId or miscName is required' },
);

export type CreateRateAnalysisComponentInput = z.infer<typeof createRateAnalysisComponentSchema>;

export const createRateAnalysisSchema = z.object({
  name: z.string().min(1, 'Name is required').max(300),
  unit: z.string().min(1).max(20),
  description: z.string().max(1000).optional(),
  components: z.array(createRateAnalysisComponentSchema).min(1, 'At least one component is required'),
});
export type CreateRateAnalysisInput = z.infer<typeof createRateAnalysisSchema>;

export const updateRateAnalysisSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  unit: z.string().min(1).max(20).optional(),
  description: z.string().max(1000).optional(),
  components: z.array(createRateAnalysisComponentSchema).optional(),
});
export type UpdateRateAnalysisInput = z.infer<typeof updateRateAnalysisSchema>;

export const rateAnalysisQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().optional(),
  stale: z.enum(['true', 'false']).optional(),
});
export type RateAnalysisQueryInput = z.infer<typeof rateAnalysisQuerySchema>;

/* ------------------------------------------------------------------ */
/* Estimate                                                            */
/* ------------------------------------------------------------------ */

export const createEstimateSchema = z.object({
  name: z.string().min(1, 'Estimate name is required').max(200),
  notes: z.string().max(2000).optional(),
  overheadPct: z.number().min(0).max(100).default(0),
  contingencyPct: z.number().min(0).max(100).default(0),
  profitMarginPct: z.number().min(0).max(100).default(0),
});
export type CreateEstimateInput = z.infer<typeof createEstimateSchema>;

export const updateEstimateMetaSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  notes: z.string().max(2000).optional(),
  overheadPct: z.number().min(0).max(100).optional(),
  contingencyPct: z.number().min(0).max(100).optional(),
  profitMarginPct: z.number().min(0).max(100).optional(),
});
export type UpdateEstimateMetaInput = z.infer<typeof updateEstimateMetaSchema>;

export const createEstimateSectionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  orderIndex: z.number().int().min(0).default(0),
});
export type CreateEstimateSectionInput = z.infer<typeof createEstimateSectionSchema>;

export const updateEstimateSectionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  orderIndex: z.number().int().min(0).optional(),
});
export type UpdateEstimateSectionInput = z.infer<typeof updateEstimateSectionSchema>;

export const createEstimateItemSchema = z.object({
  sectionId: z.string().uuid(),
  description: z.string().min(1).max(500),
  unit: z.string().min(1).max(20),
  quantity: z.number().min(0),
  rate: z.number().min(0),
  type: costTypeSchema.default('MISC'),
  resourceId: z.string().uuid().optional(),
  wbsItemId: z.string().uuid().optional(),
  itemCode: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
});
export type CreateEstimateItemInput = z.infer<typeof createEstimateItemSchema>;

export const updateEstimateItemSchema = z.object({
  sectionId: z.string().uuid().optional(),
  description: z.string().min(1).max(500).optional(),
  unit: z.string().min(1).max(20).optional(),
  quantity: z.number().min(0).optional(),
  rate: z.number().min(0).optional(),
  type: costTypeSchema.optional(),
  resourceId: z.string().uuid().optional().nullable(),
  wbsItemId: z.string().uuid().optional().nullable(),
  itemCode: z.string().max(50).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});
export type UpdateEstimateItemInput = z.infer<typeof updateEstimateItemSchema>;

export const rejectEstimateSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required').max(1000),
});
export type RejectEstimateInput = z.infer<typeof rejectEstimateSchema>;

export const estimateQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.nativeEnum(CostType).optional(),
});
export type EstimateQueryInput = z.infer<typeof estimateQuerySchema>;