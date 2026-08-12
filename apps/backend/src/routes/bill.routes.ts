/**
 * BuildFlow - Bill routes.
 *
 * Mounted at /api/bills (detail-level) and within project router for project-scoped.
 *
 * PROC-B8: All bill write routes now use requirePermission instead of requireRole.
 * Permissions: bill.view, bill.create, bill.approve, bill.record_payment.
 */
import { Router } from 'express';
import { z } from 'zod';
import * as billController from '../controllers/bill.controller';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async-handler';
import { createBillSchema, updateBillSchema, recordPaymentSchema, idSchema } from '@buildflow/shared';

const idParams = z.object({ id: idSchema });

export const billProjectRouter = Router();
billProjectRouter.use(authenticateToken);

// Project-scoped bill listing/creation
billProjectRouter.get('/:id/bills', requirePermission('bill.view'), validate({ params: idParams }), asyncHandler(billController.list));
billProjectRouter.get('/:id/bills/summary', requirePermission('bill.view'), validate({ params: idParams }), asyncHandler(billController.summary));
billProjectRouter.post(
  '/:id/bills',
  requirePermission('bill.create'),
  validate({ params: idParams, body: createBillSchema }),
  asyncHandler(billController.create),
);

// PROC-B9: Bill extraction endpoints (LLM) - requires bill.create
billProjectRouter.post(
  '/:id/bills/extract',
  requirePermission('bill.create'),
  asyncHandler(billController.extract),
);
billProjectRouter.post(
  '/:id/bills/extract-batch',
  requirePermission('bill.create'),
  asyncHandler(billController.extractBatch),
);
billProjectRouter.post(
  '/:id/bills/bulk-create',
  requirePermission('bill.create'),
  asyncHandler(billController.bulkCreate),
);

// Detail-level routes mounted at /api/bills
export const billRouter = Router();
billRouter.use(authenticateToken);

billRouter.get('/', requirePermission('bill.view'), asyncHandler(billController.list));
billRouter.get('/:id', requirePermission('bill.view'), validate({ params: idParams }), asyncHandler(billController.get));
billRouter.put(
  '/:id',
  requirePermission('bill.create'),
  validate({ params: idParams, body: updateBillSchema }),
  asyncHandler(billController.update),
);
billRouter.post('/:id/approve', requirePermission('bill.approve'), validate({ params: idParams }), asyncHandler(billController.approve));
billRouter.post('/:id/reject', requirePermission('bill.approve'), validate({ params: idParams }), asyncHandler(billController.reject));
billRouter.post('/:id/pay', requirePermission('bill.record_payment'), validate({ params: idParams }), asyncHandler(billController.pay));
billRouter.post(
  '/:id/record-payment',
  requirePermission('bill.record_payment'),
  validate({ params: idParams, body: recordPaymentSchema }),
  asyncHandler(billController.recordPayment),
);
billRouter.delete(
  '/:id',
  requirePermission('bill.create'),
  validate({ params: idParams }),
  asyncHandler(billController.remove),
);