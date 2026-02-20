"""
Phase 3: Sample Request System - Django Admin Configuration
"""

from django.contrib import admin
from .models import (
    SampleRequest,
    SampleCostEstimate,
    T2POForSample,
    T2POLineForSample,
    SampleMWO,
    Sample,
    SampleAttachment,
    SampleRun,
    SampleActuals
)


class SampleCostEstimateInline(admin.TabularInline):
    model = SampleCostEstimate
    extra = 0
    fields = ('estimate_version', 'status', 'estimated_total', 'currency', 'source')
    readonly_fields = ('estimate_version', 'snapshot_hash')


class T2POLineForSampleInline(admin.TabularInline):
    model = T2POLineForSample
    extra = 0
    fields = ('line_no', 'material_name', 'uom', 'consumption_per_piece',
              'wastage_pct', 'quantity_requested', 'unit_price', 'line_total')


class SampleInline(admin.TabularInline):
    model = Sample
    extra = 0
    fields = ('physical_ref', 'quantity_made', 'status', 'delivered_date')


class SampleAttachmentInline(admin.TabularInline):
    model = SampleAttachment
    extra = 0
    fields = ('file_type', 'caption', 'file_url')


class SampleRunInline(admin.TabularInline):
    model = SampleRun
    extra = 0
    fields = ('run_no', 'run_type', 'quantity', 'status', 'target_due_date')
    readonly_fields = ('run_no',)


