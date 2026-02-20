"""
Costing Models
Phase 2: Sample Costing / Bulk Costing (BULK PO 之前)
Phase 2-2I: 版本策略封進系統
Phase 2-3: 三層分離架構重構
"""

from decimal import Decimal, ROUND_HALF_UP
from django.db import models, transaction
from django.conf import settings
import uuid
from apps.styles.models import StyleRevision, BOMItem, Style


class CostSheet(models.Model):
    """
    成本表頭（Sample/Bulk 報價）

    Phase 2 邊界：
    - ✅ Sample Costing（樣品報價）
    - ✅ Bulk Costing（大貨報價）
    - ❌ 不關聯 BULK PO（Phase 4）
    """

    COSTING_TYPE_CHOICES = [
        ('sample', 'Sample Costing'),
        ('bulk', 'Bulk Costing'),
    ]

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('sent', 'Sent'),
        ('archived', 'Archived'),
    ]

    # 關聯
    revision = models.ForeignKey(
        StyleRevision,
        on_delete=models.CASCADE,
        related_name='cost_sheets'
    )

    # 類型與版本
    costing_type = models.CharField(
        max_length=20,
        choices=COSTING_TYPE_CHOICES,
        help_text='Sample or Bulk costing'
    )
    version_no = models.IntegerField(
        help_text='Version number (1, 2, 3...)'
    )
    is_current = models.BooleanField(
        default=True,
        help_text='Is this the current version?'
    )

    # 成本輸入（人工）
    labor_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text='Labor cost per unit'
    )
    overhead_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text='Overhead cost per unit'
    )
    freight_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text='Freight cost per unit'
    )
    packaging_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text='Packaging cost per unit'
    )
    testing_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text='Testing cost per unit'
    )

    # 定價參數
    margin_pct = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('30.00'),
        help_text='Margin percentage (e.g., 30.00 for 30%)'
    )
    wastage_pct = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('5.00'),
        help_text='Global wastage percentage (Phase 1: applies to all lines)'
    )

    # 計算結果快照（Decimal 4 位小數）
    material_cost = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        help_text='Total material cost (sum of line_cost)'
    )
    total_cost = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        help_text='Total COGS (material + labor + overhead + freight + packaging + testing)'
    )
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        help_text='Final unit price (Sample price or FOB price)'
    )

    # 元數據
    notes = models.TextField(
        blank=True,
        help_text='Notes for this costing version'
    )

    # 狀態與審計（Phase 2-2I: 版本策略）
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft',
        help_text='Status: draft/sent/archived'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cost_sheets_created',
        help_text='User who created this version'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cost_sheets_updated',
        help_text='User who last updated this version'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'cost_sheets'
        ordering = ['-version_no']
        unique_together = ['revision', 'costing_type', 'version_no']
        indexes = [
            models.Index(fields=['revision', 'costing_type', 'is_current']),
        ]

    def __str__(self):
        return f"{self.revision.revision_label} - {self.get_costing_type_display()} v{self.version_no}"

    @classmethod
    def get_next_version_no(cls, revision, costing_type):
        """Get next version number for this revision and costing type"""
        last_version = cls.objects.filter(
            revision=revision,
            costing_type=costing_type
        ).order_by('-version_no').first()

        return (last_version.version_no + 1) if last_version else 1

    def calculate_totals(self):
        """
        計算總額（使用 Decimal + quantize 避免浮點誤差）

        微調點 1: 使用 Decimal.quantize 保證精確度
        """
        # Material cost (sum of line costs)
        lines_total = sum(
            (line.line_cost for line in self.lines.all()),
            Decimal('0.0000')
        )
        self.material_cost = lines_total.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)

        # Total COGS
        cogs = (
            self.material_cost +
            self.labor_cost +
            self.overhead_cost +
            self.freight_cost +
            self.packaging_cost +
            self.testing_cost
        )
        self.total_cost = cogs.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)

        # Unit price (FOB or Sample price)
        if self.margin_pct > 0:
            divisor = (Decimal('1.00') - (self.margin_pct / Decimal('100.00')))
            if divisor > 0:
                self.unit_price = (self.total_cost / divisor).quantize(
                    Decimal('0.0001'),
                    rounding=ROUND_HALF_UP
                )
            else:
                self.unit_price = self.total_cost
        else:
            self.unit_price = self.total_cost


