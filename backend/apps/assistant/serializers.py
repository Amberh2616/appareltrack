from rest_framework import serializers
from .models import AssistantTask, AssistantNote, Notification, ChatMessage


class AssistantTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssistantTask
        fields = [
            'id', 'title', 'description', 'priority', 'status',
            'due_date', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class AssistantNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssistantNote
        fields = ['id', 'content', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            'id', 'title', 'message', 'notification_type',
            'is_read', 'created_at'
        ]
        read_only_fields = ['created_at']


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ['id', 'role', 'content', 'parsed_command', 'created_at']
        read_only_fields = ['created_at']


class ChatInputSerializer(serializers.Serializer):
    """Serializer for chat input from user."""
    message = serializers.CharField(max_length=500)


class ChatResponseSerializer(serializers.Serializer):
    """Serializer for chat response from assistant."""
    type = serializers.CharField()
    message = serializers.CharField()
    items = serializers.ListField(required=False)
    count = serializers.IntegerField(required=False)
    commands = serializers.ListField(required=False)
    stats = serializers.DictField(required=False)
    email_draft = serializers.DictField(required=False, allow_null=True)
    success = serializers.BooleanField(required=False)
    suggestion = serializers.CharField(required=False)
