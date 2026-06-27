/**
 * BuildFlow — Project & WBS Zod validators.
 */
import { z } from 'zod';
import { ProjectType, ProjectStatus } from '../enums';

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
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  budget: z.number().min(0).optional(),
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