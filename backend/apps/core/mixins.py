"""
SaaS-Ready: Tenant Mixins for Views

Usage:
    class SampleRequestViewSet(TenantViewMixin, viewsets.ModelViewSet):
        queryset = SampleRequest.objects.all()
        serializer_class = SampleRequestSerializer

    # Queryset will automatically be filtered by user's organization
"""

from rest_framework.exceptions import PermissionDenied


class TenantViewMixin:
    """
    Mixin for DRF ViewSets to automatically filter by tenant (organization).

    Features:
    - Automatically filters queryset by user's organization
    - Raises 403 if user has no organization
    - Provides get_organization() helper method
    - Automatically sets organization on create

    Requirements:
    - Model must have `organization` FK field
    - Model must use TenantManager with `for_tenant()` method
    - User must have `organization` field
    """

    def get_organization(self):
        """
        Get the current user's organization.
        Raises PermissionDenied if user has no organization.
        """
        user = self.request.user

        if not user.is_authenticated:
            raise PermissionDenied("Authentication required")

        if not hasattr(user, 'organization') or user.organization is None:
            raise PermissionDenied("User is not associated with any organization")

        return user.organization

    def get_queryset(self):
        """
        Filter queryset by user's organization.

        Uses the model's TenantManager.for_tenant() method.
        """
        queryset = super().get_queryset()
        org = self.get_organization()

        # Use TenantManager's for_tenant() if available
        if hasattr(queryset, 'for_tenant'):
            return queryset.for_tenant(org)

        # Fallback: direct filter (for models without TenantManager)
        if hasattr(queryset.model, 'organization'):
            return queryset.filter(organization=org)

        return queryset

    def perform_create(self, serializer):
        """
        Automatically set organization on create.
        """
        org = self.get_organization()

        # Check if model has organization field
        model = serializer.Meta.model
        if hasattr(model, 'organization'):
            serializer.save(organization=org)
        else:
            serializer.save()


class TenantQueryMixin:
    """
    Lighter mixin for non-ViewSet views (APIView, etc.)
    Just provides the get_organization() helper.
    """

    def get_organization(self):
        """Get the current user's organization."""
        user = self.request.user

        if not user.is_authenticated:
            raise PermissionDenied("Authentication required")

        if not hasattr(user, 'organization') or user.organization is None:
            raise PermissionDenied("User is not associated with any organization")

        return user.organization

    def filter_by_tenant(self, queryset):
        """
        Helper to filter any queryset by current tenant.

        Usage:
            runs = self.filter_by_tenant(SampleRun.objects.all())
        """
        org = self.get_organization()

        if hasattr(queryset, 'for_tenant'):
            return queryset.for_tenant(org)

        if hasattr(queryset.model, 'organization'):
            return queryset.filter(organization=org)

        return queryset


class OptionalTenantMixin:
    """
    Mixin for views that support both authenticated and unauthenticated access.
    Returns None for organization if user is not authenticated.

    Useful for public endpoints that show different data based on auth status.
    """

    def get_organization_or_none(self):
        """
        Get organization if user is authenticated and has one.
        Returns None otherwise (no exception).
        """
        user = getattr(self.request, 'user', None)

        if user is None or not user.is_authenticated:
            return None

        return getattr(user, 'organization', None)

    def filter_by_tenant_if_authenticated(self, queryset):
        """
        Filter by tenant only if user is authenticated with organization.
        Returns unfiltered queryset for unauthenticated users.
        """
        org = self.get_organization_or_none()

        if org is None:
            return queryset

        if hasattr(queryset, 'for_tenant'):
            return queryset.for_tenant(org)

        if hasattr(queryset.model, 'organization'):
            return queryset.filter(organization=org)

        return queryset
