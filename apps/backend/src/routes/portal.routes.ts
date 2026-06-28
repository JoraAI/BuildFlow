/**
 * BuildFlow - Client portal routes.
 *
 * Public:        GET /api/portal/:token
 * Authenticated: POST /api/projects/:id/portal-access
 */
import { Router } from 'express';
import { z } from 'zod';
import * as portalController from '../controllers/portal.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createPortalAccessSchema, idSchema } from '@buildflow/shared';
import { Role } from '@buildflow/shared';

const projectIdParams = z.object({ id: idSchema });
const tokenParams = z.object({ token: z.string().min(32).max(128) });

export const portalPublicRouter = Router();

portalPublicRouter.get(
  '/:token',
  validate({ params: tokenParams }),
  portalController.getByToken,
);

export const portalProjectRouter = Router();
portalProjectRouter.use(authenticateToken);

portalProjectRouter.post(
  '/:id/portal-access',
  requireRole(Role.OWNER, Role.PM),
  validate({ params: projectIdParams, body: createPortalAccessSchema }),
  portalController.createAccess,
);
