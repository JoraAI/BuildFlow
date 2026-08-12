/**
 * BuildFlow - Health check route.
 *
 * FIX (SEC-L18): Don't expose the `env` value - it leaks deployment info
 * (production/staging) to anyone hitting `/health`.
 */
import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      service: 'buildflow-api',
      timestamp: new Date().toISOString(),
    },
  });
});