class CostLine(models.Model):
    """
    成本表明細（快照，Phase 1 read-only）

    設計原則：
    - 快照 BOM 當下的 consumption、unit_price
    - Phase 1 不允許編輯（要改回 BOM 改）
    - 保存計算結果避免重算誤差
    """

    # 關聯
    cost_sheet = models.ForeignKey(
        CostSheet,
        on_delete=models.CASCADE,
        related_name='lines'
    )
    bom_item = models.ForeignKey(
        BOMItem,
        on_delete=models.PROTECT,
        help_text='Reference to original BOM item (for traceability)'
    )

    # 快照（報價當下的事實）
    material_name = models.CharField(
        max_length=255,
        help_text='Material name snapshot'
    )
    supplier = models.CharField(
        max_length=255,
        help_text='Supplier snapshot'
    )
    category = models.CharField(
        max_length=50,
        help_text='Category snapshot (fabric/trim/packaging/label)'
    )
    unit = models.CharField(
        max_length=20,
        help_text='Unit snapshot (Yard/Meter/PCS)'
    )

    # 核心數據快照
    consumption = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        help_text='Consumption per garment (snapshot)'
    )
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        help_text='Unit price snapshot'
    )

    # 計算結果（保存避免誤差）
    # 微調點 1: line_cost 在創建時計算並保存
    line_cost = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        help_text='Line cost = consumption × unit_price × (1 + wastage%)'
    )

    # 排序（微調點 2: 獨立管理，不依賴 item_number）
    sort_order = models.IntegerField(
        default=0,
        help_text='Display order (0-based index)'
    )

    class Meta:
        db_table = 'cost_lines'
        ordering = ['sort_order']
        indexes = [
            models.Index(fields=['cost_sheet', 'sort_order']),
        ]

    def __str__(self):
        return f"{self.material_name} - ${self.line_cost}"

    @classmethod
    def calculate_line_cost(cls, consumption, unit_price, wastage_pct):
        """
        計算 line_cost（靜態方法，可重用）

        微調點 1: 使用 Decimal + quantize

        Formula: consumption × unit_price × (1 + wastage_pct/100)
        """
        consumption = Decimal(str(consumption))
        unit_price = Decimal(str(unit_price))
        wastage_pct = Decimal(str(wastage_pct))

        multiplier = Decimal('1.00') + (wastage_pct / Decimal('100.00'))
        line_cost = consumption * unit_price * multiplier

        return line_cost.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)


# ============================================================================
# Phase 2-3 New Models: Three-Layer Separation Architecture
# ============================================================================

