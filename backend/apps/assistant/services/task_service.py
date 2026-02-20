"""
Task Service for Assistant

Manages tasks, notes, and notifications.
"""

from datetime import date, timedelta
from typing import Optional, List, Dict, Any
from django.contrib.contenttypes.models import ContentType

from apps.assistant.models import AssistantTask, AssistantNote, Notification


class TaskService:
    """Service for managing assistant tasks."""

    @staticmethod
    def create_task(
        title: str,
        description: str = '',
        priority: str = 'medium',
        due_date: Optional[date] = None,
        related_object: Optional[Any] = None,
    ) -> AssistantTask:
        """Create a new task."""
        task_data = {
            'title': title,
            'description': description,
            'priority': priority,
            'status': 'pending',
            'due_date': due_date,
        }

        if related_object:
            content_type = ContentType.objects.get_for_model(related_object)
            task_data['content_type'] = content_type
            task_data['object_id'] = related_object.pk

        return AssistantTask.objects.create(**task_data)

    @staticmethod
    def get_tasks(
        status: Optional[str] = None,
        priority: Optional[str] = None,
        limit: int = 50,
    ) -> List[AssistantTask]:
        """Get tasks with optional filters."""
        queryset = AssistantTask.objects.all()

        if status:
            queryset = queryset.filter(status=status)
        if priority:
            queryset = queryset.filter(priority=priority)

        return list(queryset.order_by('-priority', 'due_date')[:limit])

    @staticmethod
    def update_task_status(task_id: int, new_status: str) -> Optional[AssistantTask]:
        """Update task status."""
        try:
            task = AssistantTask.objects.get(id=task_id)
            task.status = new_status
            task.save()
            return task
        except AssistantTask.DoesNotExist:
            return None

    @staticmethod
    def delete_task(task_id: int) -> bool:
        """Delete a task."""
        try:
            task = AssistantTask.objects.get(id=task_id)
            task.delete()
            return True
        except AssistantTask.DoesNotExist:
            return False


class NoteService:
    """Service for managing notes."""

    @staticmethod
    def create_note(
        content: str,
        related_object: Optional[Any] = None,
    ) -> AssistantNote:
        """Create a new note."""
        note_data = {'content': content}

        if related_object:
            content_type = ContentType.objects.get_for_model(related_object)
            note_data['content_type'] = content_type
            note_data['object_id'] = related_object.pk

        return AssistantNote.objects.create(**note_data)

    @staticmethod
    def get_notes(limit: int = 50) -> List[AssistantNote]:
        """Get recent notes."""
        return list(AssistantNote.objects.order_by('-created_at')[:limit])

    @staticmethod
    def get_notes_for_object(obj: Any) -> List[AssistantNote]:
        """Get notes for a specific object."""
        content_type = ContentType.objects.get_for_model(obj)
        return list(
            AssistantNote.objects.filter(
                content_type=content_type,
                object_id=obj.pk
            ).order_by('-created_at')
        )


class NotificationService:
    """Service for managing notifications."""

    @staticmethod
    def create_notification(
        title: str,
        message: str,
        notification_type: str = 'info',
        related_object: Optional[Any] = None,
    ) -> Notification:
        """Create a new notification."""
        notif_data = {
            'title': title,
            'message': message,
            'notification_type': notification_type,
        }

        if related_object:
            content_type = ContentType.objects.get_for_model(related_object)
            notif_data['content_type'] = content_type
            notif_data['object_id'] = related_object.pk

        return Notification.objects.create(**notif_data)

    @staticmethod
    def get_unread_notifications(limit: int = 20) -> List[Notification]:
        """Get unread notifications."""
        return list(
            Notification.objects.filter(is_read=False)
            .order_by('-created_at')[:limit]
        )

    @staticmethod
    def mark_as_read(notification_id: int) -> bool:
        """Mark a notification as read."""
        try:
            notif = Notification.objects.get(id=notification_id)
            notif.is_read = True
            notif.save()
            return True
        except Notification.DoesNotExist:
            return False

    @staticmethod
    def mark_all_as_read() -> int:
        """Mark all notifications as read. Returns count of updated."""
        return Notification.objects.filter(is_read=False).update(is_read=True)
