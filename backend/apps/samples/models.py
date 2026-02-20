"""
Phase 3: Sample Request System Models
Request-based design (not flow-based)
"""

from django.db import models
from django.core.validators import MinValueValidator
import uuid
import hashlib
import json

from apps.core.managers import TenantManager


# ==================== Choices ====================

class SampleRequestType:
    # Core types
    PROTO = 'proto'
    FIT = 'fit'
    SALES = 'sales'
    PHOTO = 'photo'
    MARKETING = 'marketing'
    WEAR_TEST = 'wear_test'

    # Special types
    MATERIAL_TEST = 'material_test'
    COLOR_APPROVAL = 'color_approval'
    SIZE_SET = 'size_set'
    REPLACEMENT = 'replacement'

    # Trade show types
    TRADE_SHOW = 'trade_show'
    COUNTER = 'counter'
    SEALED = 'sealed'

    # Custom
    CUSTOM = 'custom'

    CHOICES = [
        (PROTO, 'Proto Sample'),
        (FIT, 'Fit Sample'),
        (SALES, 'Sales Sample'),
        (PHOTO, 'Photo Sample'),
        (MARKETING, 'Marketing Sample'),
        (WEAR_TEST, 'Wear Test'),
        (MATERIAL_TEST, 'Material Test'),
        (COLOR_APPROVAL, 'Color Approval'),
        (SIZE_SET, 'Size Set'),
        (REPLACEMENT, 'Replacement'),
        (TRADE_SHOW, 'Trade Show'),
        (COUNTER, 'Counter Sample'),
        (SEALED, 'Sealed Sample'),
        (CUSTOM, 'Custom'),
    ]


class SampleRequestStatus:
    """
    支援舊有 submit/quote/approve 流程，同時兼容 Phase 3 簡化狀態。
    """
    # Legacy / workflow states
    DRAFT = 'draft'
    QUOTE_REQUESTED = 'quote_requested'
    QUOTED = 'quoted'
    APPROVED = 'approved'
    IN_EXECUTION = 'in_execution'
    COMPLETED = 'completed'
    REJECTED = 'rejected'

    # Simplified Kanban states
    OPEN = 'open'
    ON_HOLD = 'on_hold'
    CLOSED = 'closed'
    CANCELLED = 'cancelled'

    CHOICES = [
        # Legacy
        (DRAFT, 'Draft'),
        (QUOTE_REQUESTED, 'Quote Requested'),
        (QUOTED, 'Quoted'),
        (APPROVED, 'Approved'),
        (IN_EXECUTION, 'In Execution'),
        (COMPLETED, 'Completed'),
        (REJECTED, 'Rejected'),
        # Simplified
        (OPEN, 'Open'),
        (ON_HOLD, 'On Hold'),
        (CLOSED, 'Closed'),
        (CANCELLED, 'Cancelled'),
    ]


class SampleRunStatus:
    """
    樣衣輪次狀態機（Phase 3 重構）
    每一輪樣衣的核心中樞
    """
    DRAFT = 'draft'
    MATERIALS_PLANNING = 'materials_planning'   # 確保 guidance usage
    PO_DRAFTED = 'po_drafted'                   # T2PO draft 已生成
    PO_ISSUED = 'po_issued'                     # T2PO 已發出
    MWO_DRAFTED = 'mwo_drafted'                 # MWO draft 已生成
    MWO_ISSUED = 'mwo_issued'                   # MWO 已發出
    IN_PROGRESS = 'in_progress'                 # 製作中
    SAMPLE_DONE = 'sample_done'                 # 樣衣完成
    ACTUALS_RECORDED = 'actuals_recorded'       # 實際用量已回填
    COSTING_GENERATED = 'costing_generated'     # 已產生 costing
    QUOTED = 'quoted'                           # 已對客
    ACCEPTED = 'accepted'
    REVISE_NEEDED = 'revise_needed'
    CANCELLED = 'cancelled'

    CHOICES = [
        (DRAFT, 'Draft'),
        (MATERIALS_PLANNING, 'Materials Planning'),
        (PO_DRAFTED, 'PO Drafted'),
        (PO_ISSUED, 'PO Issued'),
        (MWO_DRAFTED, 'MWO Drafted'),
        (MWO_ISSUED, 'MWO Issued'),
        (IN_PROGRESS, 'In Progress'),
        (SAMPLE_DONE, 'Sample Done'),
        (ACTUALS_RECORDED, 'Actuals Recorded'),
        (COSTING_GENERATED, 'Costing Generated'),
        (QUOTED, 'Quoted'),
        (ACCEPTED, 'Accepted'),
        (REVISE_NEEDED, 'Revise Needed'),
        (CANCELLED, 'Cancelled'),
    ]


