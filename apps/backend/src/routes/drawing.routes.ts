import { Router } from 'express';
import * as ctrl from '../controllers/drawing.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createDrawingSchema, updateDrawingSchema, addVersionSchema, drawingQuerySchema, Role } from '@buildflow/shared';
export const drawingRouter = Router();
drawingRouter.use(authenticateToken);
const MUT = requireRole(Role.OWNER, Role.PM, Role.SITE_SUPERVISOR, Role.DPM);
drawingRouter.get('/', validate({ query: drawingQuerySchema }), ctrl.list);
drawingRouter.post('/', MUT, validate({ body: createDrawingSchema.shape.body }), ctrl.create);
drawingRouter.get('/:id', ctrl.get);
// FIX (NR-31/§2.2A): Use the flat { params, body } map expected by validate().
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
