/**
 * BuildFlow - Analytics controller (OWNER only).
 */
import { Request, Response } from 'express';
import { getOwnerDashboard } from '../services/analytics.service';
import { ok } from '../utils/response';

export async function getDashboard(req: Request, res: Response) {
  const data = await getOwnerDashboard(req.user!.companyId);
  return ok(res, data);
}
