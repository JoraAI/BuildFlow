/**
 * BuildFlow Mobile - Permission hooks
 *
 * Usage:
 *   const canApprove = usePermission('estimate.approve');
 *   const canAccessAccounting = useAnyPermission(['invoice.view', 'bill.view']);
 *   const { hasPermission, hasAnyPermission, permissions } = usePermissions();
 *
 * Permissions are loaded into the auth store at login time and refreshed
 * when the user profile is fetched.
 */
import { useCallback, useMemo } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import type { Permission } from '@buildflow/shared';

/**
 * Check if the current user has a single permission.
 */
export function usePermission(permission: Permission): boolean {
  const permissions = useAuthStore((s) => s.user?.permissions);
  return useMemo(
    () => permissions?.includes(permission) ?? false,
    [permissions, permission],
  );
}

/**
 * Check if the current user has ANY of the given permissions (OR logic).
 */
export function useAnyPermission(permissions: Permission[]): boolean {
  const userPerms = useAuthStore((s) => s.user?.permissions);
  return useMemo(
    () => permissions.some((p) => userPerms?.includes(p) ?? false),
    [userPerms, permissions],
  );
}

/**
 * Check if the current user has ALL of the given permissions (AND logic).
 */
export function useAllPermissions(permissions: Permission[]): boolean {
  const userPerms = useAuthStore((s) => s.user?.permissions);
  return useMemo(
    () => permissions.every((p) => userPerms?.includes(p) ?? false),
    [userPerms, permissions],
  );
}

/**
 * Returns the full permission-checking toolkit + the user's permission list.
 */
export function usePermissions() {
  const permissions = useAuthStore((s) => s.user?.permissions) ?? [];

  const hasPermission = useCallback(
    (perm: Permission): boolean => permissions.includes(perm),
    [permissions],
  );

  const hasAnyPermission = useCallback(
    (perms: Permission[]): boolean => perms.some((p) => permissions.includes(p)),
    [permissions],
  );

  const hasAllPermissions = useCallback(
    (perms: Permission[]): boolean => perms.every((p) => permissions.includes(p)),
    [permissions],
  );

  const canViewAmounts = hasPermission('financials.view_amounts');
  const canViewBudget = hasPermission('financials.view_budget');
  const canViewProfit = hasPermission('financials.view_profit');

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canViewAmounts,
    canViewBudget,
    canViewProfit,
    /** True if the user has no permissions loaded (edge case). */
    isEmpty: permissions.length === 0,
  };
}