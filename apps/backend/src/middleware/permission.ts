/**
 * BuildFlow - Permission middleware
 *
 * Usage:
 *   router.post('/', authenticateToken, requirePermission('estimate.create'), handler)
 *   router.get('/', authenticateToken, requireAnyPermission(['invoice.view', 'bill.view']), handler)
 *
 * `requirePermission` checks the user's role permissions (company-customizable)
 * and calls next() if granted, or ApiError.forbidden() if denied.
 *
 * `loadPermissions` is an optional middleware that pre-loads permissions onto
 * `req.user.permissions` so services can check them synchronously without
 * another DB lookup.
 */
import { NextFunction, Request, Response } from 'express';
import type { Permission } from '@buildflow/shared';
import { ApiError } from '../utils/errors';
import { getRolePermissions, hasPermission, hasAnyPermission } from '../lib/permissions';

/**
 * Guard: require a single permission.
 * Must be used AFTER `authenticateToken`.
 */
export function requirePermission(permission: Permission) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(ApiError.unauthorized());

      const granted = await hasPermission(req.user.companyId, req.user.role, permission);
      if (!granted) {
        return next(
          ApiError.forbidden(
            `Your role (${req.user.role}) does not have permission: ${permission}`,
          ),
        );
      }
      next();
    } catch (err) {
      next(err instanceof ApiError ? err : ApiError.internal());
    }
  };
}

/**
 * Guard: require ANY of the given permissions (OR logic).
 * Must be used AFTER `authenticateToken`.
 */
export function requireAnyPermission(permissions: Permission[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(ApiError.unauthorized());

      const granted = await hasAnyPermission(req.user.companyId, req.user.role, permissions);
      if (!granted) {
        return next(
          ApiError.forbidden(
            `Your role (${req.user.role}) requires one of: ${permissions.join(', ')}`,
          ),
        );
      }
      next();
    } catch (err) {
      next(err instanceof ApiError ? err : ApiError.internal());
    }
  };
}

/**
 * Guard: require ALL of the given permissions (AND logic).
 * Must be used AFTER `authenticateToken`.
 */
export function requireAllPermissions(permissions: Permission[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(ApiError.unauthorized());

      const { hasAllPermissions } = await import('../lib/permissions');
      const granted = await hasAllPermissions(req.user.companyId, req.user.role, permissions);
      if (!granted) {
        return next(
          ApiError.forbidden(
            `Your role (${req.user.role}) requires all of: ${permissions.join(', ')}`,
          ),
        );
      }
      next();
    } catch (err) {
      next(err instanceof ApiError ? err : ApiError.internal());
    }
  };
}

/**
 * Optional middleware: pre-loads the user's permissions onto req.user.permissions.
 * This allows services to check `req.user.permissions?.includes(...)` synchronously.
 *
 * Use AFTER `authenticateToken` and BEFORE controllers that need field-level
 * permission checks (e.g., masking amounts).
 */
export async function loadPermissions(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (req.user) {
      req.user.permissions = await getRolePermissions(req.user.companyId, req.user.role);
    }
    next();
  } catch (err) {
    // Don't fail the request if permission loading fails — services will
    // fall back to deny-by-default or use the async hasPermission() helper.
    next();
  }
}

/**
 * Helper for services/controllers to check a permission synchronously.
 * Requires `loadPermissions` middleware to have run upstream.
 * Returns false if permissions were not loaded (deny by default).
 */
export function checkLoadedPermission(
  req: Request,
  permission: Permission,
): boolean {
  return req.user?.permissions?.includes(permission) ?? false;
}