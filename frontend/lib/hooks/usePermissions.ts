/**
 * Permission Hooks
 */

import { useAuthStore } from '@/lib/stores/authStore';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from '@/lib/api/users';
import {
  Role,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canEdit,
  isAdmin,
  canViewCosting,
  getPermissionsForRole,
} from '@/lib/permissions';

/**
 * Hook to get current user with role information
 */
export function useCurrentUser() {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: ['current-user'],
    queryFn: getCurrentUser,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for permission checks
 */
export function usePermissions() {
  const { data: user, isLoading } = useCurrentUser();
  const role = user?.role as Role | undefined;

  return {
    user,
    role,
    isLoading,

    // Permission checks
    hasPermission: (permission: string) => hasPermission(role, permission),
    hasAnyPermission: (permissions: string[]) => hasAnyPermission(role, permissions),
    hasAllPermissions: (permissions: string[]) => hasAllPermissions(role, permissions),

    // Role checks
    canEdit: () => canEdit(role),
    isAdmin: () => isAdmin(role),
    canViewCosting: () => canViewCosting(role),

    // Get all permissions
    permissions: role ? getPermissionsForRole(role) : [],
  };
}

/**
 * Hook to check a single permission
 */
export function useHasPermission(permission: string): boolean {
  const { hasPermission } = usePermissions();
  return hasPermission(permission);
}

/**
 * Hook to check if user can edit
 */
export function useCanEdit(): boolean {
  const { canEdit } = usePermissions();
  return canEdit();
}

/**
 * Hook to check if user is admin
 */
export function useIsAdmin(): boolean {
  const { isAdmin } = usePermissions();
  return isAdmin();
}
