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
import { asyncHandler } from '../utils/async-handler';
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
  asyncHandler(procurementController.listRequisitions),
);
procurementRouter.post(
  '/:id/procurement/requisitions',
  requireRole(Role.OWNER, Role.PM, Role.SUPERVISOR),
  validate({ params: projectIdParams, body: createRequisitionSchema }),
  asyncHandler(procurementController.createRequisition),
);
procurementRouter.post(
  '/:id/procurement/requisitions/:requisitionId/submit',
  requireRole(Role.OWNER, Role.PM, Role.SUPERVISOR),
  validate({ params: requisitionIdParams }),
  asyncHandler(procurementController.submitRequisition),
);
procurementRouter.post(
  '/:id/procurement/requisitions/:requisitionId/approve',
  requireRole(Role.OWNER, Role.PM),
  validate({ params: requisitionIdParams }),
  asyncHandler(procurementController.approveRequisition),
);
procurementRouter.post(
  '/:id/procurement/purchase-orders',
  requireRole(Role.OWNER, Role.PM, Role.ACCOUNTANT),
  validate({ params: projectIdParams, body: createPurchaseOrderSchema }),
  asyncHandler(procurementController.createPO),
);
procurementRouter.post(
  '/:id/procurement/grn',
  requireRole(Role.OWNER, Role.PM, Role.SUPERVISOR),
  validate({ params: projectIdParams, body: createGrnSchema }),
  asyncHandler(procurementController.createGRN),
);
procurementRouter.get(
  '/:id/procurement/stock/summary',
  validate({ params: projectIdParams }),
  asyncHandler(procurementController.getStockSummary),
);
procurementRouter.get(
  '/:id/procurement/stock/movements',
  validate({ params: projectIdParams }),
  asyncHandler(procurementController.listStockMovements),
);
procurementRouter.get(
  '/:id/procurement/stock',
  validate({ params: projectIdParams }),
  asyncHandler(procurementController.listStock),
);
procurementRouter.get(
  '/:id/procurement/boq-shortfalls',
  validate({ params: projectIdParams }),
  asyncHandler(procurementController.getBoqShortfalls),
);
procurementRouter.post(
  '/:id/procurement/generate-from-boq',
  requireRole(Role.OWNER, Role.PM, Role.SUPERVISOR),
  validate({ params: projectIdParams }),
  asyncHandler(procurementController.generateIndentsFromBoq),
);
