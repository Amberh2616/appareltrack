"""
Procurement Models - v2.3.0
Purchase orders, suppliers, materials
"""

from django.db import models
import uuid

from apps.core.managers import TenantManager


class Supplier(models.Model):
    """
    Supplier/vendor information
    """
    SUPPLIER_TYPE_CHOICES = [
        ('fabric', 'Fabric Supplier'),
        ('trim', 'Trim Supplier'),
        ('label', 'Label Supplier'),
        ('packaging', 'Packaging Supplier'),
        ('factory', 'Garment Factory'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        'core.Organization',
        on_delete=models.CASCADE,
        related_name='suppliers'
    )

    # Basic info
    name = models.CharField(max_length=200)
    supplier_code = models.CharField(max_length=50, blank=True)
    supplier_type = models.CharField(max_length=50, choices=SUPPLIER_TYPE_CHOICES)

    # Contact
    contact_person = models.CharField(max_length=100, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    address = models.TextField(blank=True)

    # Terms
    payment_terms = models.CharField(max_length=100, blank=True)
    lead_time_days = models.IntegerField(null=True, blank=True)

    # Status
    is_active = models.BooleanField(default=True)

    # Metadata
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'suppliers'
        verbose_name = 'Supplier'
        verbose_name_plural = 'Suppliers'
        ordering = ['name']

    # SaaS-Ready: Tenant-aware manager
    objects = TenantManager()

    def __str__(self):
        return f"{self.name} ({self.get_supplier_type_display()})"


class Material(models.Model):
    """
    Material Master Data (物料主檔)
    Central repository for all materials used across styles
    Can be linked from BOMItem via article_no or material FK
    """
    CATEGORY_CHOICES = [
        ('fabric', 'Fabric'),
        ('trim', 'Trim'),
        ('label', 'Label'),
        ('packaging', 'Packaging'),
    ]

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('pending_approval', 'Pending Approval'),
        ('approved', 'Approved'),
        ('discontinued', 'Discontinued'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        'core.Organization',
        on_delete=models.CASCADE,
        related_name='materials'
    )

    # Basic info
    article_no = models.CharField(
        max_length=100,
        db_index=True,
        help_text="Supplier article number (unique per supplier)"
    )
    name = models.CharField(max_length=200, help_text="Material name in English")
    name_zh = models.CharField(
        max_length=200,
        blank=True,
        help_text="Material name in Chinese"
    )
    description = models.TextField(blank=True)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)

    # Supplier link
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,
        related_name='materials',
        null=True,
        blank=True
    )

    # Specifications
    color = models.CharField(max_length=100, blank=True)
    color_code = models.CharField(max_length=50, blank=True)
    composition = models.CharField(
        max_length=200,
        blank=True,
        help_text="e.g., 80% Nylon, 20% Spandex"
    )
    weight = models.CharField(
        max_length=50,
        blank=True,
        help_text="e.g., 180 GSM"
    )
    width = models.CharField(
        max_length=50,
        blank=True,
        help_text="e.g., 150 cm"
    )
    unit = models.CharField(
        max_length=20,
        default='yards',
        help_text="Standard unit: yards, meters, pcs, etc."
    )

    # Pricing
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Standard unit price"
    )
    currency = models.CharField(
        max_length=3,
        default='USD',
        help_text="Currency code: USD, TWD, CNY, etc."
    )
    moq = models.IntegerField(
        null=True,
        blank=True,
        help_text="Minimum Order Quantity"
    )

    # Lead time & wastage
    lead_time_days = models.IntegerField(
        null=True,
        blank=True,
        help_text="Standard lead time in days"
    )
    wastage_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=5.00,
        help_text="Standard wastage percentage"
    )

    # Status & approval
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active'
    )
    is_active = models.BooleanField(default=True)

    # Metadata
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'materials'
        verbose_name = 'Material'
        verbose_name_plural = 'Materials'
        ordering = ['name']
        # Article number unique within organization + supplier
        unique_together = [['organization', 'supplier', 'article_no']]

    # SaaS-Ready: Tenant-aware manager
    objects = TenantManager()

    def __str__(self):
        supplier_name = self.supplier.name if self.supplier else 'No Supplier'
        return f"{self.article_no} - {self.name} ({supplier_name})"