class SampleRunType:
    """樣衣輪次類型"""
    PROTO = 'proto'
    FIT = 'fit'
    SALES = 'sales'
    PHOTO = 'photo'
    OTHER = 'other'

    CHOICES = [
        (PROTO, 'Proto Sample'),
        (FIT, 'Fit Sample'),
        (SALES, 'Sales Sample'),
        (PHOTO, 'Photo Sample'),
        (OTHER, 'Other'),
    ]


class ApprovalStatus:
    NA = 'na'
    APPROVED = 'approved'
    REJECTED = 'rejected'

    CHOICES = [
        (NA, 'N/A'),
        (APPROVED, 'Approved'),
        (REJECTED, 'Rejected'),
    ]


class Priority:
    LOW = 'low'
    NORMAL = 'normal'
    URGENT = 'urgent'

    CHOICES = [
        (LOW, 'Low'),
        (NORMAL, 'Normal'),
        (URGENT, 'Urgent'),
    ]


class EstimateStatus:
    DRAFT = 'draft'
    SENT = 'sent'
    ACCEPTED = 'accepted'
    REJECTED = 'rejected'
    EXPIRED = 'expired'

    CHOICES = [
        (DRAFT, 'Draft'),
        (SENT, 'Sent'),
        (ACCEPTED, 'Accepted'),
        (REJECTED, 'Rejected'),
        (EXPIRED, 'Expired'),
    ]


class EstimateSource:
    MANUAL = 'manual'
    FROM_PHASE2_COSTING = 'from_phase2_costing'

    CHOICES = [
        (MANUAL, 'Manual'),
        (FROM_PHASE2_COSTING, 'From Phase 2 Costing'),
    ]


class T2POStatus:
    DRAFT = 'draft'
    ISSUED = 'issued'
    CONFIRMED = 'confirmed'
    DELIVERED = 'delivered'
    CANCELLED = 'cancelled'

    CHOICES = [
        (DRAFT, 'Draft'),
        (ISSUED, 'Issued'),
        (CONFIRMED, 'Confirmed'),
        (DELIVERED, 'Delivered'),
        (CANCELLED, 'Cancelled'),
    ]


class MWOStatus:
    DRAFT = 'draft'
    ISSUED = 'issued'
    IN_PROGRESS = 'in_progress'
    COMPLETED = 'completed'
    CANCELLED = 'cancelled'

    CHOICES = [
        (DRAFT, 'Draft'),
        (ISSUED, 'Issued'),
        (IN_PROGRESS, 'In Progress'),
        (COMPLETED, 'Completed'),
        (CANCELLED, 'Cancelled'),
    ]


class SampleStatus:
    IN_PRODUCTION = 'in_production'
    COMPLETED = 'completed'
    DELIVERED = 'delivered'
    REJECTED = 'rejected'

    CHOICES = [
        (IN_PRODUCTION, 'In Production'),
        (COMPLETED, 'Completed'),
        (DELIVERED, 'Delivered'),
        (REJECTED, 'Rejected'),
    ]


class AttachmentFileType:
    PHOTO = 'photo'
    PDF = 'pdf'
    OTHER = 'other'

    CHOICES = [
        (PHOTO, 'Photo'),
        (PDF, 'PDF'),
        (OTHER, 'Other'),
    ]


# ==================== Models ====================

