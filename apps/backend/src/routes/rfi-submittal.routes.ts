import { Router } from 'express';
import * as ctrl from '../controllers/rfi-submittal.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createRfiSchema, updateRfiSchema, answerRfiSchema, rfiQuerySchema, createSubmittalSchema, updateSubmittalSchema, reviewSubmittalSchema, submittalQuerySchema, Role } from '@buildflow/shared';
export const rfiSubmittalRouter = Router();
rfiSubmittalRouter.use(authenticateToken);
const MUT = requireRole(Role.OWNER, Role.PM, Role.SITE_SUPERVISOR, Role.DPM);
const REVIEW = requireRole(Role.OWNER, Role.PM);
// RFI routes
rfiSubmittalRouter.get('/rfis', validate({ query: rfiQuerySchema }), ctrl.listRfis);
rfiSubmittalRouter.post('/rfis', MUT, validate({ body: createRfiSchema.shape.body }), ctrl.createRfi);
rfiSubmittalRouter.get('/rfis/:id', ctrl.getRfi);
// FIX (NR-31/§2.2A): Use the flat { params, body } map expected by validate().
rfiSubmittalRouter.put(
  '/rfis/:id',
  MUT,
  validate({ params: updateRfiSchema.shape.params, body: updateRfiSchema.shape.body }),
  ctrl.updateRfi,
);
rfiSubmittalRouter.post(
  '/rfis/:id/answer',
  REVIEW,
  validate({ params: answerRfiSchema.shape.params, body: answerRfiSchema.shape.body }),
  ctrl.answerRfi,
);
// Submittal routes
rfiSubmittalRouter.get('/submittals', validate({ query: submittalQuerySchema }), ctrl.listSubmittals);
rfiSubmittalRouter.post('/submittals', MUT, validate({ body: createSubmittalSchema.shape.body }), ctrl.createSubmittal);
rfiSubmittalRouter.get('/submittals/:id', ctrl.getSubmittal);
rfiSubmittalRouter.put(
  '/submittals/:id',
  MUT,
  validate({ params: updateSubmittalSchema.shape.params, body: updateSubmittalSchema.shape.body }),
  ctrl.updateSubmittal,
);
rfiSubmittalRouter.post(
  '/submittals/:id/review',
  REVIEW,
  validate({ params: reviewSubmittalSchema.shape.params, body: reviewSubmittalSchema.shape.body }),
  ctrl.reviewSubmittal,
);