class UsageScenario(models.Model):
    """
    Layer 2: 用量情境（HOW MUCH）

    定義「在什麼情況下用多少料」
    - sample_quote: 樣品報價用量（小量、急、貴）
    - bulk_quote: 大貨報價用量（大量、正常價格）
    - procurement_plan: 採購計劃用量
    - actual: 實際使用用量

    設計規則（R1）：
    - ❌ 不設置 status='locked' 欄位
    - ✅ 用 is_locked() 方法推導（從 CostSheetVersion 反查）
    """

    PURPOSE_CHOICES = [
        ('sample_quote', 'Sample Quote'),
        ('bulk_quote', 'Bulk Quote'),
        ('procurement_plan', 'Procurement Plan'),
        ('actual', 'Actual Usage'),
        ('sample_guidance', 'Sample Guidance'),  # Phase 3: 樣品指引用量
        ('sample_actual', 'Sample Actual'),      # Phase 3: 樣衣實際用量
    ]

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('superseded', 'Superseded'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    revision = models.ForeignKey(
        StyleRevision,
        on_delete=models.CASCADE,
        related_name='usage_scenarios'
    )

    # 情境定義
    purpose = models.CharField(max_length=50, choices=PURPOSE_CHOICES)
    version_no = models.IntegerField(default=1)

    # 參數
    wastage_pct = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('5.00'),
        help_text='全局 wastage percentage（可被 UsageLine 覆寫）'
    )
    rounding_rule = models.CharField(
        max_length=50,
        default='round_up',
        help_text='Round up/down rule for consumption calculation'
    )

    # 狀態（R1: 不含 locked，用推導）
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft'
    )

    # 審計（不做約束，只記錄第一次鎖定）
    locked_at = models.DateTimeField(null=True, blank=True)
    locked_first_by_cost_sheet = models.ForeignKey(
        'CostSheetVersion',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='first_locked_scenarios',
        help_text='第一個鎖定此 scenario 的 CostSheetVersion（審計用）'
    )

    # 元數據
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='created_usage_scenarios'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'usage_scenarios'
        unique_together = [['revision', 'purpose', 'version_no']]
        ordering = ['purpose', '-version_no']
        verbose_name = 'Usage Scenario'
        verbose_name_plural = 'Usage Scenarios'

    def __str__(self):
        return f"{self.revision.revision_label} - {self.get_purpose_display()} v{self.version_no}"

    def is_locked(self):
        """
        R1: Single Source of Truth for Locked State
        推導規則：只要有任何 submitted 或 accepted 的 CostSheetVersion 引用此 scenario，就是 locked
        """
        return self.cost_sheet_versions.filter(
            status__in=['submitted', 'accepted']
        ).exists()

    def can_edit(self):
        """可編輯條件：未 locked 且非 superseded"""
        return not self.is_locked() and self.status != 'superseded'


class UsageLine(models.Model):
    """
    Layer 2: 單一物料的用量記錄

    關聯到 BOMItem（WHAT）+ 記錄 consumption（HOW MUCH）
    """

    CONSUMPTION_STATUS_CHOICES = [
        ('estimated', 'Estimated'),
        ('confirmed', 'Confirmed'),
        ('actual', 'Actual'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    usage_scenario = models.ForeignKey(
        UsageScenario,
        on_delete=models.CASCADE,
        related_name='usage_lines'
    )
    bom_item = models.ForeignKey(
        BOMItem,
        on_delete=models.CASCADE,
        help_text='Reference to BOM item (WHAT material)'
    )

    # 用量核心
    consumption = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        help_text='Consumption per garment'
    )
    consumption_unit = models.CharField(
        max_length=20,
        help_text='e.g., yards, meters, pcs'
    )
    consumption_status = models.CharField(
        max_length=20,
        choices=CONSUMPTION_STATUS_CHOICES,
        default='estimated'
    )

    # 覆寫參數（可選）
    wastage_pct_override = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Override scenario wastage_pct for this specific line'
    )

    # 審核
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='confirmed_usage_lines'
    )
    confirmed_at = models.DateTimeField(null=True, blank=True)

    # 排序
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = 'usage_lines'
        unique_together = [['usage_scenario', 'bom_item']]
        ordering = ['sort_order', 'bom_item__category']
        verbose_name = 'Usage Line'
        verbose_name_plural = 'Usage Lines'

    def __str__(self):
        return f"{self.usage_scenario} - {self.bom_item.material_name}"

    @property
    def adjusted_consumption(self):
        """
        計算調整後用量（consumption × (1 + wastage%)）

        注意：不存儲在 DB，每次計算（避免同步問題）
        """
        wastage = self.wastage_pct_override if self.wastage_pct_override is not None else self.usage_scenario.wastage_pct
        multiplier = Decimal('1.00') + (wastage / Decimal('100.00'))
        return (self.consumption * multiplier).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)