class SampleRequest(models.Model):
    """
    Core entity: Sample Request (樣衣請求)
    Request-based design: supports any brand workflow
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # SaaS-Ready: Direct organization FK for query performance
    # Chain: SampleRequest → revision → style → organization (for backward compat)
    # Direct: SampleRequest → organization (for efficient tenant filtering)
    organization = models.ForeignKey(
        'core.Organization',
        on_delete=models.CASCADE,
        related_name='sample_requests',
        null=True,  # TODO: Make non-null after migration backfill
        blank=True,
        help_text="Organization (tenant) this request belongs to"
    )

    revision = models.ForeignKey(
        'styles.StyleRevision',
        on_delete=models.CASCADE,
        related_name='sample_requests',
        help_text="Source revision (Phase 2)"
    )

    # Brand & Request Info
    brand_name = models.CharField(
        max_length=120,
        blank=True,
        help_text="Brand name (future: FK to Brand model)"
    )
    request_type = models.CharField(
        max_length=32,
        choices=SampleRequestType.CHOICES,
        default=SampleRequestType.PROTO
    )
    request_type_custom = models.CharField(
        max_length=80,
        blank=True,
        help_text="Required when request_type='custom'"
    )

    # Quantity & Specs
    quantity_requested = models.IntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        help_text="Number of samples requested"
    )
    size_set_json = models.JSONField(
        default=dict,
        blank=True,
        help_text='{"sizes": ["S", "M"], "notes": "..."}'
    )
    purpose = models.TextField(
        blank=True,
        help_text="Purpose of this sample request"
    )

    # Workflow flags
    need_quote_first = models.BooleanField(
        default=False,
        help_text="Requires quote approval before execution"
    )
    priority = models.CharField(
        max_length=16,
        choices=Priority.CHOICES,
        default=Priority.NORMAL
    )
    due_date = models.DateField(
        null=True,
        blank=True
    )

    # Status (simplified in Phase 3 - Request is just a container)
    status = models.CharField(
        max_length=24,
        choices=SampleRequestStatus.CHOICES,
        default=SampleRequestStatus.DRAFT,
        db_index=True
    )

    # Notes
    notes_internal = models.TextField(blank=True)
    notes_customer = models.TextField(blank=True)

    # Brand-specific context (flexible JSON)
    brand_context_json = models.JSONField(
        default=dict,
        blank=True,
        help_text="Brand-specific custom fields"
    )

    # Metadata
    created_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sample_requests_created'
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    status_updated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'sample_requests'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['revision', 'status']),
            models.Index(fields=['brand_name', 'status']),
            models.Index(fields=['due_date']),
        ]

    # SaaS-Ready: Tenant-aware manager
    objects = TenantManager()

    def __str__(self):
        return f"{self.get_request_type_display()} - {self.brand_name or 'N/A'}"

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.request_type == SampleRequestType.CUSTOM and not self.request_type_custom:
            raise ValidationError({
                'request_type_custom': 'This field is required when request_type is "custom".'
            })


class SampleRun(models.Model):
    """
    每一輪樣衣的核心中樞（Phase 3 重構新增）

    設計原則：
    - Sample Request 是容器，SampleRun 是實際執行單位
    - 每次 Proto/Fit/Sales 都是一個 Run
    - T2PO/MWO 掛在 Run 上，支援多版本
    - 只保留單向 FK：samples → costing（避免循環依賴）
    - ⭐ SampleRun 是唯一的「執行真相來源」
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # SaaS-Ready: Direct organization FK for query performance
    organization = models.ForeignKey(
        'core.Organization',
        on_delete=models.CASCADE,
        related_name='sample_runs',
        null=True,  # TODO: Make non-null after migration backfill
        blank=True,
        help_text="Organization (tenant) this run belongs to"
    )

    sample_request = models.ForeignKey(
        SampleRequest,
        on_delete=models.CASCADE,
        related_name='runs'
    )

    # Run 識別
    run_no = models.IntegerField(
        help_text='Run number within request (1, 2, 3...)'
    )
    run_type = models.CharField(
        max_length=24,
        choices=SampleRunType.CHOICES,
        default=SampleRunType.PROTO
    )

    # 可選：指定不同 revision（如果樣衣修版）
    revision = models.ForeignKey(
        'styles.StyleRevision',
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        help_text="Override revision for this run (if different from request)"
    )

    # 數量與交期
    quantity = models.IntegerField(default=1, validators=[MinValueValidator(1)])
    target_due_date = models.DateField(null=True, blank=True)

    # 狀態機
    status = models.CharField(
        max_length=24,
        choices=SampleRunStatus.CHOICES,
        default=SampleRunStatus.DRAFT,
        db_index=True
    )
    notes = models.TextField(blank=True)

    # ⭐ 快照來源追溯（P0-1 核心）
    source_revision_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="Source revision ID at snapshot time"
    )
    source_revision_label = models.CharField(
        max_length=32,
        blank=True,
        help_text="Source revision label (e.g., 'Rev A')"
    )
    source_hash = models.CharField(
        max_length=64,
        blank=True,
        help_text="SHA256 hash of snapshotted BOM + Operations"
    )
    snapshotted_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When BOM/Operations were snapshotted"
    )

    # ⭐ 狀態時間戳追蹤（P0-1 核心）
    submitted_at = models.DateTimeField(null=True, blank=True)
    quoted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    materials_at = models.DateTimeField(null=True, blank=True)
    production_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    # ⭐ TRACK-PROGRESS: 狀態時間戳 JSON（每個狀態的進入時間）
    status_timestamps = models.JSONField(
        default=dict,
        blank=True,
        help_text='{"draft": "2026-01-01T00:00:00Z", "materials_planning": "2026-01-02T...", ...}'
    )

    # ⭐ 只保留單向 FK：samples → costing（避免循環依賴）
    guidance_usage = models.ForeignKey(
        'costing.UsageScenario',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='sample_runs_guidance',  # P19: 追蹤進度用
        help_text="Guidance usage scenario for materials planning"
    )
    actual_usage = models.ForeignKey(
        'costing.UsageScenario',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='sample_runs_actual',  # P19: 追蹤進度用
        help_text="Actual usage recorded after sample done"
    )

    # After-sample 報價版（連到 Phase 2-3）
    costing_version = models.ForeignKey(
        'costing.CostSheetVersion',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='sample_runs',  # P19: 追蹤進度用 - 可從報價追溯樣衣
        help_text="Generated costing version from actuals"
    )

    # Metadata
    created_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sample_runs_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    status_updated_at = models.DateTimeField(auto_now_add=True)

    # SaaS-Ready: Optimistic locking for concurrent edits (Phase B)
    version = models.PositiveIntegerField(
        default=1,
        help_text="Version number for optimistic locking (incremented on each save)"
    )

    class Meta:
        db_table = 'sample_runs'
        ordering = ['run_no']
        unique_together = [['sample_request', 'run_no']]
        indexes = [
            models.Index(fields=['sample_request', 'status']),
            models.Index(fields=['status', 'target_due_date']),
        ]

    # SaaS-Ready: Tenant-aware manager
    objects = TenantManager()

    def __str__(self):
        return f"Run #{self.run_no} ({self.get_run_type_display()}) - {self.get_status_display()}"

    def get_effective_revision(self):
        """取得有效的 revision（Run 優先，否則用 Request 的）"""
        return self.revision or self.sample_request.revision


