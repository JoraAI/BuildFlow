/**
 * BuildFlow — Report schedule controller (OWNER only).
 */
import { Request, Response } from 'express';
import * as svc from '../services/report-schedule.service';
import { created, ok } from '../utils/response';

export async function listSchedules(req: Request, res: Response) {
  const data = await svc.listReportSchedules(req.user!.companyId);
  return ok(res, data);
}

export async function createSchedule(req: Request, res: Response) {
  const data = await svc.createReportSchedule(req.user!.companyId, req.body);
  return created(res, data);
}
