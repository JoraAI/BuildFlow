/**
 * BuildFlow - Permission management service
 *
 * Owner-facing service for reading and customizing role permissions.
 */
import type { Role, Permission } from '@buildflow/shared';
import {
  updateRolePermissions,
  resetRolePermissions,
  invalidatePermissionCache,
} from '../lib/permissions';
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  ALL_ROLES,
  ROLE_LABELS,
} from '@buildflow/shared';
import { recordAudit } from '../utils/audit';
import { prisma } from '../lib/prisma';

/**
 * Returns the full permission state for a company:
 *   - Catalog of all available permissions (with descriptions)
 *   - Grouped by module (for UI rendering)
 *   - Current permission list per role (customized or default)
 *   - Which roles are customized vs default
 */
export async function getPermissionState(companyId: string) {
  const customRows = await prisma.companyRolePermission.findMany({
    where: { companyId },
  });
  const customMap = new Map(customRows.map((r) => [r.role, r]));

  const roles = ALL_ROLES.map((role) => {
    const custom = customMap.get(role);
    const isCustomized = custom?.isCustomized ?? false;
    const permissions = isCustomized
      ? (custom!.permissions as Permission[])
      : (DEFAULT_ROLE_PERMISSIONS[role] ?? []);
    return {
      role,
      label: ROLE_LABELS[role],
      isCustomized,
      permissions,
    };
  });

  return {
    roles,
    permissionCatalog: Object.entries(PERMISSIONS).map(([key, label]) => ({
      key: key as Permission,
      label,
    })),
    permissionGroups: PERMISSION_GROUPS,
  };
}

/**
 * Update permissions for a specific role.
 * Validates that all permission strings are known.
 */
export async function updatePermissions(
  companyId: string,
  userId: string,
  role: Role,
  permissions: Permission[],
  ipAddress?: string,
) {
  // Validate all permission strings are valid
  const validPerms = new Set<string>(ALL_PERMISSIONS);
  const invalid = permissions.filter((p) => !validPerms.has(p));
  if (invalid.length > 0) {
    throw new Error(`Invalid permissions: ${invalid.join(', ')}`);
  }

  // OWNER permissions cannot be modified
  if (role === 'OWNER') {
    throw new Error('Cannot modify OWNER role permissions');
  }

  await updateRolePermissions(companyId, role, permissions);

  await recordAudit({
    companyId,
    userId,
    action: 'UPDATE',
    entityType: 'role_permissions',
    entityId: role,
    newValue: { role, permissions },
    ipAddress,
  });

  return { role, permissions, isCustomized: true };
}

/**
 * Reset a role's permissions to the system default.
 */
export async function resetPermissions(
  companyId: string,
  userId: string,
  role: Role,
  ipAddress?: string,
) {
  if (role === 'OWNER') {
    throw new Error('Cannot reset OWNER role permissions');
  }

  await resetRolePermissions(companyId, role);

  await recordAudit({
    companyId,
    userId,
    action: 'RESET',
    entityType: 'role_permissions',
    entityId: role,
    newValue: { role, resetToDefault: true },
    ipAddress,
  });

  return {
    role,
    permissions: DEFAULT_ROLE_PERMISSIONS[role] ?? [],
    isCustomized: false,
  };
}

/**
 * Reset all customized roles back to defaults.
 */
export async function resetAllPermissions(
  companyId: string,
  userId: string,
  ipAddress?: string,
) {
  await invalidatePermissionCache(companyId);
  await prisma.companyRolePermission.deleteMany({
    where: { companyId },
  });

  await recordAudit({
    companyId,
    userId,
    action: 'CUSTOM',
    entityType: 'role_permissions',
    entityId: 'all',
    newValue: { action: 'RESET_ALL', resetAll: true },
    ipAddress,
  });

  return { reset: true };
}