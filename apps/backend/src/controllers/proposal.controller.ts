/**
 * BuildFlow - Proposal controller.
 */
import { NextFunction, Request, Response } from 'express';
import * as proposalService from '../services/proposal.service';
import { ok, okList, created, buildMeta } from '../utils/response';

function ipOf(req: Request): string | undefined {
  const xfwd = req.headers['x-forwarded-for'];
  if (typeof xfwd === 'string') return xfwd.split(',')[0]!.trim();
  return req.ip;
}

export async function listProposals(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await proposalService.listProposals(req.user!.companyId, req.query as never);
    okList(res, result.rows, buildMeta(result.page, result.limit, result.total));
  } catch (err) {
    next(err);
  }
}

export async function getProposal(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await proposalService.getProposal(req.user!.companyId, req.params.id);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

export async function createProposal(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const data = await proposalService.createProposal(companyId, userId, req.body, ipOf(req));
    created(res, data);
  } catch (err) {
    next(err);
  }
}

export async function updateProposal(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const data = await proposalService.updateProposal(
      companyId,
      userId,
      req.params.id,
      req.body,
      ipOf(req),
    );
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

export async function promoteProposal(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId, role } = req.user!;
    const data = await proposalService.promoteProposal(
      companyId,
      userId,
      role,
      req.params.id,
      req.body,
      ipOf(req),
    );
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

export async function deleteProposal(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId, role } = req.user!;
    await proposalService.deleteProposal(companyId, userId, role, req.params.id, ipOf(req));
    ok(res, { success: true });
  } catch (err) {
    next(err);
  }
}
