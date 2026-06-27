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

const uuidSchema = z.object({
  id: z.string().uuid(),
  sid: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  id2: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
});

export const estimateRouter = Router();

estimateRouter.use(authenticateToken);

// Project-scoped routes
estimateRouter.get(
  '/projects/:projectId/estimates',
  validate({ params: uuidSchema }),
  estimateController.list,
);
estimateRouter.post(
  '/projects/:projectId/estimates',
  validate({ params: uuidSchema, body: createEstimateSchema }),
  estimateController.create,
);

// Estimate-scoped routes
estimateRouter.get('/estimates/:id', estimateController.get);
estimateRouter.put(
  '/estimates/:id',
  validate({ body: updateEstimateMetaSchema }),
  estimateController.update,
);
estimateRouter.delete('/estimates/:id', estimateController.remove);

// Sections
estimateRouter.post(
  '/estimates/:id/sections',
  validate({ body: createEstimateSectionSchema }),
  estimateController.createSection,
);
estimateRouter.put(
  '/estimates/:id/sections/:sid',
  validate({ params: uuidSchema, body: updateEstimateSectionSchema }),
  estimateController.updateSection,
);
estimateRouter.delete('/estimates/:id/sections/:sid', estimateController.deleteSection);

// Items
estimateRouter.post(
  '/estimates/:id/sections/:sid/items',
  validate({ body: createEstimateItemSchema }),
  estimateController.createItem,
);
estimateRouter.put(
  '/estimate-items/:itemId',
  validate({ params: uuidSchema, body: updateEstimateItemSchema }),
  estimateController.updateItem,
);
estimateRouter.delete('/estimate-items/:itemId', estimateController.deleteItem);

// Workflow
estimateRouter.post('/estimates/:id/submit', estimateController.submit);
estimateRouter.post('/estimates/:id/approve', estimateController.approve);
estimateRouter.post(
  '/estimates/:id/reject',
  validate({ body: rejectEstimateSchema }),
  estimateController.reject,
);
estimateRouter.post('/estimates/:id/duplicate', estimateController.duplicate);
estimateRouter.post('/estimates/:id/convert-to-boq', boqController.convertEstimateToBoq);
estimateRouter.get('/estimates/:id/compare/:id2', estimateController.compare);

// Exports
estimateRouter.get('/estimates/:id/export/excel', estimateController.exportExcel);
estimateRouter.get('/estimates/:id/export/pdf', estimateController.exportPdf);
