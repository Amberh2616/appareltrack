from django.contrib import admin
from .models import ExtractionRun, DraftReviewItem, UploadedDocument
from .models_blocks import DraftBlock, Revision as TechPackRevision


@admin.register(UploadedDocument)
class UploadedDocumentAdmin(admin.ModelAdmin):
    list_display = ('id', 'filename', 'file_type', 'status', 'file_url_display', 'created_at')
    list_filter = ('status', 'file_type')
    readonly_fields = ('id', 'created_at', 'updated_at', 'file_url_display')
    search_fields = ('filename',)

    def file_url_display(self, obj):
        return obj.file.url if obj.file else '—'
    file_url_display.short_description = 'File URL'


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
    search_fields = ('source_text',)  # 只搜 source_text，避免雙欄全文掃描
    readonly_fields = ('id', 'created_at', 'updated_at')
    list_per_page = 50
    show_full_result_count = False  # 關掉 COUNT(*) 全表查詢，大幅提速

    def source_text_short(self, obj):
        return obj.source_text[:50] if obj.source_text else ''
    source_text_short.short_description = 'Source'

    def translated_text_short(self, obj):
        return obj.translated_text[:50] if obj.translated_text else '(empty)'
    translated_text_short.short_description = 'Translation'
