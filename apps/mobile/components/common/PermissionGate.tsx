/**
 * BuildFlow Mobile - PermissionGate component
 *
 * Conditionally renders children based on the user's permissions.
 *
 * Usage:
 *   <PermissionGate permission="estimate.approve">
 *     <ApproveButton />
 *   </PermissionGate>
 *
 *   <PermissionGate anyOf={['invoice.view', 'bill.view']}>
 *     <AccountingTab />
 *   </PermissionGate>
 *
 *   <PermissionGate allOf={['financials.view_amounts', 'reports.download']}>
 *     <ExportButton />
 *   </PermissionGate>
 *
 *   <PermissionGate permission="settings.users" fallback={<Text>Access denied</Text>}>
 *     <UsersList />
 *   </PermissionGate>
 */
import React from 'react';
import type { Permission } from '@buildflow/shared';
import { usePermissions } from '@/hooks/usePermission';

interface PermissionGateProps {
  /** Require a single permission. */
  permission?: Permission;
  /** Require ANY of these permissions (OR). */
  anyOf?: Permission[];
  /** Require ALL of these permissions (AND). */
  allOf?: Permission[];
  /** Content to render if the user DOES have the permission(s). */
  children: React.ReactNode;
  /** Content to render if the user does NOT have permission (default: null). */
  fallback?: React.ReactNode;
}

export function PermissionGate({
  permission,
  anyOf,
  allOf,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  let allowed: boolean;
  if (permission) {
    allowed = hasPermission(permission);
  } else if (anyOf && anyOf.length > 0) {
    allowed = hasAnyPermission(anyOf);
  } else if (allOf && allOf.length > 0) {
    allowed = hasAllPermissions(allOf);
  } else {
    // No permission specified → always render (useful for layout wrappers)
    allowed = true;
  }

  return <>{allowed ? children : fallback}</>;
}

/**
 * Convenience wrapper specifically for financial amount visibility.
 * Shows children only if user has 'financials.view_amounts' permission.
 */
export function AmountGate({
  children,
  fallback = <>{'—'}</>,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { canViewAmounts } = usePermissions();
  return <>{canViewAmounts ? children : fallback}</>;
}