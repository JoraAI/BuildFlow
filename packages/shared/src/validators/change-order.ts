import { z } from 'zod';

export const changeOrderLineSchema = z.object({
  boqItemId: z.string().uuid().optional(),
  resourceId: z.string().uuid().optional(),
  description: z.string().min(1).max(500),
  unit: z.string().min(1).max(20),
  qtyDelta: z.coerce.number(),
  rate: z.coerce.number().nonnegative(),
});
export type ChangeOrderLineInput = z.infer<typeof changeOrderLineSchema>;

export const createChangeOrderSchema = z.object({
  number: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  reason: z.string().max(2000).optional(),
  scheduleImpactDays: z.coerce.number().int().default(0),
  linkedTaskId: z.string().uuid().optional(),
  linkedWorkOrderId: z.string().uuid().optional(),
  lines: z.array(changeOrderLineSchema).min(1),
});
export type CreateChangeOrderInput = z.infer<typeof createChangeOrderSchema>;

export const rejectChangeOrderSchema = z.object({
  reason: z.string().min(1).max(1000),
});

export const changeOrderIdParamsSchema = z.object({
  id: z.string().uuid(),
  changeOrderId: z.string().uuid(),
});
