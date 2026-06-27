/**
 * BuildFlow — Financial reports controller.
 */
import { Request, Response } from 'express';
import * as svc from '../services/financial-report.service';
import * as tallySvc from '../services/tally.service';
import { ok } from '../utils/response';

export async function getProfitLoss(req: Request, res: Response) {
  const { id: projectId } = req.params;
  const data = await svc.getProfitLoss(req.user!.companyId, projectId);
  return ok(res, data);
}

export async function getCashFlow(req: Request, res: Response) {
  const { id: projectId } = req.params;
  const data = await svc.getCashFlow(req.user!.companyId, projectId);
  return ok(res, data);
}

export async function getEstimateVsActual(req: Request, res: Response) {
  const { id: projectId } = req.params;
  const data = await svc.getEstimateVsActual(req.user!.companyId, projectId);
  return ok(res, data);
}

export async function getCompanyDashboard(req: Request, res: Response) {
  const data = await svc.getCompanyDashboard(req.user!.companyId);
  return ok(res, data);
}

export async function getGstReport(req: Request, res: Response) {
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const data = await svc.getGstReport(req.user!.companyId, from, to);
  return ok(res, data);
}

export async function getTdsReport(req: Request, res: Response) {
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const data = await svc.getTdsReport(req.user!.companyId, from, to);
  return ok(res, data);
}

export async function exportProjectTally(req: Request, res: Response) {
  const { id: projectId } = req.params;
  const xml = await tallySvc.exportProjectTallyXML(req.user!.companyId, projectId);
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', `attachment; filename="tally-${projectId}.xml"`);
  return res.status(200).send(xml);
}