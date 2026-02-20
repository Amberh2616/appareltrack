# MWO v4 - Phase 1: Measurement Snapshot

**日期：** 2026-01-05
**優先級：** P4
**工時估計：** 3-4 小時
**狀態：** 待實施

---

## 問題診斷

### 現狀

```python
# backend/apps/samples/models.py:1097-1109
class SampleMWO(models.Model):
    # ✅ 現有快照
    bom_snapshot_json = JSONField()           # BOM 物料清單
    construction_snapshot_json = JSONField()  # 車縫工序
    qc_snapshot_json = JSONField()            # QC 檢驗點

    # ❌ 缺少
    # measurement_snapshot_json = JSONField()  # 尺寸規格表
```

### 為什麼需要 Measurement Snapshot？

MWO（Manufacturing Work Order）應該包含**完整的製造規格**：

```
完整的 MWO = BOM (材料) + Measurement (尺寸) + Construction (做工) + QC (檢驗)
```

**真實案例（LW1FLWS）：**
- Measurement 資料存在於 `apps/styles/Measurement` 資料庫表
- 包含 26 個測量點（Chest Width, Body Length, Sleeve Length...）
- 每個點有 6 個尺碼（XS, S, M, L, XL, XXL）
- 每個點有公差（tolerance_plus, tolerance_minus）

**但現在的 MWO 沒有包含這些尺寸資料！**

---

## 解決方案

### 新增欄位

```python
# backend/apps/samples/models.py:1109+

class SampleMWO(models.Model):
    # ... 現有欄位 ...

    # ⭐ 新增：Measurement 快照
    measurement_snapshot_json = models.JSONField(
        default=list,
        blank=True,
        help_text="""
        Measurement spec snapshot (尺寸規格快照):
        [
            {
                "point_name": "Chest Width",
                "point_code": "A",
                "values": {"XS": 40.0, "S": 42.0, "M": 44.0, ...},
                "tolerance_plus": 0.5,
                "tolerance_minus": 0.5,
                "unit": "cm",
                "source_id": "uuid..."
            },
            ...
        ]
        """
    )
```

### 快照服務

```python
# backend/apps/samples/services/auto_generation.py:237+

from apps.styles.models import Measurement

def snapshot_measurements(revision: StyleRevision, run: SampleRun) -> list:
    """
    快照 verified measurements 到 JSON.

    Args:
        revision: Source StyleRevision
        run: Target SampleRun (for future use)

    Returns:
        List of measurement dicts (JSON-serializable)
    """
    measurements = Measurement.objects.filter(
        revision=revision,
        is_verified=True
    ).order_by('point_name')

    snapshot = []
    for m in measurements:
        snapshot.append({
            'point_name': m.point_name,
            'point_code': m.point_code or '',
            'values': m.values,  # JSON: {"XS": 40.0, "S": 42.0, ...}
            'tolerance_plus': str(m.tolerance_plus),
            'tolerance_minus': str(m.tolerance_minus),
            'unit': m.unit,
            'source_id': str(m.id),
        })

    return snapshot
```

### 整合到生成流程

```python
# backend/apps/samples/services/auto_generation.py:341+

@transaction.atomic
def create_with_initial_run(...):
    """
    P0-1 核心服務：建立 SampleRequest 並自動生成所有相關文件
    ⭐ v4.0 更新：新增 Measurement snapshot
    """
    # ... 前面邏輯保持不變（1-8 步） ...

    if run_created:
        # 7. Snapshot BOM to RunBOMLine (現有)
        documents['bom_line_count'] = snapshot_bom_to_run(revision, run)

        # 8. Snapshot Operations to RunOperation (現有)
        documents['operation_count'] = snapshot_operations_to_run(revision, run)

        # ========== ⭐ 新增區域 ========== #

        # 8.5. Snapshot Measurements (NEW)
        measurement_snapshot = snapshot_measurements(revision, run)
        documents['measurement_count'] = len(measurement_snapshot)

        # ========== ⭐ 新增區域結束 ========== #

        # 9. Build enhanced MWO snapshots (現有)
        bom_snapshot = [...]  # 保持不變
        construction_snapshot = [...]  # 保持不變
        qc_snapshot = {...}  # 保持不變

        # 10. Create MWO (draft) with ALL snapshots
        mwo = SampleMWO.objects.create(
            sample_run=run,
            version_no=1,
            is_latest=True,
            mwo_no=generate_mwo_no(),
            factory_name='TBD',
            status='draft',
            source_revision_id=revision.id,
            snapshot_hash=source_hash,

            # ⭐ 新增：Measurement 快照
            measurement_snapshot_json=measurement_snapshot,

            # 現有 snapshots
            bom_snapshot_json=bom_snapshot,
            construction_snapshot_json=construction_snapshot,
            qc_snapshot_json=qc_snapshot,
        )

        # ... 剩餘邏輯保持不變 ...

    return request, run, documents
```

