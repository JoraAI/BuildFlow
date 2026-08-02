/**
 * BuildFlow - Petty Cash routes (Phase 5 §8.9).
 *
 * GET    /api/petty-cash
 * POST   /api/petty-cash
 * GET    /api/petty-cash/summary
 * GET    /api/petty-cash/:id
 * PUT    /api/petty-cash/:id
 * DELETE /api/petty-cash/:id
 */
import { Router } from 'express';
import * as pettyCashController from '../controllers/petty-cash.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createPettyCashEntrySchema,
  updatePettyCashEntrySchema,
  pettyCashEntryIdParamsSchema,
  pettyCashQuerySchema,
} from '@buildflow/shared';
import { Role } from '@buildflow/shared';

export const pettyCashRouter = Router();

pettyCashRouter.use(authenticateToken);

// All roles can view; mutations require OWNER/PM/SITE_SUPERVISOR/ACCOUNTANT
const MUTATION_ROLES = requireRole(Role.OWNER, Role.PM, Role.SITE_SUPERVISOR, Role.ACCOUNTANT);

pettyCashRouter.get('/', validate({ query: pettyCashQuerySchema }), pettyCashController.list);
pettyCashRouter.get('/summary', pettyCashController.summary);
pettyCashRouter.post(
  '/',
  MUTATION_ROLES,
  validate({ body: createPettyCashEntrySchema.shape.body }),
  pettyCashController.create,
);

pettyCashRouter.get('/:id', validate({ params: pettyCashEntryIdParamsSchema }), pettyCashController.get);
pettyCashRouter.put(
  '/:id',
  MUTATION_ROLES,
  validate({ params: pettyCashEntryIdParamsSchema, body: updatePettyCashEntrySchema.shape.body }),
  pettyCashController.update,
);
pettyCashRouter.delete(
  '/:id',
  MUTATION_ROLES,
  validate({ params: pettyCashEntryIdParamsSchema }),
  pettyCashController.remove,
);