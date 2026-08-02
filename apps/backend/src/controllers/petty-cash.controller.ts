/**
 * BuildFlow - Petty Cash controller (Phase 5 §8.9).
 */
import { Request, Response, NextFunction } from 'express';
import * as pettyCashService from '../services/petty-cash.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const companyId = req.user!.companyId;
    const result = await pettyCashService.listPettyCashEntries(companyId, req.query as never);
    res.json({ success: true, data: result.rows, meta: { page: (req.query as { page?: number }).page ?? 1, total: result.total } });
  } catch (err) { next(err); }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const companyId = req.user!.companyId;
    const entry = await pettyCashService.getPettyCashEntry(companyId, req.params.id);
    res.json({ success: true, data: entry });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const companyId = req.user!.companyId;
    const userId = req.user!.id;
    const entry = await pettyCashService.createPettyCashEntry(companyId, userId, req.body, req.ip);
    res.status(201).json({ success: true, data: entry });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const companyId = req.user!.companyId;
    const userId = req.user!.id;
    const entry = await pettyCashService.updatePettyCashEntry(companyId, userId, req.params.id, req.body, req.ip);
    res.json({ success: true, data: entry });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const companyId = req.user!.companyId;
    const userId = req.user!.id;
    await pettyCashService.deletePettyCashEntry(companyId, userId, req.params.id, req.ip);
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
}

export async function summary(req: Request, res: Response, next: NextFunction) {
  try {
    const companyId = req.user!.companyId;
    const projectId = (req.query as { projectId?: string }).projectId;
    const result = await pettyCashService.getPettyCashSummary(companyId, projectId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}