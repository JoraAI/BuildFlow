/**
 * BuildFlow — Estimate routes.
 *
 * Project-scoped:
 *   GET    /api/projects/:projectId/estimates
 *   POST   /api/projects/:projectId/estimates
 *
 * Estimate-scoped:
 *   GET    /api/estimates/:id
 *   PUT    /api/estimates/:id
 *   DELETE /api/estimates/:id
 *
 *   POST   /api/estimates/:id/sections
 *   PUT    /api/estimates/:id/sections/:sid
 *   DELETE /api/estimates/:id/sections/:sid
 *
 *   POST   /api/estimates/:id/sections/:sid/items
 *   PUT    /api/estimate-items/:itemId
 *   DELETE /api/estimate-items/:itemId
 *
 *   POST   /api/estimates/:id/submit
 *   POST   /api/estimates/:id/approve
 *   POST   /api/estimates/:id/reject
 *   POST   /api/estimates/:id/duplicate
 *   GET    /api/estimates/:id/compare/:id2
 */
import { Router } from 'express';
import { z } from 'zod';
import * as estimateController from '../controllers/estimate.controller';
import * as boqController from '../controllers/boq.controller';
import { authenticateToken } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createEstimateSchema,
  updateEstimateMetaSchema,
  createEstimateSectionSchema,
  updateEstimateSectionSchema,
  createEstimateItemSchema,
  updateEstimateItemSchema,
  rejectEstimateSchema,
} from '@buildflow/shared';

const projectIdParamsSchema = z.object({ projectId: z.string().uuid() });
const estimateIdParamsSchema = z.object({ id: z.string().uuid() });
const estimateSectionParamsSchema = z.object({
  id: z.string().uuid(),
  sid: z.string().uuid(),
});
const estimateItemParamsSchema = z.object({ itemId: z.string().uuid() });
const estimateCompareParamsSchema = z.object({
  id: z.string().uuid(),
  id2: z.string().uuid(),
});

export const estimateRouter = Router();

estimateRouter.use(authenticateToken);

// Project-scoped routes
estimateRouter.get(
  '/projects/:projectId/estimates',
  validate({ params: projectIdParamsSchema }),
  estimateController.list,
);
estimateRouter.post(
  '/projects/:projectId/estimates',
  validate({ params: projectIdParamsSchema, body: createEstimateSchema }),
  estimateController.create,
);

// Estimate-scoped routes
estimateRouter.get(
  '/estimates/:id',
  validate({ params: estimateIdParamsSchema }),
  estimateController.get,
);
estimateRouter.put(
  '/estimates/:id',
  validate({ params: estimateIdParamsSchema, body: updateEstimateMetaSchema }),
  estimateController.update,
);
estimateRouter.delete(
  '/estimates/:id',
  validate({ params: estimateIdParamsSchema }),
  estimateController.remove,
);

// Sections
estimateRouter.post(
  '/estimates/:id/sections',
  validate({ params: estimateIdParamsSchema, body: createEstimateSectionSchema }),
  estimateController.createSection,
);
estimateRouter.put(
  '/estimates/:id/sections/:sid',
  validate({ params: estimateSectionParamsSchema, body: updateEstimateSectionSchema }),
  estimateController.updateSection,
);
estimateRouter.delete(
  '/estimates/:id/sections/:sid',
  validate({ params: estimateSectionParamsSchema }),
  estimateController.deleteSection,
);

// Items
estimateRouter.post(
  '/estimates/:id/sections/:sid/items',
  validate({ params: estimateSectionParamsSchema, body: createEstimateItemSchema }),
  estimateController.createItem,
);
estimateRouter.put(
  '/estimate-items/:itemId',
  validate({ params: estimateItemParamsSchema, body: updateEstimateItemSchema }),
  estimateController.updateItem,
);
estimateRouter.delete(
  '/estimate-items/:itemId',
  validate({ params: estimateItemParamsSchema }),
  estimateController.deleteItem,
);

// Workflow
estimateRouter.post(
  '/estimates/:id/submit',
  validate({ params: estimateIdParamsSchema }),
  estimateController.submit,
);
estimateRouter.post(
  '/estimates/:id/approve',
  validate({ params: estimateIdParamsSchema }),
  estimateController.approve,
);
estimateRouter.post(
  '/estimates/:id/reject',
  validate({ params: estimateIdParamsSchema, body: rejectEstimateSchema }),
  estimateController.reject,
);
estimateRouter.post(
  '/estimates/:id/duplicate',
  validate({ params: estimateIdParamsSchema }),
  estimateController.duplicate,
);
estimateRouter.post(
  '/estimates/:id/convert-to-boq',
  validate({ params: estimateIdParamsSchema }),
  boqController.convertEstimateToBoq,
);
estimateRouter.get(
  '/estimates/:id/compare/:id2',
  validate({ params: estimateCompareParamsSchema }),
  estimateController.compare,
);

// Exports
estimateRouter.get(
  '/estimates/:id/export/excel',
  validate({ params: estimateIdParamsSchema }),
  estimateController.exportExcel,
);
estimateRouter.get(
  '/estimates/:id/export/pdf',
  validate({ params: estimateIdParamsSchema }),
  estimateController.exportPdf,
);
