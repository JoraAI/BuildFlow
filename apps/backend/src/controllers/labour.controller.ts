import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/labour.service';

export async function attendanceSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.getAttendanceSummary(req.user!.companyId, req.user!.id, req.user!.role, req.params.projectId, req.query as never);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
}
export async function labourCost(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.getLabourCostTracking(req.user!.companyId, req.user!.id, req.user!.role, req.params.projectId, req.query as never);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
}
export async function productivity(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.getProductivityMetrics(req.user!.companyId, req.user!.id, req.user!.role, req.params.projectId);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
}
