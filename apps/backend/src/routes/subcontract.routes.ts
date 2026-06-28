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
import {
  createSubcontractorSchema,
  createWorkOrderSchema,
  createMeasurementSchema,
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
  subcontractController.listWorkOrders,
);
subcontractProjectRouter.post(
  '/:id/subcontract/work-orders',
  requireRole(Role.OWNER, Role.PM),
  validate({ params: projectIdParams, body: createWorkOrderSchema }),
  subcontractController.createWorkOrder,
);
subcontractProjectRouter.get(
  '/:id/subcontract/work-orders/:workOrderId',
  validate({ params: workOrderParams }),
  subcontractController.getWorkOrder,
);
subcontractProjectRouter.put(
  '/:id/subcontract/work-orders/:workOrderId',
  requireRole(Role.OWNER, Role.PM),
  validate({ params: workOrderParams, body: updateWorkOrderSchema }),
  subcontractController.updateWorkOrder,
);
subcontractProjectRouter.delete(
  '/:id/subcontract/work-orders/:workOrderId',
  requireRole(Role.OWNER, Role.PM),
  validate({ params: workOrderParams }),
  subcontractController.deleteWorkOrder,
);
subcontractProjectRouter.get(
  '/:id/subcontract/work-orders/:workOrderId/measurements',
  validate({ params: workOrderParams }),
  subcontractController.listMeasurements,
);
subcontractProjectRouter.post(
  '/:id/subcontract/work-orders/:workOrderId/measurements',
  requireRole(Role.OWNER, Role.PM, Role.SUPERVISOR),
  validate({ params: workOrderParams, body: createMeasurementSchema }),
  subcontractController.createMeasurement,
);
subcontractProjectRouter.get(
  '/:id/subcontract/measurements/:measurementId',
  validate({
    params: z.object({ id: idSchema, measurementId: z.string().uuid() }),
  }),
  subcontractController.getMeasurement,
);
subcontractProjectRouter.put(
  '/:id/subcontract/measurements/:measurementId',
  requireRole(Role.OWNER, Role.PM, Role.SUPERVISOR),
  validate({
    params: z.object({ id: idSchema, measurementId: z.string().uuid() }),
    body: createMeasurementSchema,
  }),
  subcontractController.updateMeasurement,
);
subcontractProjectRouter.delete(
  '/:id/subcontract/measurements/:measurementId',
  requireRole(Role.OWNER, Role.PM),
  validate({
    params: z.object({ id: idSchema, measurementId: z.string().uuid() }),
  }),
  subcontractController.deleteMeasurement,
);
subcontractProjectRouter.post(
  '/:id/subcontract/measurements/:measurementId/submit',
  requireRole(Role.OWNER, Role.PM, Role.SUPERVISOR),
  validate({
    params: z.object({ id: idSchema, measurementId: z.string().uuid() }),
  }),
  subcontractController.submitMeasurement,
);
subcontractProjectRouter.post(
  '/:id/subcontract/measurements/:measurementId/approve',
  requireRole(Role.OWNER, Role.PM),
  validate({
    params: z.object({ id: idSchema, measurementId: z.string().uuid() }),
    body: approveMeasurementSchema,
  }),
  subcontractController.approveMeasurement,
);

export const subcontractorRouter = Router();
subcontractorRouter.use(authenticateToken);

subcontractorRouter.get('/', subcontractController.listSubcontractors);
subcontractorRouter.post(
  '/',
  requireRole(Role.OWNER, Role.PM, Role.ACCOUNTANT),
  validate({ body: createSubcontractorSchema }),
  subcontractController.createSubcontractor,
);
subcontractorRouter.get(
  '/:subcontractorId',
  validate({ params: subcontractorIdParams }),
  subcontractController.getSubcontractor,
);
subcontractorRouter.put(
  '/:subcontractorId',
  requireRole(Role.OWNER, Role.PM, Role.ACCOUNTANT),
  validate({ params: subcontractorIdParams, body: updateSubcontractorSchema }),
  subcontractController.updateSubcontractor,
);
subcontractorRouter.delete(
  '/:subcontractorId',
  requireRole(Role.OWNER, Role.PM),
  validate({ params: subcontractorIdParams }),
  subcontractController.deleteSubcontractor,
);
