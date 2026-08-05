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

// VAR-D2: Convert approved variation to BOQ (explicit step)
changeOrderRouter.post(
  '/:id/change-orders/:changeOrderId/convert-to-boq',
  requireRole(Role.OWNER, Role.PM),
  validate({ params: changeOrderIdParamsSchema }),
  changeOrderController.convertToBoq,
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

// FIX (EST-H6): Update a change-order line's qtyDelta/rate + recompute costImpact.
changeOrderRouter.put(
  '/:id/change-orders/:changeOrderId/lines/:lineId',
  requireRole(Role.OWNER, Role.PM),
  validate({
    params: z.object({
      id: idSchema,
      changeOrderId: z.string().uuid(),
      lineId: z.string().uuid(),
    }),
    body: z.object({
      qtyDelta: z.coerce.number().optional(),
      rate: z.coerce.number().nonnegative().optional(),
      description: z.string().max(500).optional(),
    }),
  }),
  changeOrderController.updateLine,
);

// VO-B1: Post-approve impact summary (BOQ changes, indents, budget delta)
changeOrderRouter.get(
  '/:id/change-orders/:changeOrderId/impact',
  validate({ params: changeOrderIdParamsSchema }),
  changeOrderController.impact,
);

// VO-B4: Revised scope summary (original estimate + approved variations)
changeOrderRouter.get(
  '/:id/scope-summary',
  validate({ params: projectIdParams }),
  changeOrderController.scopeSummary,
);
