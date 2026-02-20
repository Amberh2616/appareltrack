/**
 * Frontend Permission System
 * Mirror of backend permissions for UI control
 */

export type Role = 'admin' | 'merchandiser' | 'factory' | 'viewer';

export const Roles = {
  ADMIN: 'admin' as Role,
  MERCHANDISER: 'merchandiser' as Role,
  FACTORY: 'factory' as Role,
  VIEWER: 'viewer' as Role,
};

export const ALL_ROLES: Role[] = ['admin', 'merchandiser', 'factory', 'viewer'];
export const EDIT_ROLES: Role[] = ['admin', 'merchandiser'];
export const PRODUCTION_ROLES: Role[] = ['admin', 'merchandiser', 'factory'];

/**
 * Permission definitions matching backend
 */
export const PERMISSIONS: Record<string, Role[]> = {
  // User Management - Admin only
  'users.view': ['admin'],
  'users.create': ['admin'],
  'users.edit': ['admin'],
  'users.delete': ['admin'],

  // Styles & Documents
  'styles.view': ALL_ROLES,
  'styles.create': EDIT_ROLES,
  'styles.edit': EDIT_ROLES,
  'styles.delete': ['admin'],

  // BOM & Spec
  'bom.view': ALL_ROLES,
  'bom.create': EDIT_ROLES,
  'bom.edit': EDIT_ROLES,
  'bom.delete': EDIT_ROLES,

  // Samples & MWO
  'samples.view': ALL_ROLES,
  'samples.create': EDIT_ROLES,
  'samples.edit': EDIT_ROLES,
  'samples.transition': PRODUCTION_ROLES,
  'samples.delete': ['admin'],

  // Costing
  'costing.view': ['admin', 'merchandiser'],
  'costing.create': EDIT_ROLES,
  'costing.edit': EDIT_ROLES,

  // Procurement
  'procurement.view': ALL_ROLES,
  'procurement.create': EDIT_ROLES,
  'procurement.edit': EDIT_ROLES,
  'procurement.send': EDIT_ROLES,

  // Production Orders
  'production.view': ALL_ROLES,
  'production.create': EDIT_ROLES,
  'production.edit': PRODUCTION_ROLES,

  // Suppliers & Materials
  'suppliers.view': ALL_ROLES,
  'suppliers.create': EDIT_ROLES,
  'suppliers.edit': EDIT_ROLES,

  'materials.view': ALL_ROLES,
  'materials.create': EDIT_ROLES,
  'materials.edit': EDIT_ROLES,

  // Settings
  'settings.view': ['admin', 'merchandiser'],
  'settings.edit': ['admin'],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role | null | undefined, permission: string): boolean {
  if (!role) return false;
  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) return false;
  return allowedRoles.includes(role);
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: Role | null | undefined, permissions: string[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

/**
 * Check if a role has all specified permissions
 */
export function hasAllPermissions(role: Role | null | undefined, permissions: string[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

/**
 * Check if a role can edit (admin or merchandiser)
 */
export function canEdit(role: Role | null | undefined): boolean {
  if (!role) return false;
  return EDIT_ROLES.includes(role);
}

/**
 * Check if a role is admin
 */
export function isAdmin(role: Role | null | undefined): boolean {
  return role === 'admin';
}

/**
 * Check if a role can view costing
 */
export function canViewCosting(role: Role | null | undefined): boolean {
  return hasPermission(role, 'costing.view');
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: Role): string[] {
  return Object.entries(PERMISSIONS)
    .filter(([, roles]) => roles.includes(role))
    .map(([permission]) => permission);
}

/**
 * Role display names
 */
export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  merchandiser: 'Merchandiser',
  factory: 'Factory User',
  viewer: 'Viewer',
};

/**
 * Role descriptions
 */
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'Full access including user management',
  merchandiser: 'Create and edit styles, samples, BOM, costing',
  factory: 'View MWO, update production status',
  viewer: 'Read-only access to all data',
};
