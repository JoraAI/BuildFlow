/**
 * BuildFlow — Redis client (ioredis) for rate limiting, token blacklist, caching.
 *
 * Key prefix: buildflow:{feature}:{key}  (company_id added by callers where relevant)
 */
import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../config/logger';

const globalForRedis = globalThis as unknown as { __redis?: Redis; __redisSub?: Redis };

function createClient(): Redis {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
    keyPrefix: 'buildflow:',
  });

  client.on('error', (err) => {
    logger.error('Redis error', { error: err.message });
  });
  client.on('connect', () => {
    logger.info('Redis connected', { url: env.REDIS_URL });
  });

  return client;
}

export const redis: Redis = globalForRedis.__redis ?? createClient();
if (process.env.NODE_ENV !== 'production') {
  globalForRedis.__redis = redis;
}

/* ------------------------------------------------------------------ */
/* Token blacklist helpers (refresh tokens on logout)                  */
/* ------------------------------------------------------------------ */

const BLACKLIST_PREFIX = 'auth:blacklist:';

export async function blacklistToken(tokenId: string, ttlSeconds: number): Promise<void> {
  await redis.set(`${BLACKLIST_PREFIX}${tokenId}`, '1', 'EX', ttlSeconds);
}

export async function isTokenBlacklisted(tokenId: string): Promise<boolean> {
  const v = await redis.get(`${BLACKLIST_PREFIX}${tokenId}`);
  return v === '1';
}

/* ------------------------------------------------------------------ */
/* Generic cache helpers                                               */
/* ------------------------------------------------------------------ */

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

export async function cacheInvalidate(key: string): Promise<void> {
  await redis.del(key);
}

export async function disconnectRedis(): Promise<void> {
  try {
    await redis.quit();
  } catch (err) {
    logger.error('Redis disconnect failed', { error: String(err) });
  }
}