### 更新 snapshot_hash 計算

```python
# backend/apps/samples/models.py:1134+

def save(self, *args, **kwargs):
    # 更新 snapshot_hash 計算邏輯
    if not self.snapshot_hash:
        canonical = json.dumps({
            'bom': self.bom_snapshot_json,
            'construction': self.construction_snapshot_json,
            'qc': self.qc_snapshot_json,
            'measurements': self.measurement_snapshot_json,  # ⭐ 新增
        }, sort_keys=True)
        self.snapshot_hash = hashlib.sha256(canonical.encode()).hexdigest()
    super().save(*args, **kwargs)
```

---

## 實施步驟

### Step 1: Migration（10 分鐘）

```bash
cd backend

# 1. 修改 models.py（加 measurement_snapshot_json 欄位）
# 2. 生成 migration
python manage.py makemigrations samples -n add_measurement_snapshot

# 3. 執行 migration
python manage.py migrate samples
```

**預期 migration 內容：**
```python
# backend/apps/samples/migrations/000X_add_measurement_snapshot.py

operations = [
    migrations.AddField(
        model_name='samplemwo',
        name='measurement_snapshot_json',
        field=models.JSONField(
            blank=True,
            default=list,
            help_text='Measurement spec snapshot'
        ),
    ),
]
```

### Step 2: 實現 snapshot_measurements() 服務（30 分鐘）

**位置：** `backend/apps/samples/services/auto_generation.py:237+`

**程式碼：** 見上方「快照服務」章節

**測試：**
```python
from apps.styles.models import StyleRevision, Measurement
from apps.samples.services.auto_generation import snapshot_measurements

# 1. 準備測試資料
revision = StyleRevision.objects.get(style__style_number='LW1FLWS')

# 2. 測試快照函數
measurements = snapshot_measurements(revision, None)

# 3. 驗證輸出
assert len(measurements) > 0
assert 'point_name' in measurements[0]
assert 'values' in measurements[0]
print(f"✅ Snapshotted {len(measurements)} measurement points")
```

### Step 3: 修改 create_with_initial_run() 整合（30 分鐘）

**位置：** `backend/apps/samples/services/auto_generation.py:341+`

**修改點：**
1. 在 step 8.5 新增 `measurement_snapshot = snapshot_measurements(revision, run)`
2. 在 step 10 `SampleMWO.objects.create()` 加入 `measurement_snapshot_json=measurement_snapshot`
3. 更新 `documents['measurement_count']`
4. 修改 `save()` 方法的 snapshot_hash 計算（加入 measurements）

### Step 4: 測試（60 分鐘）

#### 測試 1: 建立新 Request

```bash
# 1. 啟動後端
cd backend && python manage.py runserver 8000

# 2. 使用 curl 或 Postman 測試
curl -X POST http://localhost:8000/api/v2/sample-requests/ \
  -H "Content-Type: application/json" \
  -d '{
    "revision_id": "uuid-of-LW1FLWS-revision",
    "request_type": "proto",
    "quantity_requested": 5
  }'
```

**預期結果：**
```json
{
  "initial_run": {
    "run_no": 1,
    "status": "draft"
  },
  "documents": {
    "mwo_no": "MWO-2601-000002",
    "bom_line_count": 15,
    "operation_count": 8,
    "measurement_count": 26  // ⭐ 新增
  }
}
```

#### 測試 2: 查詢 MWO 確認資料

```bash
# 1. 取得 MWO ID（從上一步回應）
MWO_ID="uuid-from-response"

# 2. 查詢 MWO 詳情
curl http://localhost:8000/api/v2/sample-mwos/$MWO_ID/

# 3. 檢查 measurement_snapshot_json
```

