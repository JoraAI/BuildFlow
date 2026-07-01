/**
 * BuildFlow - Subcontractor portal public routes.
 */
import { Router } from 'express';
import { z } from 'zod';
import * as subPortalService from '../services/subcontract-portal.service';
import { validate } from '../middleware/validate';
import { createMeasurementSchema } from '@buildflow/shared';
import { ok, created } from '../utils/response';

const tokenParams = z.object({ token: z.string().min(32).max(128) });
const woParams = z.object({
  token: z.string().min(32).max(128),
  workOrderId: z.string().uuid(),
});
const measParams = z.object({
  token: z.string().min(32).max(128),
  measurementId: z.string().uuid(),
});

export const subPortalPublicRouter = Router();

subPortalPublicRouter.get(
  '/:token',
  validate({ params: tokenParams }),
  async (req, res) => {
    const data = await subPortalService.getSubPortalData(req.params.token);
    return ok(res, data);
  },
);

subPortalPublicRouter.post(
  '/:token/work-orders/:workOrderId/measurements',
  validate({ params: woParams, body: createMeasurementSchema }),
  async (req, res) => {
    const data = await subPortalService.subPortalCreateMeasurement(
      req.params.token,
      req.params.workOrderId,
      req.body,
    );
    return created(res, data);
  },
);

subPortalPublicRouter.post(
  '/:token/measurements/:measurementId/submit',
  validate({ params: measParams }),
  async (req, res) => {
    const data = await subPortalService.subPortalSubmitMeasurement(
      req.params.token,
      req.params.measurementId,
    );
    return ok(res, data);
  },
);
