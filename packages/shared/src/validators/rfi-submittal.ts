import { z } from 'zod';
export const RFI_PRIORITIES = ['LOW','NORMAL','HIGH','URGENT'] as const;
export const RFI_STATUSES = ['OPEN','ANSWERED','CLOSED','CANCELLED'] as const;
export const SUBMITTAL_TYPES = ['MATERIAL','SHOP_DRAWING','METHOD_STATEMENT','OTHER'] as const;
export const SUBMITTAL_STATUSES = ['DRAFT','SUBMITTED','APPROVED','REJECTED','REVISE'] as const;
export const createRfiSchema = z.object({ body: z.object({
  projectId: z.string().uuid(), taskId: z.string().uuid().optional(), boqItemId: z.string().uuid().optional(),
  subject: z.string().min(1).max(300), question: z.string().min(1).max(5000),
  priority: z.enum(RFI_PRIORITIES).default('NORMAL'), attachments: z.array(z.string().url()).max(10).default([]),
  dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
})});
export const updateRfiSchema = z.object({ params: z.object({ id: z.string().uuid() }), body: z.object({
  subject: z.string().min(1).max(300).optional(), question: z.string().max(5000).optional(),
  priority: z.enum(RFI_PRIORITIES).optional(), status: z.enum(RFI_STATUSES).optional(),
  attachments: z.array(z.string().url()).max(10).optional(), dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
})});
export const answerRfiSchema = z.object({ params: z.object({ id: z.string().uuid() }), body: z.object({ answer: z.string().min(1).max(10000) })});
export const rfiQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(50),
  projectId: z.string().uuid().optional(), status: z.enum(RFI_STATUSES).optional(), priority: z.enum(RFI_PRIORITIES).optional(),
});
export const createSubmittalSchema = z.object({ body: z.object({
  projectId: z.string().uuid(), taskId: z.string().uuid().optional(),
  title: z.string().min(1).max(300), description: z.string().max(5000).optional(),
  type: z.enum(SUBMITTAL_TYPES).default('MATERIAL'), attachments: z.array(z.string().url()).max(10).default([]),
  dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
})});
export const updateSubmittalSchema = z.object({ params: z.object({ id: z.string().uuid() }), body: z.object({
  title: z.string().min(1).max(300).optional(), description: z.string().max(5000).optional(),
  type: z.enum(SUBMITTAL_TYPES).optional(), status: z.enum(SUBMITTAL_STATUSES).optional(),
  attachments: z.array(z.string().url()).max(10).optional(), reviewNotes: z.string().max(5000).optional(),
  dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
})});
export const reviewSubmittalSchema = z.object({ params: z.object({ id: z.string().uuid() }), body: z.object({
  status: z.enum(['APPROVED','REJECTED','REVISE']), reviewNotes: z.string().max(5000).optional(),
})});
export const submittalQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(50),
  projectId: z.string().uuid().optional(), status: z.enum(SUBMITTAL_STATUSES).optional(), type: z.enum(SUBMITTAL_TYPES).optional(),
});
export type CreateRfiInput = z.infer<typeof createRfiSchema>['body'];
export type UpdateRfiInput = z.infer<typeof updateRfiSchema>['body'];
export type CreateSubmittalInput = z.infer<typeof createSubmittalSchema>['body'];
export type UpdateSubmittalInput = z.infer<typeof updateSubmittalSchema>['body'];
export type RfiQueryInput = z.infer<typeof rfiQuerySchema>;
export type SubmittalQueryInput = z.infer<typeof submittalQuerySchema>;
