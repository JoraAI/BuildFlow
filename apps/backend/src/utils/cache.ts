/**
 * BuildFlow — Redis cache wrapper with graceful degradation.
 *
 * If Redis is unavailable or errors, all operations fail open (reads return
 * null, writes/invalidations are swallowed) so the API keeps serving.
 *
 * Conventions:
 *  - Keys MUST include companyId for tenant isolation: `cache:{company_id}:{feature}:{key}`
 *  - TTLs chosen per data volatility (see offline-first spec: resources 1h, rate analysis 1h,
 *    project summary 2min, dashboard 5min).
 */
import { cacheGet, cacheSet, cacheInvalidate } from '../lib/redis';
import { logger } from '../config/logger';

/**
 * Wrap a data-fetching function with a Redis cache layer.
 *
 * @param key  Stable cache key (already namespaced + parameterized).
 * @param ttlSeconds  Time-to-live.
 * @param loader  Called only on cache miss.
 * @returns Cached or freshly-loaded value.
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  // Try cache read
  try {
    const cached = await cacheGet<T>(key);
    if (cached !== null) return cached;
  } catch (err) {
    logger.warn('Cache read failed, serving from DB', { key, error: (err as Error).message });
  }

  // Cache miss -> load
  const value = await loader();

  // Write back (fire-and-forget style but awaited to keep ordering simple)
  try {
    await cacheSet(key, value, ttlSeconds);
  } catch (err) {
    logger.warn('Cache write failed', { key, error: (err as Error).message });
  }

  return value;
}

/**
 * Invalidate one or more cache keys. Swallows errors so mutation paths
 * never fail because of cache issues.
 */
export async function invalidateCache(...keys: string[]): Promise<void> {
  try {
    await Promise.all(keys.map((k) => cacheInvalidate(k)));
  } catch (err) {
    logger.warn('Cache invalidation failed', { keys, error: (err as Error).message });
  }
}

/**
 * Invalidate by pattern using Redis SCAN + DEL. Use sparingly (e.g. bulk import).
 * Matches keys with the given glob pattern (without the global keyPrefix).
 */
export async function invalidatePattern(pattern: string): Promise<void> {
  try {
    // Lazy import to avoid circular deps in test env
    const { redis } = await import('../lib/redis');
    const stream = redis.scanStream({ match: pattern, count: 100 });
    const keys: string[] = [];
    for await (const chunk of stream) {
      keys.push(...(chunk as string[]));
    }
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    logger.warn('Cache pattern invalidation failed', { pattern, error: (err as Error).message });
  }
}

/* ------------------------------------------------------------------ */
/* Key builders (centralized to avoid typos)                           */
/* ------------------------------------------------------------------ */
export const cacheKeys = {
  /** Resources list. Includes all filter params for correctness. */
  resourcesList: (companyId: string, queryHash: string) =>
    `cache:${companyId}:resources:list:${queryHash}`,
  resource: (companyId: string, id: string) => `cache:${companyId}:resources:item:${id}`,
  /** Rate analysis library list. */
  rateAnalysisList: (companyId: string, queryHash: string) =>
    `cache:${companyId}:rate-analysis:list:${queryHash}`,
  rateAnalysis: (companyId: string, id: string) =>
    `cache:${companyId}:rate-analysis:item:${id}`,
  /** Project summary (computed stats). */
  projectSummary: (companyId: string, projectId: string) =>
    `cache:${companyId}:project:summary:${projectId}`,
  /** Owner analytics dashboard. */
  dashboard: (companyId: string) => `cache:${companyId}:dashboard`,
  /** Company profile (settings). */
  companyProfile: (companyId: string) => `cache:${companyId}:company:profile`,
};

/**
 * Hash a plain object into a short stable string for cache key suffixes.
 * Uses JSON.stringify with sorted keys for determinism.
 */
export function hashQuery(obj: unknown): string {
  const str = JSON.stringify(obj, Object.keys(obj as object).sort());
  // Simple FNV-1a 32-bit hash -> base36
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}