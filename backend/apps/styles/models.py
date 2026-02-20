"""
Styles Models - v2.3.0
Style-centric design: Style → StyleRevision → BOMItem/Measurement/ConstructionStep
Added: Brand model with BOM format configuration
"""

from django.db import models
import uuid

from apps.core.managers import TenantManager


# BOM Format Choices
BOM_FORMAT_CHOICES = [
    ('auto', 'Auto Detect'),
    ('vertical_table', 'Vertical Table (columns: Material, Supplier, Price...)'),
    ('horizontal_table', 'Horizontal Table (rows: materials, columns: colors)'),
    ('free_text', 'Free Text (FABRIC INFO sections)'),
    ('mixed', 'Mixed Format'),
]


class Brand(models.Model):
    """
    Brand/Customer master data with BOM format configuration
    品牌主檔 - 包含 BOM 提取格式配置
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        'core.Organization',
        on_delete=models.CASCADE,
        related_name='brands'
    )

    # Basic info
    code = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Brand code, e.g., LLL, NIKE, ADIDAS"
    )
    name = models.CharField(
        max_length=200,
        help_text="Full brand name, e.g., lululemon athletica"
    )

    # BOM Format Configuration
    bom_format = models.CharField(
        max_length=50,
        choices=BOM_FORMAT_CHOICES,
        default='auto',
        help_text="Default BOM format for this brand's tech packs"
    )
    bom_extraction_rules = models.JSONField(
        default=dict,
        blank=True,
        help_text="Custom extraction rules: column mappings, section keywords, etc."
    )
    """
    Example bom_extraction_rules:
    {
        "fabric_section_keywords": ["FABRIC INFO", "BODY:", "SHELL:"],
        "trim_section_keywords": ["TRIM", "LABEL", "ZIPPER"],
        "column_mapping": {
            "material_name": ["Material", "Description", "Fabric"],
            "supplier": ["Supplier", "Vendor", "Mill"],
            "consumption": ["Usage", "Consumption", "Qty"]
        },
        "skip_keywords": ["TOTAL", "SUBTOTAL", "N/A"],
        "color_row_position": "top"  # or "left" for horizontal tables
    }
    """

    # Status
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'brands'
        verbose_name = 'Brand'
        verbose_name_plural = 'Brands'
        unique_together = [['organization', 'code']]
        ordering = ['name']

    objects = TenantManager()

    def __str__(self):
        return f"{self.code} - {self.name}"


class Style(models.Model):
    """
    Core entity representing a garment style (款式)
    One Style can have multiple revisions (Rev A, Rev B, etc.)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        'core.Organization',
        on_delete=models.CASCADE,
        related_name='styles'
    )

    # Basic info
    style_number = models.CharField(
        max_length=50,
        db_index=True,
        help_text="e.g., LW1FLPS"
    )
    style_name = models.CharField(
        max_length=200,
        help_text="e.g., Nulu Cami Tank"
    )
    season = models.CharField(max_length=50, blank=True)
    customer = models.CharField(max_length=100, blank=True)  # Legacy field, kept for compatibility

    # Brand relationship (for BOM format configuration)
    brand = models.ForeignKey(
        'Brand',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='styles',
        help_text="Brand determines BOM extraction format"
    )

    # Current version tracking
    current_revision = models.ForeignKey(
        'StyleRevision',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+'
    )

    # Portfolio management
    target_due_date = models.DateField(
        null=True,
        blank=True,
        help_text='Target due date for this style (for risk calculation)'
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_styles'
    )

    class Meta:
        db_table = 'styles'
        verbose_name = 'Style'
        verbose_name_plural = 'Styles'
        unique_together = [['organization', 'style_number']]
        ordering = ['-created_at']

    # SaaS-Ready: Tenant-aware manager
    objects = TenantManager()

    def __str__(self):
        return f"{self.style_number} - {self.style_name}"


