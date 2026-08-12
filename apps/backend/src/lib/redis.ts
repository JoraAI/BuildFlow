/**
 * BuildFlow - Redis client (ioredis) for rate limiting, token blacklist, caching.
 *
 * Key prefix: buildflow:{feature}:{key}  (company_id added by callers where relevant)
 */
import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../config/logger';

const globalForRedis = globalThis as unknown as { __redis?: Redis; __redisSub?: Redis };

/** Mask password in logs. */
function redactRedisUrl(url: string): string {
  return url.replace(/:([^:@/]+)@/, ':***@');
}

/**
 * Upstash requires TLS. Users often paste `redis://` from `redis-cli --tls -u`;
 * auto-upgrade to rediss:// for *.upstash.io hosts.
 */
function resolveRedisConnection(rawUrl: string): { url: string; tls?: Record<string, never> } {
  let url = rawUrl.trim();
  if (/\.upstash\.io/i.test(url) && url.startsWith('redis://')) {
    url = `rediss://${url.slice('redis://'.length)}`;
    logger.warn('Upstash host detected - use rediss:// in REDIS_URL (TLS required)');
  }
  return { url, tls: url.startsWith('rediss://') ? {} : undefined };
}

function createClient(): Redis {
  const { url, tls } = resolveRedisConnection(env.REDIS_URL);
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
    keyPrefix: 'buildflow:',
    ...(tls ? { tls } : {}),
  });

  client.on('error', (err) => {
    logger.error('Redis error', { error: err.message });
  });
  client.on('connect', () => {
    logger.info('Redis connected', { url: redactRedisUrl(url) });
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
    redis.removeAllListeners();
    // Force-close - quit() hangs when TLS/upstream commands are failing (seed exit).
    redis.disconnect(false);
  } catch (err) {
    logger.error('Redis disconnect failed', { error: String(err) });
  }
}