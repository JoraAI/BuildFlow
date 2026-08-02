import { z } from 'zod';
export const PUNCH_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export const PUNCH_STATUSES = ['OPEN', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'CLOSED'] as const;
export const createPunchItemSchema = z.object({
  body: z.object({
    projectId: z.string().uuid(),
    taskId: z.string().uuid().optional(),
    title: z.string().min(1).max(300),
    description: z.string().max(2000).optional(),
    location: z.string().max(300).optional(),
    priority: z.enum(PUNCH_PRIORITIES).default('MEDIUM'),
    assignedTo: z.string().uuid().optional(),
    dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    photos: z.array(z.string().url()).max(10).default([]),
  }),
});
export const updatePunchItemSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    title: z.string().min(1).max(300).optional(),
    description: z.string().max(2000).optional(),
    location: z.string().max(300).optional(),
    priority: z.enum(PUNCH_PRIORITIES).optional(),
    status: z.enum(PUNCH_STATUSES).optional(),
    assignedTo: z.string().uuid().nullable().optional(),
    dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    photos: z.array(z.string().url()).max(10).optional(),
  }),
});
export const punchItemIdParamsSchema = z.object({ id: z.string().uuid() });
export const punchItemQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  projectId: z.string().uuid().optional(),
  status: z.enum(PUNCH_STATUSES).optional(),
  priority: z.enum(PUNCH_PRIORITIES).optional(),
});
export type CreatePunchItemInput = z.infer<typeof createPunchItemSchema>['body'];
export type UpdatePunchItemInput = z.infer<typeof updatePunchItemSchema>['body'];
export type PunchItemQueryInput = z.infer<typeof punchItemQuerySchema>;