class StyleRevision(models.Model):
    """
    A specific revision of a Style (e.g., Rev A, Rev B)
    Each revision has its own BOM, measurements, construction steps
    """
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('approved', 'Approved'),
        ('in_production', 'In Production'),
        ('archived', 'Archived'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # SaaS-Ready: Direct organization FK for query performance
    organization = models.ForeignKey(
        'core.Organization',
        on_delete=models.CASCADE,
        related_name='style_revisions',
        null=True,  # TODO: Make non-null after migration backfill
        blank=True,
        help_text="Organization (tenant) - denormalized from style for query performance"
    )

    style = models.ForeignKey(
        Style,
        on_delete=models.CASCADE,
        related_name='revisions'
    )

    # Revision info
    revision_label = models.CharField(
        max_length=20,
        help_text="e.g., Rev A, Rev B, PP"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft'
    )

    # Notes and changes
    notes = models.TextField(blank=True)
    changes_from_previous = models.JSONField(
        null=True,
        blank=True,
        help_text="AI-detected changes from previous revision"
    )

    # Draft vs Verified (D-011: AI outputs go to draft, human review writes to verified)
    # Verified data: BOMItem/Measurement/ConstructionStep tables (related objects)
    # Draft data: JSON fields below (AI raw outputs)
    draft_bom_data = models.JSONField(
        null=True,
        blank=True,
        help_text="AI-extracted BOM data (draft, pending review)"
    )
    draft_measurement_data = models.JSONField(
        null=True,
        blank=True,
        help_text="AI-extracted measurement data (draft, pending review)"
    )
    draft_construction_data = models.JSONField(
        null=True,
        blank=True,
        help_text="AI-extracted construction data (draft, pending review)"
    )

    # Previous revision link
    previous_revision = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='next_revisions'
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_revisions'
    )

    class Meta:
        db_table = 'style_revisions'
        verbose_name = 'Style Revision'
        verbose_name_plural = 'Style Revisions'
        unique_together = [['style', 'revision_label']]
        ordering = ['-created_at']

    # SaaS-Ready: Tenant-aware manager
    objects = TenantManager()

    def __str__(self):
        return f"{self.style.style_number} {self.revision_label}"


