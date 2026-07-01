/**
 * BuildFlow - Bill routes.
 *
 * Mounted at /api/bills (detail-level) and within project router for project-scoped.
 */
import { Router } from 'express';
import { z } from 'zod';
import * as billController from '../controllers/bill.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async-handler';
import { createBillSchema, updateBillSchema, recordPaymentSchema, idSchema } from '@buildflow/shared';
import { Role } from '@buildflow/shared';

const idParams = z.object({ id: idSchema });

export const billProjectRouter = Router();
billProjectRouter.use(authenticateToken);

// Project-scoped bill listing/creation
billProjectRouter.get('/:id/bills', validate({ params: idParams }), asyncHandler(billController.list));
billProjectRouter.get('/:id/bills/summary', validate({ params: idParams }), asyncHandler(billController.summary));
billProjectRouter.post(
  '/:id/bills',
  requireRole(Role.OWNER, Role.PM, Role.ACCOUNTANT),
  validate({ params: idParams, body: createBillSchema }),
  asyncHandler(billController.create),
);

// Detail-level routes mounted at /api/bills
export const billRouter = Router();
billRouter.use(authenticateToken);

billRouter.get('/', asyncHandler(billController.list));
billRouter.get('/:id', validate({ params: idParams }), asyncHandler(billController.get));
billRouter.put(
  '/:id',
  requireRole(Role.OWNER, Role.PM, Role.ACCOUNTANT),
  validate({ params: idParams, body: updateBillSchema }),
  asyncHandler(billController.update),
);
billRouter.post('/:id/approve', requireRole(Role.OWNER, Role.PM), validate({ params: idParams }), asyncHandler(billController.approve));
billRouter.post('/:id/reject', requireRole(Role.OWNER, Role.PM), validate({ params: idParams }), asyncHandler(billController.reject));
billRouter.post('/:id/pay', requireRole(Role.OWNER, Role.ACCOUNTANT), validate({ params: idParams }), asyncHandler(billController.pay));
billRouter.post(
  '/:id/record-payment',
  requireRole(Role.OWNER, Role.PM, Role.ACCOUNTANT),
  validate({ params: idParams, body: recordPaymentSchema }),
  asyncHandler(billController.recordPayment),
);
billRouter.delete(
  '/:id',
  requireRole(Role.OWNER, Role.PM, Role.ACCOUNTANT),
  validate({ params: idParams }),
  asyncHandler(billController.remove),
);