import { Request, Response, NextFunction } from 'express';
import * as syncService from '../services/sync.service';

export async function delta(req: Request, res: Response, next: NextFunction) {
  try {
    const since = (req.query.since as string) || new Date(0).toISOString();
    const projectIds = (req.query.projectIds as string | undefined)?.split(',').filter(Boolean);
    const result = await syncService.getDeltaSync(req.user!.companyId, since, projectIds);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
}

export async function status(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await syncService.getSyncStatus(req.user!.companyId);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
}
