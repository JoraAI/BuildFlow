/**
 * BuildFlow — BOQ controller (thin request handlers).
 */
import { NextFunction, Request, Response } from 'express';
import * as boqService from '../services/boq.service';
import { ok, created } from '../utils/response';

function ipOf(req: Request): string | undefined {
  const xfwd = req.headers['x-forwarded-for'];
  if (typeof xfwd === 'string') return xfwd.split(',')[0]!.trim();
  return req.ip;
}

export async function listBoq(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await boqService.listBoq(req.user!.companyId, req.params.id);
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