class PurchaseOrder(models.Model):
    """
    Purchase order to supplier
    """
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending_review', 'Pending Review'),  # 待審核
        ('ready', 'Ready to Send'),  # 審核完成可發送
        ('sent', 'Sent'),
        ('confirmed', 'Confirmed'),
        ('in_production', 'In Production'),  # P23: 生產中
        ('shipped', 'Shipped'),  # P23: 已出貨
        ('partial_received', 'Partial Received'),
        ('received', 'Received'),
        ('cancelled', 'Cancelled'),
    ]

    PO_TYPE_CHOICES = [
        ('rfq', 'RFQ (Request for Quotation)'),
        ('production', 'Production PO'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        'core.Organization',
        on_delete=models.CASCADE,
        related_name='purchase_orders'
    )

    # PO info
    # SaaS-Ready: Changed from unique=True to unique_together with organization
    po_number = models.CharField(max_length=50, db_index=True)
    po_type = models.CharField(
        max_length=20,
        choices=PO_TYPE_CHOICES,
        default='rfq',
        help_text="RFQ allows pre_estimate/confirmed/locked; Production requires confirmed/locked only"
    )
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,
        related_name='purchase_orders'
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft'
    )

    # Dates
    po_date = models.DateField()
    expected_delivery = models.DateField()
    actual_delivery = models.DateField(null=True, blank=True)

    # Totals
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )

    # Email tracking (P24)
    sent_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Email 發送時間'
    )
    sent_to_email = models.EmailField(
        blank=True,
        help_text='發送目標 Email'
    )
    sent_count = models.IntegerField(
        default=0,
        help_text='發送次數'
    )

    # Metadata
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True
    )

    class Meta:
        db_table = 'purchase_orders'
        verbose_name = 'Purchase Order'
        verbose_name_plural = 'Purchase Orders'
        ordering = ['-created_at']
        # SaaS-Ready: PO number unique within organization only
        unique_together = [['organization', 'po_number']]

    # SaaS-Ready: Tenant-aware manager
    objects = TenantManager()

    def __str__(self):
        return f"{self.po_number} - {self.supplier.name}"

    @property
    def all_lines_confirmed(self) -> bool:
        """Check if all lines are confirmed (ready for PDF/send)"""
        lines = self.lines.all()
        if not lines.exists():
            return False
        return all(line.is_confirmed for line in lines)

    @property
    def confirmed_lines_count(self) -> int:
        """Count of confirmed lines"""
        return self.lines.filter(is_confirmed=True).count()

    @property
    def total_lines_count(self) -> int:
        """Total number of lines"""
        return self.lines.count()

    # P23: Overdue detection properties
    @property
    def is_overdue(self) -> bool:
        """
        判斷 PO 是否逾期：
        - expected_delivery < today
        - status not in ['received', 'cancelled']
        """
        from datetime import date
        if self.status in ['received', 'cancelled']:
            return False
        if not self.expected_delivery:
            return False
        return self.expected_delivery < date.today()

    @property
    def days_overdue(self) -> int:
        """
        計算逾期天數（若未逾期返回 0）
        """
        from datetime import date
        if not self.is_overdue:
            return 0
        return (date.today() - self.expected_delivery).days

    @property
    def overdue_lines_count(self) -> int:
        """
        計算逾期行數（基於 POLine.expected_delivery 或 required_date）
        """
        from datetime import date
        today = date.today()
        count = 0
        for line in self.lines.all():
            # Check line-level expected_delivery first, then required_date
            check_date = line.expected_delivery or line.required_date
            if check_date and check_date < today:
                if line.delivery_status not in ['received']:
                    count += 1
        return count