**預期結果：**
```json
{
  "id": "uuid...",
  "mwo_no": "MWO-2601-000002",
  "measurement_snapshot_json": [
    {
      "point_name": "Chest Width",
      "point_code": "A",
      "values": {"XS": 40.0, "S": 42.0, "M": 44.0, ...},
      "tolerance_plus": "0.5",
      "tolerance_minus": "0.5",
      "unit": "cm"
    },
    // ... 25 more measurement points
  ],
  "bom_snapshot_json": [...],
  "construction_snapshot_json": [...]
}
```

#### 測試 3: Excel 匯出包含 Measurement（可選）

如果時間允許，可以更新 Excel 匯出服務加入 Measurement sheet：

```python
# backend/apps/samples/services/excel_export.py

class MWOExcelExporter:
    def generate(self):
        # ... 現有 sheets ...

        # ⭐ 新增 Measurement sheet
        ws_measurement = wb.create_sheet("Measurement Spec")

        # Header
        ws_measurement.append([
            "Point", "Code", "XS", "S", "M", "L", "XL", "XXL",
            "Tolerance +", "Tolerance -", "Unit"
        ])

        # Data rows
        for m in self.mwo.measurement_snapshot_json:
            row = [
                m['point_name'],
                m.get('point_code', ''),
            ]
            # Add size values
            for size in ['XS', 'S', 'M', 'L', 'XL', 'XXL']:
                row.append(m['values'].get(size, ''))

            row.extend([
                m.get('tolerance_plus', ''),
                m.get('tolerance_minus', ''),
                m.get('unit', 'cm')
            ])
            ws_measurement.append(row)
```

---

## 成功標準

- [x] Migration 成功執行，`measurement_snapshot_json` 欄位存在
- [x] `snapshot_measurements()` 函數正常運作
- [x] `create_with_initial_run()` 成功生成包含 measurement 的 MWO
- [x] API 回應包含 `measurement_count`
- [x] MWO 查詢可看到完整 measurement 資料
- [x] snapshot_hash 計算包含 measurements

---

## 風險與限制

### 風險

1. **舊資料相容性**：現有 MWO 沒有 `measurement_snapshot_json`
   - **解決**：欄位設為 `default=list`, `blank=True`，舊資料為空 list

2. **Measurement 不存在**：某些 Revision 可能沒有 verified measurements
   - **解決**：snapshot 返回空 list，不阻擋 MWO 生成

3. **資料量大**：Measurement 資料可能很大（多尺碼、多測點）
   - **影響**：JSON 欄位增大，但可接受（預估 < 10KB per MWO）

### 限制

- **本階段不包含**：Tech Pack PDF 整合（留待 Phase 2）
- **不影響現有功能**：所有現有 API、UI 繼續運作
- **降級友善**：如果沒有 measurement 資料，系統仍正常運作

---

## 下一步（Phase 2）

完成 Measurement snapshot 後，下一步可以：

1. **Tech Pack JSON snapshot**（4-6 小時）
   - 加 `tech_pack_snapshot_json` 欄位
   - 加 `source_revision` FK 連接 `apps.parsing.Revision`
   - 實現 `snapshot_tech_pack_json()` 服務

2. **雙語 PDF 生成**（6-8 小時）
   - 加 `bilingual_tech_pack` FileField
   - 實現 PyMuPDF 疊層服務
   - 整合到 MWO 生成流程

3. **前端 UI 顯示**（2-3 小時）
   - MWO 詳情頁顯示 Measurement 表格
   - Tech Pack PDF 預覽
   - 下載完整 MWO Package（ZIP）

---

## 總結

**Phase 1 目標：** 讓 MWO 包含完整的尺寸規格資料

**改進前：**
```
SampleMWO = BOM + Construction + QC
```

**改進後：**
```
SampleMWO = BOM + Construction + QC + Measurement ⭐
```

**預期成果：**
```bash
POST /api/v2/sample-requests/
→ 自動生成 MWO with measurement_snapshot_json
→ 包含 26 個測量點 × 6 個尺碼
```

**下一步：** Phase 2 Tech Pack 整合（未來規劃）
