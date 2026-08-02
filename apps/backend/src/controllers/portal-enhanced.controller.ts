import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/portal-enhanced.service';
export async function list(req: Request, res: Response, next: NextFunction) {
  try { res.json({ success: true, data: await svc.listPortalAccess(req.user!.companyId, req.user!.id, req.user!.role, req.params.id) }); } catch (e) { next(e); }
}
export async function revoke(req: Request, res: Response, next: NextFunction) {
  try { res.json({ success: true, data: await svc.revokePortalAccess(req.user!.companyId, req.user!.id, req.user!.role, req.params.id, req.params.accessId) }); } catch (e) { next(e); }
}
export async function enhancedData(req: Request, res: Response, next: NextFunction) {
  try { res.json({ success: true, data: await svc.getEnhancedPortalData(req.params.token) }); } catch (e) { next(e); }
}
