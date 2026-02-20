from django.contrib import admin
from .models import SalesOrder, SalesOrderItem


class SalesOrderItemInline(admin.TabularInline):
    model = SalesOrderItem
    extra = 0


@admin.register(SalesOrder)
class SalesOrderAdmin(admin.ModelAdmin):
    list_display = ('order_number', 'customer', 'status', 'order_date', 'delivery_date')
    list_filter = ('status', 'order_date')
    search_fields = ('order_number', 'customer', 'po_number')
    inlines = [SalesOrderItemInline]


@admin.register(SalesOrderItem)
class SalesOrderItemAdmin(admin.ModelAdmin):
    list_display = ('sales_order', 'style_revision', 'total_quantity', 'unit_price')
