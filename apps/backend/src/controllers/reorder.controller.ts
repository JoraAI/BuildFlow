/**
 * BuildFlow - Reorder automation controller (INVENTORY_HORIZONTAL_PLATFORM Phase 4).
 * Thin request handlers for reorder suggestions + one-click purchase.
 */
import { NextFunction, Request, Response } from 'express';
import * as reorderService from '../services/reorder.service';
import { ok, created } from '../utils/response';

export async function getSuggestions(req: Request, res: Response, next: NextFunction) {
  try {
    const resourceIds =
      typeof req.query.resourceIds === 'string' && req.query.resourceIds
        ? req.query.resourceIds.split(',')
        : undefined;
    ok(
      res,
      await reorderService.getReorderSuggestions(
        req.user!.companyId,
        req.user!.id,
        req.user!.role,
        resourceIds,
      ),
    );
  } catch (err) {
    next(err);
  }
}

export async function order(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reorderService.createReorderPurchase(
      req.user!.companyId,
      req.user!.id,
      req.user!.role,
      req.body.resourceIds,
    );
    created(res, data);
  } catch (err) {
    next(err);
  }
}
