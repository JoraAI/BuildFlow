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
import { authenticateToken, requireRole } from '../middleware/auth';
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
  Role,
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
  ]),
);

// FIX (R2-3): Gate estimate workflow mutations behind requireRole, matching
// boq.routes.ts. Previously approve / convert-to-boq had no role guard, so any
// team member (incl. STORE_INCHARGE) could approve estimates or convert them.
const ESTIMATE_MUTATION_ROLES = requireRole(Role.OWNER, Role.PM, Role.DPM, Role.ACCOUNTANT);

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

// Sub-items (children of a parent estimate item)
estimateRouter.get(
  '/estimate-items/:itemId/sub-items',
  validate({ params: estimateItemParamsSchema }),
  estimateController.listSubItems,
);
estimateRouter.post(
  '/estimate-items/:itemId/sub-items',
  validate({ params: estimateItemParamsSchema, body: createEstimateItemSchema }),
  estimateController.createSubItem,
);
estimateRouter.delete(
  '/estimate-items/:itemId/sub-items/:subItemId',
  validate({ params: z.object({ itemId: z.string().uuid(), subItemId: z.string().uuid() }) }),
  estimateController.deleteSubItem,
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
  estimateController.listSubEstimates,
);
estimateRouter.post(
  '/estimates/:id/sub-estimates',
  validate({ params: estimateIdParamsSchema, body: z.object({ name: z.string().min(1).max(200), notes: z.string().max(2000).optional() }) }),
  estimateController.createSubEstimate,
);

// Workflow
estimateRouter.post(
  '/estimates/:id/submit',
  validate({ params: estimateIdParamsSchema }),
  asyncHandler(estimateController.submit),
);
estimateRouter.post(
  '/estimates/:id/approve',
  ESTIMATE_MUTATION_ROLES,
  validate({ params: estimateIdParamsSchema }),
  estimateController.approve,
);
estimateRouter.post(
  '/estimates/:id/reject',
  ESTIMATE_MUTATION_ROLES,
  validate({ params: estimateIdParamsSchema, body: rejectEstimateSchema }),
  estimateController.reject,
);
estimateRouter.post(
  '/estimates/:id/duplicate',
  ESTIMATE_MUTATION_ROLES,
  validate({ params: estimateIdParamsSchema }),
  estimateController.duplicate,
);
estimateRouter.post(
  '/estimates/:id/convert-to-boq',
  ESTIMATE_MUTATION_ROLES,
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
