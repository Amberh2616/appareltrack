"""
Core Models - v2.2.1
Organization, User, Authentication
"""

from django.contrib.auth.models import AbstractUser
from django.db import models
import uuid


class Organization(models.Model):
    """
    Multi-tenant support (optional for MVP single user)
    Represents a company/organization using the system
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)

    # Settings and limits
    settings = models.JSONField(default=dict, blank=True)
    ai_budget_monthly = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=200.00,
        help_text="Monthly AI API budget limit in USD"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'organizations'
        verbose_name = 'Organization'
        verbose_name_plural = 'Organizations'

    def __str__(self):
        return self.name


class User(AbstractUser):
    """
    Extended user model with organization and role
    """
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('merchandiser', 'Merchandiser'),
        ('factory', 'Factory User'),
        ('viewer', 'Viewer'),
    ]

    organization = models.ForeignKey(
        Organization,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users'
    )
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='merchandiser'
    )

    # Preferences
    email_notifications = models.BooleanField(default=True)

    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"


class AuditLog(models.Model):
    """
    SaaS-Ready: Audit log for tracking changes (B2B enterprise requirement)

    Records who changed what, when, and the before/after values.
    Critical for enterprise customers: "誰改了什麼有記錄嗎？"

    Usage:
        AuditLog.objects.create(
            organization=run.organization,
            user=request.user,
            action='transition',
            model_name='SampleRun',
            object_id=run.id,
            old_data={'status': 'draft'},
            new_data={'status': 'materials_planning'},
            ip_address=get_client_ip(request),
        )
    """
    ACTION_CHOICES = [
        ('create', 'Create'),
        ('update', 'Update'),
        ('delete', 'Delete'),
        ('transition', 'Status Transition'),
        ('approve', 'Approve'),
        ('reject', 'Reject'),
        ('export', 'Export'),
        ('login', 'Login'),
        ('logout', 'Logout'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='audit_logs'
    )

    # Who
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs'
    )

    # What
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    model_name = models.CharField(
        max_length=100,
        help_text="Model class name, e.g., 'SampleRun', 'BOMItem'"
    )
    object_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="UUID of the affected object"
    )
    object_repr = models.CharField(
        max_length=255,
        blank=True,
        help_text="String representation of the object"
    )

    # Changes
    old_data = models.JSONField(
        null=True,
        blank=True,
        help_text="State before the change"
    )
    new_data = models.JSONField(
        null=True,
        blank=True,
        help_text="State after the change"
    )

    # When
    created_at = models.DateTimeField(auto_now_add=True)

    # Context
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    request_id = models.CharField(
        max_length=100,
        blank=True,
        help_text="Request ID for tracing"
    )
    extra_data = models.JSONField(
        null=True,
        blank=True,
        help_text="Additional context data"
    )

    class Meta:
        db_table = 'audit_logs'
        verbose_name = 'Audit Log'
        verbose_name_plural = 'Audit Logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'created_at']),
            models.Index(fields=['model_name', 'object_id']),
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['action', 'created_at']),
        ]

    def __str__(self):
        return f"[{self.action}] {self.model_name} by {self.user} at {self.created_at}"
