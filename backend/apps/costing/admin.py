from django.contrib import admin
from .models import (
    CostSheet, CostLine,
    UsageScenario, UsageLine,
    CostSheetGroup, CostSheetVersion, CostLineV2
)


class CostLineInline(admin.TabularInline):
    model = CostLine
    extra = 0
    readonly_fields = [
        'material_name',
        'supplier',
        'category',
        'consumption',
        'unit_price',
        'line_cost',
        'sort_order'
    ]
    fields = readonly_fields
    can_delete = False


@admin.register(CostSheet)
class CostSheetAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'revision',
        'costing_type',
        'version_no',
        'is_current',
        'material_cost',
        'unit_price',
        'created_at'
    ]
    list_filter = ['costing_type', 'is_current', 'created_at']
    search_fields = ['revision__filename', 'notes']
    readonly_fields = ['material_cost', 'total_cost', 'unit_price', 'created_at', 'updated_at']

    fieldsets = [
        ('基本資訊', {
            'fields': ['revision', 'costing_type', 'version_no', 'is_current']
        }),
        ('成本輸入', {
            'fields': [
                'labor_cost',
                'overhead_cost',
                'freight_cost',
                'packaging_cost',
                'testing_cost'
            ]
        }),
        ('定價參數', {
            'fields': ['margin_pct', 'wastage_pct']
        }),
        ('計算結果', {
            'fields': ['material_cost', 'total_cost', 'unit_price'],
            'classes': ['collapse']
        }),
        ('元數據', {
            'fields': ['notes', 'created_at', 'updated_at'],
            'classes': ['collapse']
        })
    ]

    inlines = [CostLineInline]


@admin.register(CostLine)
class CostLineAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'cost_sheet',
        'material_name',
        'consumption',
        'unit_price',
        'line_cost',
        'sort_order'
    ]
    list_filter = ['category']
    search_fields = ['material_name', 'supplier']
    readonly_fields = [
        'material_name',
        'supplier',
        'category',
        'unit',
        'consumption',
        'unit_price',
        'line_cost',
        'sort_order'
    ]
