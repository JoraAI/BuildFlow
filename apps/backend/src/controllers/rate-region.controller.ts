/**
 * BuildFlow - Rate region controller.
 */
import { NextFunction, Request, Response } from 'express';
import * as rateRegionService from '../services/rate-region.service';
import { created, ok } from '../utils/response';

export async function listRateRegions(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await rateRegionService.listRateRegions(req.user!.companyId);
    ok(res, rows);
  } catch (err) {
    next(err);
  }
}

export async function createRateRegion(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await rateRegionService.createRateRegion(req.user!.companyId, req.body);
    created(res, row);
  } catch (err) {
    next(err);
  }
}

export async function updateRateRegion(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await rateRegionService.updateRateRegion(
      req.user!.companyId,
      req.params.regionId,
      req.body,
    );
    ok(res, row);
  } catch (err) {
    next(err);
  }
}

export async function deleteRateRegion(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await rateRegionService.deleteRateRegion(req.user!.companyId, req.params.regionId);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function listRegionalRates(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await rateRegionService.listRegionalRates(req.user!.companyId, req.params.regionId);
    ok(res, rows);
  } catch (err) {
    next(err);
  }
}

export async function upsertRegionalRates(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await rateRegionService.upsertRegionalRates(
      req.user!.companyId,
      req.params.regionId,
      req.body.rates,
    );
    ok(res, rows);
  } catch (err) {
    next(err);
  }
}
