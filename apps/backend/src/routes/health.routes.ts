/**
 * BuildFlow - Health check route.
 */
import { Router } from 'express';
import { env } from '../config/env';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      service: 'buildflow-api',
      env: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    },
  });
});