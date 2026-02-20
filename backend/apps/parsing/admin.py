from django.contrib import admin
from .models import ExtractionRun, DraftReviewItem
from .models_blocks import DraftBlock, Revision as TechPackRevision


@admin.register(ExtractionRun)
class ExtractionRunAdmin(admin.ModelAdmin):
    list_display = ('id', 'document', 'status', 'confidence_score', 'started_at', 'completed_at')
    list_filter = ('status', 'ai_model')
    readonly_fields = ('id', 'started_at', 'completed_at')


@admin.register(DraftReviewItem)
class DraftReviewItemAdmin(admin.ModelAdmin):
    list_display = ('id', 'item_type', 'status', 'ai_confidence', 'reviewed_by', 'reviewed_at')
    list_filter = ('item_type', 'status')
    readonly_fields = ('id', 'reviewed_at')


@admin.register(TechPackRevision)
class TechPackRevisionAdmin(admin.ModelAdmin):
    list_display = ('id', 'filename', 'status', 'page_count', 'created_at')
    list_filter = ('status',)
    readonly_fields = ('id', 'created_at', 'updated_at')
    search_fields = ('filename',)


@admin.register(DraftBlock)
class DraftBlockAdmin(admin.ModelAdmin):
    list_display = ('id', 'source_text_short', 'translated_text_short', 'translation_status', 'block_type')
    list_filter = ('translation_status', 'block_type')
    search_fields = ('source_text', 'translated_text')
    readonly_fields = ('id', 'created_at', 'updated_at')

    def source_text_short(self, obj):
        return obj.source_text[:50] if obj.source_text else ''
    source_text_short.short_description = 'Source'

    def translated_text_short(self, obj):
        return obj.translated_text[:50] if obj.translated_text else '(empty)'
    translated_text_short.short_description = 'Translation'
