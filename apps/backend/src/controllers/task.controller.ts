/**
 * BuildFlow — Task controller (thin request handlers).
 */
import { NextFunction, Request, Response } from 'express';
import * as taskService from '../services/task.service';
import { ok, created } from '../utils/response';

function ipOf(req: Request): string | undefined {
  const xfwd = req.headers['x-forwarded-for'];
  if (typeof xfwd === 'string') return xfwd.split(',')[0]!.trim();
  return req.ip;
}

export async function listTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const tasks = await taskService.listTasks(req.user!.companyId, req.params.id);
    ok(res, tasks);
  } catch (err) {
    next(err);
  }
}

export async function createTask(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const task = await taskService.createTask(companyId, userId, req.params.id, req.body, ipOf(req));
    created(res, task);
  } catch (err) {
    next(err);
  }
}

export async function updateTask(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const task = await taskService.updateTask(companyId, userId, req.params.id, req.body, ipOf(req));
    ok(res, task);
  } catch (err) {
    next(err);
  }
}

export async function updateTaskProgress(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const task = await taskService.updateTaskProgress(
      companyId,
      userId,
      req.params.id,
      req.body.progressPct,
      ipOf(req),
    );
    ok(res, task);
  } catch (err) {
    next(err);
  }
}

export async function deleteTask(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    await taskService.deleteTask(companyId, userId, req.params.id, ipOf(req));
    ok(res, { success: true });
  } catch (err) {
    next(err);
  }
}

export async function getGantt(req: Request, res: Response, next: NextFunction) {
  try {
    const gantt = await taskService.getGantt(req.user!.companyId, req.params.id);
    ok(res, gantt);
  } catch (err) {
    next(err);
  }
}

export async function getCriticalPath(req: Request, res: Response, next: NextFunction) {
  try {
    const cp = await taskService.getCriticalPath(req.user!.companyId, req.params.id);
    ok(res, cp);
  } catch (err) {
    next(err);
  }
}

export async function addTaskResource(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const tr = await taskService.addTaskResource(companyId, userId, req.params.id, req.body, ipOf(req));
    created(res, tr);
  } catch (err) {
    next(err);
  }
}

export async function removeTaskResource(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    await taskService.removeTaskResource(companyId, userId, req.params.id, req.params.rid, ipOf(req));
    ok(res, { success: true });
  } catch (err) {
    next(err);
  }
}