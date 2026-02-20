from django.contrib import admin
from .models import ManufacturingWorkOrder


@admin.register(ManufacturingWorkOrder)
class ManufacturingWorkOrderAdmin(admin.ModelAdmin):
    list_display = (
        'mwo_number',
        'factory_name',
        'status',
        'issue_date',
        'target_completion'
    )
    list_filter = ('status', 'issue_date')
    search_fields = ('mwo_number', 'factory_name')
    readonly_fields = ('id', 'created_at', 'updated_at')