class BOMItem(models.Model):
    """
    BOM Item (template level) - attached to StyleRevision
    Represents a material/component in the style's bill of materials
    """
    CATEGORY_CHOICES = [
        ('fabric', 'Fabric'),
        ('trim', 'Trim'),
        ('label', 'Label'),
        ('packaging', 'Packaging'),
    ]

    CONSUMPTION_MATURITY_CHOICES = [
        ('unknown', 'Unknown'),
        ('pre_estimate', 'Pre-Estimate'),
        ('sample', 'Sample'),
        ('confirmed', 'Confirmed'),
        ('locked', 'Locked'),
    ]

    TRANSLATION_STATUS_CHOICES = [
        ('pending', 'Pending Translation'),
        ('confirmed', 'Translation Confirmed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # SaaS-Ready: Direct organization FK for query performance
    organization = models.ForeignKey(
        'core.Organization',
        on_delete=models.CASCADE,
        related_name='bom_items',
        null=True,  # TODO: Make non-null after migration backfill
        blank=True,
        help_text="Organization (tenant) - denormalized for query performance"
    )

    revision = models.ForeignKey(
        StyleRevision,
        on_delete=models.CASCADE,
        related_name='bom_items'
    )

    # Item info
    item_number = models.IntegerField()
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    material_name = models.CharField(max_length=200)
    supplier = models.CharField(max_length=100, blank=True)
    supplier_article_no = models.CharField(
        max_length=100,
        blank=True,
        help_text="Supplier's article/material number (key for procurement)"
    )
    color = models.CharField(max_length=100, blank=True)
    color_code = models.CharField(max_length=50, blank=True)

    # Material status (approval status from supplier/quality)
    material_status = models.CharField(
        max_length=100,
        blank=True,
        help_text="e.g., Approved, Approved with Limitations, Pending, etc."
    )

    # Consumption (template level)
    consumption = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Consumption per piece"
    )
    consumption_maturity = models.CharField(
        max_length=20,
        choices=CONSUMPTION_MATURITY_CHOICES,
        default='unknown'
    )

    # 用量四階段演進
    pre_estimate_value = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="預估用量（工廠經驗值，用於 RFQ）"
    )
    sample_value = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="樣衣用量（打樣實際消耗）"
    )
    confirmed_value = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="確認用量（Marker Report 調整後）"
    )
    locked_value = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="鎖定用量（大貨確認後不可改）"
    )
    consumption_history = models.JSONField(
        default=list,
        blank=True,
        help_text="用量變更歷史記錄"
    )
    sample_confirmed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="樣衣用量確認時間"
    )
    consumption_confirmed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="用量確認時間"
    )
    consumption_locked_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="用量鎖定時間"
    )

    unit = models.CharField(
        max_length=20,
        default='YD',
        blank=True,
        help_text="e.g., yards, meters, pcs"
    )

    # Placement (JSONField for SQLite compatibility)
    placement = models.JSONField(
        default=list,
        blank=True,
        help_text="List of placements, e.g., ['body', 'sleeve']"
    )

    # Wastage
    wastage_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=5.00,
        help_text="Wastage percentage"
    )

    # Pricing (optional at template level)
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )

    # Lead time
    leadtime_days = models.IntegerField(
        null=True,
        blank=True,
        help_text="Total lead time in days"
    )

    # AI extraction metadata
    ai_confidence = models.FloatField(null=True, blank=True)
    is_verified = models.BooleanField(default=False)

    # Phase 2-1: Verification tracking (who & when)
    verified_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_bom_items'
    )
    verified_at = models.DateTimeField(null=True, blank=True)

    # Phase 2-1: Translation status tracking
    translation_status = models.CharField(
        max_length=20,
        choices=TRANSLATION_STATUS_CHOICES,
        default='pending',
        help_text="Translation confirmation status"
    )

    # Translation content fields
    material_name_zh = models.CharField(
        max_length=200,
        blank=True,
        help_text="Chinese translation of material name"
    )
    description_zh = models.TextField(
        blank=True,
        help_text="Chinese translation of description/notes"
    )
    translated_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this item was translated"
    )
    translated_by = models.CharField(
        max_length=50,
        blank=True,
        help_text="Who/what translated this (e.g., ai:claude-sonnet, human:username)"
    )

    class Meta:
        db_table = 'bom_items'
        verbose_name = 'BOM Item'
        verbose_name_plural = 'BOM Items'
        ordering = ['item_number']

    def __str__(self):
        return f"{self.revision} - {self.item_number}. {self.material_name}"

    @property
    def current_consumption(self):
        """
        返回當前最佳用量值（按成熟度優先級）
        locked > confirmed > sample > pre_estimate > consumption
        """
        if self.locked_value is not None:
            return self.locked_value
        if self.confirmed_value is not None:
            return self.confirmed_value
        if self.sample_value is not None:
            return self.sample_value
        if self.pre_estimate_value is not None:
            return self.pre_estimate_value
        return self.consumption

    @property
    def consumption_maturity_display(self):
        """用量成熟度顯示名稱"""
        displays = {
            'unknown': '待填寫',
            'pre_estimate': '預估',
            'sample': '樣衣',
            'confirmed': '已確認',
            'locked': '已鎖定',
        }
        return displays.get(self.consumption_maturity, self.consumption_maturity)

    def set_pre_estimate(self, value, user=None):
        """設置預估用量"""
        from django.utils import timezone
        old_value = self.pre_estimate_value
        self.pre_estimate_value = value
        self.consumption_maturity = 'pre_estimate'
        # 記錄歷史
        history_entry = {
            'action': 'set_pre_estimate',
            'old_value': str(old_value) if old_value else None,
            'new_value': str(value),
            'timestamp': timezone.now().isoformat(),
            'user': str(user) if user else None,
        }
        if not self.consumption_history:
            self.consumption_history = []
        self.consumption_history.append(history_entry)
        self.save()

    def set_sample(self, value, user=None):
        """設置樣衣用量（打樣實際消耗）"""
        from django.utils import timezone
        old_value = self.sample_value
        self.sample_value = value
        self.consumption_maturity = 'sample'
        self.sample_confirmed_at = timezone.now()
        # 記錄歷史
        history_entry = {
            'action': 'set_sample',
            'old_value': str(old_value) if old_value else None,
            'new_value': str(value),
            'timestamp': timezone.now().isoformat(),
            'user': str(user) if user else None,
        }
        if not self.consumption_history:
            self.consumption_history = []
        self.consumption_history.append(history_entry)
        self.save()

    def confirm_consumption(self, value, source='manual', user=None):
        """確認用量（Marker Report 調整後）"""
        from django.utils import timezone
        old_value = self.confirmed_value
        self.confirmed_value = value
        self.consumption_maturity = 'confirmed'
        self.consumption_confirmed_at = timezone.now()
        # 記錄歷史
        history_entry = {
            'action': 'confirm',
            'source': source,
            'old_value': str(old_value) if old_value else None,
            'new_value': str(value),
            'timestamp': timezone.now().isoformat(),
            'user': str(user) if user else None,
        }
        if not self.consumption_history:
            self.consumption_history = []
        self.consumption_history.append(history_entry)
        self.save()

    def lock_consumption(self, value=None, user=None):
        """鎖定用量（大貨報價確認後調用）

        Args:
            value: 可選，指定鎖定值。若未提供則使用 confirmed_value
            user: 操作用戶
        """
        from django.utils import timezone
        if self.consumption_maturity == 'locked':
            raise ValueError("用量已經鎖定，無法再次鎖定")

        # 如果提供了自訂值則使用，否則使用確認用量
        if value is not None:
            self.locked_value = value
        elif self.confirmed_value is not None:
            self.locked_value = self.confirmed_value
        else:
            raise ValueError("必須提供鎖定值或先確認用量")

        self.consumption_maturity = 'locked'
        self.consumption_locked_at = timezone.now()
        # 記錄歷史
        history_entry = {
            'action': 'lock',
            'locked_value': str(self.locked_value),
            'timestamp': timezone.now().isoformat(),
            'user': str(user) if user else None,
        }
        if not self.consumption_history:
            self.consumption_history = []
        self.consumption_history.append(history_entry)
        self.save()

    def can_edit_consumption(self):
        """檢查是否可以編輯用量"""
        return self.consumption_maturity != 'locked'


