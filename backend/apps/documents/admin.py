from django.contrib import admin
from .models import Document


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ('filename', 'doc_type', 'file_kind', 'source', 'status', 'file_size', 'uploaded_by', 'uploaded_at')
    list_filter = ('doc_type', 'file_kind', 'source', 'status', 'uploaded_at')
    search_fields = ('filename', 'file_hash', 'storage_key')
    readonly_fields = ('id', 'file_hash', 'uploaded_at')