class CostSheetGroup(models.Model):
    """
    Layer 3: 報價組（綁定 Style，不綁定 Revision）

    設計原因：同一個 Style 的所有 revisions 共享一個報價歷史
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    style = models.ForeignKey(
        Style,
        on_delete=models.CASCADE,
        related_name='cost_sheet_groups'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'cost_sheet_groups'
        verbose_name = 'Cost Sheet Group'
        verbose_name_plural = 'Cost Sheet Groups'
        constraints = [
            models.UniqueConstraint(
                fields=['style'],
                name='unique_cost_sheet_group_per_style'
            )
        ]

    def __str__(self):
        return f"Cost Sheet Group for {self.style}"


class CostSheetVersion(models.Model):
    """
    Layer 3: 報價版本（v1/v2/v3）

    設計原則：
    - Version stacking（版本堆疊）：v1 → v2 → v3，不可覆寫
    - Evidence binding（證據綁定）：每個版本綁定 techpack_revision + usage_scenario
    - State machine（狀態機）：Draft → Submitted → Superseded/Accepted/Rejected
    - Single direction snapshot（單向快照）：從 UsageLine 快照到 CostLine，不回寫
    """

    COSTING_TYPE_CHOICES = [
        ('sample', 'Sample Costing'),
        ('bulk', 'Bulk Costing'),
    ]

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('submitted', 'Submitted'),
        ('superseded', 'Superseded'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cost_sheet_group = models.ForeignKey(
        CostSheetGroup,
        on_delete=models.CASCADE,
        related_name='versions'
    )

    # 版本標識
    version_no = models.IntegerField(help_text='Version number within costing_type')
    costing_type = models.CharField(max_length=20, choices=COSTING_TYPE_CHOICES)

    # ⭐ Evidence 綁定（不可修改，PROTECT 防止刪除）
    techpack_revision = models.ForeignKey(
        StyleRevision,
        on_delete=models.PROTECT,
        help_text='Tech Pack revision used for this quote'
    )
    usage_scenario = models.ForeignKey(
        UsageScenario,
        on_delete=models.PROTECT,
        related_name='cost_sheet_versions',
        help_text='Usage scenario snapshot for this quote'
    )

    # 報價參數
    labor_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00')
    )
    overhead_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00')
    )
    freight_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00')
    )
    packing_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00')
    )
    margin_pct = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('30.00')
    )

    # 幣別（Phase 1: USD only）
    currency = models.CharField(max_length=3, default='USD')
    exchange_rate = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        default=Decimal('1.0000')
    )

    # 計算結果（快照）
    material_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00')
    )
    total_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00')
    )
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00')
    )

    # ⭐ 狀態機
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft'
    )

    # 版本關係（R3: Soft delete only）
    superseded_by = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='superseded_versions',
        help_text='Which version superseded this one'
    )
    cloned_from = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='cloned_versions',
        help_text='Which version this was cloned from'
    )
    change_reason = models.TextField(
        blank=True,
        help_text='Why was this version created (e.g., "Client requested price reduction")'
    )

    # 元數據
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='created_cost_sheet_versions'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    submitted_at = models.DateTimeField(null=True, blank=True)
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='submitted_cost_sheet_versions'
    )

    class Meta:
        db_table = 'cost_sheet_versions'
        unique_together = [['cost_sheet_group', 'costing_type', 'version_no']]
        ordering = ['costing_type', '-version_no']
        verbose_name = 'Cost Sheet Version'
        verbose_name_plural = 'Cost Sheet Versions'

    def __str__(self):
        return f"{self.cost_sheet_group.style.style_number} - {self.get_costing_type_display()} v{self.version_no}"

    def can_edit(self):
        """可編輯條件：status = draft"""
        return self.status == 'draft'

    def calculate_totals(self):
        """
        計算總額（類似舊版 CostSheet.calculate_totals）
        """
        # Material cost (sum of line costs)
        lines_total = sum(
            (line.line_cost for line in self.cost_lines.all()),
            Decimal('0.00')
        )
        self.material_cost = lines_total.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        # Total COGS
        cogs = (
            self.material_cost +
            self.labor_cost +
            self.overhead_cost +
            self.freight_cost +
            self.packing_cost
        )
        self.total_cost = cogs.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        # Unit price
        if self.margin_pct > 0:
            divisor = (Decimal('1.00') - (self.margin_pct / Decimal('100.00')))
            if divisor > 0:
                self.unit_price = (self.total_cost / divisor).quantize(
                    Decimal('0.01'),
                    rounding=ROUND_HALF_UP
                )
            else:
                self.unit_price = self.total_cost
        else:
            self.unit_price = self.total_cost


class CostLineV2(models.Model):
    """
    Layer 3: 報價明細（快照 + 可調整）

    設計原則：
    - Snapshot pattern：創建時快照 UsageLine 的 consumption 和 unit_price
    - Adjustable：允許在 Draft 狀態調整 consumption 和 unit_price
    - Source tracking：記錄來源 IDs（revision/scenario/bom_item/usage_line）
    - Calculation：line_cost = consumption_adjusted × unit_price_adjusted × (1 + wastage%)
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cost_sheet_version = models.ForeignKey(
        CostSheetVersion,
        on_delete=models.CASCADE,
        related_name='cost_lines'
    )

    # ⭐ 快照來源（補強，便於追溯）
    source_revision_id = models.UUIDField(
        help_text='StyleRevision ID (for traceability)'
    )
    source_usage_scenario_id = models.UUIDField(
        help_text='UsageScenario ID (for traceability)'
    )
    source_usage_scenario_version_no = models.IntegerField(
        help_text='UsageScenario version_no (for traceability)'
    )
    source_bom_item_id = models.UUIDField(
        help_text='BOMItem ID (for traceability)'
    )
    source_usage_line_id = models.UUIDField(
        help_text='UsageLine ID (for traceability)'
    )

    # 快照數據（物料識別）
    material_name = models.CharField(max_length=200)
    material_name_zh = models.CharField(max_length=200, blank=True)
    category = models.CharField(max_length=50)
    supplier = models.CharField(max_length=200, blank=True)
    supplier_article_no = models.CharField(max_length=100, blank=True)
    unit = models.CharField(max_length=20)

    # ⭐ 用量與價格（快照 + 可調整）
    consumption_snapshot = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        help_text='Original consumption from UsageLine'
    )
    consumption_adjusted = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        help_text='Adjusted consumption (editable in Draft)'
    )
    unit_price_snapshot = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Original unit price from BOMItem'
    )
    unit_price_adjusted = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Adjusted unit price (editable in Draft)'
    )

    # 調整標記
    is_consumption_adjusted = models.BooleanField(
        default=False,
        help_text='True if consumption was manually adjusted'
    )
    is_price_adjusted = models.BooleanField(
        default=False,
        help_text='True if unit price was manually adjusted'
    )
    adjustment_reason = models.CharField(
        max_length=200,
        blank=True,
        help_text='Why was this adjusted (e.g., "Client negotiation")'
    )

    # 計算結果
    line_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Line cost = consumption_adjusted × unit_price_adjusted'
    )

    # 排序
    sort_order = models.IntegerField(default=0)

    # 元數據
    adjusted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='adjusted_cost_lines'
    )
    adjusted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'cost_lines_v2'
        ordering = ['sort_order', 'category', 'material_name']
        verbose_name = 'Cost Line (v2)'
        verbose_name_plural = 'Cost Lines (v2)'

    def __str__(self):
        return f"{self.material_name} - ${self.line_cost}"

    @classmethod
    def calculate_line_cost(cls, consumption, unit_price):
        """
        計算 line_cost（不含 wastage，因為已在 UsageLine 處理）

        Formula: consumption_adjusted × unit_price_adjusted
        """
        consumption = Decimal(str(consumption))
        unit_price = Decimal(str(unit_price))

        line_cost = consumption * unit_price

        return line_cost.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
