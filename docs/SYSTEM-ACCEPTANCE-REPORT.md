# Fashion Production System - 系統驗收報告

**驗收日期：** 2026-01-16
**版本：** v4.27.4
**驗收結果：** ✅ P0/P1 問題已全部修復

---

## 目錄

1. [驗收摘要](#一驗收摘要)
2. [觸發流程驗收 (T1-T10)](#二觸發流程驗收-t1-t10)
3. [功能模組驗收](#三功能模組驗收)
4. [待修復問題清單](#四待修復問題清單)
5. [修復計劃](#五修復計劃)
6. [SaaS 多租戶遷移規劃](#六saas-多租戶遷移規劃)

---

## 一、驗收摘要

### 整體完成度

| 模組 | 完成度 | 狀態 | 備註 |
|------|--------|------|----------|
| 觸發流程 T1-T10 | 95% | ✅ | T1 冪等性已修復 |
| BOM → Cost 連動 | 95% | ✅ | UsageLine 已修正、Refresh API 已添加 |
| 上傳解析 | 70% | ⚠️ | ZIP 編碼、去重漏洞 |
| BOM 編輯 | 100% | ✅ | 新增/刪除按鈕已實現 |
| Spec 編輯 | 100% | ✅ | 新增/刪除按鈕已實現 |
| Tech Pack 翻譯 | 95% | ✅ | 批量翻譯已添加、MWO 中文疊加已實現 |
| 報價流程 | 95% | ✅ | null 值檢查已添加、BOM 驗證門檻 80% |
| 生產訂單 | 80% | ⚠️ | MRP 不考慮庫存 |

### 生產就緒度：⚠️ 基本就緒

- ✅ 可支撐 100+ 款/季規模
- ✅ 可手動補充 AI 漏提取的資料（BOM/Spec 新增按鈕）
- ✅ 報價準確度已保證（UsageLine 讀取三階段用量）
- ⚠️ MRP 計算尚未考慮現有庫存

### P0 問題快覽（7 項）✅ 全部完成

| # | 問題 | 狀態 | 修復日期 |
|---|------|------|----------|
| 1 | BOM 新增按鈕 | ✅ 已修復 | 2026-01-16 |
| 2 | BOM 刪除按鈕 | ✅ 已修復 | 2026-01-16 |
| 3 | Spec 新增按鈕 | ✅ 已修復 | 2026-01-16 |
| 4 | Spec 刪除按鈕 | ✅ 已修復 | 2026-01-16 |
| 5 | confirm_sample 冪等性 | ✅ 已修復 | 2026-01-16 |
| 6 | null unit_price 檢查 | ✅ 已修復 | 2026-01-16 |
| 7 | UsageLine 讀取 current_consumption | ✅ 已修復 | 2026-01-16 |

### P1 問題快覽（4 項）✅ 全部完成

| # | 問題 | 狀態 | 修復日期 |
|---|------|------|----------|
| 8 | Tech Pack 批量翻譯 | ✅ 已修復 | 2026-01-16 |
| 9 | MWO Tech Pack 中文疊加 | ✅ 已修復 | 2026-01-16 |
| 10 | BOM 驗證門檻 80% | ✅ 已修復 | 2026-01-16 |
| 11 | CostSheet Refresh Snapshot API | ✅ 已修復 | 2026-01-16 |

---

## 二、觸發流程驗收 (T1-T10)

### 流程總覽

```
【開發階段】
  Revision approved
       ↓ T1
  Create Sample Request → confirm → SampleRun #1

【樣衣階段】
  draft → materials_planning → po_drafted → po_issued
       ↓ T2
  mwo_drafted → mwo_issued
       ↓ T3
  in_progress
       ↓ T4
  sample_done
       ↓ T5
  actuals_recorded → costing_generated → quoted → accepted

【大貨報價】
       ↓ T6
  Create Bulk Quote
       ↓ T7
  Submit Bulk Quote → accepted

【生產階段】
       ↓ T8
  Create Production Order
       ↓ T9
  Confirm Order
       ↓ T10 (MRP + Generate PO)
  PurchaseOrder Created
```

### 各觸發點驗收

| 觸發點 | 功能 | 後端 API | 前端按鈕 | 狀態 |
|--------|------|----------|----------|------|
| **T1** | Create Sample Request | ✅ `POST /sample-requests/` | ✅ Review 頁 | ⚠️ 冪等性缺失 |
| **T1+** | Confirm Sample | ✅ `POST /sample-requests/{id}/confirm/` | ✅ 詳情頁 | ✅ 自動生成 Run/MWO/Costing |
| **T2** | Generate MWO | ✅ `POST /sample-runs/{id}/generate-mwo/` | ✅ Kanban | ✅ |
| **T3** | Submit Quote | ✅ `POST /cost-sheet-versions/{id}/submit/` | ✅ CostingDrawer | ⚠️ BOM 門檻過低 |
| **T4** | Accept Quote | ✅ `POST /cost-sheet-versions/{id}/accept/` | ✅ CostingDrawer | ✅ |
| **T5** | Record Actuals | ✅ `POST /sample-runs/{id}/record-actuals/` | ✅ Kanban | ✅ |
| **T6** | Create Bulk Quote | ✅ `POST /cost-sheet-versions/{id}/create-bulk-quote/` | ✅ CostingDrawer | ✅ |
| **T7** | Submit Bulk Quote | ✅ 同 T3 | ✅ 同 T3 | ✅ |
| **T8** | Create Production Order | ✅ `POST /production-orders/` | ✅ PO 列表頁 | ✅ |
| **T9** | Confirm Order | ✅ `POST /production-orders/{id}/confirm/` | ✅ PO 詳情頁 | ✅ |
| **T10** | Generate PO | ✅ `POST /production-orders/{id}/generate-po/` | ✅ PO 詳情頁 | ⚠️ MRP 不考慮庫存 |

### T1+ Confirm Sample 自動生成內容

確認樣衣時，後端自動生成以下內容（原子交易）：

```
POST /api/v2/sample-requests/{id}/confirm/
    ↓
1. SampleRun #1 (status: DRAFT)
2. RunBOMLine (快照已驗證的 BOMItem)
3. RunOperation (快照已驗證的 ConstructionStep)
4. SampleMWO (draft, 編號: MWO-YYMM-XXXXXX)
5. SampleCostEstimate (draft)
6. UsageScenario (purpose='sample_quote') + CostSheetVersion (costing_type='sample')
```

### 關鍵文件位置

**後端：**
| 文件 | 說明 |
|------|------|
| `backend/apps/samples/views.py` | T1-T5 SampleRequest/SampleRun API |
| `backend/apps/costing/views_phase23.py` | T3/T4/T6/T7 CostSheet API |
| `backend/apps/orders/views.py` | T8-T10 ProductionOrder API |
| `backend/apps/orders/services/mrp_service.py` | MRP 計算 |

**前端：**
| 文件 | 說明 |
|------|------|
| `frontend/app/dashboard/revisions/[id]/review/page.tsx` | T1 按鈕 |
| `frontend/app/dashboard/samples/kanban/page.tsx` | T2-T5 Kanban |
| `frontend/components/costing/CostingDetailDrawer.tsx` | T3/T4/T6/T7 按鈕 |
| `frontend/app/dashboard/production-orders/[id]/page.tsx` | T9/T10 按鈕 |

---

## 2.5 BOM → Cost 數據連動驗收

### 數據流向圖

```
BOMItem (物料表)
    ├─ consumption (單位用量)
    ├─ unit_price (單價)
    ├─ pre_estimate_value / confirmed_value / locked_value (三階段)
    ↓ (複製)
UsageLine (用量明細)
    ├─ bom_item (FK)
    ├─ consumption (複製自 BOMItem)
    ├─ adjusted_consumption (計算: consumption × (1 + wastage%))
    ↓ (快照)
CostLineV2 (成本明細)
    ├─ source_bom_item_id (UUID，非 FK)
    ├─ consumption_snapshot (凍結值)
    ├─ consumption_adjusted (可編輯)
    ├─ unit_price_snapshot (凍結值)
    ├─ unit_price_adjusted (可編輯)
    ├─ line_cost = consumption_adjusted × unit_price_adjusted
    ↓
CostSheetVersion (報價版本)
    ├─ total_material_cost
    ├─ total_cost
    └─ unit_price
```

### 連動狀態

| 修改操作 | 自動更新 UsageLine | 自動更新 CostLineV2 | 評估 |
|---------|:------------------:|:------------------:|:----:|
| BOMItem.consumption | ❌ | ❌ | 需手動 |
| BOMItem.unit_price | ❌ | ❌ | 需手動 |
| BOMItem.confirmed_value | ❌ | ❌ | 需手動 |
| UsageLine.consumption | - | ❌ | 需手動 |

**結論：** 系統採用**單向快照設計**，修改 BOM 後不會自動同步到已創建的成本單。

### ❌ 發現的連動問題

#### 問題 1：UsageLine 讀取錯誤欄位

| 項目 | 內容 |
|------|------|
| **位置** | `backend/apps/costing/services/usage_scenario_service.py:70` |
| **現狀** | `consumption = bom_item.consumption` |
| **問題** | 忽略三階段用量優先級（locked > confirmed > pre_estimate） |
| **應該** | `consumption = bom_item.current_consumption` |

#### 問題 2：無 Refresh Snapshot API

| 項目 | 內容 |
|------|------|
| **問題** | Draft 狀態的 CostSheet 無法重新從 BOM 快照 |
| **影響** | 修改 BOM 後必須重建整個報價 |
| **建議** | 添加 `POST /cost-sheets/{id}/refresh-snapshot/` API |

### 設計說明

**為什麼不自動同步？**
- 報價是「時間點快照」，用於審計追溯
- 避免報價提交後被意外修改
- `consumption_snapshot` 和 `unit_price_snapshot` 保留原始值
- `consumption_adjusted` 和 `unit_price_adjusted` 允許議價調整

**正確的工作流：**
1. BOM 定稿後再做成本估算
2. 成本單保持 draft 直到報價確認
3. 若需修改 BOM，在 draft 狀態時重建成本單

---

## 三、功能模組驗收

### 3.1 BOM 編輯頁面

**路徑：** `/dashboard/revisions/[id]/bom`

| 功能 | 狀態 | 說明 |
|------|------|------|
| 顯示 BOM 列表 | ✅ | TanStack Table |
| 編輯現有項目 | ✅ | BOMEditDrawer |
| 單項翻譯 | ✅ | AI 翻譯按鈕 |
| 批量翻譯 | ✅ | 「AI 批量翻譯」按鈕 |
| 用量三階段管理 | ✅ | pre_estimate → confirmed → locked |
| **新增項目** | ✅ | 「新增物料」按鈕和 Dialog 已實現 |
| **刪除項目** | ✅ | 刪除按鈕已添加到操作列 |

### 3.2 Spec 編輯頁面

**路徑：** `/dashboard/revisions/[id]/spec`

| 功能 | 狀態 | 說明 |
|------|------|------|
| 顯示尺寸表 | ✅ | 含尺碼欄位 |
| 編輯現有尺寸 | ✅ | MeasurementEditDrawer |
| 單項翻譯 | ✅ | 在 Drawer 中 |
| 批量翻譯 | ✅ | 「AI 批量翻譯」按鈕 |
| **新增尺寸** | ✅ | 「新增尺寸點」按鈕和 Dialog 已實現 |
| **刪除尺寸** | ✅ | 刪除按鈕已添加到操作列 |

### 3.3 Tech Pack 翻譯審校

**路徑：** `/dashboard/revisions/[id]/review`

| 功能 | 狀態 | 說明 |
|------|------|------|
| PDF 預覽 | ✅ | iframe 顯示 |
| DraftBlock 列表 | ✅ | 左側面板 |
| 單項編輯 | ✅ | textarea 修改 |
| Approve Revision | ✅ | 批准按鈕 |
| **批量翻譯** | ❌ | **BOM/Spec 有，這裡沒有** |
| **翻譯進度統計** | ❌ | **無進度條** |

### 3.4 MWO 匯出

**API：** `GET /api/v2/sample-runs/{id}/export-mwo-complete-pdf/`

| 內容 | 狀態 | 說明 |
|------|------|------|
| 封面頁 | ✅ | 中英雙語 |
| Tech Pack 頁 | ⚠️ | **仍為英文原圖，無中文疊加** |
| BOM 表 | ✅ | 含中文翻譯（藍色字） |
| Spec 表 | ✅ | 含中文翻譯（藍色字） |

### 3.5 報價流程

| 功能 | 狀態 | 說明 |
|------|------|------|
| 創建 CostSheetVersion | ✅ | - |
| CostLineV2 計算 | ✅ | null unit_price 會報錯並顯示缺失清單 |
| Submit 狀態檢查 | ✅ | BOM 驗證門檻 80% |
| Accept/Reject | ✅ | - |
| Create Bulk Quote | ✅ | 從 Sample 克隆 |
| Refresh Snapshot | ✅ | 支持從 BOM 重新載入用量和單價 |

### 3.6 生產訂單

| 功能 | 狀態 | 說明 |
|------|------|------|
| 創建訂單 | ✅ | - |
| 確認訂單 | ✅ | draft → confirmed |
| MRP 計算 | ⚠️ | **不考慮現有庫存** |
| 生成 PO | ✅ | 按供應商分組 |
| Lead Time 預警 | ❌ | **無** |

---

## 四、已修復問題清單

### P0 - 阻塞性問題 ✅ 全部完成

#### #1 BOM 新增按鈕 ✅

| 項目 | 內容 |
|------|------|
| **問題** | AI 漏提取物料時，用戶無法手動補充 |
| **修復** | 添加「新增物料」按鈕和 Dialog，支持輸入物料名稱、類別、供應商、用量、單價 |
| **額外修復** | BOMItem model 的 `unit` 欄位添加預設值 `'YD'`，避免 API 驗證錯誤 |
| **修改文件** | `bom/page.tsx`, `lib/api/bom.ts`, `lib/hooks/useBom.ts`, `lib/types/bom.ts`, `styles/models.py` |
| **完成日期** | 2026-01-16 |

#### #2 BOM 刪除按鈕 ✅

| 項目 | 內容 |
|------|------|
| **問題** | 無法移除錯誤的 BOM 項目 |
| **修復** | 在操作列添加刪除按鈕，點擊後確認刪除 |
| **修改文件** | `bom/page.tsx` |
| **完成日期** | 2026-01-16 |

#### #3 Spec 新增按鈕 ✅

| 項目 | 內容 |
|------|------|
| **問題** | AI 漏提取尺寸時，用戶無法手動補充 |
| **修復** | 添加「新增尺寸點」按鈕和 Dialog，支持輸入尺寸點名稱、編碼、公差、單位 |
| **修改文件** | `spec/page.tsx`, `lib/api/measurement.ts`, `lib/hooks/useMeasurement.ts`, `lib/types/measurement.ts` |
| **完成日期** | 2026-01-16 |

#### #4 Spec 刪除按鈕 ✅

| 項目 | 內容 |
|------|------|
| **問題** | 無法移除錯誤的尺寸項目 |
| **修復** | 在操作列添加刪除按鈕，點擊後確認刪除 |
| **修改文件** | `spec/page.tsx` |
| **完成日期** | 2026-01-16 |

#### #5 confirm_sample 冪等性 ✅

| 項目 | 內容 |
|------|------|
| **問題** | 連續點擊會重複創建 SampleRun/MWO/Estimate |
| **修復** | 後端已有檢查，前端添加錯誤處理和友好提示 |
| **修改文件** | `samples/[requestId]/page.tsx` |
| **完成日期** | 2026-01-16 |

#### #6 null unit_price 檢查 ✅

| 項目 | 內容 |
|------|------|
| **問題** | 物料單價為空時默認 $0，報價金額被低估 |
| **修復** | 添加 `MissingUnitPriceError` 異常，創建成本單時檢查所有 BOM 項目單價 |
| **修改文件** | `costing_service.py`, `views_phase23.py` |
| **完成日期** | 2026-01-16 |

#### #7 UsageLine 讀取 current_consumption ✅

| 項目 | 內容 |
|------|------|
| **問題** | 創建 UsageLine 時讀取 `bom_item.consumption`，忽略三階段用量 |
| **修復** | 改為讀取 `bom_item.current_consumption`（優先級：locked > confirmed > pre_estimate > consumption）|
| **修改文件** | `usage_scenario_service.py` |
| **完成日期** | 2026-01-16 |

---

### P1 - 重要問題 ✅ 全部完成

#### #8 Tech Pack 批量翻譯 ✅

| 項目 | 內容 |
|------|------|
| **問題** | BOM/Spec 有批量翻譯，Tech Pack 審校頁面沒有 |
| **修復** | 添加 `translate-batch` API action 和前端「✨ AI 批量翻譯」按鈕 |
| **修改文件** | `parsing/views.py`, `services/techpack_translator.py` (新), `review/page.tsx` |
| **完成日期** | 2026-01-16 |

#### #9 MWO Tech Pack 中文疊加 ✅

| 項目 | 內容 |
|------|------|
| **問題** | MWO 中 Tech Pack 仍為英文原圖 |
| **修復** | 當 bbox 無效時（坐標為 0,0），在頁面右側創建翻譯面板顯示中文翻譯 |
| **修改文件** | `techpack_pdf_export.py` |
| **完成日期** | 2026-01-16 |

#### #10 BOM 驗證門檻 80% ✅

| 項目 | 內容 |
|------|------|
| **問題** | 只檢查 verified_count > 0，門檻過低 |
| **修復** | 改為檢查 verified_ratio >= 0.8（80%），否則報錯 |
| **修改文件** | `auto_generation.py` |
| **完成日期** | 2026-01-16 |

#### #11 CostSheet Refresh Snapshot API ✅

| 項目 | 內容 |
|------|------|
| **問題** | 修改 BOM 後，Draft 狀態的 CostSheet 無法重新快照 |
| **修復** | 添加後端 `refresh_snapshot` API 和前端「刷新快照」按鈕 |
| **修改文件** | `costing_service.py`, `views_phase23.py`, `costing-phase23.ts`, `useCostingPhase23.ts`, `CostingDetailDrawer.tsx` |
| **完成日期** | 2026-01-16 |

---

### P2 - 改進項目

#### #12 MRP 考慮庫存

| 項目 | 內容 |
|------|------|
| **問題** | MRP 不查詢現有庫存，導致重複採購 |
| **需修改** | `mrp_service.py` |
| **工時** | 2 小時 |

#### #13 Lead Time 預警

| 項目 | 內容 |
|------|------|
| **問題** | 生成 PO 時不檢查供應商交期 |
| **需修改** | `orders/views.py`, `mrp_service.py` |
| **工時** | 2 小時 |

#### #14 版本號衝突保護

| 項目 | 內容 |
|------|------|
| **問題** | 高併發時 UsageScenario version_no 衝突 |
| **需修改** | `costing_service.py` 使用 F() 原子遞增 |
| **工時** | 2 小時 |

---

### P3 - 優化項目

#### #15 Vision Bbox 精度

| 項目 | 內容 |
|------|------|
| **問題** | GPT-4o Vision 無法返回精確坐標，Overlay 定位錯誤 |
| **解決方向** | 使用 EasyOCR 估算坐標 |
| **工時** | 8+ 小時 |

#### #16 翻譯進度統計

| 項目 | 內容 |
|------|------|
| **問題** | Tech Pack 審校頁面無進度條 |
| **需新增** | 已翻譯/總數、進度條 |
| **工時** | 2 小時 |

---

## 五、修復計劃

### 完成狀態

| 優先級 | 項目數 | 狀態 | 完成日期 |
|--------|--------|------|----------|
| P0 | 7 | ✅ 全部完成 | 2026-01-16 |
| P1 | 4 | ✅ 全部完成 | 2026-01-16 |
| P2 | 3 | 待處理 | - |
| P3 | 2 | 待處理 | - |

### 修復進度

```
第一批（P0 - 阻塞性）：✅ 全部完成
├── #1 BOM 新增按鈕           ✅
├── #2 BOM 刪除按鈕           ✅
├── #3 Spec 新增按鈕          ✅
├── #4 Spec 刪除按鈕          ✅
├── #5 confirm_sample 冪等性   ✅
├── #6 null unit_price 檢查    ✅
└── #7 UsageLine 讀取修正      ✅

第二批（P1 - 重要）：✅ 全部完成
├── #8 Tech Pack 批量翻譯      ✅
├── #9 MWO 中文疊加            ✅
├── #10 BOM 驗證門檻           ✅
└── #11 CostSheet Refresh API  ✅

第三批（P2 - 改進）：待處理
├── #12 MRP 考慮庫存           [2h]
├── #13 Lead Time 預警         [2h]
└── #14 版本號衝突             [2h]

第四批（P3 - 優化）：待處理
├── #15 Vision Bbox            [8+h]
└── #16 翻譯進度統計           [2h]
```

---

## 附錄：API 端點索引

### Sample 相關
```
POST   /api/v2/sample-requests/                    # 創建請求
POST   /api/v2/sample-requests/{id}/confirm/       # 確認樣衣
GET    /api/v2/kanban/runs/                        # Kanban 列表
POST   /api/v2/sample-runs/{id}/{action}/          # 狀態轉換
GET    /api/v2/sample-runs/{id}/export-mwo-complete-pdf/  # MWO 匯出
```

### BOM/Spec 相關
```
GET    /api/v2/style-revisions/{id}/bom/           # BOM 列表
POST   /api/v2/style-revisions/{id}/bom/           # 新增 BOM
PATCH  /api/v2/style-revisions/{id}/bom/{pk}/      # 編輯 BOM
DELETE /api/v2/style-revisions/{id}/bom/{pk}/      # 刪除 BOM
POST   /api/v2/style-revisions/{id}/bom/translate-batch/  # 批量翻譯

GET    /api/v2/style-revisions/{id}/measurements/  # Spec 列表
POST   /api/v2/style-revisions/{id}/measurements/  # 新增 Spec
PATCH  /api/v2/style-revisions/{id}/measurements/{pk}/  # 編輯 Spec
DELETE /api/v2/style-revisions/{id}/measurements/{pk}/  # 刪除 Spec
```

### Costing 相關
```
POST   /api/v2/cost-sheet-versions/{id}/submit/           # 提交報價
POST   /api/v2/cost-sheet-versions/{id}/accept/           # 確認報價
POST   /api/v2/cost-sheet-versions/{id}/create-bulk-quote/ # 創建大貨報價
```

### Production 相關
```
POST   /api/v2/production-orders/                  # 創建訂單
POST   /api/v2/production-orders/{id}/confirm/     # 確認訂單
POST   /api/v2/production-orders/{id}/calculate-mrp/  # MRP 計算
POST   /api/v2/production-orders/{id}/generate-po/    # 生成 PO
```

---

## 六、SaaS 多租戶遷移規劃

### 6.1 現有基礎設施

系統已具備部分多租戶基礎：

| 組件 | 狀態 | 說明 |
|------|------|------|
| Organization Model | ✅ 已有 | `backend/apps/core/models.py` |
| User Model | ✅ 已有 | Django User + organization FK |
| TenantManager | ✅ 已有 | 自動過濾當前組織數據 |
| AuditLog | ✅ 已有 | 記錄用戶操作 |
| 角色欄位 | ✅ 已有 | `user.role` (admin/manager/operator) |

### 6.2 缺失功能

#### 認證與授權（必要）

| 功能 | 現狀 | 需求 | 工時 |
|------|------|------|------|
| 登入/登出 | ❌ 無 | JWT / Session 認證 | 2-3h |
| 密碼重設 | ❌ 無 | Email + Token 流程 | 1-2h |
| 記住登入 | ❌ 無 | Refresh Token | 0.5h |
| **小計** | | | **4-6h** |

#### 數據隔離（必要）

| 功能 | 現狀 | 需求 | 工時 |
|------|------|------|------|
| API 自動過濾 | ⚠️ 部分 | 所有 ViewSet 加 TenantFilterMixin | 2-3h |
| 文件隔離 | ❌ 無 | 上傳路徑加 org_id 前綴 | 1h |
| **小計** | | | **3-4h** |

#### RBAC 權限控制（重要）

| 功能 | 現狀 | 需求 | 工時 |
|------|------|------|------|
| Permission Model | ❌ 無 | 定義操作權限 | 2h |
| Role-Permission | ❌ 無 | 角色權限映射 | 2h |
| API 權限檢查 | ❌ 無 | DRF Permission Class | 2-4h |
| **小計** | | | **6-8h** |

#### 用戶管理介面

| 功能 | 現狀 | 需求 | 工時 |
|------|------|------|------|
| 用戶列表 | ❌ 無 | Admin 可管理組織成員 | 2h |
| 邀請用戶 | ❌ 無 | Email 邀請 + 註冊 | 2-3h |
| 修改角色 | ❌ 無 | 權限調整 | 0.5h |
| **小計** | | | **4-6h** |

#### 前端認證整合

| 功能 | 現狀 | 需求 | 工時 |
|------|------|------|------|
| 登入頁面 | ❌ 無 | `/login` 頁面 | 2h |
| Auth Context | ❌ 無 | React Context + Token 管理 | 1-2h |
| Route Guard | ❌ 無 | 未登入跳轉 | 1h |
| 用戶選單 | ❌ 無 | 頭像 + 登出 | 0.5h |
| **小計** | | | **4-6h** |

### 6.3 工時總估算

| 階段 | 範圍 | 工時 |
|------|------|------|
| **MVP SaaS** | 認證 + 數據隔離 + 前端登入 | 11-16h |
| **完整 RBAC** | MVP + 權限控制 + 用戶管理 | 21-30h |
| **生產就緒** | 完整 + Email 服務 + 監控 | 26-37h |

### 6.4 實施建議

```
Phase 1: MVP SaaS（11-16h）
├── 後端 JWT 認證                    [3-4h]
├── API TenantFilterMixin 全覆蓋     [2-3h]
├── 文件路徑隔離                     [1h]
├── 前端登入頁面                     [2h]
├── Auth Context + Route Guard       [2-3h]
└── 測試 + 修復                      [1-2h]

Phase 2: RBAC 權限（6-8h）
├── Permission/RolePermission Model  [2h]
├── DRF Permission Class             [2-4h]
└── 前端權限判斷                     [2h]

Phase 3: 用戶管理（4-6h）
├── 用戶列表頁面                     [2h]
├── 邀請用戶流程                     [2-3h]
└── 角色調整                         [0.5h]
```

### 6.5 需要的後端修改

**1. 添加 TenantFilterMixin 到所有 ViewSet：**

```python
# backend/apps/core/mixins.py
class TenantFilterMixin:
    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(self.request, 'user') and hasattr(self.request.user, 'organization'):
            return qs.filter(organization=self.request.user.organization)
        return qs.none()
```

**2. 文件上傳路徑隔離：**

```python
# backend/apps/parsing/models.py
def upload_path(instance, filename):
    org_id = instance.organization_id or 'default'
    return f'uploads/{org_id}/{filename}'
```

**3. JWT 認證配置：**

```python
# backend/settings.py
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
}
```

### 6.6 風險評估

| 風險 | 影響 | 緩解措施 |
|------|------|----------|
| 數據洩漏 | 高 | 強制 TenantFilter，單元測試覆蓋 |
| 權限提升 | 高 | API 層權限檢查，審計日誌 |
| 併發衝突 | 中 | 樂觀鎖，事務隔離 |
| 性能下降 | 低 | 數據庫索引，查詢優化 |

---

**驗收人：** Claude Code
**日期：** 2026-01-16
