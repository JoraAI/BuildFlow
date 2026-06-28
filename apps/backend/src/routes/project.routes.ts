/**
 * BuildFlow — Project routes.
 *
 * All routes require authentication + company scoping (via middleware).
 */
import { Router } from 'express';
import * as projectController from '../controllers/project.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createProjectSchema,
  updateProjectSchema,
  projectQuerySchema,
  projectIdParamsSchema,
  createWbsItemSchema,
  updateWbsItemSchema,
  wbsItemParamsSchema,
  setProjectMembersSchema,
} from '@buildflow/shared';
import { Role } from '@buildflow/shared';

export const projectRouter = Router();

projectRouter.use(authenticateToken);

// Project CRUD
projectRouter.get('/', validate({ query: projectQuerySchema }), projectController.listProjects);
projectRouter.post('/', validate({ body: createProjectSchema }), projectController.createProject);
projectRouter.get('/:id', validate({ params: projectIdParamsSchema }), projectController.getProject);
projectRouter.put(
  '/:id',
  validate({ params: projectIdParamsSchema, body: updateProjectSchema }),
  projectController.updateProject,
);
projectRouter.delete(
  '/:id',
  requireRole(Role.OWNER),
  validate({ params: projectIdParamsSchema }),
  projectController.deleteProject,
);
projectRouter.get(
  '/:id/summary',
  validate({ params: projectIdParamsSchema }),
  projectController.getProjectSummary,
);

projectRouter.get(
  '/:id/members',
  requireRole(Role.OWNER, Role.PM),
  validate({ params: projectIdParamsSchema }),
  projectController.getMembers,
);
projectRouter.put(
  '/:id/members',
  requireRole(Role.OWNER),
  validate({ params: projectIdParamsSchema, body: setProjectMembersSchema }),
  projectController.setMembers,
);

// WBS
projectRouter.get('/:id/wbs', validate({ params: projectIdParamsSchema }), projectController.getWbsTree);
projectRouter.post(
  '/:id/wbs',
  validate({ params: projectIdParamsSchema, body: createWbsItemSchema }),
  projectController.createWbsItem,
);
projectRouter.put(
  '/:id/wbs/:itemId',
  validate({ params: wbsItemParamsSchema, body: updateWbsItemSchema }),
  projectController.updateWbsItem,
);
projectRouter.delete(
  '/:id/wbs/:itemId',
  validate({ params: wbsItemParamsSchema }),
  projectController.deleteWbsItem,
);