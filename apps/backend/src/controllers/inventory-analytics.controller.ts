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

export async function getProfitLoss(req: Request, res: Response, next: NextFunction) {
  try {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    ok(
      res,
      await analyticsService.getProfitLossReport(req.user!.companyId, req.user!.id, req.user!.role, {
        from,
        to,
      }),
    );
  } catch (err) {
    next(err);
  }
}

export async function exportExcel(req: Request, res: Response, next: NextFunction) {
  try {
    const reportRaw = typeof req.query.report === 'string' ? req.query.report : 'pnl';
    const allowed = new Set(['pnl', 'margin', 'stock-health', 'expenses']);
    if (!allowed.has(reportRaw)) {
      res.status(400).json({ success: false, error: { message: 'Invalid report type' } });
      return;
    }
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    const days = typeof req.query.days === 'string' ? parseInt(req.query.days, 10) : undefined;
    const { buffer, filename } = await analyticsService.buildAnalyticsExcel(
      req.user!.companyId,
      req.user!.id,
      req.user!.role,
      reportRaw as 'pnl' | 'margin' | 'stock-health' | 'expenses',
      { from, to, days: Number.isFinite(days) ? days : undefined },
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}
