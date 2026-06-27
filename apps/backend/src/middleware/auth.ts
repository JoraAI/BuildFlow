/**
 * BuildFlow — Auth middleware: authenticateToken + requireRole.
 *
 * authenticateToken:
 *   - Reads Bearer token from Authorization header
 *   - Verifies access JWT, checks blacklist, attaches req.user
 *   - Sets company ALS context for Prisma auto-scoping
 *
 * requireRole(...roles):
 *   - Role guard; must run AFTER authenticateToken
 */
import { NextFunction, Request, Response } from 'express';
import type { Role } from '@buildflow/shared';
import { verifyAccessToken } from '../utils/jwt';
import { isTokenBlacklisted } from '../lib/redis';
import { companyALS } from '../lib/als';
import { ApiError } from '../utils/errors';
import { logger } from '../config/logger';

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

export async function authenticateToken(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractBearerToken(req);
    if (!token) throw ApiError.unauthorized('Missing authorization token');

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      throw ApiError.unauthorized('Invalid or expired token');
    }

    if (decoded.type !== 'access') {
      throw ApiError.unauthorized('Wrong token type');
    }

    if (await isTokenBlacklisted(decoded.tid)) {
      throw ApiError.unauthorized('Token has been revoked');
    }

    // Attach to req and run downstream within company ALS context.
    req.user = {
      id: decoded.sub,
      companyId: decoded.companyId,
      role: decoded.role as Role,
      tokenId: decoded.tid,
    } as Express.Request['user'];

    companyALS.run({ companyId: decoded.companyId, userId: decoded.sub }, () => next());
  } catch (err) {
    next(err instanceof ApiError ? err : ApiError.unauthorized());
  }
}

/** Optional auth: attaches req.user if a valid token is present, but never 401s. */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) return next();
  try {
    const decoded = verifyAccessToken(token);
    if (!(await isTokenBlacklisted(decoded.tid))) {
      req.user = {
        id: decoded.sub,
        companyId: decoded.companyId,
        role: decoded.role as Role,
        tokenId: decoded.tid,
      } as Express.Request['user'];
      return companyALS.run({ companyId: decoded.companyId, userId: decoded.sub }, () => next());
    }
  } catch (err) {
    logger.debug('optionalAuth: invalid token ignored', { error: String(err) });
  }
  next();
}

/**
 * Role guard. Usage: router.post('/', authenticateToken, requireRole('OWNER', 'PM'), handler)
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`This action requires one of: ${roles.join(', ')}`));
    }
    next();
  };
}