class RunBOMLine(models.Model):
    """
    BOM 快照 - 從 Revision Verified BOM 複製（P0-1 核心）

    Phase 2/3 邊界規則：
    - 只複製 verified BOM items
    - 複製後不可回寫到 Phase 2
    - 提供 source_hash 追溯
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey(
        SampleRun,
        on_delete=models.CASCADE,
        related_name='bom_lines'
    )
    line_no = models.IntegerField(help_text="Line number in BOM snapshot")

    # 快照欄位（複製時鎖定）
    material_name = models.CharField(max_length=200)
    material_name_zh = models.CharField(max_length=200, blank=True)
    material_code = models.CharField(max_length=80, blank=True)
    category = models.CharField(max_length=60, blank=True)
    color = models.CharField(max_length=80, blank=True)
    uom = models.CharField(max_length=16, help_text="Unit of measure")
    consumption = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        default=0,
        help_text="Consumption per garment"
    )
    wastage_pct = models.DecimalField(
        max_digits=6,
        decimal_places=4,
        default=0,
        help_text="Wastage percentage"
    )
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        null=True,
        blank=True
    )
    supplier_name = models.CharField(max_length=120, blank=True)
    supplier_id = models.UUIDField(null=True, blank=True)
    leadtime_days = models.IntegerField(default=0)

    # 來源追溯
    source_bom_item_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="Original BOMItem ID for reference"
    )

    class Meta:
        db_table = 'run_bom_lines'
        ordering = ['line_no']
        unique_together = [['run', 'line_no']]
        indexes = [
            models.Index(fields=['run']),
            models.Index(fields=['material_name']),
        ]

    def __str__(self):
        return f"Line {self.line_no}: {self.material_name}"


class RunOperation(models.Model):
    """
    工序快照 - 從 Revision Construction 複製（P0-1 核心）
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey(
        SampleRun,
        on_delete=models.CASCADE,
        related_name='operations'
    )
    step_no = models.IntegerField(help_text="Step number")

    # 快照欄位
    step_name = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    description_zh = models.TextField(blank=True, help_text="Chinese translation of operation description")
    machine_type = models.CharField(max_length=100, blank=True)
    machine_type_zh = models.CharField(max_length=150, blank=True, help_text="Chinese translation of machine type")
    stitch_type_zh = models.CharField(max_length=100, blank=True, help_text="Chinese translation of stitch type")
    std_minutes = models.IntegerField(default=0, help_text="Standard minutes")
    special_requirements = models.TextField(blank=True)

    # 來源追溯
    source_construction_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="Original ConstructionStep ID for reference"
    )

    class Meta:
        db_table = 'run_operations'
        ordering = ['step_no']
        unique_together = [['run', 'step_no']]
        indexes = [
            models.Index(fields=['run']),
        ]

    def __str__(self):
        return f"Step {self.step_no}: {self.step_name or self.description[:50]}"


