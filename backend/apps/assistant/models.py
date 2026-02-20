from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType


class AssistantTask(models.Model):
    """Tasks created by assistant for follow-up actions"""

    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('done', 'Done'),
        ('cancelled', 'Cancelled'),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pending')
    due_date = models.DateField(null=True, blank=True)

    # Generic relation to any object (Style, SampleRun, PO, etc.)
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    object_id = models.PositiveIntegerField(null=True, blank=True)
    related_object = GenericForeignKey('content_type', 'object_id')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Task: {self.title}"


class AssistantNote(models.Model):
    """Notes/memos attached to any object"""

    content = models.TextField()

    # Generic relation to any object
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    object_id = models.PositiveIntegerField(null=True, blank=True)
    related_object = GenericForeignKey('content_type', 'object_id')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        preview = self.content[:50] + "..." if len(self.content) > 50 else self.content
        return f"Note: {preview}"


class ReminderRule(models.Model):
    """Automated reminder rules"""

    RULE_TYPE_CHOICES = [
        ('status_stall', 'Status Stall'),
        ('due_approaching', 'Due Date Approaching'),
        ('missing_field', 'Missing Field'),
        ('custom', 'Custom'),
    ]

    name = models.CharField(max_length=100)
    rule_type = models.CharField(max_length=20, choices=RULE_TYPE_CHOICES)
    is_active = models.BooleanField(default=True)

    # Rule configuration (JSON)
    config = models.JSONField(default=dict, help_text="Rule configuration parameters")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"Rule: {self.name}"


class Notification(models.Model):
    """Notifications/alerts from the assistant"""

    TYPE_CHOICES = [
        ('reminder', 'Reminder'),
        ('alert', 'Alert'),
        ('info', 'Info'),
        ('warning', 'Warning'),
    ]

    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='info')
    is_read = models.BooleanField(default=False)

    # Link to the rule that triggered this notification
    triggered_by = models.ForeignKey(
        ReminderRule,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications'
    )

    # Generic relation to related object
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    object_id = models.PositiveIntegerField(null=True, blank=True)
    related_object = GenericForeignKey('content_type', 'object_id')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification: {self.title}"


class ChatMessage(models.Model):
    """Store chat history with the assistant"""

    ROLE_CHOICES = [
        ('user', 'User'),
        ('assistant', 'Assistant'),
    ]

    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()

    # Optional: command that was parsed from user message
    parsed_command = models.CharField(max_length=50, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        preview = self.content[:50] + "..." if len(self.content) > 50 else self.content
        return f"{self.role}: {preview}"
