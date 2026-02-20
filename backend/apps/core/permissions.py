"""
RBAC Permission System for Fashion PLM

Role Hierarchy:
    admin > merchandiser > factory > viewer

Permission Matrix:
    - admin: Full access (including user management)
    - merchandiser: Create/Edit/View styles, samples, BOM, costing, PO
    - factory: View MWO, update production status
    - viewer: Read-only access
"""

from rest_framework.permissions import BasePermission
from functools import wraps
from django.http import JsonResponse


# =============================================================================
# Permission Constants
# =============================================================================

class Roles:
    ADMIN = 'admin'
    MERCHANDISER = 'merchandiser'
    FACTORY = 'factory'
    VIEWER = 'viewer'

    ALL = [ADMIN, MERCHANDISER, FACTORY, VIEWER]
    EDIT_ROLES = [ADMIN, MERCHANDISER]  # Can create/edit
    PRODUCTION_ROLES = [ADMIN, MERCHANDISER, FACTORY]  # Can update production


# Permission definitions by module
PERMISSIONS = {
    # User Management - Admin only
    'users.view': [Roles.ADMIN],
    'users.create': [Roles.ADMIN],
    'users.edit': [Roles.ADMIN],
    'users.delete': [Roles.ADMIN],

    # Styles & Documents
    'styles.view': Roles.ALL,
    'styles.create': Roles.EDIT_ROLES,
    'styles.edit': Roles.EDIT_ROLES,
    'styles.delete': [Roles.ADMIN],

    # BOM & Spec
    'bom.view': Roles.ALL,
    'bom.create': Roles.EDIT_ROLES,
    'bom.edit': Roles.EDIT_ROLES,
    'bom.delete': Roles.EDIT_ROLES,

    # Samples & MWO
    'samples.view': Roles.ALL,
    'samples.create': Roles.EDIT_ROLES,
    'samples.edit': Roles.EDIT_ROLES,
    'samples.transition': Roles.PRODUCTION_ROLES,  # Status changes
    'samples.delete': [Roles.ADMIN],

    # Costing
    'costing.view': [Roles.ADMIN, Roles.MERCHANDISER],
    'costing.create': Roles.EDIT_ROLES,
    'costing.edit': Roles.EDIT_ROLES,

    # Procurement (PO)
    'procurement.view': Roles.ALL,
    'procurement.create': Roles.EDIT_ROLES,
    'procurement.edit': Roles.EDIT_ROLES,
    'procurement.send': Roles.EDIT_ROLES,

    # Production Orders
    'production.view': Roles.ALL,
    'production.create': Roles.EDIT_ROLES,
    'production.edit': Roles.PRODUCTION_ROLES,

    # Suppliers & Materials
    'suppliers.view': Roles.ALL,
    'suppliers.create': Roles.EDIT_ROLES,
    'suppliers.edit': Roles.EDIT_ROLES,

    'materials.view': Roles.ALL,
    'materials.create': Roles.EDIT_ROLES,
    'materials.edit': Roles.EDIT_ROLES,

    # Settings
    'settings.view': [Roles.ADMIN, Roles.MERCHANDISER],
    'settings.edit': [Roles.ADMIN],
}


# =============================================================================
# Permission Check Functions
# =============================================================================

def has_permission(user, permission_key: str) -> bool:
    """
    Check if user has a specific permission.

    Usage:
        if has_permission(request.user, 'samples.create'):
            # allow action
    """
    if not user or not user.is_authenticated:
        return False

    # Superuser has all permissions
    if user.is_superuser:
        return True

    allowed_roles = PERMISSIONS.get(permission_key, [])
    return user.role in allowed_roles


def has_any_permission(user, permission_keys: list) -> bool:
    """Check if user has any of the specified permissions."""
    return any(has_permission(user, key) for key in permission_keys)


def has_all_permissions(user, permission_keys: list) -> bool:
    """Check if user has all specified permissions."""
    return all(has_permission(user, key) for key in permission_keys)


def get_user_permissions(user) -> list:
    """Get all permissions for a user based on their role."""
    if not user or not user.is_authenticated:
        return []

    if user.is_superuser:
        return list(PERMISSIONS.keys())

    return [key for key, roles in PERMISSIONS.items() if user.role in roles]


