/**
 * BuildFlow - Auth controller (thin request handlers).
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

const REFRESH_COOKIE_NAME = 'bf_refresh_token';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

function isWebRequest(req: Request): boolean {
  return req.headers['user-agent']?.includes('Mozilla') || req.headers['x-buildflow-platform'] === 'web';
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: REFRESH_COOKIE_MAX_AGE,
    path: '/api/auth',
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.login(req.body, ipOf(req));
    // FIX (MOB-H6): On web, store refresh token in httpOnly cookie (not
    // localStorage) to prevent XSS token theft. Native still gets it in the
    // response body (stored in SecureStore).
    if (isWebRequest(req) && result.refreshToken) {
      setRefreshCookie(res, result.refreshToken);
      // Don't expose refreshToken in the response body for web
      ok(res, { ...result, refreshToken: undefined });
    } else {
      ok(res, result);
    }
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // FIX (MOB-H6): Read refresh token from httpOnly cookie (web) or body (native).
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] ?? req.body?.refreshToken;
    if (!refreshToken) {
      res.status(401).json({ success: false, error: { code: 'NO_REFRESH_TOKEN', message: 'No refresh token provided' } });
      return;
    }
    const tokens = await authService.refresh(refreshToken);
    // Rotate the cookie if web
    if (isWebRequest(req) && tokens.refreshToken) {
      setRefreshCookie(res, tokens.refreshToken);
      ok(res, { ...tokens, refreshToken: undefined });
    } else {
      ok(res, tokens);
    }
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // FIX (MOB-H6): Read from cookie (web) or body (native), then clear cookie.
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] ?? req.body?.refreshToken;
    await authService.logout(refreshToken);
    clearRefreshCookie(res);
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