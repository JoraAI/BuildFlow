/**
 * BuildFlow - Project material rate validators.
 */
import { z } from 'zod';

export const upsertProjectMaterialRateSchema = z.object({
  resourceId: z.string().uuid(),
  rate: z.number().min(0),
  unit: z.string().min(1).max(20),
  notes: z.string().max(500).optional(),
});

export const bulkUpsertProjectMaterialRatesSchema = z.object({
  rates: z.array(upsertProjectMaterialRateSchema).min(1).max(200),
});

export type UpsertProjectMaterialRateInput = z.infer<typeof upsertProjectMaterialRateSchema>;

export const projectMaterialRatesParamsSchema = z.object({
  id: z.string().uuid(),
});
