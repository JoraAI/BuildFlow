import { z } from 'zod';
export const DRAWING_DISCIPLINES = ['CIVIL','STRUCTURAL','MEP','ARCHITECTURAL','OTHER'] as const;
export const DRAWING_STATUSES = ['DRAFT','IN_REVIEW','APPROVED','SUPERSEDED'] as const;

/** Blueprint sheet: http(s) or camera/gallery data URL. */
const drawingFileUrlSchema = z
  .string()
  .max(5_000_000)
  .refine(
    (v) => /^https?:\/\//i.test(v) || /^data:image\//i.test(v),
    'File must be an image URL or captured image',
  );

export const DRAWING_PIN_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export const DRAWING_PIN_STATUSES = ['OPEN', 'RESOLVED', 'CLOSED'] as const;

export const drawingPinSchema = z.object({
  id: z.string().min(1).max(80),
  xPct: z.number().min(0).max(100),
  yPct: z.number().min(0).max(100),
  title: z.string().min(1).max(300),
  severity: z.enum(DRAWING_PIN_SEVERITIES).default('HIGH'),
  status: z.enum(DRAWING_PIN_STATUSES).default('OPEN'),
  assignee: z.string().max(200).optional(),
  photoUrl: drawingFileUrlSchema.optional(),
});

export const createDrawingSchema = z.object({ body: z.object({
  projectId: z.string().uuid(), drawingNo: z.string().min(1).max(100), title: z.string().min(1).max(500),
  discipline: z.enum(DRAWING_DISCIPLINES).default('CIVIL'), category: z.string().max(200).nullable().optional(),
})});
export const updateDrawingSchema = z.object({ params: z.object({ id: z.string().uuid() }), body: z.object({
  title: z.string().min(1).max(500).optional(), discipline: z.enum(DRAWING_DISCIPLINES).optional(),
  category: z.string().max(200).nullable().optional(), status: z.enum(DRAWING_STATUSES).optional(),
})});
export const addVersionSchema = z.object({ params: z.object({ id: z.string().uuid() }), body: z.object({
  versionLabel: z.string().min(1).max(50), fileUrl: drawingFileUrlSchema,
  thumbnailUrl: drawingFileUrlSchema.optional(), notes: z.string().max(2000).nullable().optional(),
})});
export const replaceDrawingPinsSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ pins: z.array(drawingPinSchema).max(200) }),
});
export const drawingQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(50),
  projectId: z.string().uuid().optional(), status: z.enum(DRAWING_STATUSES).optional(),
  discipline: z.enum(DRAWING_DISCIPLINES).optional(),
});
export type CreateDrawingInput = z.infer<typeof createDrawingSchema>['body'];
export type UpdateDrawingInput = z.infer<typeof updateDrawingSchema>['body'];
export type AddVersionInput = z.infer<typeof addVersionSchema>['body'];
export type ReplaceDrawingPinsInput = z.infer<typeof replaceDrawingPinsSchema>['body'];
export type DrawingQueryInput = z.infer<typeof drawingQuerySchema>;
export type DrawingPinInput = z.infer<typeof drawingPinSchema>;
