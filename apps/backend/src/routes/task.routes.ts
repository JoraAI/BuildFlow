/**
 * BuildFlow - Task routes.
 *
 * Nested under /api/projects for project-scoped endpoints; /api/tasks for
 * task-level endpoints.
 */
import { Router } from 'express';
import * as taskController from '../controllers/task.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { requireModule, requireModuleForPaths } from '../middleware/module-gate';
import { validate } from '../middleware/validate';
import {
  createTaskSchema,
  updateTaskSchema,
  updateTaskProgressSchema,
  addTaskResourceSchema,
  taskIdParamsSchema,
  projectIdParamsSchema,
} from '@buildflow/shared';
import { Role } from '@buildflow/shared';

export const taskRouter = Router();

taskRouter.use(authenticateToken);
// Mounted at /api/projects - path-aware so only planning routes are gated.
taskRouter.use(
  requireModuleForPaths('planning', [
    /^\/[^/]+\/tasks\b/,
    /^\/[^/]+\/gantt\b/,
    /^\/[^/]+\/critical-path\b/,
  ]),
);

// Project-scoped task endpoints
taskRouter.get('/:id/tasks', validate({ params: projectIdParamsSchema }), taskController.listTasks);
taskRouter.post('/:id/tasks', validate({ params: projectIdParamsSchema, body: createTaskSchema }), taskController.createTask);
taskRouter.get('/:id/gantt', validate({ params: projectIdParamsSchema }), taskController.getGantt);
taskRouter.get('/:id/critical-path', validate({ params: projectIdParamsSchema }), taskController.getCriticalPath);

// Task-level endpoints (mounted at /api/tasks)
export const taskDetailRouter = Router();
taskDetailRouter.use(authenticateToken);
taskDetailRouter.use(requireModule('planning'));

taskDetailRouter.put('/:id', validate({ params: taskIdParamsSchema, body: updateTaskSchema }), taskController.updateTask);
taskDetailRouter.delete('/:id', validate({ params: taskIdParamsSchema }), taskController.deleteTask);
taskDetailRouter.put(
  '/:id/progress',
  requireRole(Role.PM, Role.SUPERVISOR, Role.OWNER),
  validate({ params: taskIdParamsSchema, body: updateTaskProgressSchema }),
  taskController.updateTaskProgress,
);

// Task resources
taskDetailRouter.post('/:id/resources', validate({ params: taskIdParamsSchema, body: addTaskResourceSchema }), taskController.addTaskResource);
taskDetailRouter.delete('/:id/resources/:rid', validate({ params: taskIdParamsSchema }), taskController.removeTaskResource);