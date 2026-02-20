"""
Manufacturing Models - v2.2.1
Manufacturing Work Orders (MWO)
"""

from django.db import models
import uuid

from apps.core.managers import TenantManager


class ManufacturingWorkOrder(models.Model):
    """
    Manufacturing Work Order (MWO) - 製造工作單
    Generated for factory production
    """
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('issued', 'Issued'),
        ('in_production', 'In Production'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        'core.Organization',
        on_delete=models.CASCADE,
        related_name='manufacturing_work_orders'
    )

    # MWO info
    # SaaS-Ready: Changed from unique=True to unique_together with organization
    mwo_number = models.CharField(max_length=50, db_index=True)
    sales_order_item = models.ForeignKey(
        'orders.SalesOrderItem',
        on_delete=models.PROTECT,
        related_name='manufacturing_work_orders'
    )

    # Factory
    factory_name = models.CharField(max_length=200)
    factory_contact = models.CharField(max_length=100, blank=True)

    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft'
    )

    # Dates
    issue_date = models.DateField(null=True, blank=True)
    start_date = models.DateField(null=True, blank=True)
    target_completion = models.DateField()
    actual_completion = models.DateField(null=True, blank=True)

    # PDF file (generated)
    mwo_pdf = models.ForeignKey(
        'documents.Document',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+'
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
        db_table = 'manufacturing_work_orders'
        verbose_name = 'Manufacturing Work Order'
        verbose_name_plural = 'Manufacturing Work Orders'
        ordering = ['-created_at']
        # SaaS-Ready: MWO number unique within organization only
        unique_together = [['organization', 'mwo_number']]

    # SaaS-Ready: Tenant-aware manager
    objects = TenantManager()

    def __str__(self):
        return f"{self.mwo_number} - {self.factory_name}"
