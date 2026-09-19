/**
 * BuildFlow - BOQ controller (thin request handlers).
 */
import { NextFunction, Request, Response } from 'express';
import * as boqService from '../services/boq.service';
import { ok, created } from '../utils/response';
import { canViewBoqRates, canViewAmounts } from '../utils/financial-mask';

function ipOf(req: Request): string | undefined {
  const xfwd = req.headers['x-forwarded-for'];
  if (typeof xfwd === 'string') return xfwd.split(',')[0]!.trim();
  return req.ip;
}

export async function listBoq(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await boqService.listBoq(req.user!.companyId, req.params.id);
    const canRates = await canViewBoqRates(req.user!.companyId, req.user!.role);
    if (!canRates) {
      for (const item of result.items) {
        (item as { rate: unknown }).rate = null;
        (item as { amount: unknown }).amount = null;
      }
    }
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function createBoqItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const item = await boqService.createBoqItem(companyId, userId, req.params.id, req.body, ipOf(req));
    created(res, item);
  } catch (err) {
    next(err);
  }
}

export async function updateBoqItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const item = await boqService.updateBoqItem(companyId, userId, req.params.id, req.body, ipOf(req));
    ok(res, item);
  } catch (err) {
    next(err);
  }
}

export async function deleteBoqItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    await boqService.deleteBoqItem(companyId, userId, req.params.id, ipOf(req));
    ok(res, { success: true });
  } catch (err) {
    next(err);
  }
}

export async function importBoq(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const result = await boqService.importBoq(companyId, userId, req.params.id, req.body, ipOf(req));
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function convertEstimateToBoq(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const result = await boqService.convertEstimateToBoq(
      companyId,
      userId,
      req.params.id,
      ipOf(req),
    );
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function recordMeasurement(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const result = await boqService.recordBoqMeasurement(
      companyId,
      userId,
      req.params.id,
      req.body,
      ipOf(req),
    );
    created(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getBoqVsActual(req: Request, res: Response, next: NextFunction) {
  try {
    const canMoney = await canViewAmounts(req.user!.companyId, req.user!.role);
    if (!canMoney) {
      ok(res, { lines: [], categoryTotals: [], restricted: true });
      return;
    }
    const result = await boqService.getBoqVsActualLines(req.user!.companyId, req.params.id);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}