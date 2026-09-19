/**
 * BuildFlow - BOQ routes.
 */
import { Router } from 'express';
import * as boqController from '../controllers/boq.controller';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { validate } from '../middleware/validate';
import {
  createBoqItemSchema,
  updateBoqItemSchema,
  boqItemIdParamsSchema,
  projectIdParamsSchema,
  boqImportSchema,
  recordBoqMeasurementSchema,
} from '@buildflow/shared';

export const boqRouter = Router();

boqRouter.use(authenticateToken);

// Project-scoped BOQ — mutations follow permission tags (Accountant has no boq.edit).
boqRouter.get('/:id/boq/vs-actual', validate({ params: projectIdParamsSchema }), boqController.getBoqVsActual);
boqRouter.get('/:id/boq', validate({ params: projectIdParamsSchema }), boqController.listBoq);
boqRouter.post(
  '/:id/boq',
  requirePermission('boq.edit'),
  validate({ params: projectIdParamsSchema, body: createBoqItemSchema }),
  boqController.createBoqItem,
);
boqRouter.post(
  '/:id/boq/import',
  requirePermission('boq.import'),
  validate({ params: projectIdParamsSchema, body: boqImportSchema }),
  boqController.importBoq,
);

// BOQ-level endpoints (mounted at /api/boq)
export const boqDetailRouter = Router();
boqDetailRouter.use(authenticateToken);

boqDetailRouter.put(
  '/:id',
  requirePermission('boq.edit'),
  validate({ params: boqItemIdParamsSchema, body: updateBoqItemSchema }),
  boqController.updateBoqItem,
);
boqDetailRouter.delete(
  '/:id',
  requirePermission('boq.edit'),
  validate({ params: boqItemIdParamsSchema }),
  boqController.deleteBoqItem,
);
boqDetailRouter.post(
  '/:id/measurements',
  requirePermission('boq.record_measurement'),
  validate({ params: boqItemIdParamsSchema, body: recordBoqMeasurementSchema }),
  boqController.recordMeasurement,
);

// Estimate-to-BOQ conversion (mounted at /api/estimates/:id/convert-to-boq)
export const estimateToBoqRouter = Router();
estimateToBoqRouter.use(authenticateToken);
estimateToBoqRouter.post(
  '/:id/convert-to-boq',
  requirePermission('estimate.convert_boq'),
  validate({ params: boqItemIdParamsSchema }),
  boqController.convertEstimateToBoq,
);
