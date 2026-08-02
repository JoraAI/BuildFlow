import { z } from 'zod';
export const DRAWING_DISCIPLINES = ['CIVIL','STRUCTURAL','MEP','ARCHITECTURAL','OTHER'] as const;
export const DRAWING_STATUSES = ['DRAFT','IN_REVIEW','APPROVED','SUPERSEDED'] as const;
export const createDrawingSchema = z.object({ body: z.object({
  projectId: z.string().uuid(), drawingNo: z.string().min(1).max(100), title: z.string().min(1).max(500),
  discipline: z.enum(DRAWING_DISCIPLINES).default('CIVIL'), category: z.string().max(200).optional(),
})});
export const updateDrawingSchema = z.object({ params: z.object({ id: z.string().uuid() }), body: z.object({
  title: z.string().min(1).max(500).optional(), discipline: z.enum(DRAWING_DISCIPLINES).optional(),
  category: z.string().max(200).optional(), status: z.enum(DRAWING_STATUSES).optional(),
})});
export const addVersionSchema = z.object({ params: z.object({ id: z.string().uuid() }), body: z.object({
  versionLabel: z.string().min(1).max(50), fileUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional(), notes: z.string().max(2000).optional(),
})});
export const drawingQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(50),
  projectId: z.string().uuid().optional(), status: z.enum(DRAWING_STATUSES).optional(),
  discipline: z.enum(DRAWING_DISCIPLINES).optional(),
});
export type CreateDrawingInput = z.infer<typeof createDrawingSchema>['body'];
export type UpdateDrawingInput = z.infer<typeof updateDrawingSchema>['body'];
export type AddVersionInput = z.infer<typeof addVersionSchema>['body'];
export type DrawingQueryInput = z.infer<typeof drawingQuerySchema>;
