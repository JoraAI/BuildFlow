/**
 * BuildFlow - Task & Scheduling Zod validators.
 */
import { z } from 'zod';
import { TaskStatus, TaskConstraintType, DependencyType } from '../enums';

export const taskStatusSchema = z.nativeEnum(TaskStatus);
export const taskConstraintTypeSchema = z.nativeEnum(TaskConstraintType);
export const dependencyTypeSchema = z.nativeEnum(DependencyType);

export const createTaskSchema = z.object({
  name: z.string().min(1, 'Task name is required').max(300),
  description: z.string().max(2000).optional(),
  wbsId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  durationDays: z.number().int().min(1).max(3650).default(1),
  progressPct: z.number().int().min(0).max(100).optional(),
  status: taskStatusSchema.optional(),
  assignedTo: z.string().uuid().optional(),
  constraintType: taskConstraintTypeSchema.optional(),
  isMilestone: z.boolean().optional(),
  predecessors: z
    .array(
      z.object({
        predecessorId: z.string().uuid(),
        type: dependencyTypeSchema.optional(),
        lagDays: z.number().int().min(-365).max(365).optional(),
      }),
    )
    .optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = createTaskSchema.partial();
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const updateTaskProgressSchema = z.object({
  progressPct: z.number().int().min(0).max(100),
});
export type UpdateTaskProgressInput = z.infer<typeof updateTaskProgressSchema>;

export const addTaskResourceSchema = z.object({
  resourceId: z.string().uuid(),
  quantity: z.number().min(0),
  unit: z.string().min(1).max(20),
  rate: z.number().min(0).optional(),
});

export type AddTaskResourceInput = z.infer<typeof addTaskResourceSchema>;

export const taskIdParamsSchema = z.object({
  id: z.string().uuid(),
});