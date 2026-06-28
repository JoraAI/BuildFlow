/**
 * BuildFlow - Project material rate controller.
 */
import { NextFunction, Request, Response } from 'express';
import * as projectMaterialRateService from '../services/project-material-rate.service';
import { ok } from '../utils/response';

export async function listProjectMaterialRates(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await projectMaterialRateService.listProjectMaterialRates(
      req.user!.companyId,
      req.params.id,
    );
    ok(res, rows);
  } catch (err) {
    next(err);
  }
}

export async function upsertProjectMaterialRates(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await projectMaterialRateService.upsertProjectMaterialRates(
      req.user!.companyId,
      req.params.id,
      req.body.rates,
    );
    ok(res, rows);
  } catch (err) {
    next(err);
  }
}

export async function copyProjectRatesFromRegion(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await projectMaterialRateService.copyProjectRatesFromRegion(
      req.user!.companyId,
      req.params.id,
    );
    ok(res, rows);
  } catch (err) {
    next(err);
  }
}

export async function copyProjectRatesFromEstimate(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await projectMaterialRateService.copyProjectRatesFromEstimate(
      req.user!.companyId,
      req.params.id,
    );
    ok(res, rows);
  } catch (err) {
    next(err);
  }
}
