/**
 * BuildFlow — Resource & Price History Zod validators.
 */
import { z } from 'zod';
import { ResourceType } from '../enums';

export const resourceTypeSchema = z.nativeEnum(ResourceType);

export const createResourceSchema = z.object({
  name: z.string().min(1, 'Resource name is required').max(200),
  type: resourceTypeSchema,
  unit: z.string().min(1).max(20),
  rate: z.number().min(0),
  gstRate: z.number().min(0).max(100).optional(),
  hsnSacCode: z.string().max(20).optional(),
  brandOrSpec: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
});

export type CreateResourceInput = z.infer<typeof createResourceSchema>;

export const updateResourceSchema = createResourceSchema.partial();
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;

export const resourceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  type: resourceTypeSchema.optional(),
  search: z.string().optional(),
  active: z.enum(['true', 'false']).optional(),
});

export type ResourceQueryInput = z.infer<typeof resourceQuerySchema>;

export const resourceIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createPriceHistorySchema = z.object({
  rate: z.number().min(0),
  effectiveDate: z.string().datetime(),
  notes: z.string().max(500).optional(),
});

export type CreatePriceHistoryInput = z.infer<typeof createPriceHistorySchema>;

export const importResourcesSchema = z.object({
  resources: z.array(createResourceSchema).min(1, 'At least one resource is required').max(1000),
});
export type ImportResourcesInput = z.infer<typeof importResourcesSchema>;
