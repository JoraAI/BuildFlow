/**
 * BuildFlow — Rate Analysis routes.
 *
 * GET    /api/rate-analysis
 * POST   /api/rate-analysis
 * GET    /api/rate-analysis/:id
 * PUT    /api/rate-analysis/:id
 * DELETE /api/rate-analysis/:id
 * POST   /api/rate-analysis/:id/duplicate
 */
import { Router } from 'express';
import { z } from 'zod';
import * as rateAnalysisController from '../controllers/rate-analysis.controller';
import { authenticateToken } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createRateAnalysisSchema,
  updateRateAnalysisSchema,
  rateAnalysisQuerySchema,
} from '@buildflow/shared';

const idParamsSchema = z.object({ id: z.string().uuid() });

export const rateAnalysisRouter = Router();

rateAnalysisRouter.use(authenticateToken);

rateAnalysisRouter.get(
  '/',
  validate({ query: rateAnalysisQuerySchema }),
  rateAnalysisController.list,
);
rateAnalysisRouter.post(
  '/',
  validate({ body: createRateAnalysisSchema }),
  rateAnalysisController.create,
);

rateAnalysisRouter.get(
  '/:id',
  validate({ params: idParamsSchema }),
  rateAnalysisController.get,
);
rateAnalysisRouter.put(
  '/:id',
  validate({ params: idParamsSchema, body: updateRateAnalysisSchema }),
  rateAnalysisController.update,
);
rateAnalysisRouter.delete(
  '/:id',
  validate({ params: idParamsSchema }),
  rateAnalysisController.remove,
);
rateAnalysisRouter.post(
  '/:id/duplicate',
  validate({ params: idParamsSchema }),
  rateAnalysisController.duplicate,
);