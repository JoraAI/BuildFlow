/**
 * Shop unit catalog controller (IM multi-unit).
 */
import { NextFunction, Request, Response } from 'express';
import * as units from '../services/company-unit.service';
import { ok } from '../utils/response';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId } = req.user!;
    const includeInactive = String(req.query.includeInactive ?? '') === 'true';
    const rows = await units.listCompanyUnits(companyId, { includeInactive });
    ok(res, rows);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId } = req.user!;
    const row = await units.createCompanyUnit(companyId, req.body);
    ok(res, row, 201);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId } = req.user!;
    const row = await units.updateCompanyUnit(companyId, req.params.id, req.body);
    ok(res, row);
  } catch (err) {
    next(err);
  }
}

export async function deactivate(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId } = req.user!;
    const row = await units.deactivateCompanyUnit(companyId, req.params.id);
    ok(res, row);
  } catch (err) {
    next(err);
  }
}
