/**
 * BuildFlow - JWT helpers (access + refresh tokens).
 *
 * Payload always includes { sub, companyId, role, tid } where `tid` is a unique
 * token id (jti) used for blacklisting on logout.
 */
import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';

export interface TokenPayload {
  sub: string; // user id or platform admin id
  companyId?: string;
  role?: string;
  tid: string; // token id (jti) for blacklisting
  type: 'access' | 'refresh' | 'platform_access';
}

export interface DecodedToken extends Omit<JwtPayload, 'sub'>, TokenPayload {}

export function signAccessToken(payload: Omit<TokenPayload, 'tid' | 'type'> & { companyId: string; role: string }): string {
  const tid = uuidv4();
  return jwt.sign({ ...payload, tid, type: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as SignOptions);
}

export function signPlatformAccessToken(payload: { sub: string }): string {
  const tid = uuidv4();
  return jwt.sign({ sub: payload.sub, tid, type: 'platform_access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as SignOptions);
}

export function signRefreshToken(payload: Omit<TokenPayload, 'tid' | 'type'> & { companyId: string; role: string }): string {
  const tid = uuidv4();
  return jwt.sign({ ...payload, tid, type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as SignOptions);
}

export function expiresInSeconds(value: string, fallback = 15 * 60): number {
  const m = value.trim().match(/^(\d+)\s*([smhd])$/i);
  if (!m) return fallback;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === 's') return n;
  if (unit === 'm') return n * 60;
  if (unit === 'h') return n * 3600;
  if (unit === 'd') return n * 86400;
  return fallback;
}

export function verifyAccessToken(token: string): DecodedToken {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as DecodedToken;
}

export function verifyRefreshToken(token: string): DecodedToken {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as DecodedToken;
}

export function verifyPlatformAccessToken(token: string): DecodedToken {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as DecodedToken;
  if (decoded.type !== 'platform_access') {
    throw new Error('Wrong token type');
  }
  return decoded;
}

/** Decode expiry (seconds) from a jwt without verifying - for blacklist TTL. */
export function getTokenTtlSeconds(token: string): number {
  const decoded = jwt.decode(token) as JwtPayload | null;
  if (!decoded?.exp) return 0;
  return Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
}