class Measurement(models.Model):
    """
    Measurement specification point for a StyleRevision
    """
    TRANSLATION_STATUS_CHOICES = [
        ('pending', 'Pending Translation'),
        ('confirmed', 'Translation Confirmed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # SaaS-Ready: Direct organization FK for query performance
    organization = models.ForeignKey(
        'core.Organization',
        on_delete=models.CASCADE,
        related_name='measurements',
        null=True,  # TODO: Make non-null after migration backfill
        blank=True,
        help_text="Organization (tenant) - denormalized for query performance"
    )

    revision = models.ForeignKey(
        StyleRevision,
        on_delete=models.CASCADE,
        related_name='measurements'
    )

    # Measurement point
    point_name = models.CharField(max_length=100)
    point_name_zh = models.CharField(max_length=100, blank=True, help_text='Chinese translation of measurement point name')
    point_code = models.CharField(max_length=20, blank=True)

    # Size values (JSON: {"XS": 40.0, "S": 42.0, "M": 44.0, ...})
    values = models.JSONField()

    # Tolerances
    tolerance_plus = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.5
    )
    tolerance_minus = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.5
    )
    unit = models.CharField(max_length=10, default='cm')

    # AI extraction metadata
    ai_confidence = models.FloatField(null=True, blank=True)
    is_verified = models.BooleanField(default=False)

    # Phase 2-1: Verification tracking (who & when)
    verified_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_measurements'
    )
    verified_at = models.DateTimeField(null=True, blank=True)

    # Phase 2-1: Translation status tracking
    translation_status = models.CharField(
        max_length=20,
        choices=TRANSLATION_STATUS_CHOICES,
        default='pending',
        help_text="Translation confirmation status"
    )

    class Meta:
        db_table = 'measurements'
        verbose_name = 'Measurement'
        verbose_name_plural = 'Measurements'
        ordering = ['point_name']

    def __str__(self):
        return f"{self.revision} - {self.point_name}"


class ConstructionStep(models.Model):
    """
    Construction/sewing instructions for a StyleRevision
    """
    TRANSLATION_STATUS_CHOICES = [
        ('pending', 'Pending Translation'),
        ('confirmed', 'Translation Confirmed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # SaaS-Ready: Direct organization FK for query performance
    organization = models.ForeignKey(
        'core.Organization',
        on_delete=models.CASCADE,
        related_name='construction_steps',
        null=True,  # TODO: Make non-null after migration backfill
        blank=True,
        help_text="Organization (tenant) - denormalized for query performance"
    )

    revision = models.ForeignKey(
        StyleRevision,
        on_delete=models.CASCADE,
        related_name='construction_steps'
    )

    step_number = models.IntegerField()
    description = models.TextField()
    stitch_type = models.CharField(max_length=50, blank=True)
    machine_type = models.CharField(max_length=100, blank=True)

    # AI extraction metadata
    ai_confidence = models.FloatField(null=True, blank=True)
    is_verified = models.BooleanField(default=False)

    # Phase 2-1: Verification tracking (who & when)
    verified_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_construction_steps'
    )
    verified_at = models.DateTimeField(null=True, blank=True)

    # Phase 2-1: Translation status tracking
    translation_status = models.CharField(
        max_length=20,
        choices=TRANSLATION_STATUS_CHOICES,
        default='pending',
        help_text="Translation confirmation status"
    )

    # Translation content fields
    description_zh = models.TextField(
        blank=True,
        help_text="Chinese translation of description"
    )
    stitch_type_zh = models.CharField(
        max_length=100,
        blank=True,
        help_text="Chinese translation of stitch type"
    )
    machine_type_zh = models.CharField(
        max_length=150,
        blank=True,
        help_text="Chinese translation of machine type"
    )
    translated_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this step was translated"
    )
    translated_by = models.CharField(
        max_length=50,
        blank=True,
        help_text="Who/what translated this"
    )

    class Meta:
        db_table = 'construction_steps'
        verbose_name = 'Construction Step'
        verbose_name_plural = 'Construction Steps'
        ordering = ['step_number']

    def __str__(self):
        return f"{self.revision} - Step {self.step_number}"
