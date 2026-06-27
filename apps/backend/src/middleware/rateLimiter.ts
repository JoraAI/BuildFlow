/**
 * BuildFlow — Rate limiting middleware.
 *
 * Two presets:
 *   - authLimiter:  10 req / 15 min per IP  (login, register, forgot-password)
 *   - apiLimiter:   200 req / min per user (or IP if unauthenticated)
 *
 * Backed by Redis (sliding window via INCR + EXPIRE).
 */
import { NextFunction, Request, Response } from 'express';
import { redis } from '../lib/redis';
import { env } from '../config/env';
import { ApiError } from '../utils/errors';

interface LimiterOptions {
  max: number;
  windowMs: number;
  keyPrefix: string;
  /** Build a discriminator from the request (default: user id OR ip). */
  keyFn?: (req: Request) => string;
}

function ipOf(req: Request): string {
  const xfwd = req.headers['x-forwarded-for'];
  if (typeof xfwd === 'string') return xfwd.split(',')[0]!.trim();
  return req.ip ?? 'unknown';
}

export function rateLimiter(opts: LimiterOptions) {
  const windowSec = Math.ceil(opts.windowMs / 1000);
  const keyFn =
    opts.keyFn ?? ((req: Request) => req.user?.id ?? `ip:${ipOf(req)}`);

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // Skip rate limiting in test environment (no Redis dependency).
    if (env.NODE_ENV === 'test') {
      next();
      return;
    }
    try {
      const key = `${opts.keyPrefix}:${keyFn(req)}`;
      const current = await redis.incr(key);

      if (current === 1) {
        await redis.expire(key, windowSec);
      }

      if (current > opts.max) {
        const retryAfter = await redis.ttl(key);
        _res.setHeader('Retry-After', String(retryAfter));
        return next(
          ApiError.rateLimited('Too many requests. Please try again later.'),
        );
      }
      next();
    } catch (err) {
      // If Redis is down, fail open (allow request) but log.
      next();
      // eslint-disable-next-line no-console
      console.warn('[rateLimiter] Redis error, failing open:', String(err));
    }
  };
}

export const authLimiter = rateLimiter({
  max: env.RATE_LIMIT_AUTH_MAX,
  windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
  keyPrefix: 'rl:auth',
  keyFn: (req) => `ip:${ipOf(req)}`,
});

export const apiLimiter = rateLimiter({
  max: env.RATE_LIMIT_API_MAX,
  windowMs: env.RATE_LIMIT_API_WINDOW_MS,
  keyPrefix: 'rl:api',
});