class SampleActuals(models.Model):
    """
    樣衣完成後回填的實際數據（Phase 3 重構新增）

    記錄實際工時、成本、損耗，用於生成 Sample Costing
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sample_run = models.OneToOneField(
        SampleRun,
        on_delete=models.CASCADE,
        related_name='actuals'
    )

    # 工時
    labor_minutes = models.IntegerField(
        null=True, blank=True,
        help_text="Actual labor time in minutes"
    )
    labor_cost = models.DecimalField(
        max_digits=12, decimal_places=2,
        null=True, blank=True,
        help_text="Actual labor cost"
    )

    # 其他成本
    overhead_cost = models.DecimalField(
        max_digits=12, decimal_places=2,
        null=True, blank=True
    )
    shipping_cost = models.DecimalField(
        max_digits=12, decimal_places=2,
        null=True, blank=True
    )
    rework_cost = models.DecimalField(
        max_digits=12, decimal_places=2,
        null=True, blank=True,
        help_text="Cost of any rework required"
    )

    # 損耗
    waste_pct_actual = models.DecimalField(
        max_digits=6, decimal_places=2,
        null=True, blank=True,
        help_text="Actual wastage percentage"
    )

    # 備註
    issues_notes = models.TextField(
        blank=True,
        help_text="Notes about issues encountered"
    )

    # 審計
    recorded_by = models.ForeignKey(
        'core.User',
        null=True, blank=True,
        on_delete=models.SET_NULL
    )
    recorded_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'sample_actuals'
        verbose_name = 'Sample Actuals'
        verbose_name_plural = 'Sample Actuals'

    def __str__(self):
        return f"Actuals for {self.sample_run}"


class SampleCostEstimate(models.Model):
    """
    Sample Quote/Estimate (樣衣報價)
    Supports multiple versions, flexible JSON breakdown
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # SaaS-Ready: Direct organization FK for tenant isolation
    organization = models.ForeignKey(
        'core.Organization',
        on_delete=models.CASCADE,
        related_name='sample_cost_estimates',
        null=True,  # Nullable for migration
        blank=True,
        help_text="Organization (tenant) this estimate belongs to"
    )

    sample_request = models.ForeignKey(
        SampleRequest,
        on_delete=models.CASCADE,
        related_name='estimates'
    )

    # Version control
    estimate_version = models.IntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        help_text="Version number (starts from 1)"
    )

    # Status & Validity
    status = models.CharField(
        max_length=16,
        choices=EstimateStatus.CHOICES,
        default=EstimateStatus.DRAFT,
        db_index=True
    )
    currency = models.CharField(max_length=3, default='USD')
    valid_until = models.DateField(null=True, blank=True)

    # Cost
    estimated_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)]
    )

    # Breakdown (flexible JSON)
    breakdown_snapshot_json = models.JSONField(
        default=dict,
        help_text='{"materials": [...], "labor": [...], "overhead": [...]}'
    )

    # Provenance
    source = models.CharField(
        max_length=32,
        choices=EstimateSource.CHOICES,
        default=EstimateSource.MANUAL
    )
    source_revision_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="Redundant record of source revision"
    )
    snapshot_hash = models.CharField(
        max_length=64,
        blank=True,
        help_text="SHA256 of canonical JSON"
    )

    # Metadata
    created_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'sample_cost_estimates'
        ordering = ['-estimate_version']
        unique_together = [['sample_request', 'estimate_version']]
        indexes = [
            models.Index(fields=['sample_request', 'status']),
        ]

    # SaaS-Ready: Tenant-aware manager
    objects = TenantManager()

    def __str__(self):
        return f"Estimate v{self.estimate_version} - {self.estimated_total} {self.currency}"

    def save(self, *args, **kwargs):
        # Auto-generate snapshot_hash if breakdown exists
        if self.breakdown_snapshot_json and not self.snapshot_hash:
            canonical = json.dumps(self.breakdown_snapshot_json, sort_keys=True)
            self.snapshot_hash = hashlib.sha256(canonical.encode()).hexdigest()
        super().save(*args, **kwargs)


