/**
 * BuildFlow - Procurement routes.
 *
 * Mounted at /api/projects/:id/procurement/*
 */
import { Router } from 'express';
import { z } from 'zod';
import * as procurementController from '../controllers/procurement.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createRequisitionSchema,
  createPurchaseOrderSchema,
  createGrnSchema,
  idSchema,
} from '@buildflow/shared';
import { Role } from '@buildflow/shared';

const projectIdParams = z.object({ id: idSchema });
const requisitionIdParams = z.object({
  id: idSchema,
  requisitionId: z.string().uuid(),
});

export const procurementRouter = Router();
procurementRouter.use(authenticateToken);

procurementRouter.get(
  '/:id/procurement/requisitions',
  validate({ params: projectIdParams }),
  procurementController.listRequisitions,
);
procurementRouter.post(
  '/:id/procurement/requisitions',
  requireRole(Role.OWNER, Role.PM, Role.SUPERVISOR),
  validate({ params: projectIdParams, body: createRequisitionSchema }),
  procurementController.createRequisition,
);
procurementRouter.post(
  '/:id/procurement/requisitions/:requisitionId/submit',
  requireRole(Role.OWNER, Role.PM, Role.SUPERVISOR),
  validate({ params: requisitionIdParams }),
  procurementController.submitRequisition,
);
procurementRouter.post(
  '/:id/procurement/requisitions/:requisitionId/approve',
  requireRole(Role.OWNER, Role.PM),
  validate({ params: requisitionIdParams }),
  procurementController.approveRequisition,
);
procurementRouter.post(
  '/:id/procurement/purchase-orders',
  requireRole(Role.OWNER, Role.PM, Role.ACCOUNTANT),
  validate({ params: projectIdParams, body: createPurchaseOrderSchema }),
  procurementController.createPO,
);
procurementRouter.post(
  '/:id/procurement/grn',
  requireRole(Role.OWNER, Role.PM, Role.SUPERVISOR),
  validate({ params: projectIdParams, body: createGrnSchema }),
  procurementController.createGRN,
);
procurementRouter.get(
  '/:id/procurement/stock',
  validate({ params: projectIdParams }),
  procurementController.listStock,
);
