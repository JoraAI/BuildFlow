/**
 * BuildFlow - Inventory analytics controller (INVENTORY_HORIZONTAL_PLATFORM Phase 6).
 * Thin request handlers for the executive dashboard + stock/margin reports.
 */
import { NextFunction, Request, Response } from 'express';
import * as analyticsService from '../services/inventory-analytics.service';
import { ok } from '../utils/response';

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await analyticsService.getDashboard(req.user!.companyId, req.user!.id, req.user!.role));
  } catch (err) {
    next(err);
  }
}

export async function getStockHealth(req: Request, res: Response, next: NextFunction) {
  try {
    const days = typeof req.query.days === 'string' ? parseInt(req.query.days, 10) : undefined;
    const locationId = typeof req.query.locationId === 'string' ? req.query.locationId : undefined;
    ok(
      res,
      await analyticsService.getStockHealthReport(
        req.user!.companyId,
        req.user!.id,
        req.user!.role,
        {
          days: Number.isFinite(days) ? days : undefined,
          locationId,
        },
      ),
    );
  } catch (err) {
    next(err);
  }
}

export async function getWarehouseValue(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await analyticsService.getWarehouseValueReport(req.user!.companyId, req.user!.id, req.user!.role));
  } catch (err) {
    next(err);
  }
}

export async function getMargin(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await analyticsService.getMarginReport(req.user!.companyId, req.user!.id, req.user!.role));
  } catch (err) {
    next(err);
  }
}

export async function getPurchaseHistory(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await analyticsService.getPurchaseHistoryReport(req.user!.companyId, req.user!.id, req.user!.role));
  } catch (err) {
    next(err);
  }
}
