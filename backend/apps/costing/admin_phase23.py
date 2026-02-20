"""
Phase 2-3 Admin 配置（临时文件，稍后合并到 admin.py）
"""
from django.contrib import admin
from .models import UsageScenario, UsageLine, CostSheetGroup, CostSheetVersion, CostLineV2


class UsageLineInline(admin.TabularInline):
    model = UsageLine
    extra = 0
    fields = ['bom_item', 'consumption', 'consumption_unit', 'consumption_status', 'wastage_pct_override', 'sort_order']
    readonly_fields = ['bom_item']


@admin.register(UsageScenario)
class UsageScenarioAdmin(admin.ModelAdmin):
    list_display = ['id', 'revision', 'purpose', 'version_no', 'wastage_pct', 'status', 'is_locked_display', 'created_at']
    list_filter = ['purpose', 'status', 'created_at']
    search_fields = ['revision__filename', 'notes']
    readonly_fields = ['is_locked_display', 'locked_at', 'created_at']

    fieldsets = [
        ('基本資訊', {'fields': ['revision', 'purpose', 'version_no', 'status']}),
        ('參數', {'fields': ['wastage_pct', 'rounding_rule']}),
        ('鎖定狀態', {'fields': ['is_locked_display', 'locked_at', 'locked_first_by_cost_sheet'], 'classes': ['collapse']}),
        ('元數據', {'fields': ['notes', 'created_by', 'created_at'], 'classes': ['collapse']})
    ]

    inlines = [UsageLineInline]

    def is_locked_display(self, obj):
        return obj.is_locked()
    is_locked_display.short_description = 'Is Locked?'
    is_locked_display.boolean = True


@admin.register(UsageLine)
class UsageLineAdmin(admin.ModelAdmin):
    list_display = ['id', 'usage_scenario', 'bom_item', 'consumption', 'consumption_unit', 'consumption_status', 'sort_order']
    list_filter = ['consumption_status', 'consumption_unit']
    search_fields = ['bom_item__material_name']
    readonly_fields = ['adjusted_consumption_display']

    fieldsets = [
        ('關聯', {'fields': ['usage_scenario', 'bom_item']}),
        ('用量', {'fields': ['consumption', 'consumption_unit', 'consumption_status', 'wastage_pct_override', 'adjusted_consumption_display']}),
        ('審核', {'fields': ['confirmed_by', 'confirmed_at'], 'classes': ['collapse']}),
        ('排序', {'fields': ['sort_order']})
    ]

    def adjusted_consumption_display(self, obj):
        return obj.adjusted_consumption
    adjusted_consumption_display.short_description = 'Adjusted Consumption'


@admin.register(CostSheetGroup)
class CostSheetGroupAdmin(admin.ModelAdmin):
    list_display = ['id', 'style', 'created_at', 'updated_at']
    search_fields = ['style__style_number', 'style__style_name']
    readonly_fields = ['created_at', 'updated_at']


class CostLineV2Inline(admin.TabularInline):
    model = CostLineV2
    extra = 0
    fields = ['material_name', 'category', 'consumption_snapshot', 'consumption_adjusted', 'is_consumption_adjusted', 'unit_price_snapshot', 'unit_price_adjusted', 'is_price_adjusted', 'line_cost', 'sort_order']
    readonly_fields = ['material_name', 'category', 'consumption_snapshot', 'unit_price_snapshot', 'line_cost']


@admin.register(CostSheetVersion)
class CostSheetVersionAdmin(admin.ModelAdmin):
    list_display = ['id', 'cost_sheet_group', 'costing_type', 'version_no', 'status', 'unit_price', 'created_at']
    list_filter = ['costing_type', 'status', 'created_at']
    search_fields = ['cost_sheet_group__style__style_number', 'change_reason']
    readonly_fields = ['material_cost', 'total_cost', 'unit_price', 'created_at', 'submitted_at', 'can_edit_display']

    fieldsets = [
        ('基本資訊', {'fields': ['cost_sheet_group', 'costing_type', 'version_no', 'status', 'can_edit_display']}),
        ('Evidence 綁定', {'fields': ['techpack_revision', 'usage_scenario']}),
        ('報價參數', {'fields': ['labor_cost', 'overhead_cost', 'freight_cost', 'packing_cost', 'margin_pct']}),
        ('幣別', {'fields': ['currency', 'exchange_rate'], 'classes': ['collapse']}),
        ('計算結果', {'fields': ['material_cost', 'total_cost', 'unit_price'], 'classes': ['collapse']}),
        ('版本關係', {'fields': ['superseded_by', 'cloned_from', 'change_reason'], 'classes': ['collapse']}),
        ('元數據', {'fields': ['created_by', 'created_at', 'submitted_by', 'submitted_at'], 'classes': ['collapse']})
    ]

    inlines = [CostLineV2Inline]

    def can_edit_display(self, obj):
        return obj.can_edit()
    can_edit_display.short_description = 'Can Edit?'
    can_edit_display.boolean = True


@admin.register(CostLineV2)
class CostLineV2Admin(admin.ModelAdmin):
    list_display = ['id', 'cost_sheet_version', 'material_name', 'consumption_adjusted', 'unit_price_adjusted', 'line_cost', 'is_consumption_adjusted', 'is_price_adjusted', 'sort_order']
    list_filter = ['category', 'is_consumption_adjusted', 'is_price_adjusted']
    search_fields = ['material_name', 'supplier']
    readonly_fields = ['source_revision_id', 'source_usage_scenario_id', 'source_bom_item_id', 'source_usage_line_id', 'consumption_snapshot', 'unit_price_snapshot', 'line_cost']

    fieldsets = [
        ('關聯', {'fields': ['cost_sheet_version']}),
        ('快照來源', {'fields': ['source_revision_id', 'source_usage_scenario_id', 'source_usage_scenario_version_no', 'source_bom_item_id', 'source_usage_line_id'], 'classes': ['collapse']}),
        ('物料識別', {'fields': ['material_name', 'material_name_zh', 'category', 'supplier', 'supplier_article_no', 'unit']}),
        ('用量與價格', {'fields': ['consumption_snapshot', 'consumption_adjusted', 'is_consumption_adjusted', 'unit_price_snapshot', 'unit_price_adjusted', 'is_price_adjusted', 'adjustment_reason']}),
        ('計算結果', {'fields': ['line_cost', 'sort_order']}),
        ('元數據', {'fields': ['adjusted_by', 'adjusted_at'], 'classes': ['collapse']})
    ]
