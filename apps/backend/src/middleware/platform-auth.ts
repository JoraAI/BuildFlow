/**
 * Platform admin auth middleware — separate from tenant JWT.
 */
import { NextFunction, Request, Response } from 'express';
import { verifyPlatformAccessToken } from '../utils/jwt';
import { isTokenBlacklisted } from '../lib/redis';
import { ApiError } from '../utils/errors';

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

export async function authenticatePlatformAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractBearerToken(req);
    if (!token) throw ApiError.unauthorized('Missing authorization token');

    let decoded;
    try {
      decoded = verifyPlatformAccessToken(token);
    } catch {
      throw ApiError.unauthorized('Invalid or expired token');
    }

    if (await isTokenBlacklisted(decoded.tid)) {
      throw ApiError.unauthorized('Token has been revoked');
    }

    req.platformAdmin = { id: decoded.sub, tokenId: decoded.tid };
    next();
  } catch (err) {
    next(err instanceof ApiError ? err : ApiError.unauthorized());
  }
}
