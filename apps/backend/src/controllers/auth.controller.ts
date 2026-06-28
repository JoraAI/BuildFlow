/**
 * BuildFlow — Auth controller (thin request handlers).
 */
import { NextFunction, Request, Response } from 'express';
import * as authService from '../services/auth.service';
import * as inviteService from '../services/invite.service';
import { ok } from '../utils/response';
import { env } from '../config/env';

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

export async function config(_req: Request, res: Response): Promise<void> {
  ok(res, { allowPublicCompanyRegistration: env.ALLOW_PUBLIC_COMPANY_REGISTRATION });
}

export async function getInvitePreview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const preview = await inviteService.getInvitePreview(req.params.token);
    ok(res, preview);
  } catch (err) {
    next(err);
  }
}

export async function acceptInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await inviteService.acceptInvite(req.body, ipOf(req));
    ok(res, result, 201);
  } catch (err) {
    next(err);
  }
}