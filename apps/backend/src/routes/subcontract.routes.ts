/**
 * BuildFlow - Subcontract routes.
 *
 * Project-scoped: /api/projects/:id/subcontract/*
 * Company-scoped:  /api/subcontractors
 * Detail:          /api/subcontract/measurements/:measurementId/*
 */
import { Router } from 'express';
import { z } from 'zod';
import * as subcontractController from '../controllers/subcontract.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async-handler';
import {
  createSubcontractorSchema,
  createWorkOrderSchema,
  createWorkOrderFromBoqSchema,
  createMeasurementSchema,
  rejectMeasurementSchema,
  createSubcontractorPortalSchema,
  recordBillPaymentSchema,
  idSchema,
} from '@buildflow/shared';
import { Role } from '@buildflow/shared';

const projectIdParams = z.object({ id: idSchema });
const workOrderParams = z.object({
  id: idSchema,
  workOrderId: z.string().uuid(),
});
const subcontractorIdParams = z.object({ subcontractorId: z.string().uuid() });

const updateSubcontractorSchema = createSubcontractorSchema.partial();
const updateWorkOrderSchema = createWorkOrderSchema
  .partial()
  .extend({ status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional() });
const approveMeasurementSchema = z.object({ createBill: z.boolean().optional() });

export const subcontractProjectRouter = Router();
subcontractProjectRouter.use(authenticateToken);

subcontractProjectRouter.get(
  '/:id/subcontract/work-orders',
  validate({ params: projectIdParams }),
  asyncHandler(subcontractController.listWorkOrders),
);
subcontractProjectRouter.post(
  '/:id/subcontract/work-orders',
  requireRole(Role.OWNER, Role.PM),
  validate({ params: projectIdParams, body: createWorkOrderSchema }),
  asyncHandler(subcontractController.createWorkOrder),
);
subcontractProjectRouter.get(
  '/:id/subcontract/work-orders/:workOrderId',
  validate({ params: workOrderParams }),
  asyncHandler(subcontractController.getWorkOrder),
);
subcontractProjectRouter.get(
  '/:id/subcontract/work-orders/:workOrderId/summary',
  validate({ params: workOrderParams }),
  asyncHandler(subcontractController.getWorkOrderSummary),
);
subcontractProjectRouter.post(
  '/:id/subcontract/work-orders/from-boq',
  requireRole(Role.OWNER, Role.PM),
  validate({ params: projectIdParams, body: createWorkOrderFromBoqSchema }),
  asyncHandler(subcontractController.createWorkOrderFromBoq),
);
subcontractProjectRouter.put(
  '/:id/subcontract/work-orders/:workOrderId',
  requireRole(Role.OWNER, Role.PM),
  validate({ params: workOrderParams, body: updateWorkOrderSchema }),
  asyncHandler(subcontractController.updateWorkOrder),
);
subcontractProjectRouter.delete(
  '/:id/subcontract/work-orders/:workOrderId',
  requireRole(Role.OWNER, Role.PM),
  validate({ params: workOrderParams }),
  asyncHandler(subcontractController.deleteWorkOrder),
);
subcontractProjectRouter.get(
  '/:id/subcontract/work-orders/:workOrderId/measurements',
  validate({ params: workOrderParams }),
  asyncHandler(subcontractController.listMeasurements),
);
subcontractProjectRouter.post(
  '/:id/subcontract/work-orders/:workOrderId/measurements',
  requireRole(Role.OWNER, Role.PM, Role.SUPERVISOR),
  validate({ params: workOrderParams, body: createMeasurementSchema }),
  asyncHandler(subcontractController.createMeasurement),
);
subcontractProjectRouter.get(
  '/:id/subcontract/measurements/:measurementId',
  validate({
    params: z.object({ id: idSchema, measurementId: z.string().uuid() }),
  }),
  asyncHandler(subcontractController.getMeasurement),
);
subcontractProjectRouter.put(
  '/:id/subcontract/measurements/:measurementId',
  requireRole(Role.OWNER, Role.PM, Role.SUPERVISOR),
  validate({
    params: z.object({ id: idSchema, measurementId: z.string().uuid() }),
    body: createMeasurementSchema,
  }),
  asyncHandler(subcontractController.updateMeasurement),
);
subcontractProjectRouter.delete(
  '/:id/subcontract/measurements/:measurementId',
  requireRole(Role.OWNER, Role.PM),
  validate({
    params: z.object({ id: idSchema, measurementId: z.string().uuid() }),
  }),
  asyncHandler(subcontractController.deleteMeasurement),
);
subcontractProjectRouter.post(
  '/:id/subcontract/measurements/:measurementId/submit',
  requireRole(Role.OWNER, Role.PM, Role.SUPERVISOR),
  validate({
    params: z.object({ id: idSchema, measurementId: z.string().uuid() }),
  }),
  asyncHandler(subcontractController.submitMeasurement),
);
subcontractProjectRouter.post(
  '/:id/subcontract/measurements/:measurementId/approve',
  requireRole(Role.OWNER, Role.PM),
  validate({
    params: z.object({ id: idSchema, measurementId: z.string().uuid() }),
    body: approveMeasurementSchema,
  }),
  asyncHandler(subcontractController.approveMeasurement),
);
subcontractProjectRouter.post(
  '/:id/subcontract/measurements/:measurementId/reject',
  requireRole(Role.OWNER, Role.PM),
  validate({
    params: z.object({ id: idSchema, measurementId: z.string().uuid() }),
    body: rejectMeasurementSchema,
  }),
  asyncHandler(subcontractController.rejectMeasurement),
);
subcontractProjectRouter.post(
  '/:id/subcontract/bills/:billId/payment',
  requireRole(Role.OWNER, Role.PM, Role.ACCOUNTANT),
  validate({
    params: z.object({ id: idSchema, billId: z.string().uuid() }),
    body: recordBillPaymentSchema,
  }),
  asyncHandler(subcontractController.recordBillPayment),
);
subcontractProjectRouter.post(
  '/:id/subcontract-portal-access',
  requireRole(Role.OWNER, Role.PM),
  validate({ params: projectIdParams, body: createSubcontractorPortalSchema }),
  asyncHandler(subcontractController.createSubcontractorPortalAccess),
);

export const subcontractorRouter = Router();
subcontractorRouter.use(authenticateToken);

subcontractorRouter.get('/', asyncHandler(subcontractController.listSubcontractors));
subcontractorRouter.post(
  '/',
  requireRole(Role.OWNER, Role.PM, Role.ACCOUNTANT),
  validate({ body: createSubcontractorSchema }),
  asyncHandler(subcontractController.createSubcontractor),
);
subcontractorRouter.get(
  '/:subcontractorId',
  validate({ params: subcontractorIdParams }),
  asyncHandler(subcontractController.getSubcontractor),
);
subcontractorRouter.put(
  '/:subcontractorId',
  requireRole(Role.OWNER, Role.PM, Role.ACCOUNTANT),
  validate({ params: subcontractorIdParams, body: updateSubcontractorSchema }),
  asyncHandler(subcontractController.updateSubcontractor),
);
subcontractorRouter.delete(
  '/:subcontractorId',
  requireRole(Role.OWNER, Role.PM),
  validate({ params: subcontractorIdParams }),
  asyncHandler(subcontractController.deleteSubcontractor),
);
