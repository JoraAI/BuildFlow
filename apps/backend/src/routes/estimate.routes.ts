/**
 * BuildFlow - Estimate routes.
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
import * as changeOrderService from '../services/change-order.service';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { requireModuleForPaths } from '../middleware/module-gate';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async-handler';
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
// estimateRouter is mounted at `/api` (catch-all) - the gate must be path-aware
// so unrelated /api/* requests (invoices, bills, settings, ...) pass through.
estimateRouter.use(
  requireModuleForPaths('estimates', [
    /^\/projects\/[^/]+\/estimates\b/,
    /^\/estimates\b/,
    /^\/estimate-items\b/,
  ]),
);

// Owner-aligned: mutations follow permission tags (Accountant has no estimate.*).
const ESTIMATE_EDIT = requirePermission('estimate.create');
const ESTIMATE_APPROVE = requirePermission('estimate.approve');
const ESTIMATE_CONVERT = requirePermission('estimate.convert_boq');

// Project-scoped routes
estimateRouter.get(
  '/projects/:projectId/estimates',
  requirePermission('estimate.view'),
  validate({ params: projectIdParamsSchema }),
  asyncHandler(estimateController.list),
);
estimateRouter.post(
  '/projects/:projectId/estimates',
  ESTIMATE_EDIT,
  validate({ params: projectIdParamsSchema, body: createEstimateSchema }),
  asyncHandler(estimateController.create),
);

// Estimate-scoped routes
estimateRouter.get(
  '/estimates/:id',
  requirePermission('estimate.view'),
  validate({ params: estimateIdParamsSchema }),
  asyncHandler(estimateController.get),
);
estimateRouter.put(
  '/estimates/:id',
  ESTIMATE_EDIT,
  validate({ params: estimateIdParamsSchema, body: updateEstimateMetaSchema }),
  asyncHandler(estimateController.update),
);
estimateRouter.delete(
  '/estimates/:id',
  ESTIMATE_EDIT,
  validate({ params: estimateIdParamsSchema }),
  asyncHandler(estimateController.remove),
);

// Sections
estimateRouter.post(
  '/estimates/:id/sections',
  ESTIMATE_EDIT,
  validate({ params: estimateIdParamsSchema, body: createEstimateSectionSchema }),
  asyncHandler(estimateController.createSection),
);
estimateRouter.put(
  '/estimates/:id/sections/:sid',
  ESTIMATE_EDIT,
  validate({ params: estimateSectionParamsSchema, body: updateEstimateSectionSchema }),
  asyncHandler(estimateController.updateSection),
);
estimateRouter.delete(
  '/estimates/:id/sections/:sid',
  ESTIMATE_EDIT,
  validate({ params: estimateSectionParamsSchema }),
  asyncHandler(estimateController.deleteSection),
);

// Items
estimateRouter.post(
  '/estimates/:id/sections/:sid/items',
  ESTIMATE_EDIT,
  validate({ params: estimateSectionParamsSchema, body: createEstimateItemSchema }),
  asyncHandler(estimateController.createItem),
);
estimateRouter.put(
  '/estimate-items/:itemId',
  ESTIMATE_EDIT,
  validate({ params: estimateItemParamsSchema, body: updateEstimateItemSchema }),
  asyncHandler(estimateController.updateItem),
);
estimateRouter.delete(
  '/estimate-items/:itemId',
  ESTIMATE_EDIT,
  validate({ params: estimateItemParamsSchema }),
  asyncHandler(estimateController.deleteItem),
);

// Sub-items (children of a parent estimate item)
estimateRouter.get(
  '/estimate-items/:itemId/sub-items',
  requirePermission('estimate.view'),
  validate({ params: estimateItemParamsSchema }),
  asyncHandler(estimateController.listSubItems),
);
estimateRouter.post(
  '/estimate-items/:itemId/sub-items',
  ESTIMATE_EDIT,
  validate({ params: estimateItemParamsSchema, body: createEstimateItemSchema }),
  asyncHandler(estimateController.createSubItem),
);
estimateRouter.delete(
  '/estimate-items/:itemId/sub-items/:subItemId',
  ESTIMATE_EDIT,
  validate({ params: z.object({ itemId: z.string().uuid(), subItemId: z.string().uuid() }) }),
  asyncHandler(estimateController.deleteSubItem),
);

// EST-VO-11b: Variations linked to this estimate
estimateRouter.get(
  '/estimates/:id/variations',
  validate({ params: estimateIdParamsSchema }),
  async (req, res, next) => {
    try {
      const result = await changeOrderService.listVariationsByEstimate(
        req.user!.companyId,
        req.params.id,
      );
      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  },
);

// Sub-estimates (child estimates for additional scope)
estimateRouter.get(
  '/estimates/:id/sub-estimates',
  validate({ params: estimateIdParamsSchema }),
  asyncHandler(estimateController.listSubEstimates),
);
estimateRouter.post(
  '/estimates/:id/sub-estimates',
  ESTIMATE_EDIT,
  validate({ params: estimateIdParamsSchema, body: z.object({ name: z.string().min(1).max(200), notes: z.string().max(2000).optional() }) }),
  asyncHandler(estimateController.createSubEstimate),
);

// Workflow
estimateRouter.post(
  '/estimates/:id/submit',
  requirePermission('estimate.submit'),
  validate({ params: estimateIdParamsSchema }),
  asyncHandler(estimateController.submit),
);
estimateRouter.post(
  '/estimates/:id/approve',
  ESTIMATE_APPROVE,
  validate({ params: estimateIdParamsSchema }),
  asyncHandler(estimateController.approve),
);
estimateRouter.post(
  '/estimates/:id/reject',
  ESTIMATE_APPROVE,
  validate({ params: estimateIdParamsSchema, body: rejectEstimateSchema }),
  asyncHandler(estimateController.reject),
);
estimateRouter.post(
  '/estimates/:id/duplicate',
  ESTIMATE_EDIT,
  validate({ params: estimateIdParamsSchema }),
  asyncHandler(estimateController.duplicate),
);
estimateRouter.post(
  '/estimates/:id/convert-to-boq',
  ESTIMATE_CONVERT,
  validate({ params: estimateIdParamsSchema }),
  asyncHandler(boqController.convertEstimateToBoq),
);
estimateRouter.get(
  '/estimates/:id/compare/:id2',
  requirePermission('estimate.view'),
  validate({ params: estimateCompareParamsSchema }),
  asyncHandler(estimateController.compare),
);

// Exports
estimateRouter.get(
  '/estimates/:id/export/excel',
  requirePermission('estimate.export'),
  validate({ params: estimateIdParamsSchema }),
  asyncHandler(estimateController.exportExcel),
);
estimateRouter.get(
  '/estimates/:id/export/pdf',
  requirePermission('estimate.export'),
  validate({ params: estimateIdParamsSchema }),
  asyncHandler(estimateController.exportPdf),
);
