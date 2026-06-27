/**
 * BuildFlow — Project controller (thin request handlers).
 */
import { NextFunction, Request, Response } from 'express';
import * as projectService from '../services/project.service';
import { ok, okList, created, buildMeta } from '../utils/response';

function ipOf(req: Request): string | undefined {
  const xfwd = req.headers['x-forwarded-for'];
  if (typeof xfwd === 'string') return xfwd.split(',')[0]!.trim();
  return req.ip;
}

/* ---------------- Projects ---------------- */

export async function listProjects(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId } = req.user!;
    const result = await projectService.listProjects(companyId, req.query as never);
    okList(res, result.rows, buildMeta(result.page, result.limit, result.total));
  } catch (err) {
    next(err);
  }
}

export async function getProject(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectService.getProject(req.user!.companyId, req.params.id);
    ok(res, project);
  } catch (err) {
    next(err);
  }
}

export async function createProject(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const project = await projectService.createProject(companyId, userId, req.body, ipOf(req));
    created(res, project);
  } catch (err) {
    next(err);
  }
}

export async function updateProject(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const project = await projectService.updateProject(companyId, userId, req.params.id, req.body, ipOf(req));
    ok(res, project);
  } catch (err) {
    next(err);
  }
}

export async function deleteProject(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId, role } = req.user!;
    await projectService.deleteProject(companyId, userId, role, req.params.id, ipOf(req));
    ok(res, { success: true });
  } catch (err) {
    next(err);
  }
}

export async function getProjectSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await projectService.getProjectSummary(req.user!.companyId, req.params.id);
    ok(res, stats);
  } catch (err) {
    next(err);
  }
}

/* ---------------- WBS ---------------- */

export async function getWbsTree(req: Request, res: Response, next: NextFunction) {
  try {
    const tree = await projectService.getWbsTree(req.user!.companyId, req.params.id);
    ok(res, tree);
  } catch (err) {
    next(err);
  }
}

export async function createWbsItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const item = await projectService.createWbsItem(companyId, userId, req.params.id, req.body, ipOf(req));
    created(res, item);
  } catch (err) {
    next(err);
  }
}

export async function updateWbsItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const item = await projectService.updateWbsItem(
      companyId,
      userId,
      req.params.id,
      req.params.itemId,
      req.body,
      ipOf(req),
    );
    ok(res, item);
  } catch (err) {
    next(err);
  }
}

export async function deleteWbsItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    await projectService.deleteWbsItem(companyId, userId, req.params.id, req.params.itemId, ipOf(req));
    ok(res, { success: true });
  } catch (err) {
    next(err);
  }
}