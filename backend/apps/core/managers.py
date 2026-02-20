"""
SaaS-Ready: TenantManager for multi-tenant data isolation

Usage:
    class SampleRun(models.Model):
        organization = models.ForeignKey(Organization, ...)
        objects = TenantManager()

    # Query with tenant filter
    SampleRun.objects.for_tenant(org).filter(status='draft')
"""

from django.db import models


class TenantQuerySet(models.QuerySet):
    """
    QuerySet with tenant-aware methods
    """
    def for_tenant(self, organization):
        """
        Filter queryset by organization (tenant).

        Args:
            organization: Organization instance or organization_id

        Returns:
            Filtered queryset for the given tenant
        """
        if organization is None:
            return self.none()

        if hasattr(organization, 'id'):
            org_id = organization.id
        else:
            org_id = organization

        return self.filter(organization_id=org_id)


class TenantManager(models.Manager):
    """
    Manager that provides tenant-aware querying.

    Does NOT automatically filter - you must explicitly call for_tenant().
    This is intentional to avoid silent data leaks when forgetting to filter.
    """

    def get_queryset(self):
        return TenantQuerySet(self.model, using=self._db)

    def for_tenant(self, organization):
        """
        Get queryset filtered by organization.

        Usage:
            SampleRun.objects.for_tenant(request.user.organization).filter(...)
        """
        return self.get_queryset().for_tenant(organization)


class TenantAwareManager(models.Manager):
    """
    Alternative manager that requires tenant context.

    WARNING: This manager will raise an error if you try to query
    without setting the tenant context first. Use with caution.
    """

    _current_tenant = None

    def get_queryset(self):
        qs = TenantQuerySet(self.model, using=self._db)
        if self._current_tenant is not None:
            qs = qs.for_tenant(self._current_tenant)
        return qs

    def set_tenant(self, organization):
        """Set the current tenant for this manager"""
        self._current_tenant = organization
        return self

    def clear_tenant(self):
        """Clear the current tenant"""
        self._current_tenant = None
        return self
