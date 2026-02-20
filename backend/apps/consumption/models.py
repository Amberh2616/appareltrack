"""
Consumption Models - v2.2.1
OrderItemBOM (two-level BOM architecture), MarkerReport, TrimMeasurement
"""

from django.db import models
import uuid


class OrderItemBOM(models.Model):
    """
    Order-level BOM instance (CRITICAL MODEL!)
    Two-level BOM architecture: BOMItem (template) → OrderItemBOM (instance)

    Lifecycle: unknown → pre_estimate → confirmed → locked
    """
    CONSUMPTION_MATURITY_CHOICES = [
        ('unknown', 'Unknown'),
        ('pre_estimate', 'Pre-Estimate'),
        ('confirmed', 'Confirmed'),
        ('locked', 'Locked'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Links to order and template
    order_item = models.ForeignKey(
        'orders.SalesOrderItem',
        on_delete=models.CASCADE,
        related_name='bom_items'
    )
    template_bom_item = models.ForeignKey(
        'styles.BOMItem',
        on_delete=models.PROTECT,
        related_name='order_instances',
        help_text="The template BOM item this is based on"
    )

    # Order-specific consumption (can override template)
    consumption_per_piece = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        help_text="Actual consumption for this specific order (current active value)"
    )
    consumption_maturity = models.CharField(
        max_length=20,
        choices=CONSUMPTION_MATURITY_CHOICES,
        default='unknown'
    )

    # Three-stage consumption values (BOM → PO Phase 1)
    pre_estimate_value = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Estimated consumption (for RFQ PO)"
    )
    confirmed_value = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Confirmed consumption (from marker/sample, for Production PO)"
    )
    locked_value = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Locked consumption (frozen before PP, for final Production PO)"
    )

    # Total calculation
    total_consumption = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        help_text="Order quantity × consumption_per_piece"
    )

    # Evidence/source of consumption value (legacy fields, keep for backward compatibility)
    source = models.CharField(
        max_length=50,
        blank=True,
        help_text="DEPRECATED: Use source_type instead. e.g., 'marker_report', 'trim_rule_TRIM-001', 'manual_entry'"
    )
    source_reference = models.ForeignKey(
        'MarkerReport',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="DEPRECATED: Use source_ref instead. Link to marker report if source is marker"
    )

    # New evidence tracking (BOM → PO Phase 1)
    SOURCE_TYPE_CHOICES = [
        ('tech_pack', 'Tech Pack'),
        ('marker', 'Marker Report'),
        ('trim_rule', 'Trim Rule'),
        ('manual', 'Manual Entry'),
    ]
    source_type = models.CharField(
        max_length=20,
        choices=SOURCE_TYPE_CHOICES,
        blank=True,
        help_text="Type of evidence for consumption value"
    )
    source_ref = models.CharField(
        max_length=200,
        blank=True,
        help_text="Reference ID/code (e.g., 'MARKER-2024-001', 'TRIM-005', marker UUID)"
    )

    # Pricing (order-specific)
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    total_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )

    # Metadata
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'order_item_bom'
        verbose_name = 'Order Item BOM'
        verbose_name_plural = 'Order Item BOMs'
        ordering = ['template_bom_item__item_number']

    def __str__(self):
        return f"{self.order_item} - {self.template_bom_item.material_name}"


class MarkerReport(models.Model):
    """
    Marker/排版圖 report for fabric consumption
    Provides evidence for consumption maturity: unknown → confirmed
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    order_item = models.ForeignKey(
        'orders.SalesOrderItem',
        on_delete=models.CASCADE,
        related_name='marker_reports'
    )

    # Marker info
    marker_date = models.DateField()
    fabric_width = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        help_text="Fabric width in cm or inches"
    )
    fabric_width_unit = models.CharField(max_length=10, default='cm')

    # Results
    consumption_per_piece = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        help_text="Yards or meters per piece from marker"
    )
    unit = models.CharField(max_length=20)
    efficiency = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Marker efficiency percentage"
    )

    # File
    marker_file = models.ForeignKey(
        'documents.Document',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    # Metadata
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True
    )

    class Meta:
        db_table = 'marker_reports'
        verbose_name = 'Marker Report'
        verbose_name_plural = 'Marker Reports'
        ordering = ['-created_at']

    def __str__(self):
        return f"Marker for {self.order_item} - {self.consumption_per_piece} {self.unit}/pc"


class TrimMeasurement(models.Model):
    """
    Trim actual measurement from sample
    Provides evidence for trim consumption calculation
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    order_item = models.ForeignKey(
        'orders.SalesOrderItem',
        on_delete=models.CASCADE,
        related_name='trim_measurements'
    )
    bom_item = models.ForeignKey(
        'styles.BOMItem',
        on_delete=models.CASCADE,
        related_name='trim_measurements'
    )

    # Measurement
    measured_value = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Actual measured value from sample"
    )
    unit = models.CharField(max_length=20)

    # Measurement point (e.g., "waist_opening", "neck_circumference")
    measurement_point = models.CharField(max_length=100)

    # Applied rule (if using trim rules library)
    applied_rule_id = models.CharField(
        max_length=20,
        blank=True,
        help_text="e.g., TRIM-001"
    )

    # Calculated consumption
    calculated_consumption = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        help_text="Result after applying rule"
    )

    # Metadata
    measured_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True
    )
    measured_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'trim_measurements'
        verbose_name = 'Trim Measurement'
        verbose_name_plural = 'Trim Measurements'
        ordering = ['-measured_at']

    def __str__(self):
        return f"{self.bom_item.material_name} - {self.measured_value} {self.unit}"