class T2POForSample(models.Model):
    """
    T2 PO for Sample (樣品調料採購單)
    Contract document - immutable after issued

    Phase 3 重構：改掛在 SampleRun，支援多版本
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # SaaS-Ready: Direct organization FK for tenant isolation
    organization = models.ForeignKey(
        'core.Organization',
        on_delete=models.CASCADE,
        related_name='t2pos_for_sample',
        null=True,  # Nullable for migration
        blank=True,
        help_text="Organization (tenant) this T2PO belongs to"
    )

    # ⭐ Phase 3: 改掛在 SampleRun（nullable for migration）
    sample_run = models.ForeignKey(
        SampleRun,
        on_delete=models.CASCADE,
        null=True,  # Nullable for migration
        blank=True,
        related_name='t2pos'
    )

    # Legacy: 舊版掛在 request（migration 後會清除）
    sample_request = models.ForeignKey(
        SampleRequest,
        on_delete=models.CASCADE,
        null=True,  # Made nullable for migration
        blank=True,
        related_name='t2pos_legacy'
    )
    estimate = models.ForeignKey(
        SampleCostEstimate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='t2pos'
    )

    # ⭐ Phase 3: 支援多版本
    version_no = models.IntegerField(
        default=1,
        help_text='Version number within run (1, 2, 3...)'
    )
    is_latest = models.BooleanField(
        default=True,
        help_text='Is this the latest version for this run?'
    )

    # PO Info
    po_no = models.CharField(
        max_length=40,
        blank=True,
        db_index=True,
        help_text="Generated after issued"
    )
    supplier_name = models.CharField(max_length=120)

    # Status & Dates
    status = models.CharField(
        max_length=16,
        choices=T2POStatus.CHOICES,
        default=T2POStatus.DRAFT,
        db_index=True
    )
    issued_at = models.DateTimeField(null=True, blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    delivery_date = models.DateField(
        null=True,
        blank=True,
        db_index=True
    )

    # Cost
    currency = models.CharField(max_length=3, default='USD')
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )

    notes = models.TextField(blank=True)

    # Snapshot provenance (Phase 2/3 boundary)
    source_revision_id = models.UUIDField(
        help_text="Source revision at snapshot time"
    )
    snapshot_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When BOM was snapshotted"
    )
    snapshot_hash = models.CharField(
        max_length=64,
        help_text="SHA256 of canonical BOM JSON"
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 't2pos_for_sample'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['sample_run', 'status']),
            models.Index(fields=['sample_run', 'version_no']),
            models.Index(fields=['supplier_name', 'status']),
            models.Index(fields=['po_no']),
            models.Index(fields=['delivery_date']),
        ]
        # Note: unique_together for [sample_run, version_no] will be added
        # after data migration when sample_run is not null

    # SaaS-Ready: Tenant-aware manager
    objects = TenantManager()

    def __str__(self):
        version_str = f" v{self.version_no}" if self.version_no > 1 else ""
        return f"{self.po_no or 'DRAFT'}{version_str} - {self.supplier_name}"


class T2POLineForSample(models.Model):
    """
    T2 PO Line for Sample (PO 明細)
    Snapshot fields (NO FK to BOMItem) - Phase 2/3 boundary rule
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    t2po = models.ForeignKey(
        T2POForSample,
        on_delete=models.CASCADE,
        related_name='lines'
    )

    line_no = models.IntegerField(help_text="Line number in PO")

    # Material info (snapshot)
    material_name = models.CharField(max_length=200)
    supplier_article_no = models.CharField(max_length=80, blank=True)
    uom = models.CharField(
        max_length=16,
        help_text="Unit of measure: yd, m, pcs"
    )

    # Consumption (snapshot from BOM)
    consumption_per_piece = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        default=0,
        help_text="Consumption per garment"
    )
    wastage_pct = models.DecimalField(
        max_digits=6,
        decimal_places=4,
        default=0,
        help_text="Wastage percentage (0.10 = 10%)"
    )

    # Quantity & Cost
    quantity_requested = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        default=0,
        help_text="qty × consumption × (1 + wastage)"
    )
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        default=0
    )
    line_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text="quantity × unit_price"
    )

    class Meta:
        db_table = 't2po_lines_for_sample'
        ordering = ['line_no']
        unique_together = [['t2po', 'line_no']]
        indexes = [
            models.Index(fields=['t2po']),
            models.Index(fields=['material_name']),
        ]

    def __str__(self):
        return f"Line {self.line_no}: {self.material_name}"


