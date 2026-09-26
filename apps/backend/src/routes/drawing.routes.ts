import { Router } from 'express';
import * as ctrl from '../controllers/drawing.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createDrawingSchema,
  updateDrawingSchema,
  addVersionSchema,
  replaceDrawingPinsSchema,
  drawingQuerySchema,
  Role,
} from '@buildflow/shared';

export const drawingRouter = Router();
drawingRouter.use(authenticateToken);

// Align with drawing.upload / drawing.manage defaults (QC + site supervisors included).
const MUT = requireRole(Role.OWNER, Role.PM, Role.DPM, Role.QC, Role.SITE_SUPERVISOR, Role.SUPERVISOR);

drawingRouter.get('/', validate({ query: drawingQuerySchema }), ctrl.list);
drawingRouter.post('/', MUT, validate({ body: createDrawingSchema.shape.body }), ctrl.create);
drawingRouter.get('/:id', ctrl.get);
drawingRouter.put(
  '/:id',
  MUT,
  validate({ params: updateDrawingSchema.shape.params, body: updateDrawingSchema.shape.body }),
  ctrl.update,
);
drawingRouter.post(
  '/:id/versions',
  MUT,
  validate({ params: addVersionSchema.shape.params, body: addVersionSchema.shape.body }),
  ctrl.addVersion,
);
drawingRouter.put(
  '/:id/pins',
  MUT,
  validate({
    params: replaceDrawingPinsSchema.shape.params,
    body: replaceDrawingPinsSchema.shape.body,
  }),
  ctrl.replacePins,
);
