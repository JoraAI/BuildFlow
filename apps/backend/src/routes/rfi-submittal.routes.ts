import { Router } from 'express';
import * as ctrl from '../controllers/rfi-submittal.controller';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { validate } from '../middleware/validate';
import {
  createRfiSchema,
  updateRfiSchema,
  answerRfiSchema,
  rfiQuerySchema,
  createSubmittalSchema,
  updateSubmittalSchema,
  reviewSubmittalSchema,
  submittalQuerySchema,
} from '@buildflow/shared';

export const rfiSubmittalRouter = Router();
rfiSubmittalRouter.use(authenticateToken);

rfiSubmittalRouter.get('/rfis', requirePermission('rfi.view'), validate({ query: rfiQuerySchema }), ctrl.listRfis);
rfiSubmittalRouter.post(
  '/rfis',
  requirePermission('rfi.create'),
  validate({ body: createRfiSchema.shape.body }),
  ctrl.createRfi,
);
rfiSubmittalRouter.get('/rfis/:id', requirePermission('rfi.view'), ctrl.getRfi);
rfiSubmittalRouter.put(
  '/rfis/:id',
  requirePermission('rfi.create'),
  validate({ params: updateRfiSchema.shape.params, body: updateRfiSchema.shape.body }),
  ctrl.updateRfi,
);
rfiSubmittalRouter.post(
  '/rfis/:id/answer',
  requirePermission('rfi.answer'),
  validate({ params: answerRfiSchema.shape.params, body: answerRfiSchema.shape.body }),
  ctrl.answerRfi,
);

rfiSubmittalRouter.get(
  '/submittals',
  requirePermission('rfi.view'),
  validate({ query: submittalQuerySchema }),
  ctrl.listSubmittals,
);
rfiSubmittalRouter.post(
  '/submittals',
  requirePermission('rfi.create'),
  validate({ body: createSubmittalSchema.shape.body }),
  ctrl.createSubmittal,
);
rfiSubmittalRouter.get('/submittals/:id', requirePermission('rfi.view'), ctrl.getSubmittal);
rfiSubmittalRouter.put(
  '/submittals/:id',
  requirePermission('rfi.create'),
  validate({ params: updateSubmittalSchema.shape.params, body: updateSubmittalSchema.shape.body }),
  ctrl.updateSubmittal,
);
rfiSubmittalRouter.post(
  '/submittals/:id/review',
  requirePermission('rfi.answer'),
  validate({ params: reviewSubmittalSchema.shape.params, body: reviewSubmittalSchema.shape.body }),
  ctrl.reviewSubmittal,
);
