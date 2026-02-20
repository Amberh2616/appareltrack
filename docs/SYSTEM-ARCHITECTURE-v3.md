# Fashion Production System - 系統架構 v3.0

**Last Updated:** 2026-01-01
**Version:** 3.0.0
**Status:** 規劃確認版

---

## 0. 系統定位與核心目標

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI-Augmented PLM + ERP Lite                  │
│                                                                 │
│   目標：1 人管理 300-500+ 款/季，70-80% 自動化                   │
│   擴展：多人協作 1000+ 款，可商業化 SaaS                         │
│                                                                 │
│   輸入：客戶 Tech Pack (PDF)                                    │
│   輸出：製作單(MWO)、報價單(Estimate)、採購單(T2 PO)             │
└─────────────────────────────────────────────────────────────────┘
```

### 核心原則

> **SampleRun 是唯一的「執行真相來源（Single Source of Execution Truth）」**
> MWO / Estimate / T2 PO 都是 Run 的輸出文件，不是各自獨立生長。

### 三大必做事項

1. **事件化（Event-driven）**：Create Request 觸發原子交易內的自動生成
2. **快照治理（Snapshot Governance）**：source_hash + 可追溯來源
3. **採購拆單（PO Split）**：T2 PO 按供應商拆分，分 Draft/Issued 兩層

---

## 1. 系統架構分層

```
┌─────────────────────────────────────────────────────────────────┐
│                         系統分層架構                             │
└─────────────────────────────────────────────────────────────────┘

Layer A: Ingestion & Parsing（文件輸入）
├── PDF Storage（S3/本地）
├── ExtractionRun（AI 解析任務）
└── Draft Blocks（雙語疊層審核）

Layer B: Verified Data（可用真相）
├── Verified BOMItem
├── Verified Measurement
├── Verified Construction
└── 只讀、可追溯（verified_by/verified_at）

Layer C: Execution Layer（執行層）
├── SampleRequest（容器/需求）
├── SampleRun（執行批次 - 唯一真相來源）
└── Run Snapshots（RunBOMLine/RunOperation）

Layer D: Documents（輸出單據）
├── MWO（製作單 - 給工廠）
├── Estimate（報價單 - 給客戶）
└── T2 PO（採購單 - 給供應商，多張）

Layer E: Tracking & Collaboration（追蹤協作）
├── Timeline Timestamps
├── Attachments / Comments
├── Activity Log
└── Alerts（due/overdue）

