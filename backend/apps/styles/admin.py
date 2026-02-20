from django.contrib import admin
from .models import Style, StyleRevision, BOMItem, Measurement, ConstructionStep


class BOMItemInline(admin.TabularInline):
    model = BOMItem
    extra = 0
    fields = ('item_number', 'category', 'material_name', 'supplier', 'supplier_article_no', 'consumption', 'consumption_maturity', 'unit')


class MeasurementInline(admin.TabularInline):
    model = Measurement
    extra = 0
    fields = ('point_name', 'values', 'unit')


@admin.register(Style)
class StyleAdmin(admin.ModelAdmin):
    list_display = ('style_number', 'style_name', 'season', 'customer', 'created_at')
    search_fields = ('style_number', 'style_name', 'customer')
    list_filter = ('season', 'customer')
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(StyleRevision)
class StyleRevisionAdmin(admin.ModelAdmin):
    list_display = ('style', 'revision_label', 'status', 'created_at', 'approved_at')
    list_filter = ('status',)
    search_fields = ('style__style_number', 'revision_label')
    readonly_fields = ('id', 'created_at', 'updated_at')
    inlines = [BOMItemInline, MeasurementInline]


@admin.register(BOMItem)
class BOMItemAdmin(admin.ModelAdmin):
    list_display = ('revision', 'item_number', 'category', 'material_name', 'supplier', 'supplier_article_no', 'color', 'material_status', 'consumption', 'unit', 'unit_price', 'leadtime_days', 'consumption_maturity')
    list_filter = ('category', 'material_status', 'consumption_maturity', 'is_verified')
    search_fields = ('material_name', 'supplier', 'supplier_article_no', 'color', 'material_status')


@admin.register(Measurement)
class MeasurementAdmin(admin.ModelAdmin):
    list_display = ('revision', 'point_name', 'unit', 'is_verified')
    list_filter = ('is_verified',)
    search_fields = ('point_name',)


@admin.register(ConstructionStep)
class ConstructionStepAdmin(admin.ModelAdmin):
    list_display = ('revision', 'step_number', 'description', 'is_verified')
    list_filter = ('is_verified',)
    search_fields = ('description',)
