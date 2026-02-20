from django.contrib import admin
from .models import ExtractionRun, DraftReviewItem


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
