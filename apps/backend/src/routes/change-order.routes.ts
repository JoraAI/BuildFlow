/**
 * BuildFlow - Change order routes.
 *
 * Mounted at /api/projects/:id/change-orders
 */
import { Router } from 'express';
import { z } from 'zod';
import * as changeOrderController from '../controllers/change-order.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createChangeOrderSchema,
  rejectChangeOrderSchema,
  changeOrderIdParamsSchema,
  idSchema,
} from '@buildflow/shared';
import { Role } from '@buildflow/shared';

const projectIdParams = z.object({ id: idSchema });

export const changeOrderRouter = Router();
changeOrderRouter.use(authenticateToken);

changeOrderRouter.get(
  '/:id/change-orders',
  validate({ params: projectIdParams }),
  changeOrderController.list,
);
changeOrderRouter.post(
  '/:id/change-orders',
  requireRole(Role.OWNER, Role.PM),
  validate({ params: projectIdParams, body: createChangeOrderSchema }),
  changeOrderController.create,
);
changeOrderRouter.post(
  '/:id/change-orders/:changeOrderId/submit',
  requireRole(Role.OWNER, Role.PM),
  validate({ params: changeOrderIdParamsSchema }),
  changeOrderController.submit,
);
changeOrderRouter.post(
  '/:id/change-orders/:changeOrderId/approve',
  requireRole(Role.OWNER),
  validate({ params: changeOrderIdParamsSchema }),
  changeOrderController.approve,
);
changeOrderRouter.post(
  '/:id/change-orders/:changeOrderId/reject',
  requireRole(Role.OWNER),
  validate({ params: changeOrderIdParamsSchema, body: rejectChangeOrderSchema }),
  changeOrderController.reject,
);

// Variation BOQ picker — list eligible items + bulk-attach as variation lines
changeOrderRouter.get(
  '/:id/change-orders/:changeOrderId/eligible-boq',
  requireRole(Role.OWNER, Role.PM),
  validate({ params: changeOrderIdParamsSchema }),
  changeOrderController.listEligibleBoq,
);
changeOrderRouter.post(
  '/:id/change-orders/:changeOrderId/add-boq-lines',
  requireRole(Role.OWNER, Role.PM),
  validate({
    params: changeOrderIdParamsSchema,
    body: z.object({ boqItemIds: z.array(z.string().uuid()).min(1).max(100) }),
  }),
  changeOrderController.addBoqLines,
);
