'use client';

import { ReactNode } from 'react';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { Role } from '@/lib/permissions';

interface PermissionGateProps {
  children: ReactNode;
  /** Required permission key (e.g., 'users.view') */
  permission?: string;
  /** Array of permissions - user must have ANY of these */
  anyPermission?: string[];
  /** Array of permissions - user must have ALL of these */
  allPermissions?: string[];
  /** Required roles - user must have one of these roles */
  roles?: Role[];
  /** Require admin role */
  adminOnly?: boolean;
  /** Require edit capability (admin or merchandiser) */
  editOnly?: boolean;
  /** Fallback content when permission denied */
  fallback?: ReactNode;
  /** Show nothing instead of fallback when denied */
  hideOnDeny?: boolean;
}

/**
 * Component for conditional rendering based on permissions.
 *
 * Usage:
 * ```tsx
 * <PermissionGate permission="users.view">
 *   <UserManagementButton />
 * </PermissionGate>
 *
 * <PermissionGate adminOnly>
 *   <AdminPanel />
 * </PermissionGate>
 *
 * <PermissionGate editOnly fallback={<span>View only</span>}>
 *   <EditButton />
 * </PermissionGate>
 * ```
 */
export function PermissionGate({
  children,
  permission,
  anyPermission,
  allPermissions,
  roles,
  adminOnly,
  editOnly,
  fallback = null,
  hideOnDeny = false,
}: PermissionGateProps) {
  const {
    role,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isAdmin,
    canEdit,
    isLoading,
  } = usePermissions();

  // Still loading user data
  if (isLoading) {
    return hideOnDeny ? null : fallback;
  }

  // No role means no permissions
  if (!role) {
    return hideOnDeny ? null : <>{fallback}</>;
  }

  let hasAccess = true;

  // Check single permission
  if (permission) {
    hasAccess = hasAccess && hasPermission(permission);
  }

  // Check any permission
  if (anyPermission && anyPermission.length > 0) {
    hasAccess = hasAccess && hasAnyPermission(anyPermission);
  }

  // Check all permissions
  if (allPermissions && allPermissions.length > 0) {
    hasAccess = hasAccess && hasAllPermissions(allPermissions);
  }

  // Check roles
  if (roles && roles.length > 0) {
    hasAccess = hasAccess && roles.includes(role);
  }

  // Check admin only
  if (adminOnly) {
    hasAccess = hasAccess && isAdmin();
  }

  // Check edit only
  if (editOnly) {
    hasAccess = hasAccess && canEdit();
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  return hideOnDeny ? null : <>{fallback}</>;
}

/**
 * Higher-order component for permission-protected components
 */
export function withPermission<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: Omit<PermissionGateProps, 'children'>
) {
  return function PermissionProtectedComponent(props: P) {
    return (
      <PermissionGate {...options}>
        <WrappedComponent {...props} />
      </PermissionGate>
    );
  };
}

/**
 * Hook-style permission check for programmatic use
 */
export function usePermissionCheck(options: Omit<PermissionGateProps, 'children' | 'fallback' | 'hideOnDeny'>): boolean {
  const {
    role,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isAdmin,
    canEdit,
  } = usePermissions();

  if (!role) return false;

  let hasAccess = true;

  if (options.permission) {
    hasAccess = hasAccess && hasPermission(options.permission);
  }

  if (options.anyPermission && options.anyPermission.length > 0) {
    hasAccess = hasAccess && hasAnyPermission(options.anyPermission);
  }

  if (options.allPermissions && options.allPermissions.length > 0) {
    hasAccess = hasAccess && hasAllPermissions(options.allPermissions);
  }

  if (options.roles && options.roles.length > 0) {
    hasAccess = hasAccess && options.roles.includes(role);
  }

  if (options.adminOnly) {
    hasAccess = hasAccess && isAdmin();
  }

  if (options.editOnly) {
    hasAccess = hasAccess && canEdit();
  }

  return hasAccess;
}
