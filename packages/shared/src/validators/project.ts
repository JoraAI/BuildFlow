/**
 * BuildFlow - Project & WBS Zod validators.
 */
import { z } from 'zod';
import { ProjectType, ProjectStatus } from '../enums';
import { dateSchema } from './common';

export const projectTypeSchema = z.nativeEnum(ProjectType);
export const projectStatusSchema = z.nativeEnum(ProjectStatus);

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(200),
  code: z.string().min(1, 'Project code is required').max(50),
  type: projectTypeSchema,
  status: projectStatusSchema.optional(),
  clientName: z.string().min(1, 'Client name is required').max(200),
  clientContact: z.string().max(50).optional(),
  locationLat: z.number().min(-90).max(90).optional(),
  locationLng: z.number().min(-180).max(180).optional(),
  locationAddress: z.string().max(500).optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  budget: z.number().min(0).optional(),
  rateRegionId: z.string().uuid().nullable().optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema.partial();
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const projectQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: projectStatusSchema.optional(),
  type: projectTypeSchema.optional(),
  search: z.string().optional(),
  excludeTemporary: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => {
      if (v === undefined) return true;
      if (typeof v === 'boolean') return v;
      return v !== 'false';
    }),
});

export type ProjectQueryInput = z.infer<typeof projectQuerySchema>;

export const projectIdParamsSchema = z.object({
  id: z.string().uuid(),
});

/* ------------------------------------------------------------------ */
/* WBS                                                                 */
/* ------------------------------------------------------------------ */

export const createWbsItemSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  parentId: z.string().uuid().optional(),
  orderIndex: z.number().int().optional(),
});

export type CreateWbsItemInput = z.infer<typeof createWbsItemSchema>;

export const updateWbsItemSchema = createWbsItemSchema.partial();
export type UpdateWbsItemInput = z.infer<typeof updateWbsItemSchema>;

export const wbsItemParamsSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
});