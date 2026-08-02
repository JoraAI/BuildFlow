import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/drawing.service';
export async function list(req: Request, res: Response, next: NextFunction) { try { const r = await svc.listDrawings(req.user!.companyId, req.query as never); res.json({ success: true, data: r.rows, meta: { page: r.page, total: r.total } }); } catch (e) { next(e); } }
export async function get(req: Request, res: Response, next: NextFunction) { try { res.json({ success: true, data: await svc.getDrawing(req.user!.companyId, req.params.id) }); } catch (e) { next(e); } }
export async function create(req: Request, res: Response, next: NextFunction) { try { res.status(201).json({ success: true, data: await svc.createDrawing(req.user!.companyId, req.user!.id, req.body, req.ip) }); } catch (e) { next(e); } }
export async function update(req: Request, res: Response, next: NextFunction) { try { res.json({ success: true, data: await svc.updateDrawing(req.user!.companyId, req.user!.id, req.params.id, req.body, req.ip) }); } catch (e) { next(e); } }
export async function addVersion(req: Request, res: Response, next: NextFunction) { try { res.status(201).json({ success: true, data: await svc.addVersion(req.user!.companyId, req.user!.id, req.params.id, req.body, req.ip) }); } catch (e) { next(e); } }