class SampleMWO(models.Model):
    """
    Sample Manufacturing Work Order (樣衣製造單)
    Historical instruction - immutable after issued

    Phase 3 重構：改掛在 SampleRun，支援多版本
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # SaaS-Ready: Direct organization FK for tenant isolation
    organization = models.ForeignKey(
        'core.Organization',
        on_delete=models.CASCADE,
        related_name='sample_mwos',
        null=True,  # Nullable for migration
        blank=True,
        help_text="Organization (tenant) this MWO belongs to"
    )

    # ⭐ Phase 3: 改掛在 SampleRun（nullable for migration）
    sample_run = models.ForeignKey(
        SampleRun,
        on_delete=models.CASCADE,
        null=True,  # Nullable for migration
        blank=True,
        related_name='mwos'
    )

    # Legacy: 舊版掛在 request（migration 後會清除）
    sample_request = models.ForeignKey(
        SampleRequest,
        on_delete=models.CASCADE,
        null=True,  # Made nullable for migration
        blank=True,
        related_name='mwos_legacy'
    )
    estimate = models.ForeignKey(
        SampleCostEstimate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    # ⭐ Phase 3: 支援多版本
    version_no = models.IntegerField(
        default=1,
        help_text='Version number within run (1, 2, 3...)'
    )
    is_latest = models.BooleanField(
        default=True,
        help_text='Is this the latest version for this run?'
    )

    # MWO Info
    mwo_no = models.CharField(
        max_length=40,
        blank=True,
        help_text="Generated after issued"
    )
    factory_name = models.CharField(max_length=120)

    # Status & Dates
    status = models.CharField(
        max_length=16,
        choices=MWOStatus.CHOICES,
        default=MWOStatus.DRAFT,
        db_index=True
    )
    start_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(
        null=True,
        blank=True,
        db_index=True
    )

    notes = models.TextField(blank=True)

    # Snapshots (Phase 2/3 boundary)
    source_revision_id = models.UUIDField()
    snapshot_at = models.DateTimeField(auto_now_add=True)
    snapshot_hash = models.CharField(max_length=64)

    bom_snapshot_json = models.JSONField(
        default=list,
        help_text="BOM snapshot at MWO generation time"
    )
    construction_snapshot_json = models.JSONField(
        default=list,
        help_text="Construction steps snapshot"
    )
    qc_snapshot_json = models.JSONField(
        default=dict,
        blank=True,
        help_text="QC checkpoints snapshot"
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'sample_mwos'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['sample_run', 'status']),
            models.Index(fields=['sample_run', 'version_no']),
            models.Index(fields=['factory_name', 'status']),
            models.Index(fields=['due_date']),
        ]
        # Note: unique_together for [sample_run, version_no] will be added
        # after data migration when sample_run is not null

    # SaaS-Ready: Tenant-aware manager
    objects = TenantManager()

    def __str__(self):
        version_str = f" v{self.version_no}" if self.version_no > 1 else ""
        return f"{self.mwo_no or 'DRAFT'}{version_str} - {self.factory_name}"

    def save(self, *args, **kwargs):
        # Auto-generate snapshot_hash
        if not self.snapshot_hash:
            canonical = json.dumps({
                'bom': self.bom_snapshot_json,
                'construction': self.construction_snapshot_json,
                'qc': self.qc_snapshot_json
            }, sort_keys=True)
            self.snapshot_hash = hashlib.sha256(canonical.encode()).hexdigest()
        super().save(*args, **kwargs)


class Sample(models.Model):
    """
    Physical Sample (實體樣衣)
    Multiple samples can be created per request
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sample_request = models.ForeignKey(
        SampleRequest,
        on_delete=models.CASCADE,
        related_name='samples'
    )
    sample_mwo = models.ForeignKey(
        SampleMWO,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='samples'
    )

    # Physical info
    physical_ref = models.CharField(
        max_length=60,
        blank=True,
        help_text="Physical reference / package number"
    )
    quantity_made = models.IntegerField(
        default=1,
        validators=[MinValueValidator(1)]
    )

    # Status & Dates
    status = models.CharField(
        max_length=16,
        choices=SampleStatus.CHOICES,
        default=SampleStatus.IN_PRODUCTION,
        db_index=True
    )
    received_date = models.DateField(null=True, blank=True)
    delivered_date = models.DateField(
        null=True,
        blank=True,
        db_index=True
    )

    # Feedback
    customer_feedback = models.TextField(blank=True)
    fit_comments = models.TextField(blank=True)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'samples'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['sample_request', 'status']),
            models.Index(fields=['delivered_date']),
        ]

    def __str__(self):
        return f"{self.physical_ref or 'Sample'} - {self.get_status_display()}"


