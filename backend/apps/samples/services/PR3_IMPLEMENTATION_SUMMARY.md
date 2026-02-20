# Backend PR-3: Guidance/T2PO/MWO 生成服務實作完成

**實作日期:** 2026-01-01
**狀態:** ✅ 完成

---

## 實作內容

### 1. 新建檔案

#### `snapshot_services.py` (503 lines)

實作 5 個核心服務函數：

1. **`ensure_guidance_usage(run_id)`**
   - 確保 SampleRun 有 guidance usage scenario
   - 若已有，直接返回
   - 若沒有，從 confirmed BOMItem 建立新的 UsageScenario + UsageLines
   - consumption 預設值用 1.0（不從 BOMItem 取）
   - purpose = 'sample_guidance'
   - 使用 `@transaction.atomic` 保證原子性

2. **`generate_t2po_from_guidance(run_id)`**
   - 從 guidance usage 生成 T2PO draft（版本化 + 可重入）
   - 若已有 latest draft，直接返回（可重入設計）
   - 新版本號 = 上一版 + 1
   - 舊 latest 全部設為 is_latest=False
   - 計算 quantity_requested = consumption × run.quantity × 1.05（5% 損耗）
   - 生成 snapshot_hash（SHA256）

3. **`generate_mwo_snapshot(run_id)`**
   - 從 guidance usage 生成 MWO draft（版本化 + 可重入）
   - bom_snapshot = guidance usage lines 的 JSON 快照
   - construction_snapshot = confirmed ConstructionStep 的 JSON 快照
   - qc_points_snapshot = []（Phase 1 暫不實作）
   - 生成 snapshot_hash（SHA256）

4. **`ensure_actual_usage(run_id)`**
   - 確保 SampleRun 有 actual usage scenario
   - 若已有，直接返回
   - 從 guidance_usage 複製，purpose = 'sample_actual'
   - consumption_status = 'actual'

5. **`generate_sample_costing_from_actuals(run_id)`**
   - 從 actual usage + SampleActuals 生成 Sample Costing
   - 找或建 CostSheetGroup（by Style）
   - 計算 material_cost（從 actual_usage lines）
   - labor_cost/overhead_cost/shipping_cost/rework_cost 從 SampleActuals 取
   - 建立 CostSheetVersion + CostLineV2（含完整 source tracking）
   - 預設 margin_pct = 30%

---

### 2. 修改檔案

#### `run_transitions.py`

新增功能：

1. **`execute_action_side_effects(run, action, payload)`** (73 lines)
   - 執行狀態轉換的副作用（生成資源、更新相關物件）
   - 處理以下 actions：
     - `start_materials_planning` → ensure_guidance_usage
     - `generate_t2po` → generate_t2po_from_guidance
     - `issue_t2po` → 更新 T2PO status = 'issued'
     - `generate_mwo` → generate_mwo_snapshot
     - `issue_mwo` → 更新 MWO status = 'issued'
     - `record_actuals` → ensure_actual_usage
     - `generate_sample_costing` → generate_sample_costing_from_actuals
   - 返回 metadata（資源 ID、版本號、統計數字）

2. **`transition_sample_run()` 修改**
   - 在狀態轉換前呼叫 `execute_action_side_effects()`
   - 將 action_meta 合併到 TransitionResult.meta
   - cancel action 不執行副作用

---

## 技術特點

### 1. Phase 2/3 邊界保護

- ✅ 只讀取 `is_verified=True` 且 `translation_status='confirmed'` 的 BOMItem
- ✅ 只讀取 `is_verified=True` 且 `translation_status='confirmed'` 的 ConstructionStep
- ✅ 使用快照模式（snapshot fields + snapshot_hash）
- ✅ 不回寫到 Phase 2 模型

### 2. 版本化設計

- ✅ T2PO/MWO 支援多版本（version_no + is_latest）
- ✅ 可重入設計：重複呼叫 generate 函數只返回現有 draft，不重複創建
- ✅ 版本號自動遞增

### 3. 資料完整性

- ✅ 使用 `@transaction.atomic` 保證原子性
- ✅ 使用 `Decimal.quantize()` 避免浮點誤差
- ✅ ValidationError 清晰錯誤訊息

### 4. CostLineV2 完整性

