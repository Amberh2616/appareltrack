from django.contrib import admin
from .models import AssistantTask, AssistantNote, ReminderRule, Notification, ChatMessage


@admin.register(AssistantTask)
class AssistantTaskAdmin(admin.ModelAdmin):
    list_display = ['title', 'priority', 'status', 'due_date', 'created_at']
    list_filter = ['priority', 'status']
    search_fields = ['title', 'description']
    ordering = ['-created_at']


@admin.register(AssistantNote)
class AssistantNoteAdmin(admin.ModelAdmin):
    list_display = ['id', 'content_preview', 'created_at']
    search_fields = ['content']
    ordering = ['-created_at']

    def content_preview(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
    content_preview.short_description = 'Content'


@admin.register(ReminderRule)
class ReminderRuleAdmin(admin.ModelAdmin):
    list_display = ['name', 'rule_type', 'is_active', 'created_at']
    list_filter = ['rule_type', 'is_active']
    search_fields = ['name']


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['title', 'notification_type', 'is_read', 'created_at']
    list_filter = ['notification_type', 'is_read']
    search_fields = ['title', 'message']
    ordering = ['-created_at']


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ['role', 'content_preview', 'parsed_command', 'created_at']
    list_filter = ['role', 'parsed_command']
    search_fields = ['content']
    ordering = ['-created_at']

    def content_preview(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
    content_preview.short_description = 'Content'
