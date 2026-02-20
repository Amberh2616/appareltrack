"""
Documents Serializers - v2.2.1
"""

from rest_framework import serializers
from .models import Document


class DocumentSerializer(serializers.ModelSerializer):
    """Standard Document serializer"""
    class Meta:
        model = Document
        fields = [
            'id', 'organization', 'doc_type', 'file_kind', 'source',
            'filename', 'file_size', 'file_hash', 'content_type',
            'storage_key', 'status', 'style_revision',
            'uploaded_by', 'uploaded_at',
        ]
        read_only_fields = ['id', 'uploaded_at', 'uploaded_by']


class DocumentUploadInitSerializer(serializers.Serializer):
    """Upload initialization request"""
    doc_type = serializers.ChoiceField(choices=Document.DOC_TYPE_CHOICES)
    file_kind = serializers.ChoiceField(choices=Document.FILE_KIND_CHOICES)
    filename = serializers.CharField(max_length=255)
    content_type = serializers.CharField(max_length=100)
    file_size = serializers.IntegerField(min_value=1)
    file_hash = serializers.CharField(max_length=64, required=False, allow_blank=True)
    source = serializers.ChoiceField(choices=Document.SOURCE_CHOICES, default='customer')


class DocumentUploadInitResponseSerializer(serializers.Serializer):
    """Upload initialization response"""
    document_id = serializers.UUIDField()
    storage_key = serializers.CharField()
    upload_url = serializers.URLField()
    expires_in = serializers.IntegerField()
    already_exists = serializers.BooleanField()


class DocumentUploadCompleteSerializer(serializers.Serializer):
    """Upload completion request"""
    file_hash = serializers.CharField(max_length=64)
    file_size = serializers.IntegerField(min_value=1)


class DocumentAttachSerializer(serializers.Serializer):
    """Attach document to revision"""
    revision_id = serializers.UUIDField()


class DocumentListSerializer(serializers.ModelSerializer):
    """Lightweight document list serializer"""
    doc_type_display = serializers.CharField(source='get_doc_type_display', read_only=True)
    file_kind_display = serializers.CharField(source='get_file_kind_display', read_only=True)
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Document
        fields = [
            'id', 'doc_type', 'doc_type_display', 'file_kind', 'file_kind_display',
            'source', 'source_display', 'filename', 'file_size',
            'status', 'status_display', 'uploaded_at',
        ]