@admin.register(SampleRequest)
class SampleRequestAdmin(admin.ModelAdmin):
    list_display = ('id', 'brand_name', 'request_type', 'quantity_requested',
                    'status', 'priority', 'due_date', 'created_at')
    list_filter = ('status', 'request_type', 'priority', 'need_quote_first')
    search_fields = ('brand_name', 'notes_internal', 'notes_customer')
    readonly_fields = ('id', 'created_at', 'updated_at', 'status_updated_at')

    fieldsets = (
        ('Basic Info', {
            'fields': ('id', 'revision', 'brand_name', 'request_type',
                      'request_type_custom', 'quantity_requested', 'size_set_json')
        }),
        ('Workflow', {
            'fields': ('need_quote_first', 'priority', 'due_date', 'purpose')
        }),
        ('Status', {
            'fields': ('status', 'status_updated_at')
        }),
        ('Notes', {
            'fields': ('notes_internal', 'notes_customer', 'brand_context_json')
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    inlines = [SampleRunInline, SampleCostEstimateInline, SampleInline, SampleAttachmentInline]


@admin.register(SampleCostEstimate)
class SampleCostEstimateAdmin(admin.ModelAdmin):
    list_display = ('id', 'sample_request', 'estimate_version', 'status',
                    'estimated_total', 'currency', 'source')
    list_filter = ('status', 'source', 'currency')
    readonly_fields = ('id', 'snapshot_hash', 'created_at', 'updated_at')

    fieldsets = (
        ('Basic Info', {
            'fields': ('id', 'sample_request', 'estimate_version')
        }),
        ('Status & Cost', {
            'fields': ('status', 'currency', 'valid_until', 'estimated_total')
        }),
        ('Breakdown', {
            'fields': ('breakdown_snapshot_json',)
        }),
        ('Provenance', {
            'fields': ('source', 'source_revision_id', 'snapshot_hash'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(T2POForSample)
class T2POForSampleAdmin(admin.ModelAdmin):
    list_display = ('po_no', 'supplier_name', 'status', 'delivery_date',
                    'total_amount', 'currency')
    list_filter = ('status', 'currency')
    search_fields = ('po_no', 'supplier_name')
    readonly_fields = ('snapshot_at', 'snapshot_hash', 'created_at', 'updated_at')

    fieldsets = (
        ('Basic Info', {
            'fields': ('sample_request', 'estimate', 'po_no', 'supplier_name')
        }),
        ('Status & Dates', {
            'fields': ('status', 'issued_at', 'confirmed_at', 'delivered_at', 'delivery_date')
        }),
        ('Cost', {
            'fields': ('currency', 'total_amount')
        }),
        ('Notes', {
            'fields': ('notes',)
        }),
        ('Snapshot Provenance', {
            'fields': ('source_revision_id', 'snapshot_at', 'snapshot_hash'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    inlines = [T2POLineForSampleInline]


@admin.register(T2POLineForSample)
class T2POLineForSampleAdmin(admin.ModelAdmin):
    list_display = ('t2po', 'line_no', 'material_name', 'uom',
                    'quantity_requested', 'unit_price', 'line_total')
    list_filter = ('uom',)
    search_fields = ('material_name', 'supplier_article_no')


@admin.register(SampleMWO)
class SampleMWOAdmin(admin.ModelAdmin):
    list_display = ('mwo_no', 'factory_name', 'status', 'due_date', 'created_at')
    list_filter = ('status',)
    search_fields = ('mwo_no', 'factory_name')
    readonly_fields = ('snapshot_at', 'snapshot_hash', 'created_at', 'updated_at')

    fieldsets = (
        ('Basic Info', {
            'fields': ('sample_request', 'estimate', 'mwo_no', 'factory_name')
        }),
        ('Status & Dates', {
            'fields': ('status', 'start_date', 'due_date')
        }),
        ('Snapshots', {
            'fields': ('bom_snapshot_json', 'construction_snapshot_json', 'qc_snapshot_json'),
            'classes': ('collapse',)
        }),
        ('Provenance', {
            'fields': ('source_revision_id', 'snapshot_at', 'snapshot_hash'),
            'classes': ('collapse',)
        }),
        ('Notes', {
            'fields': ('notes',)
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    inlines = [SampleInline]


@admin.register(Sample)
class SampleAdmin(admin.ModelAdmin):
    list_display = ('physical_ref', 'sample_request', 'quantity_made', 'status',
                    'delivered_date')
    list_filter = ('status',)
    search_fields = ('physical_ref',)
    readonly_fields = ('created_at', 'updated_at')

    fieldsets = (
        ('Basic Info', {
            'fields': ('sample_request', 'sample_mwo', 'physical_ref', 'quantity_made')
        }),
        ('Status & Dates', {
            'fields': ('status', 'received_date', 'delivered_date')
        }),
        ('Feedback', {
            'fields': ('customer_feedback', 'fit_comments')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    inlines = [SampleAttachmentInline]


@admin.register(SampleAttachment)
class SampleAttachmentAdmin(admin.ModelAdmin):
    list_display = ('file_type', 'caption', 'sample_request', 'sample', 'uploaded_at')
    list_filter = ('file_type',)
    search_fields = ('caption',)
    readonly_fields = ('uploaded_at',)


class SampleActualsInline(admin.StackedInline):
    model = SampleActuals
    extra = 0
    fields = (
        ('labor_minutes', 'labor_cost'),
        ('overhead_cost', 'shipping_cost', 'rework_cost'),
        'waste_pct_actual',
        'issues_notes',
        'recorded_at',
        'recorded_by'
    )
    readonly_fields = ('recorded_at',)


@admin.register(SampleRun)
class SampleRunAdmin(admin.ModelAdmin):
    list_display = ('id', 'sample_request', 'run_no', 'run_type', 'quantity',
                    'status', 'target_due_date', 'created_at')
    list_filter = ('status', 'run_type')
    search_fields = ('sample_request__brand_name', 'notes')
    readonly_fields = ('id', 'created_at', 'updated_at', 'status_updated_at')

    fieldsets = (
        ('Basic Information', {
            'fields': ('sample_request', 'run_no', 'run_type', 'quantity',
                      'target_due_date', 'revision')
        }),
        ('Usage & Costing', {
            'fields': ('guidance_usage', 'actual_usage', 'costing_version'),
            'classes': ('collapse',)
        }),
        ('Status & Tracking', {
            'fields': ('status', 'notes', 'created_by', 'status_updated_at')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

    inlines = [SampleActualsInline]


@admin.register(SampleActuals)
class SampleActualsAdmin(admin.ModelAdmin):
    list_display = ('sample_run', 'labor_cost', 'overhead_cost', 'shipping_cost',
                    'rework_cost', 'waste_pct_actual', 'recorded_at')
    list_filter = ('recorded_at',)
    search_fields = ('sample_run__sample_request__brand_name', 'issues_notes')
    readonly_fields = ('created_at', 'updated_at', 'recorded_at')