class RunTechPackPage(models.Model):
    """
    Run 的 Tech Pack 頁面快照

    設計原則：
    - Run 創建時從 RevisionPage 複製
    - 每個 Run 有自己的翻譯快照
    - 支援翻譯位置調整（不影響原 Revision）
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    run = models.ForeignKey(
        SampleRun,
        on_delete=models.CASCADE,
        related_name='techpack_pages'
    )

    page_number = models.IntegerField(help_text="頁碼")
    width = models.IntegerField(help_text="頁面寬度")
    height = models.IntegerField(help_text="頁面高度")

    # 來源追溯
    source_page_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="原始 RevisionPage ID"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'run_techpack_pages'
        ordering = ['page_number']
        unique_together = [['run', 'page_number']]
        indexes = [
            models.Index(fields=['run']),
        ]

    def __str__(self):
        return f"Run {self.run.run_no} - Page {self.page_number}"


class RunTechPackBlock(models.Model):
    """
    Run 的翻譯快照

    設計原則：
    - Run 創建時從 DraftBlock 複製
    - MWO 導出使用這裡的數據
    - 可獨立修改，不影響原 Revision
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    run_page = models.ForeignKey(
        RunTechPackPage,
        on_delete=models.CASCADE,
        related_name='blocks'
    )

    # 文字內容（快照）
    block_type = models.CharField(max_length=30, blank=True)
    source_text = models.TextField(help_text="原文（英文）")
    translated_text = models.TextField(help_text="翻譯（中文）")

    # 原始位置（從 DraftBlock 複製）
    bbox_x = models.FloatField(default=0)
    bbox_y = models.FloatField(default=0)
    bbox_width = models.FloatField(default=0)
    bbox_height = models.FloatField(default=0)

    # 翻譯疊加位置（可在 MWO 中調整）
    overlay_x = models.FloatField(
        null=True,
        blank=True,
        help_text="翻譯文字框 X 位置"
    )
    overlay_y = models.FloatField(
        null=True,
        blank=True,
        help_text="翻譯文字框 Y 位置"
    )
    overlay_visible = models.BooleanField(
        default=True,
        help_text="是否顯示此翻譯"
    )

    # 來源追溯
    source_block_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="原始 DraftBlock ID"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'run_techpack_blocks'
        ordering = ['bbox_y', 'bbox_x']
        indexes = [
            models.Index(fields=['run_page']),
        ]

    def __str__(self):
        return f"{self.block_type} - {self.source_text[:30]}..."


class SampleAttachment(models.Model):
    """
    Attachments / Photos for Sample Requests or Physical Samples
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Can attach to either request or sample (at least one required)
    sample_request = models.ForeignKey(
        SampleRequest,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='attachments'
    )
    sample = models.ForeignKey(
        Sample,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='attachments'
    )

    # File info
    file_url = models.TextField(help_text="URL or path to file")
    file_type = models.CharField(
        max_length=24,
        choices=AttachmentFileType.CHOICES,
        default=AttachmentFileType.PHOTO
    )
    caption = models.CharField(max_length=200, blank=True)

    # Metadata
    uploaded_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'sample_attachments'
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.get_file_type_display()} - {self.caption or 'N/A'}"

    def clean(self):
        from django.core.exceptions import ValidationError
        if not self.sample_request and not self.sample:
            raise ValidationError(
                'At least one of sample_request or sample must be specified.'
            )


class SampleRunTransitionLog(models.Model):
    """
    TRACK-PROGRESS: 狀態轉換操作歷史表
    記錄每次狀態轉換/回退的完整審計資訊
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    sample_run = models.ForeignKey(
        SampleRun,
        on_delete=models.CASCADE,
        related_name='transition_logs'
    )

    from_status = models.CharField(max_length=24)
    to_status = models.CharField(max_length=24)
    action = models.CharField(
        max_length=32,
        help_text="Action name: submit, approve, rollback, cancel, etc."
    )

    actor = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    note = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'sample_run_transition_logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['sample_run', '-created_at']),
        ]

    def __str__(self):
        return f"{self.from_status} → {self.to_status} ({self.action})"
