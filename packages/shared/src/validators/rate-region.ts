/**
 * BuildFlow - Rate region validators.
 */
import { z } from 'zod';
import { dateSchema } from './common';

export const createRateRegionSchema = z.object({
  name: z.string().min(1).max(120),
  state: z.string().max(80).optional(),
});

export type CreateRateRegionInput = z.infer<typeof createRateRegionSchema>;

export const updateRateRegionSchema = createRateRegionSchema.partial();
export type UpdateRateRegionInput = z.infer<typeof updateRateRegionSchema>;

export const rateRegionParamsSchema = z.object({
  regionId: z.string().uuid(),
});

export const upsertRegionalRateSchema = z.object({
  resourceId: z.string().uuid(),
  rate: z.number().min(0),
  unit: z.string().min(1).max(20),
  effectiveDate: dateSchema,
  notes: z.string().max(500).optional(),
});

export const bulkUpsertRegionalRatesSchema = z.object({
  rates: z.array(upsertRegionalRateSchema).min(1).max(200),
});

export type UpsertRegionalRateInput = z.infer<typeof upsertRegionalRateSchema>;
