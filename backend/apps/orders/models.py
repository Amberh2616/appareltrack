"""
Orders Models - v2.2.1
Sales orders and order items
"""

from django.db import models
import uuid

from apps.core.managers import TenantManager


class SalesOrder(models.Model):
    """
    Sales order from customer
    """
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('confirmed', 'Confirmed'),
        ('in_production', 'In Production'),
        ('shipped', 'Shipped'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        'core.Organization',
        on_delete=models.CASCADE,
        related_name='sales_orders'
    )

    # Order info
    # SaaS-Ready: Changed from unique=True to unique_together with organization
    order_number = models.CharField(max_length=50, db_index=True)
    customer = models.CharField(max_length=200)
    po_number = models.CharField(max_length=100, blank=True)

    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft'
    )

    # Dates
    order_date = models.DateField()
    delivery_date = models.DateField()

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'sales_orders'
        verbose_name = 'Sales Order'
        verbose_name_plural = 'Sales Orders'
        ordering = ['-created_at']
        # SaaS-Ready: Order number unique within organization only
        unique_together = [['organization', 'order_number']]

    # SaaS-Ready: Tenant-aware manager
    objects = TenantManager()

    def __str__(self):
        return f"{self.order_number} - {self.customer}"


class SalesOrderItem(models.Model):
    """
    Line item in a sales order (Style + Quantity + Size breakdown)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sales_order = models.ForeignKey(
        SalesOrder,
        on_delete=models.CASCADE,
        related_name='items'
    )
    style_revision = models.ForeignKey(
        'styles.StyleRevision',
        on_delete=models.PROTECT,
        related_name='order_items'
    )

    # Quantities
    total_quantity = models.IntegerField()
    size_breakdown = models.JSONField(
        help_text='{"XS": 100, "S": 200, "M": 300, ...}'
    )

    # Pricing
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = 'sales_order_items'
        verbose_name = 'Sales Order Item'
        verbose_name_plural = 'Sales Order Items'

    def __str__(self):
        return f"{self.sales_order.order_number} - {self.style_revision}"


class ProductionOrder(models.Model):
    """
    Production Order (大貨訂單) - Bulk order from customer

    This represents the confirmed bulk order after:
    1. Sample runs (Proto, Fit, Size Set) completed
    2. Bulk costing confirmed
    3. Customer confirms the order

    Flow: SampleRuns → Bulk Costing → ProductionOrder → MRP → PurchaseOrder
    """
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('confirmed', 'Confirmed'),
        ('materials_ordered', 'Materials Ordered'),
        ('in_production', 'In Production'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        'core.Organization',
        on_delete=models.CASCADE,
        related_name='production_orders'
    )

    # Order identification
    po_number = models.CharField(
        max_length=50,
        db_index=True,
        help_text='Customer PO number'
    )
    order_number = models.CharField(
        max_length=50,
        db_index=True,
        help_text='Internal production order number'
    )

    # Customer info
    customer = models.CharField(max_length=200)
    customer_po_ref = models.CharField(
        max_length=100,
        blank=True,
        help_text='Customer PO reference'
    )

    # Link to style/revision
    style_revision = models.ForeignKey(
        'styles.StyleRevision',
        on_delete=models.PROTECT,
        related_name='production_orders'
    )

    # Link to confirmed bulk costing (optional, for price reference)
    bulk_costing = models.ForeignKey(
        'costing.CostSheetVersion',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='production_orders',
        help_text='Confirmed bulk costing for this order'
    )

    # Link to approved sample run (P18: 追蹤哪個樣衣階段批准進入大貨)
    approved_sample_run = models.ForeignKey(
        'samples.SampleRun',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='production_orders',
        help_text='The Sample Run (typically Size Set) that was approved before bulk production'
    )

    # Quantities
    total_quantity = models.IntegerField(help_text='Total order quantity')
    size_breakdown = models.JSONField(
        help_text='{"XS": 100, "S": 200, "M": 300, "L": 200, "XL": 100}'
    )

    # Pricing
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Agreed FOB price per unit'
    )
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text='Total order amount'
    )
    currency = models.CharField(max_length=3, default='USD')

    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft'
    )

    # Dates
    order_date = models.DateField()
    delivery_date = models.DateField(help_text='Target delivery date')
    actual_delivery = models.DateField(null=True, blank=True)

    # MRP calculation status
    mrp_calculated = models.BooleanField(
        default=False,
        help_text='Whether material requirements have been calculated'
    )
    mrp_calculated_at = models.DateTimeField(null=True, blank=True)

    # Metadata
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='production_orders_created'
    )

    class Meta:
        db_table = 'production_orders'
        verbose_name = 'Production Order'
        verbose_name_plural = 'Production Orders'
        ordering = ['-created_at']
        unique_together = [['organization', 'order_number']]

    objects = TenantManager()

    def __str__(self):
        return f"{self.order_number} - {self.customer} ({self.total_quantity} pcs)"


class MaterialRequirement(models.Model):
    """
    Material Requirement (物料需求) - MRP calculation result

    Calculation: order_qty × consumption × (1 + wastage%)

    This tracks the required quantity for each material based on:
    - ProductionOrder quantity
    - BOM consumption (from confirmed/locked UsageScenario)
    - Wastage percentage
    """
    STATUS_CHOICES = [
        ('calculated', 'Calculated'),
        ('ordered', 'Ordered'),
        ('received', 'Received'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    production_order = models.ForeignKey(
        ProductionOrder,
        on_delete=models.CASCADE,
        related_name='material_requirements'
    )

    # Link to BOM item (source of material info)
    bom_item = models.ForeignKey(
        'styles.BOMItem',
        on_delete=models.PROTECT,
        related_name='material_requirements'
    )

    # Snapshot of material info (for traceability)
    material_name = models.CharField(max_length=255)
    material_name_zh = models.CharField(max_length=255, blank=True)
    category = models.CharField(max_length=50)
    supplier = models.CharField(max_length=255, blank=True)
    supplier_article_no = models.CharField(max_length=100, blank=True)
    unit = models.CharField(max_length=20)

    # Consumption data (from UsageScenario)
    consumption_per_piece = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        help_text='Consumption per garment'
    )
    wastage_pct = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=5.00,
        help_text='Wastage percentage'
    )

    # Calculated requirements
    order_quantity = models.IntegerField(
        help_text='Order quantity (from ProductionOrder)'
    )
    gross_requirement = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        help_text='order_qty × consumption'
    )
    wastage_quantity = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        help_text='gross_requirement × wastage%'
    )
    total_requirement = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        help_text='gross_requirement + wastage_quantity'
    )

    # Stock and ordering
    current_stock = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        default=0,
        help_text='Current inventory (if tracked)'
    )
    order_quantity_needed = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        help_text='total_requirement - current_stock (if positive)'
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='calculated'
    )

    # Review status (before generating PO)
    is_reviewed = models.BooleanField(
        default=False,
        help_text='Whether this requirement has been reviewed'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(
        blank=True,
        help_text='Notes from review process'
    )
    # Allow editing during review
    reviewed_quantity = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        null=True,
        blank=True,
        help_text='Adjusted quantity after review (if different from calculated)'
    )
    reviewed_unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Confirmed unit price for this material'
    )
    # Delivery planning
    required_date = models.DateField(
        null=True,
        blank=True,
        help_text='物料需求日期（生產需要的時間）'
    )
    expected_delivery = models.DateField(
        null=True,
        blank=True,
        help_text='預計交期（從供應商 lead time 計算）'
    )

    # Link to generated PO (if any)
    purchase_order_line = models.ForeignKey(
        'procurement.POLine',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='material_requirements',
        help_text='Generated PO line for this requirement'
    )

    # Metadata
    calculated_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'material_requirements'
        verbose_name = 'Material Requirement'
        verbose_name_plural = 'Material Requirements'
        ordering = ['category', 'material_name']
        unique_together = [['production_order', 'bom_item']]

    def __str__(self):
        return f"{self.production_order.order_number} - {self.material_name} ({self.total_requirement} {self.unit})"

    def calculate_requirements(self):
        """
        Calculate material requirements based on consumption and wastage

        Formula:
        - gross = order_qty × consumption
        - wastage = gross × wastage%
        - total = gross + wastage
        - order_needed = max(0, total - current_stock)
        """
        from decimal import Decimal, ROUND_HALF_UP

        self.gross_requirement = (
            Decimal(str(self.order_quantity)) * self.consumption_per_piece
        ).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)

        self.wastage_quantity = (
            self.gross_requirement * (self.wastage_pct / Decimal('100'))
        ).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)

        self.total_requirement = (
            self.gross_requirement + self.wastage_quantity
        ).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)

        self.order_quantity_needed = max(
            Decimal('0'),
            self.total_requirement - self.current_stock
        ).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
