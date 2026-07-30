/**
 * BuildFlow - Rate limiting middleware.
 *
 * Two presets:
 *   - authLimiter:  10 req / 15 min per IP  (login, register, forgot-password)
 *   - apiLimiter:   200 req / min per user (or IP if unauthenticated)
 *
 * Backed by Redis (sliding window via INCR + EXPIRE).
 *
 * FIX (SEC-H3): Removed manual X-Forwarded-For parsing — Express's `req.ip`
 * respects `app.set('trust proxy')` and is the correct, non-spoofable source.
 * FIX (SEC-H4): The auth limiter now FAILS CLOSED when Redis is unreachable
 * (returns 503), preventing brute-force when Redis is down. The general API
 * limiter still fails open for availability.
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
  /** If true, reject the request (503) when Redis is unavailable. */
  failClosed?: boolean;
}

/**
 * FIX (SEC-H3): Use Express's `req.ip` directly — it respects the configured
 * `trust proxy` setting and is the safe, non-spoofable source. Previously this
 * read `X-Forwarded-For` directly, allowing an attacker to rotate IPs per
 * request to bypass brute-force limits.
 */
function ipOf(req: Request): string {
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
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
      if (opts.failClosed) {
        // FIX (SEC-H4): auth limiter FAILS CLOSED — Redis down must not
        // disable brute-force protection on login/register/forgot-password.
        return next(
          ApiError.rateLimited(
            'Rate limiting service unavailable. Please try again shortly.',
          ),
        );
      }
      // General API limiter: fail open for availability.
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
  failClosed: true, // FIX (SEC-H4): auth endpoints must fail closed.
});

export const apiLimiter = rateLimiter({
  max: env.RATE_LIMIT_API_MAX,
  windowMs: env.RATE_LIMIT_API_WINDOW_MS,
  keyPrefix: 'rl:api',
});