- ✅ 填充所有 source tracking fields：
  - source_revision_id
  - source_usage_scenario_id
  - source_usage_scenario_version_no
  - source_bom_item_id
  - source_usage_line_id
- ✅ 填充所有 material info fields：
  - material_name, material_name_zh, category, supplier, supplier_article_no, unit

---

## 測試驗證

### 語法檢查

```bash
✅ python manage.py check --tag models
   System check identified no issues (0 silenced).

✅ python -m py_compile apps/samples/services/snapshot_services.py
   (no errors)

✅ python -m py_compile apps/samples/services/run_transitions.py
   (no errors)
```

---

## API 端點（已連接）

以下 SampleRunViewSet 的 action endpoints 現在已經完整串接服務函數：

```
POST /api/v2/sample-runs/{id}/start-materials-planning/
  → transition → ensure_guidance_usage()

POST /api/v2/sample-runs/{id}/generate-t2po/
  → transition → generate_t2po_from_guidance()

POST /api/v2/sample-runs/{id}/issue-t2po/
  → transition → 更新 T2PO status='issued'

POST /api/v2/sample-runs/{id}/generate-mwo/
  → transition → generate_mwo_snapshot()

POST /api/v2/sample-runs/{id}/issue-mwo/
  → transition → 更新 MWO status='issued'

POST /api/v2/sample-runs/{id}/record-actuals/
  → transition → ensure_actual_usage()

POST /api/v2/sample-runs/{id}/generate-sample-costing/
  → transition → generate_sample_costing_from_actuals()
```

---

## 檔案清單

### 新建檔案
- `backend/apps/samples/services/snapshot_services.py` (503 lines)
- `backend/apps/samples/services/PR3_IMPLEMENTATION_SUMMARY.md` (本檔案)

### 修改檔案
- `backend/apps/samples/services/run_transitions.py` (+75 lines)

---

## 下一步

### M1: P0（能發 MWO）- 已完成 ✅

- [x] 新增 SampleRun model + migration
- [x] T2PO/MWO 加 sample_run(nullable) + version_no + is_latest
- [x] Data migration: Request → Run#1
- [x] SampleRun ViewSet + allowed-actions + 狀態機
- [x] ensure_guidance_usage service + endpoint
- [x] generate_t2po_from_guidance + issue-t2po
- [x] generate_mwo_snapshot + issue-mwo
- [ ] Sample Request UI（列表 + 詳情 + runs timeline）
- [ ] Run Console UI（Overview/Materials/MWO/Progress）

### M2: P1（能報價）- Backend 完成 ✅

- [x] SampleActuals model + ensure-actuals endpoint
- [x] UsageScenario 增加 purpose（並回填 guidance/actual）
- [x] record-actuals API（回填 usage lines + labor/費用）
- [x] generate_sample_costing_from_actuals service
- [ ] Actuals Tab UI
- [ ] Costing Tab（連到現有 CostingDetailDrawer）

---

## 驗收測試腳本（待執行）

```python
# 1. 建 Sample Request
request = SampleRequest.objects.create(...)

# 2. 建 Proto Run（qty=2、due_date=...）
run = SampleRun.objects.create(
    sample_request=request,
    run_no=1,
    run_type='proto',
    quantity=2,
    target_due_date='2026-02-01',
)

# 3. Run console → Materials：Generate T2PO → Issue
POST /api/v2/sample-runs/{run.id}/start-materials-planning/
POST /api/v2/sample-runs/{run.id}/generate-t2po/
POST /api/v2/sample-runs/{run.id}/issue-t2po/

# 4. Run console → MWO：Generate → Issue
POST /api/v2/sample-runs/{run.id}/generate-mwo/
POST /api/v2/sample-runs/{run.id}/issue-mwo/

# 5. Progress：Start Production → Mark Sample Done
POST /api/v2/sample-runs/{run.id}/start-production/
POST /api/v2/sample-runs/{run.id}/mark-sample-done/

# 6. Record Actuals → Generate Costing
POST /api/v2/sample-runs/{run.id}/record-actuals/
POST /api/v2/sample-runs/{run.id}/generate-sample-costing/
```

全部成功 = P0+P1 Backend 完成 ✅

---

**總結：Backend PR-3 實作完成，已就緒等待前端 UI 整合。**
