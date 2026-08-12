/**
 * BuildFlow - BOQ routes.
 */
import { Router } from 'express';
import * as boqController from '../controllers/boq.controller';
import { authenticateToken } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createBoqItemSchema,
  updateBoqItemSchema,
  boqItemIdParamsSchema,
  projectIdParamsSchema,
  boqImportSchema,
  recordBoqMeasurementSchema,
} from '@buildflow/shared';
import { requireRole } from '../middleware/auth';
import { Role } from '@buildflow/shared';

export const boqRouter = Router();

boqRouter.use(authenticateToken);

// FIX (EST-M13): Gate BOQ mutations behind requireRole so any member can't
// archive the entire BOQ or overwrite the budget. Reads stay open to all
// authenticated users (tenant-scoped).
const BOQ_MUTATION_ROLES = requireRole(Role.OWNER, Role.PM, Role.DPM, Role.ACCOUNTANT);

// Project-scoped BOQ
boqRouter.get('/:id/boq/vs-actual', validate({ params: projectIdParamsSchema }), boqController.getBoqVsActual);
boqRouter.get('/:id/boq', validate({ params: projectIdParamsSchema }), boqController.listBoq);
boqRouter.post('/:id/boq', BOQ_MUTATION_ROLES, validate({ params: projectIdParamsSchema, body: createBoqItemSchema }), boqController.createBoqItem);
boqRouter.post('/:id/boq/import', BOQ_MUTATION_ROLES, validate({ params: projectIdParamsSchema, body: boqImportSchema }), boqController.importBoq);

// BOQ-level endpoints (mounted at /api/boq)
export const boqDetailRouter = Router();
boqDetailRouter.use(authenticateToken);

boqDetailRouter.put('/:id', BOQ_MUTATION_ROLES, validate({ params: boqItemIdParamsSchema, body: updateBoqItemSchema }), boqController.updateBoqItem);
boqDetailRouter.delete('/:id', BOQ_MUTATION_ROLES, validate({ params: boqItemIdParamsSchema }), boqController.deleteBoqItem);
boqDetailRouter.post(
  '/:id/measurements',
  requireRole(Role.OWNER, Role.PM, Role.SUPERVISOR),
  validate({ params: boqItemIdParamsSchema, body: recordBoqMeasurementSchema }),
  boqController.recordMeasurement,
);

// Estimate-to-BOQ conversion (mounted at /api/estimates/:id/convert-to-boq)
export const estimateToBoqRouter = Router();
estimateToBoqRouter.use(authenticateToken);
// FIX (EST-M13): Conversion is a high-impact mutation (archives + rebuilds BOQ,
// sets budget) - restrict to OWNER/PM/ESTIMATOR.
estimateToBoqRouter.post('/:id/convert-to-boq', BOQ_MUTATION_ROLES, validate({ params: boqItemIdParamsSchema }), boqController.convertEstimateToBoq);
