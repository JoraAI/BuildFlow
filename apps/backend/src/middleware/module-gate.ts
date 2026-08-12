/**
 * BuildFlow - Product module gate middleware.
 *
 * Usage (AFTER `authenticateToken`):
 *   router.use(authenticateToken);
 *   router.use(requireModule('estimates'));
 */
import { NextFunction, Request, Response } from 'express';
import type { AppModule, InventoryFeatureFlag } from '@buildflow/shared';
import { ApiError } from '../utils/errors';
import { assertModuleEnabled, assertInventoryFeature } from '../services/module-gate.service';

export function requireModule(module: AppModule) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(ApiError.unauthorized());
      await assertModuleEnabled(req.user.companyId, module);
      next();
    } catch (err) {
      next(err instanceof ApiError ? err : ApiError.internal());
    }
  };
}

/**
 * INVENTORY_HORIZONTAL_PLATFORM (Phase 1): gate an endpoint behind an inventory
 * phase flag (parties, stock_adjustments, ...). Construction tenants always get
 * 403 until the corresponding phase ships for their plan.
 */
export function requireInventoryFeature(flag: InventoryFeatureFlag) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(ApiError.unauthorized());
      await assertInventoryFeature(req.user.companyId, flag);
      next();
    } catch (err) {
      next(err instanceof ApiError ? err : ApiError.internal());
    }
  };
}

/**
 * Path-aware module gate.
 *
 * Use this when the router is mounted at a SHARED prefix (e.g. `/api` for the
 * estimate router, or `/api/projects` for project-scoped routers). A plain
 * `router.use(requireModule(...))` would block unrelated requests that merely
 * pass through the router (e.g. `/api/projects/:id/invoices` entering the
 * planning router). `matchers` are tested against the mount-relative `req.path`
 * so only requests for this module's routes are gated.
 */
export function requireModuleForPaths(module: AppModule, matchers: RegExp[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!matchers.some((m) => m.test(req.path))) return next();
    try {
      if (!req.user) return next(ApiError.unauthorized());
      await assertModuleEnabled(req.user.companyId, module);
      next();
    } catch (err) {
      next(err instanceof ApiError ? err : ApiError.internal());
    }
  };
}
