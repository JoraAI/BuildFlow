/**
 * BuildFlow MCP Server - Redis client for token blacklist checks.
 *
 * Shares the same Redis instance + key prefix as the backend so that tokens
 * revoked via logout (blacklisted in the backend) are immediately rejected
 * by the MCP server too.
 */
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const BLACKLIST_PREFIX = 'buildflow:auth:blacklist:';

const globalForRedis = globalThis as unknown as { __mcpRedis?: Redis };

function createClient(): Redis {
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });
}

export const redis: Redis = globalForRedis.__mcpRedis ?? createClient();
if (process.env.NODE_ENV !== 'production') {
  globalForRedis.__mcpRedis = redis;
}

/**
 * Check whether a token id (jti) has been blacklisted via logout.
 * Returns false if Redis is unreachable (fail-open for availability of the
 * MCP server - the token signature + type check in identity.ts still apply).
 */
export async function isTokenBlacklisted(tokenId: string): Promise<boolean> {
  try {
    const v = await redis.get(`${BLACKLIST_PREFIX}${tokenId}`);
    return v === '1';
  } catch {
    // Redis unreachable - fail open for MCP availability. The access token
    // is still signature-verified, type-checked, and expiry-enforced.
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  try {
    await redis.quit();
  } catch {
    // ignore
  }
}