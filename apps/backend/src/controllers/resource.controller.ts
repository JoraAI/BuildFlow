/**
 * BuildFlow — Resource controller (thin request handlers).
 */
import { NextFunction, Request, Response } from 'express';
import * as resourceService from '../services/resource.service';
import { ok, okList, created, buildMeta } from '../utils/response';

function ipOf(req: Request): string | undefined {
  const xfwd = req.headers['x-forwarded-for'];
  if (typeof xfwd === 'string') return xfwd.split(',')[0]!.trim();
  return req.ip;
}

export async function listResources(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await resourceService.listResources(req.user!.companyId, req.query as never);
    okList(res, result.rows, buildMeta(result.page, result.limit, result.total));
  } catch (err) {
    next(err);
  }
}

export async function getResource(req: Request, res: Response, next: NextFunction) {
  try {
    const resource = await resourceService.getResource(req.user!.companyId, req.params.id);
    ok(res, resource);
  } catch (err) {
    next(err);
  }
}

export async function createResource(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const resource = await resourceService.createResource(companyId, userId, req.body, ipOf(req));
    created(res, resource);
  } catch (err) {
    next(err);
  }
}

export async function updateResource(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const resource = await resourceService.updateResource(companyId, userId, req.params.id, req.body, ipOf(req));
    ok(res, resource);
  } catch (err) {
    next(err);
  }
}

export async function deleteResource(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    await resourceService.deleteResource(companyId, userId, req.params.id, ipOf(req));
    ok(res, { success: true });
  } catch (err) {
    next(err);
  }
}

export async function getPriceHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const history = await resourceService.getPriceHistory(req.user!.companyId, req.params.id);
    ok(res, history);
  } catch (err) {
    next(err);
  }
}

export async function addPriceHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const entry = await resourceService.addPriceHistory(companyId, userId, req.params.id, req.body, ipOf(req));
    created(res, entry);
  } catch (err) {
    next(err);
  }
}

export async function importResources(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const result = await resourceService.importResources(companyId, userId, req.body, ipOf(req));
    ok(res, result);
  } catch (err) {
    next(err);
  }
}