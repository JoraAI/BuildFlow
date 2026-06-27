/**
 * BuildFlow — Auth controller (thin request handlers).
 */
import { NextFunction, Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { ok } from '../utils/response';

function ipOf(req: Request): string | undefined {
  const xfwd = req.headers['x-forwarded-for'];
  if (typeof xfwd === 'string') return xfwd.split(',')[0]!.trim();
  return req.ip;
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.registerCompany(req.body, ipOf(req));
    ok(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.login(req.body, ipOf(req));
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tokens = await authService.refresh(req.body.refreshToken);
    ok(res, tokens);
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.logout(req.body?.refreshToken);
    ok(res, { success: true });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.me(req.user!.id);
    ok(res, user);
  } catch (err) {
    next(err);
  }
}