class POLine(models.Model):
    """
    Line item in a purchase order
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name='lines'
    )

    # Material reference (link to Material master)
    material = models.ForeignKey(
        Material,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='po_lines',
        help_text="Link to Material master data"
    )
    order_item_bom = models.ForeignKey(
        'consumption.OrderItemBOM',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        help_text="Link to OrderItemBOM if this PO is for a specific order"
    )

    # Item details (denormalized for display)
    material_name = models.CharField(max_length=200)
    color = models.CharField(max_length=100, blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=4)
    unit = models.CharField(max_length=20)

    # Pricing
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    line_total = models.DecimalField(max_digits=12, decimal_places=2)

    # Delivery tracking (per line)
    quantity_received = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        default=0
    )
    required_date = models.DateField(
        null=True,
        blank=True,
        help_text='物料需求日期（生產需要的最晚時間）'
    )
    expected_delivery = models.DateField(
        null=True,
        blank=True,
        help_text='供應商預計交期'
    )
    actual_delivery = models.DateField(
        null=True,
        blank=True,
        help_text='實際交貨日期'
    )
    delivery_status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),      # 尚未出貨
            ('shipped', 'Shipped'),      # 已出貨
            ('partial', 'Partial'),      # 部分收貨
            ('received', 'Received'),    # 已收貨
            ('delayed', 'Delayed'),      # 延遲
        ],
        default='pending'
    )
    delivery_notes = models.TextField(blank=True, help_text='交期追蹤備註')

    # Review status
    is_confirmed = models.BooleanField(
        default=False,
        help_text='Whether this line has been reviewed and confirmed'
    )
    confirmed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, help_text='Line item notes')

    class Meta:
        db_table = 'po_lines'
        verbose_name = 'PO Line'
        verbose_name_plural = 'PO Lines'

    def __str__(self):
        return f"{self.purchase_order.po_number} - {self.material_name}"

    # P23: Overdue detection properties
    @property
    def is_overdue(self) -> bool:
        """
        判斷行項目是否逾期：
        - expected_delivery 或 required_date < today
        - delivery_status not in ['received']
        """
        from datetime import date
        if self.delivery_status in ['received']:
            return False
        check_date = self.expected_delivery or self.required_date
        if not check_date:
            return False
        return check_date < date.today()

    @property
    def days_overdue(self) -> int:
        """
        計算行項目逾期天數（若未逾期返回 0）
        """
        from datetime import date
        if not self.is_overdue:
            return 0
        check_date = self.expected_delivery or self.required_date
        if not check_date:
            return 0
        return (date.today() - check_date).days

    def sync_material_requirements(self):
        """
        P18: 同步關聯的 MaterialRequirement 狀態

        狀態映射：
        - POLine 創建/連結 → MaterialRequirement.status = 'ordered'
        - POLine.quantity_received >= total_requirement → MaterialRequirement.status = 'received'
        """
        from apps.orders.models import MaterialRequirement

        # 獲取所有關聯的 MaterialRequirement
        linked_requirements = MaterialRequirement.objects.filter(purchase_order_line=self)

        for req in linked_requirements:
            old_status = req.status

            # 判斷新狀態
            if self.quantity_received >= req.total_requirement:
                new_status = 'received'
            else:
                new_status = 'ordered'

            # 如果狀態變化，更新
            if new_status != old_status:
                req.status = new_status
                req.save(update_fields=['status', 'updated_at'])


# ========================================
# Signals for POLine → MaterialRequirement sync
# ========================================

from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender=POLine)
def sync_material_requirement_on_po_line_save(sender, instance, **kwargs):
    """
    P18: 當 POLine 保存時，同步關聯的 MaterialRequirement 狀態
    """
    instance.sync_material_requirements()
