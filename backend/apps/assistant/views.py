from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny

from .models import AssistantTask, AssistantNote, Notification, ChatMessage
from .serializers import (
    AssistantTaskSerializer,
    AssistantNoteSerializer,
    NotificationSerializer,
    ChatMessageSerializer,
    ChatInputSerializer,
)
from .services.command_parser import parse_and_execute
from .services.task_service import TaskService, NoteService, NotificationService


class ChatView(APIView):
    """
    Main chat endpoint for the assistant.
    POST /api/v2/assistant/chat/
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ChatInputSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user_message = serializer.validated_data['message']

        # Save user message to history
        ChatMessage.objects.create(
            role='user',
            content=user_message,
        )

        # Parse and execute command
        response_data = parse_and_execute(user_message)

        # Save assistant response to history
        ChatMessage.objects.create(
            role='assistant',
            content=response_data.get('message', ''),
            parsed_command=response_data.get('type', 'unknown'),
        )

        return Response(response_data)


class ChatHistoryView(APIView):
    """
    Get chat history.
    GET /api/v2/assistant/chat/history/
    """
    permission_classes = [AllowAny]

    def get(self, request):
        limit = int(request.query_params.get('limit', 50))
        messages = ChatMessage.objects.order_by('-created_at')[:limit]
        # Reverse to get chronological order
        messages = list(reversed(messages))
        serializer = ChatMessageSerializer(messages, many=True)
        return Response(serializer.data)

    def delete(self, request):
        """Clear chat history."""
        ChatMessage.objects.all().delete()
        return Response({'message': 'Chat history cleared'})


class TaskViewSet(viewsets.ModelViewSet):
    """
    CRUD for assistant tasks.
    """
    queryset = AssistantTask.objects.all()
    serializer_class = AssistantTaskSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = AssistantTask.objects.all()

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Filter by priority
        priority = self.request.query_params.get('priority')
        if priority:
            queryset = queryset.filter(priority=priority)

        return queryset.order_by('-priority', 'due_date', '-created_at')

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark task as done."""
        task = self.get_object()
        task.status = 'done'
        task.save()
        return Response(AssistantTaskSerializer(task).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a task."""
        task = self.get_object()
        task.status = 'cancelled'
        task.save()
        return Response(AssistantTaskSerializer(task).data)


class NoteViewSet(viewsets.ModelViewSet):
    """
    CRUD for assistant notes.
    """
    queryset = AssistantNote.objects.all()
    serializer_class = AssistantNoteSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return AssistantNote.objects.order_by('-created_at')


class NotificationViewSet(viewsets.ModelViewSet):
    """
    CRUD for notifications.
    """
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = Notification.objects.all()

        # Filter by read status
        is_read = self.request.query_params.get('is_read')
        if is_read is not None:
            queryset = queryset.filter(is_read=is_read.lower() == 'true')

        return queryset.order_by('-created_at')

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark notification as read."""
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response(NotificationSerializer(notification).data)

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all notifications as read."""
        count = NotificationService.mark_all_as_read()
        return Response({'marked_count': count})

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get count of unread notifications."""
        count = Notification.objects.filter(is_read=False).count()
        return Response({'count': count})