# =============================================================================
# DRF Permission Classes
# =============================================================================

class IsAdmin(BasePermission):
    """Only allow admin users."""
    message = "Admin access required."

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            (request.user.is_superuser or request.user.role == Roles.ADMIN)
        )


class IsAdminOrMerchandiser(BasePermission):
    """Allow admin or merchandiser users."""
    message = "Admin or Merchandiser access required."

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            (request.user.is_superuser or request.user.role in Roles.EDIT_ROLES)
        )


class IsProductionUser(BasePermission):
    """Allow users who can manage production (admin, merchandiser, factory)."""
    message = "Production access required."

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            (request.user.is_superuser or request.user.role in Roles.PRODUCTION_ROLES)
        )


class CanViewCosting(BasePermission):
    """Only admin and merchandiser can view costing."""
    message = "You don't have permission to view costing information."

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            (request.user.is_superuser or request.user.role in [Roles.ADMIN, Roles.MERCHANDISER])
        )


class ReadOnlyForViewer(BasePermission):
    """
    Viewer role gets read-only access.
    Other roles get full access based on method.
    """
    message = "Viewer role has read-only access."

    SAFE_METHODS = ('GET', 'HEAD', 'OPTIONS')

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser:
            return True

        # Viewer can only read
        if request.user.role == Roles.VIEWER:
            return request.method in self.SAFE_METHODS

        return True


class HasModulePermission(BasePermission):
    """
    Generic permission class that checks module-level permissions.

    Usage in ViewSet:
        permission_classes = [HasModulePermission]
        permission_module = 'samples'  # Will check samples.view, samples.create, etc.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser:
            return True

        module = getattr(view, 'permission_module', None)
        if not module:
            return True  # No module specified, allow

        # Map HTTP methods to permission actions
        method_map = {
            'GET': 'view',
            'HEAD': 'view',
            'OPTIONS': 'view',
            'POST': 'create',
            'PUT': 'edit',
            'PATCH': 'edit',
            'DELETE': 'delete',
        }

        action = method_map.get(request.method, 'view')
        permission_key = f"{module}.{action}"

        return has_permission(request.user, permission_key)


# =============================================================================
# Organization Data Isolation
# =============================================================================

class OrganizationPermission(BasePermission):
    """
    Ensure users can only access data from their organization.
    Must be combined with other permission classes.
    """
    message = "You can only access data from your organization."

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser:
            return True

        # Check if object has organization field
        obj_org = getattr(obj, 'organization', None)
        if obj_org is None:
            # Try to get organization through related fields
            obj_org = getattr(obj, 'organization_id', None)

        if obj_org is None:
            return True  # No organization field, allow

        user_org = request.user.organization
        if user_org is None:
            return False  # User has no organization

        return str(obj_org.id if hasattr(obj_org, 'id') else obj_org) == str(user_org.id)


# =============================================================================
# Decorator for Function-Based Views
# =============================================================================

def require_permission(permission_key: str):
    """
    Decorator for function-based views to require a permission.

    Usage:
        @api_view(['POST'])
        @require_permission('samples.create')
        def create_sample(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped_view(request, *args, **kwargs):
            if not has_permission(request.user, permission_key):
                return JsonResponse({
                    'error': f'Permission denied. Required: {permission_key}'
                }, status=403)
            return view_func(request, *args, **kwargs)
        return wrapped_view
    return decorator


def require_roles(*roles):
    """
    Decorator to require specific roles.

    Usage:
        @api_view(['POST'])
        @require_roles(Roles.ADMIN, Roles.MERCHANDISER)
        def sensitive_action(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped_view(request, *args, **kwargs):
            if not request.user or not request.user.is_authenticated:
                return JsonResponse({'error': 'Authentication required'}, status=401)

            if request.user.is_superuser or request.user.role in roles:
                return view_func(request, *args, **kwargs)

            return JsonResponse({
                'error': f'Permission denied. Required roles: {", ".join(roles)}'
            }, status=403)
        return wrapped_view
    return decorator
