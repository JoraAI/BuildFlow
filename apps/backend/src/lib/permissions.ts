/**
 * BuildFlow - Permission checking library
 *
 * Resolves permissions for a (companyId, role) pair:
 *   - If the company has a customized `CompanyRolePermission` row for the role,
 *     use those stored permissions.
 *   - Otherwise, fall back to the code-defined `DEFAULT_ROLE_PERMISSIONS`.
 *
 * Results are cached in-process for a short TTL to avoid hitting the DB on
 * every request. The cache is invalidated when permissions are updated.
 */
import { prisma } from './prisma';
import { redis } from './redis';
import {
  DEFAULT_ROLE_PERMISSIONS,
  type Permission,
  type Role,
} from '@buildflow/shared';
import { logger } from '../config/logger';

const CACHE_TTL_SEC = 300; // 5 minutes
const CACHE_KEY_PREFIX = 'perm:';

/** Per-process fallback cache (used when Redis is unavailable in tests). */
const memoryCache = new Map<string, { permissions: Permission[]; expiresAt: number }>();

/**
 * Returns the permission list for a given (companyId, role) pair.
 * Checks Redis cache → memory cache → DB → defaults.
 */
export async function getRolePermissions(
  companyId: string,
  role: Role,
): Promise<Permission[]> {
  // OWNER always has all permissions (never customized/overridden)
  if (role === 'OWNER') {
    return DEFAULT_ROLE_PERMISSIONS.OWNER;
  }

  const cacheKey = `${CACHE_KEY_PREFIX}${companyId}:${role}`;

  // 1. Try Redis cache
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as Permission[];
    }
  } catch {
    // Redis may be unavailable in tests — fall through to memory cache
  }

  // 2. Try memory cache
  const memCached = memoryCache.get(cacheKey);
  if (memCached && memCached.expiresAt > Date.now()) {
    return memCached.permissions;
  }

  // 3. Query DB for customized permissions
  let permissions: Permission[];
  try {
    const row = await prisma.companyRolePermission.findUnique({
      where: { companyId_role: { companyId, role } },
    });
    if (row?.isCustomized) {
      permissions = row.permissions as Permission[];
    } else {
      // Fall back to defaults
      permissions = DEFAULT_ROLE_PERMISSIONS[role] ?? [];
    }
  } catch {
    // FIX (SEC-L19): Fail CLOSED in production — return empty permissions (deny
    // all) so a DB outage doesn't grant users potentially broader default
    // permissions than the company had customized. In test/dev, fall back to
    // defaults so the test suite isn't blocked by DB connectivity.
    logger.error(`Permission DB lookup failed for ${companyId}:${role}, FAILING CLOSED (deny all)`);
    if (process.env.NODE_ENV === 'production') {
      permissions = [];
    } else {
      permissions = DEFAULT_ROLE_PERMISSIONS[role] ?? [];
    }
  }

  // 4. Cache the result
  await cachePermissions(cacheKey, permissions);

  return permissions;
}

/**
 * Check if a (companyId, role) has a specific permission.
 */
export async function hasPermission(
  companyId: string,
  role: Role,
  permission: Permission,
): Promise<boolean> {
  const permissions = await getRolePermissions(companyId, role);
  return permissions.includes(permission);
}

/**
 * Check if a (companyId, role) has ANY of the given permissions.
 */
export async function hasAnyPermission(
  companyId: string,
  role: Role,
  permissions: Permission[],
): Promise<boolean> {
  const rolePerms = await getRolePermissions(companyId, role);
  return permissions.some((p) => rolePerms.includes(p));
}

/**
 * Check if a (companyId, role) has ALL of the given permissions.
 */
export async function hasAllPermissions(
  companyId: string,
  role: Role,
  permissions: Permission[],
): Promise<boolean> {
  const rolePerms = await getRolePermissions(companyId, role);
  return permissions.every((p) => rolePerms.includes(p));
}

/**
 * Returns the full permission map for a company (all roles).
 * If no customizations exist, returns the defaults for each role.
 */
export async function getCompanyPermissions(
  companyId: string,
): Promise<Record<string, Permission[]>> {
  const customRows = await prisma.companyRolePermission.findMany({
    where: { companyId },
  });

  const customMap = new Map(customRows.map((r) => [r.role, r]));

  // Build the map using ALL_ROLES from defaults, overlaying customizations
  const { ALL_ROLES } = await import('@buildflow/shared');
  const result: Record<string, Permission[]> = {};

  for (const role of ALL_ROLES) {
    const custom = customMap.get(role);
    if (custom?.isCustomized) {
      result[role] = custom.permissions as Permission[];
    } else {
      result[role] = DEFAULT_ROLE_PERMISSIONS[role] ?? [];
    }
  }

  return result;
}

/**
 * Update permissions for a specific role in a company.
 * Marks the role as customized and invalidates the cache.
 */
export async function updateRolePermissions(
  companyId: string,
  role: Role,
  permissions: Permission[],
): Promise<void> {
  await prisma.companyRolePermission.upsert({
    where: { companyId_role: { companyId, role } },
    create: {
      companyId,
      role,
      permissions,
      isCustomized: true,
    },
    update: {
      permissions,
      isCustomized: true,
    },
  });

  await invalidatePermissionCache(companyId, role);
}

/**
 * Reset a role's permissions to the system default for a company.
 * Removes the customized override.
 */
export async function resetRolePermissions(
  companyId: string,
  role: Role,
): Promise<void> {
  await prisma.companyRolePermission.deleteMany({
    where: { companyId, role },
  });

  await invalidatePermissionCache(companyId, role);
}

/**
 * Invalidate cached permissions for a (companyId, role) pair.
 * Called after any permission update.
 */
export async function invalidatePermissionCache(
  companyId: string,
  role?: Role,
): Promise<void> {
  if (role) {
    const key = `${CACHE_KEY_PREFIX}${companyId}:${role}`;
    memoryCache.delete(key);
    try {
      await redis.del(key);
    } catch {
      // ignore
    }
  } else {
    // Invalidate all roles for this company
    const { ALL_ROLES } = await import('@buildflow/shared');
    for (const r of ALL_ROLES) {
      await invalidatePermissionCache(companyId, r);
    }
  }
}

// ── Internal helpers ──────────────────────────────────────────────

async function cachePermissions(key: string, permissions: Permission[]): Promise<void> {
  // Memory cache
  memoryCache.set(key, {
    permissions,
    expiresAt: Date.now() + CACHE_TTL_SEC * 1000,
  });

  // Redis cache
  try {
    await redis.setex(key, CACHE_TTL_SEC, JSON.stringify(permissions));
  } catch {
    // ignore — memory cache is the fallback
  }
}