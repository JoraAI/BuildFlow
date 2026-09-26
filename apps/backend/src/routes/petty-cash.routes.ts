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
import { Router, Request, Response, NextFunction } from 'express';
import * as pettyCashController from '../controllers/petty-cash.controller';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { validate } from '../middleware/validate';
import {
  createPettyCashEntrySchema,
  updatePettyCashEntrySchema,
  pettyCashEntryIdParamsSchema,
  pettyCashQuerySchema,
} from '@buildflow/shared';

export const pettyCashRouter = Router();

pettyCashRouter.use(authenticateToken);

/**
 * Status changes to RECONCILED / REJECTED need petty_cash.approve.
 * Field edits on an entry need petty_cash.create.
 */
function requirePettyCashUpdate(req: Request, res: Response, next: NextFunction) {
  const status = (req.body as { status?: string } | undefined)?.status;
  if (status === 'RECONCILED' || status === 'REJECTED') {
    return requirePermission('petty_cash.approve')(req, res, next);
  }
  return requirePermission('petty_cash.create')(req, res, next);
}

pettyCashRouter.get(
  '/',
  requirePermission('petty_cash.view'),
  validate({ query: pettyCashQuerySchema }),
  pettyCashController.list,
);
pettyCashRouter.get(
  '/summary',
  requirePermission('petty_cash.view'),
  pettyCashController.summary,
);
pettyCashRouter.post(
  '/',
  requirePermission('petty_cash.create'),
  validate({ body: createPettyCashEntrySchema.shape.body }),
  pettyCashController.create,
);

pettyCashRouter.get(
  '/:id',
  requirePermission('petty_cash.view'),
  validate({ params: pettyCashEntryIdParamsSchema }),
  pettyCashController.get,
);
pettyCashRouter.put(
  '/:id',
  requirePettyCashUpdate,
  validate({ params: pettyCashEntryIdParamsSchema, body: updatePettyCashEntrySchema.shape.body }),
  pettyCashController.update,
);
pettyCashRouter.delete(
  '/:id',
  requirePermission('petty_cash.create'),
  validate({ params: pettyCashEntryIdParamsSchema }),
  pettyCashController.remove,
);
