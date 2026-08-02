import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/rfi-submittal.service';
// RFI
export async function listRfis(req: Request, res: Response, next: NextFunction) { try { const r = await svc.listRfis(req.user!.companyId, req.query as never); res.json({ success: true, data: r.rows, meta: { page: r.page, total: r.total } }); } catch (e) { next(e); } }
export async function getRfi(req: Request, res: Response, next: NextFunction) { try { res.json({ success: true, data: await svc.getRfi(req.user!.companyId, req.params.id) }); } catch (e) { next(e); } }
export async function createRfi(req: Request, res: Response, next: NextFunction) { try { res.status(201).json({ success: true, data: await svc.createRfi(req.user!.companyId, req.user!.id, req.body, req.ip) }); } catch (e) { next(e); } }
export async function updateRfi(req: Request, res: Response, next: NextFunction) { try { res.json({ success: true, data: await svc.updateRfi(req.user!.companyId, req.user!.id, req.params.id, req.body, req.ip) }); } catch (e) { next(e); } }
export async function answerRfi(req: Request, res: Response, next: NextFunction) { try { res.json({ success: true, data: await svc.answerRfi(req.user!.companyId, req.user!.id, req.params.id, req.body.answer, req.ip) }); } catch (e) { next(e); } }
// Submittal
export async function listSubmittals(req: Request, res: Response, next: NextFunction) { try { const r = await svc.listSubmittals(req.user!.companyId, req.query as never); res.json({ success: true, data: r.rows, meta: { page: r.page, total: r.total } }); } catch (e) { next(e); } }
export async function getSubmittal(req: Request, res: Response, next: NextFunction) { try { res.json({ success: true, data: await svc.getSubmittal(req.user!.companyId, req.params.id) }); } catch (e) { next(e); } }
export async function createSubmittal(req: Request, res: Response, next: NextFunction) { try { res.status(201).json({ success: true, data: await svc.createSubmittal(req.user!.companyId, req.user!.id, req.body, req.ip) }); } catch (e) { next(e); } }
export async function updateSubmittal(req: Request, res: Response, next: NextFunction) { try { res.json({ success: true, data: await svc.updateSubmittal(req.user!.companyId, req.user!.id, req.params.id, req.body, req.ip) }); } catch (e) { next(e); } }
export async function reviewSubmittal(req: Request, res: Response, next: NextFunction) { try { res.json({ success: true, data: await svc.reviewSubmittal(req.user!.companyId, req.user!.id, req.params.id, req.body.status, req.body.reviewNotes, req.ip) }); } catch (e) { next(e); } }
