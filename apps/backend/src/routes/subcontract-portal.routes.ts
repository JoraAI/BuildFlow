/**
 * BuildFlow - Subcontractor portal public routes.
 *
 * FIX (SEC-M13): All async handlers are wrapped with the asyncHandler so token
 * errors and service errors propagate to Express's error middleware via
 * `next(err)` instead of hanging the request.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as subPortalService from '../services/subcontract-portal.service';
import { validate } from '../middleware/validate';
import { createMeasurementSchema } from '@buildflow/shared';
import { ok, created } from '../utils/response';

/** Wrap an async route handler so rejections are forwarded to next(). */
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

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
  asyncHandler(async (req, res) => {
    const data = await subPortalService.getSubPortalData(req.params.token);
    return ok(res, data);
  }),
);

subPortalPublicRouter.post(
  '/:token/work-orders/:workOrderId/measurements',
  validate({ params: woParams, body: createMeasurementSchema }),
  asyncHandler(async (req, res) => {
    const data = await subPortalService.subPortalCreateMeasurement(
      req.params.token,
      req.params.workOrderId,
      req.body,
    );
    return created(res, data);
  }),
);

subPortalPublicRouter.post(
  '/:token/measurements/:measurementId/submit',
  validate({ params: measParams }),
  asyncHandler(async (req, res) => {
    const data = await subPortalService.subPortalSubmitMeasurement(
      req.params.token,
      req.params.measurementId,
    );
    return ok(res, data);
  }),
);