from django.contrib import admin
from .models import OrderItemBOM, MarkerReport, TrimMeasurement


@admin.register(OrderItemBOM)
class OrderItemBOMAdmin(admin.ModelAdmin):
    list_display = (
        'order_item',
        'template_bom_item',
        'consumption_maturity',
        'pre_estimate_value',
        'confirmed_value',
        'locked_value',
        'consumption_per_piece',
        'source_type',
        'total_consumption'
    )
    list_filter = ('consumption_maturity', 'source_type', 'source')
    search_fields = ('template_bom_item__material_name', 'source_ref')
    readonly_fields = ('id', 'created_at', 'updated_at')
    fieldsets = (
        ('Basic Info', {
            'fields': ('order_item', 'template_bom_item')
        }),
        ('Consumption Values (Three-Stage)', {
            'fields': (
                'consumption_maturity',
                'pre_estimate_value',
                'confirmed_value',
                'locked_value',
                'consumption_per_piece',
                'total_consumption'
            )
        }),
        ('Evidence Tracking', {
            'fields': ('source_type', 'source_ref', 'source', 'source_reference')
        }),
        ('Pricing', {
            'fields': ('unit_price', 'total_cost')
        }),
        ('Metadata', {
            'fields': ('notes', 'created_at', 'updated_at')
        }),
    )


@admin.register(MarkerReport)
class MarkerReportAdmin(admin.ModelAdmin):
    list_display = (
        'order_item',
        'marker_date',
        'consumption_per_piece',
        'unit',
        'efficiency'
    )
    list_filter = ('marker_date',)
    readonly_fields = ('id', 'created_at')


@admin.register(TrimMeasurement)
class TrimMeasurementAdmin(admin.ModelAdmin):
    list_display = (
        'bom_item',
        'measurement_point',
        'measured_value',
        'calculated_consumption',
        'measured_at'
    )
    list_filter = ('applied_rule_id', 'measured_at')
    readonly_fields = ('id', 'measured_at')
