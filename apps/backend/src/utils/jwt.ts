/**
 * BuildFlow — JWT helpers (access + refresh tokens).
 *
 * Payload always includes { sub, companyId, role, tid } where `tid` is a unique
 * token id (jti) used for blacklisting on logout.
 */
import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';

export interface TokenPayload {
  sub: string; // user id
  companyId: string;
  role: string;
  tid: string; // token id (jti) for blacklisting
  type: 'access' | 'refresh';
}

export interface DecodedToken extends Omit<JwtPayload, 'sub'>, TokenPayload {}

export function signAccessToken(payload: Omit<TokenPayload, 'tid' | 'type'>): string {
  const tid = uuidv4();
  return jwt.sign({ ...payload, tid, type: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as SignOptions);
}

export function signRefreshToken(payload: Omit<TokenPayload, 'tid' | 'type'>): string {
  const tid = uuidv4();
  return jwt.sign({ ...payload, tid, type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as SignOptions);
}

export function verifyAccessToken(token: string): DecodedToken {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as DecodedToken;
}

export function verifyRefreshToken(token: string): DecodedToken {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as DecodedToken;
}

/** Decode expiry (seconds) from a jwt without verifying — for blacklist TTL. */
export function getTokenTtlSeconds(token: string): number {
  const decoded = jwt.decode(token) as JwtPayload | null;
  if (!decoded?.exp) return 0;
  return Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
}