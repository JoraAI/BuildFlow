/**
 * BuildFlow - Procurement routes.
 *
 * Mounted at /api/projects/:id/procurement/*
 */
import { Router } from 'express';
import { z } from 'zod';
import * as procurementController from '../controllers/procurement.controller';
import * as signatureService from '../services/signature.service';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async-handler';
import { ok } from '../utils/response';
import { prisma } from '../lib/prisma';
import {
  createRequisitionSchema,
  createPurchaseOrderSchema,
  createGrnSchema,
  issueStockSchema,
  idSchema,
} from '@buildflow/shared';

const projectIdParams = z.object({ id: idSchema });
const requisitionIdParams = z.object({
  id: idSchema,
  requisitionId: z.string().uuid(),
});

export const procurementRouter = Router();
procurementRouter.use(authenticateToken);

procurementRouter.get(
  '/projects/:id/procurement/stock/summary',
  requirePermission('procurement.view'),
  validate({ params: projectIdParams }),
  asyncHandler(procurementController.getStockSummary),
);

// E-signatures on POs and requisitions
procurementRouter.post(
  '/projects/:id/procurement/po/:poId/sign',
  requirePermission('procurement.approve_po'),
  validate({ params: projectIdParams.extend({ poId: idSchema }) }),
  asyncHandler(async (req, res) => {
    const { companyId, id: userId, role } = req.user!;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    const result = await signatureService.signPurchaseOrder(
      companyId,
      userId,
      role,
      user?.name ?? 'Unknown',
      req.params.poId,
      req.ip,
    );
    return ok(res, result);
  }),
);

procurementRouter.post(
  '/projects/:id/procurement/requisitions/:requisitionId/sign',
  requirePermission('procurement.create_indent'),
  validate({ params: projectIdParams.extend({ requisitionId: idSchema }) }),
  asyncHandler(async (req, res) => {
    const { companyId, id: userId, role } = req.user!;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    const result = await signatureService.signRequisition(
      companyId,
      userId,
      role,
      user?.name ?? 'Unknown',
      req.params.requisitionId,
      req.ip,
    );
    return ok(res, result);
  }),
);

procurementRouter.get(
  '/projects/:id/procurement/po/:poId/verify-signature',
  requirePermission('procurement.view'),
  validate({ params: projectIdParams.extend({ poId: idSchema }) }),
  asyncHandler(async (req, res) => {
    const result = await signatureService.verifyPoSignature(req.user!.companyId, req.params.poId);
    return ok(res, result);
  }),
);
procurementRouter.get(
  '/:id/procurement/requisitions',
  requirePermission('procurement.view'),
  validate({ params: projectIdParams }),
  asyncHandler(procurementController.listRequisitions),
);
procurementRouter.post(
  '/:id/procurement/requisitions',
  requirePermission('procurement.create_indent'),
  validate({ params: projectIdParams, body: createRequisitionSchema }),
  asyncHandler(procurementController.createRequisition),
);
procurementRouter.delete(
  '/:id/procurement/requisitions/:requisitionId',
  requirePermission('procurement.create_indent'),
  validate({ params: requisitionIdParams }),
  asyncHandler(procurementController.deleteRequisition),
);
procurementRouter.post(
  '/:id/procurement/requisitions/:requisitionId/submit',
  requirePermission('procurement.create_indent'),
  validate({ params: requisitionIdParams }),
  asyncHandler(procurementController.submitRequisition),
);
procurementRouter.post(
  '/:id/procurement/requisitions/:requisitionId/approve',
  requirePermission('procurement.approve_indent'),
  validate({ params: requisitionIdParams }),
  asyncHandler(procurementController.approveRequisition),
);
procurementRouter.post(
  '/:id/procurement/purchase-orders',
  requirePermission('procurement.approve_po'),
  validate({ params: projectIdParams, body: createPurchaseOrderSchema }),
  asyncHandler(procurementController.createPO),
);
procurementRouter.post(
  '/:id/procurement/grn',
  requirePermission('procurement.record_grn'),
  validate({ params: projectIdParams, body: createGrnSchema }),
  asyncHandler(procurementController.createGRN),
);
procurementRouter.get(
  '/:id/procurement/stock/summary',
  requirePermission('stock.view'),
  validate({ params: projectIdParams }),
  asyncHandler(procurementController.getStockSummary),
);
procurementRouter.get(
  '/:id/procurement/stock/movements',
  requirePermission('stock.view'),
  validate({ params: projectIdParams }),
  asyncHandler(procurementController.listStockMovements),
);
procurementRouter.post(
  '/:id/procurement/stock/issue',
  requirePermission('stock.manage'),
  validate({ params: projectIdParams, body: issueStockSchema }),
  asyncHandler(procurementController.issueStock),
);
procurementRouter.get(
  '/:id/procurement/stock',
  requirePermission('stock.view'),
  validate({ params: projectIdParams }),
  asyncHandler(procurementController.listStock),
);
procurementRouter.get(
  '/:id/procurement/boq-shortfalls',
  requirePermission('procurement.view'),
  validate({ params: projectIdParams }),
  asyncHandler(procurementController.getBoqShortfalls),
);
procurementRouter.post(
  '/:id/procurement/generate-from-boq',
  requirePermission('procurement.create_indent'),
  validate({ params: projectIdParams }),
  asyncHandler(procurementController.generateIndentsFromBoq),
);