Layer F: Performance & Scale（性能擴展）
├── Read Model / Summary Counts
├── Pagination + Indexes
├── Redis Cache
└── Celery Async Tasks
```

---

## 2. 資料模型設計

### 2.1 核心實體關係

```
Style (款式)
  └── StyleRevision (版本 Rev A/B/C)
        ├── BOMItem (物料清單 - Verified)
        ├── Measurement (尺寸表 - Verified)
        ├── Construction (工序表 - Verified)
        │
        └── SampleRequest (樣衣請求)
              └── SampleRun (執行批次 #1, #2...)
                    ├── RunBOMLine (BOM 快照)
                    ├── RunOperation (工序快照)
                    │
                    ├── MWO (製作單)
                    ├── Estimate (報價單)
                    │     └── EstimateLine
                    └── PurchasePlan (採購計劃)
                          └── PurchaseOrder (採購單)
                                └── PurchaseOrderLine
```

### 2.2 SampleRun（執行真相來源）

```python
class SampleRun(models.Model):
    # 關聯
    sample_request = FK(SampleRequest)
    run_no = IntegerField()  # 1, 2, 3...

    # 狀態
    status = CharField(choices=RUN_STATUS)

    # 數量與規格
    quantity_planned = IntegerField()
    due_date = DateField(null=True)

    # 快照來源追溯（重要！）
    source_revision_id = UUIDField()
    source_revision_label = CharField()  # "Rev A"
    source_hash = CharField(max_length=64)  # SHA256
    snapshotted_at = DateTimeField()

    # 時間戳追蹤
    submitted_at = DateTimeField(null=True)
    quoted_at = DateTimeField(null=True)
    approved_at = DateTimeField(null=True)
    materials_at = DateTimeField(null=True)
    production_at = DateTimeField(null=True)
    completed_at = DateTimeField(null=True)
    cancelled_at = DateTimeField(null=True)

    class Meta:
        unique_together = ['sample_request', 'run_no']
        indexes = [
            Index(fields=['sample_request', 'status']),
            Index(fields=['due_date']),
        ]
```

### 2.3 Run 快照表（Snapshot Tables）

```python
class RunBOMLine(models.Model):
    """BOM 快照 - 從 Revision Verified BOM 複製"""
    run = FK(SampleRun, related_name='bom_lines')
    line_no = IntegerField()

    # 快照欄位（複製時鎖定）
    material_name = CharField()
    material_name_zh = CharField(blank=True)
    material_code = CharField(blank=True)
    color = CharField(blank=True)
    uom = CharField()  # unit of measure
    consumption = DecimalField()
    wastage_pct = DecimalField(default=0)
    unit_price = DecimalField(null=True)
    supplier_name = CharField(blank=True)
    supplier_id = UUIDField(null=True)
    leadtime_days = IntegerField(default=0)

    class Meta:
        unique_together = ['run', 'line_no']

class RunOperation(models.Model):
    """工序快照"""
    run = FK(SampleRun, related_name='operations')
    step_no = IntegerField()
    description = TextField()
    std_minutes = IntegerField(default=0)

    class Meta:
        unique_together = ['run', 'step_no']
```

### 2.4 輸出文件（Documents）

```python
class MWO(models.Model):
    """製作單 - 給工廠"""
    run = OneToOneField(SampleRun)  # 一個 Run 一張 MWO
    doc_no = CharField(unique=True)  # MWO-2601-000123
    status = CharField()  # draft/issued/in_progress/completed

    issued_at = DateTimeField(null=True)
    issued_by = FK(User, null=True)

class Estimate(models.Model):
    """報價單 - 給客戶"""
    run = OneToOneField(SampleRun)  # 一個 Run 一張 Estimate
    quote_no = CharField(unique=True)  # EST-2601-000123-v1
    version = IntegerField(default=1)
    status = CharField()  # draft/sent/approved/rejected

    currency = CharField(default='USD')
    margin_pct = DecimalField(default=35)

    # 計算結果
    material_cost = DecimalField()
    labor_cost = DecimalField()
    overhead_cost = DecimalField()
    total_cost = DecimalField()
    unit_price = DecimalField()

class EstimateLine(models.Model):
    """報價明細"""
    estimate = FK(Estimate, related_name='lines')
    line_type = CharField()  # material/labor/overhead/other
    description = CharField()
    quantity = DecimalField()
    unit_price = DecimalField()
    amount = DecimalField()
```

### 2.5 採購單（拆分設計）

```python
class PurchasePlan(models.Model):
    """採購計劃（草稿，可修改）"""
    run = FK(SampleRun, related_name='purchase_plans')
    supplier_name = CharField()
    supplier_id = UUIDField(null=True)
    status = CharField()  # draft/ready/issued
    planned_delivery = DateField(null=True)

class PurchaseOrder(models.Model):
    """正式採購單（已發出，不可隨意修改）"""
    plan = FK(PurchasePlan, null=True)
    run = FK(SampleRun, related_name='purchase_orders')

    po_no = CharField(unique=True)  # T2PO-2601-000123
    supplier_name = CharField()
    status = CharField()  # draft/issued/confirmed/delivered/cancelled

    issued_at = DateTimeField(null=True)
    issued_by = FK(User, null=True)

class PurchaseOrderLine(models.Model):
    """採購單明細"""
    po = FK(PurchaseOrder, related_name='lines')
    material_name = CharField()
    color = CharField()
    uom = CharField()
    quantity = DecimalField()
    unit_price = DecimalField()
    amount = DecimalField()
    delivery_date = DateField(null=True)
```

### 2.6 支援表

```python
class Attachment(models.Model):
    """附件（照片、PDF、規格書）"""
    content_type = FK(ContentType)
    object_id = UUIDField()
    content_object = GenericForeignKey()

    file = FileField()
    file_type = CharField()  # photo/pdf/excel
    uploaded_by = FK(User)
    uploaded_at = DateTimeField(auto_now_add=True)

class Comment(models.Model):
    """備註/對話"""
    content_type = FK(ContentType)
    object_id = UUIDField()
    content_object = GenericForeignKey()

    text = TextField()
    author = FK(User)
    created_at = DateTimeField(auto_now_add=True)

class ActivityLog(models.Model):
    """操作日誌"""
    content_type = FK(ContentType)
    object_id = UUIDField()

    action = CharField()  # created/updated/status_changed
    field_name = CharField(blank=True)
    old_value = TextField(blank=True)
    new_value = TextField(blank=True)

    actor = FK(User)
    timestamp = DateTimeField(auto_now_add=True)
```

---

## 3. 狀態機設計

### 3.1 SampleRun 狀態流程

```
                        Create Request
                              │
                              ▼
                    ┌─────────────────┐
                    │     DRAFT       │  草稿
                    └────────┬────────┘
                             │ [Submit]
                             ▼
                    ┌─────────────────┐
                    │   SUBMITTED     │  已提交（待報價）
                    └────────┬────────┘
                             │ [Mark Quoted]
                             ▼
                    ┌─────────────────┐
                    │     QUOTED      │  已報價
                    └────────┬────────┘
                             │ [Send to Customer]
                             ▼
                    ┌─────────────────┐
                    │ PENDING_APPROVAL│  待客戶確認
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              │              ▼
     ┌────────────┐          │      ┌────────────┐
     │  REJECTED  │          │      │  APPROVED  │
     └────────────┘          │      └─────┬──────┘
                             │            │ [Start Materials]
                             │            ▼
                             │   ┌─────────────────┐
                             │   │   MATERIALS     │  調料中
                             │   │   PLANNING      │
                             │   └────────┬────────┘
                             │            │ [Issue PO]
                             │            ▼
                             │   ┌─────────────────┐
                             │   │   PO_ISSUED     │  採購單已發
                             │   └────────┬────────┘
                             │            │ [Materials Ready]
                             │            ▼
                             │   ┌─────────────────┐
                             │   │  IN_PRODUCTION  │  生產中
                             │   └────────┬────────┘
                             │            │ [QC Pass]
                             │            ▼
                             │   ┌─────────────────┐
                             │   │   COMPLETED     │  完成
                             │   └─────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   CANCELLED     │  取消
                    └─────────────────┘
```

### 3.2 狀態定義

```python
class SampleRunStatus:
    DRAFT = 'draft'                      # 草稿
    SUBMITTED = 'submitted'              # 已提交
    QUOTED = 'quoted'                    # 已報價
    PENDING_APPROVAL = 'pending_approval'# 待客戶確認
    APPROVED = 'approved'                # 已批准
    REJECTED = 'rejected'                # 被拒絕
    MATERIALS_PLANNING = 'materials'     # 調料中
    PO_ISSUED = 'po_issued'             # 採購單已發
    IN_PRODUCTION = 'production'         # 生產中
    COMPLETED = 'completed'              # 完成
    CANCELLED = 'cancelled'              # 取消
```

---

## 4. P0-1 工程規格：自動生成

### 4.1 觸發點

`POST /api/v2/sample-requests/`

### 4.2 Service 規格

```python
@transaction.atomic
def create_with_initial_run(revision_id, payload, user):
    """
    原子交易內自動生成：
    1. SampleRequest
    2. SampleRun #1
    3. Run Snapshots (BOM + Operations)
    4. MWO (draft)
    5. Estimate (draft)
    6. PurchasePlan groups (optional)
    """

    # 1. 建立 Request
    request = SampleRequest.objects.create(
        revision_id=revision_id,
        request_type=payload['request_type'],
        quantity_requested=payload['quantity'],
        priority=payload.get('priority', 'normal'),
        due_date=payload.get('due_date'),
        brand_name=payload.get('brand_name', ''),
        created_by=user,
    )

    # 2. 建立 Run #1（冪等）
    revision = StyleRevision.objects.get(id=revision_id)
    source_hash = generate_source_hash(revision)

    run, created = SampleRun.objects.get_or_create(
        sample_request=request,
        run_no=1,
        defaults={
            'status': 'draft',
            'quantity_planned': payload['quantity'],
            'due_date': payload.get('due_date'),
            'source_revision_id': revision.id,
            'source_revision_label': revision.revision_label,
            'source_hash': source_hash,
            'snapshotted_at': timezone.now(),
        }
    )

    if created:
        # 3. 複製快照
        snapshot_bom_to_run(revision, run)
        snapshot_operations_to_run(revision, run)

        # 4. 建立 MWO
        MWO.objects.get_or_create(
            run=run,
            defaults={
                'doc_no': generate_mwo_no(),
                'status': 'draft',
            }
        )

        # 5. 建立 Estimate
        estimate, _ = Estimate.objects.get_or_create(
            run=run,
            defaults={
                'quote_no': generate_estimate_no(),
                'status': 'draft',
            }
        )
        calculate_estimate_from_snapshot(estimate, run)

        # 6. 建立 PurchasePlan（按供應商分組）
        create_purchase_plans_by_supplier(run)

    return request, run
```

### 4.3 快照 Hash 生成

```python
def generate_source_hash(revision):
    """生成來源資料 hash，用於追溯"""
    bom_items = BOMItem.objects.filter(
        revision=revision,
        is_verified=True
    ).order_by('item_number')

    operations = Construction.objects.filter(
        revision=revision,
        is_verified=True
    ).order_by('step_number')

    payload = {
        'revision_id': str(revision.id),
        'bom': [
            {
                'material': item.material_name,
                'consumption': str(item.consumption),
                'uom': item.unit,
                'supplier': item.supplier,
                'unit_price': str(item.unit_price or 0),
            }
            for item in bom_items
        ],
        'ops': [
            {
                'step_no': op.step_number,
                'desc': op.description,
            }
            for op in operations
        ],
    }

    json_str = json.dumps(payload, sort_keys=True)
    return hashlib.sha256(json_str.encode()).hexdigest()
```

### 4.4 Gating 規則

**採用 Option A（嚴格模式）**：

```python
def validate_revision_for_request(revision):
    """Revision 必須有 verified BOM 才能建立 Request"""
    verified_count = BOMItem.objects.filter(
        revision=revision,
        is_verified=True
    ).count()

    if verified_count == 0:
        raise ValidationError(
            "Revision must have at least one verified BOM item"
        )
```

### 4.5 DB 約束

```sql
-- SampleRun 唯一性
ALTER TABLE sample_runs
ADD CONSTRAINT uq_run_request_no
UNIQUE (sample_request_id, run_no);

-- MWO 唯一性
ALTER TABLE mwos
ADD CONSTRAINT uq_mwo_run
UNIQUE (run_id);

-- Estimate 唯一性
ALTER TABLE estimates
ADD CONSTRAINT uq_estimate_run
UNIQUE (run_id);

-- 文件編號唯一
ALTER TABLE mwos ADD CONSTRAINT uq_mwo_doc_no UNIQUE (doc_no);
ALTER TABLE estimates ADD CONSTRAINT uq_estimate_quote_no UNIQUE (quote_no);
ALTER TABLE purchase_orders ADD CONSTRAINT uq_po_no UNIQUE (po_no);
```

### 4.6 文件編號策略

```python
def generate_mwo_no():
    """MWO-YYMM-XXXXXX"""
    prefix = timezone.now().strftime('MWO-%y%m-')
    seq = get_next_sequence('mwo')
    return f"{prefix}{seq:06d}"

def generate_estimate_no():
    """EST-YYMM-XXXXXX-v1"""
    prefix = timezone.now().strftime('EST-%y%m-')
    seq = get_next_sequence('estimate')
    return f"{prefix}{seq:06d}-v1"

def generate_po_no():
    """T2PO-YYMM-XXXXXX"""
    prefix = timezone.now().strftime('T2PO-%y%m-')
    seq = get_next_sequence('po')
    return f"{prefix}{seq:06d}"
```

---

## 5. API Contract

### 5.1 建立 SampleRequest（主入口）

```
POST /api/v2/sample-requests/

Request:
{
  "revision_id": "UUID",
  "request_type": "proto|fit|sales|photo",
  "quantity": 3,
  "priority": "normal",
  "due_date": "2026-01-15",
  "brand_name": "Lululemon"
}

Response 201:
{
  "sample_request": {
    "id": "uuid",
    "revision_id": "uuid",
    "request_type": "proto",
    "quantity_requested": 3,
    "status": "open"
  },
  "initial_run": {
    "id": "uuid",
    "run_no": 1,
    "status": "draft",
    "source_revision_label": "Rev A",
    "source_hash": "abc123..."
  },
  "documents": {
    "mwo_id": "uuid",
    "mwo_no": "MWO-2601-000001",
    "estimate_id": "uuid",
    "estimate_no": "EST-2601-000001-v1",
    "purchase_plan_count": 3
  }
}
```

### 5.2 狀態轉換 API

```
POST /api/v2/sample-runs/{id}/submit/
POST /api/v2/sample-runs/{id}/mark-quoted/
POST /api/v2/sample-runs/{id}/send-to-customer/
POST /api/v2/sample-runs/{id}/approve/
POST /api/v2/sample-runs/{id}/reject/
POST /api/v2/sample-runs/{id}/start-materials/
POST /api/v2/sample-runs/{id}/issue-po/
POST /api/v2/sample-runs/{id}/start-production/
POST /api/v2/sample-runs/{id}/complete/
POST /api/v2/sample-runs/{id}/cancel/

GET /api/v2/sample-runs/{id}/allowed-actions/
```

### 5.3 快照資料 API

```
GET /api/v2/sample-runs/{id}/bom-lines/
GET /api/v2/sample-runs/{id}/operations/
GET /api/v2/sample-runs/{id}/purchase-plans/
```

---

## 6. 擴展設計（1000+ 款）

### 6.1 多租戶（Phase C）

```python
# Row-level tenant isolation (Phase A/B)
class SampleRequest(models.Model):
    tenant = FK(Tenant, db_index=True)
    ...

    class Meta:
        indexes = [
            Index(fields=['tenant', 'status', 'created_at']),
            Index(fields=['tenant', 'due_date']),
        ]
```

### 6.2 權限設計

```
Organization (租戶)
├── Admin (管理員)
│   └── 所有權限
├── Merchandiser (跟單員)
│   └── 建立/編輯 Request, Submit
├── Manager (主管)
│   └── Approve, Issue PO
├── Factory (工廠)
│   └── 查看 MWO, 更新生產狀態
└── Customer (客戶)
    └── 查看報價, Approve/Reject
```

### 6.3 性能優化

```python
# Summary table for kanban counts
class RunSummary(models.Model):
    tenant = FK(Tenant)
    date = DateField()
    status = CharField()
    count = IntegerField()

    class Meta:
        unique_together = ['tenant', 'date', 'status']

# Redis cache for dashboard
CACHE_KEYS = {
    'kanban_counts': 'kanban:{tenant_id}',  # TTL: 5min
    'overdue_count': 'overdue:{tenant_id}',  # TTL: 1min
}
```

---

## 7. 開發路線圖

```
Phase A: 單人版完善（目前）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ P0-1: Create Request 自動生成
   ├── Service: create_with_initial_run
   ├── Snapshots: RunBOMLine, RunOperation
   ├── Documents: MWO, Estimate
   └── Idempotent + Unique constraints

⬜ P0-2: 看板視圖
   ├── Kanban counts API
   └── Drag-drop status change

⬜ P1: 批量操作 + 告警
   ├── Batch submit/approve
   └── Due/Overdue alerts

Phase B: 多人協作版
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⬜ 用戶系統 (登入/權限)
⬜ 指派功能 (assigned_to)
⬜ Activity Log
⬜ 通知系統

Phase C: 企業版 SaaS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⬜ 多租戶 (row-level → schema)
⬜ 客戶/工廠入口
⬜ API 對接
⬜ 訂閱計費

Phase D: AI 增強
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⬜ 智能排程
⬜ 風險預測
⬜ 成本優化建議
```

---

## 8. 驗收測試清單

### P0-1 必測項目

| # | 測試項目 | 預期結果 |
|---|---------|---------|
| 1 | 冪等測試：同一 Request 連點 10 次 | Run/MWO/Estimate 各只有 1 筆 |
| 2 | 快照一致：Revision 有 N 筆 BOM | RunBOMLine = N 筆 |
| 3 | Hash 存在：Run.source_hash | 不為空，64 字元 |
| 4 | Gating：Revision 無 verified BOM | 回 400 錯誤 |
| 5 | 狀態轉移：Draft → Submit | submitted_at 有值 |
| 6 | 文件編號：MWO/Estimate | 格式正確且唯一 |

---

## 9. 附錄：名詞對照表

| 中文 | 英文 | 說明 |
|------|------|------|
| 款式 | Style | 一個款號 |
| 版本 | Revision | Rev A, Rev B... |
| 物料清單 | BOM | Bill of Materials |
| 樣衣請求 | SampleRequest | 容器 |
| 執行批次 | SampleRun | Run #1, #2... |
| 製作單 | MWO | Manufacturing Work Order |
| 報價單 | Estimate | Quote |
| 採購單 | T2 PO | Tier 2 Purchase Order |
| 快照 | Snapshot | 時間點鎖定的複製 |
