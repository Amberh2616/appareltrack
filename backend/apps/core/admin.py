from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import Organization, User


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ('name', 'ai_budget_monthly', 'created_at')
    search_fields = ('name',)
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'organization', 'role', 'is_staff')
    list_filter = ('role', 'is_staff', 'is_active', 'organization')

    fieldsets = BaseUserAdmin.fieldsets + (
        ('Organization', {'fields': ('organization', 'role', 'email_notifications')}),
    )
