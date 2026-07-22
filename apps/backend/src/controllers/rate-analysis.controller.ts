/**
 * BuildFlow - Rate Analysis controller (thin).
 */
import { Request, Response } from 'express';
import * as svc from '../services/rate-analysis.service';
import { ok, okList, created } from '../utils/response';

export async function list(req: Request, res: Response) {
  const data = await svc.listRateAnalyses(req.user!.companyId, req.query as never);
  okList(res, data.rows, {
    page: data.page,
    limit: data.limit,
    total: data.total,
    totalPages: Math.ceil(data.total / data.limit),
  });
}

export async function get(req: Request, res: Response) {
  const data = await svc.getRateAnalysis(req.user!.companyId, req.params.id);
  ok(res, data);
}

export async function create(req: Request, res: Response) {
  const data = await svc.createRateAnalysis(
    req.user!.companyId,
    req.user!.id,
    req.body,
    req.ip,
  );
  created(res, data);
}

export async function update(req: Request, res: Response) {
  const data = await svc.updateRateAnalysis(
    req.user!.companyId,
    req.user!.id,
    req.params.id,
    req.body,
    req.ip,
  );
  ok(res, data);
}

export async function remove(req: Request, res: Response) {
  const force = req.query.force === 'true';
  await svc.deleteRateAnalysis(req.user!.companyId, req.user!.id, req.params.id, req.ip, force);
  ok(res, { id: req.params.id });
}

export async function duplicate(req: Request, res: Response) {
  const data = await svc.duplicateRateAnalysis(
    req.user!.companyId,
    req.user!.id,
    req.params.id,
    req.ip,
  );
  created(res, data);
}
