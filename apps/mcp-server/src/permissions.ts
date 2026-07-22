/**
 * BuildFlow MCP Server - Permission resolver
 *
 * Mirrors the backend's permission resolution: check the DB for a custom
 * CompanyRolePermission override, otherwise fall back to the code-defined
 * DEFAULT_ROLE_PERMISSIONS.
 */
import { prisma } from './prisma';
import { DEFAULT_ROLE_PERMISSIONS, type Permission, type Role } from '@buildflow/shared';

/**
 * Resolve the permission list for a (companyId, role) pair.
 * OWNER always gets all permissions.
 */
export async function getRolePermissions(
  companyId: string,
  role: Role,
): Promise<Permission[]> {
  if (role === 'OWNER') {
    return DEFAULT_ROLE_PERMISSIONS.OWNER;
  }

  const row = await prisma.companyRolePermission.findUnique({
    where: { companyId_role: { companyId, role } },
  });

  if (row?.isCustomized) {
    return row.permissions as Permission[];
  }
  return DEFAULT_ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Check if the identity has a specific permission.
 */
export function hasPermission(
  permissions: Permission[],
  required: Permission,
): boolean {
  return permissions.includes(required);
}