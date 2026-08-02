import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/punch-list.service';
export async function list(req: Request, res: Response, next: NextFunction) {
  try { const r = await svc.listPunchItems(req.user!.companyId, req.query as never); res.json({ success: true, data: r.rows, meta: { page: r.page, total: r.total } }); } catch (e) { next(e); }
}
export async function get(req: Request, res: Response, next: NextFunction) {
  try { res.json({ success: true, data: await svc.getPunchItem(req.user!.companyId, req.params.id) }); } catch (e) { next(e); }
}
export async function create(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json({ success: true, data: await svc.createPunchItem(req.user!.companyId, req.user!.id, req.body, req.ip) }); } catch (e) { next(e); }
}
export async function update(req: Request, res: Response, next: NextFunction) {
  try { res.json({ success: true, data: await svc.updatePunchItem(req.user!.companyId, req.user!.id, req.params.id, req.body, req.ip) }); } catch (e) { next(e); }
}
export async function remove(req: Request, res: Response, next: NextFunction) {
  try { await svc.deletePunchItem(req.user!.companyId, req.user!.id, req.params.id, req.ip); res.json({ success: true, data: null }); } catch (e) { next(e); }
}
