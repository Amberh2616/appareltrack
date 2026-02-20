# Feature Details — 已完成功能詳細記錄

> 從 CLAUDE.md 搬出的詳細功能文檔。CLAUDE.md 只保留精簡參考，這裡保存完整細節。
>
> **Last Updated:** 2026-02-09

---

## P24 PO 寄送供應商 (2026-01-17)

**已實現功能：**
- Email 發送服務 - `backend/apps/procurement/services/email_service.py`
- PO PDF 附件 - 自動附加 PO PDF
- 發送按鈕組件 - `frontend/components/procurement/SendPOButton.tsx`
- 狀態追蹤 - sent_at, sent_to_email, sent_count
- 重發支援 - sent 狀態可重發
- 自訂收件人 - 可覆蓋 supplier.email
- Email HTML 模板 - `backend/templates/emails/po_to_supplier.html`

**API：**
- `POST /api/v2/purchase-orders/{id}/send/`
- Body: `{ "email": "custom@email.com" }` (可選)

**Email 設定：**
```python
# 開發環境 - 輸出到 console
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# 生產環境 - Gmail SMTP
EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = "your-email@gmail.com"
EMAIL_HOST_PASSWORD = "app-password"
```

---

## P25 多輪 Fit Sample 支援 (2026-01-18)

**後端：**
- 服務函數 - `create_next_run_for_request()`
- API - `POST /api/v2/sample-requests/{id}/create-next-run/`
- API - `GET /api/v2/sample-requests/{id}/runs-summary/`
- 自動 run_no = max(run_no) + 1，繼承 run_type/quantity
- 自動快照 BOM/Operations/TechPack + 生成 MWO + CostSheet

**前端：**
- SampleRequest 詳情頁「創建下一輪」按鈕
- Kanban 卡片顯示 Run 輪次編號

**使用方式：**
```
Run #1 (Fit/Draft) → 製作完成 → 點擊「創建下一輪 (Run #2)」→ 自動生成 → ...→ Final Acceptance
```

**API 範例：**
```bash
POST /api/v2/sample-requests/{id}/create-next-run/
{ "run_type": "fit", "quantity": 3, "notes": "Round 2 adjustments" }
```

---

## P26 UI/UX 優化 (2026-01-18)

**1. Spec 編輯介面簡化：**
- 移除 3 個 Tab 合併為單一頁面
- AI 翻譯按鈕整合在中文名稱欄位旁邊
- `frontend/components/measurement/MeasurementEditDrawer.tsx`

**2. BOM/Spec/Costing 頁面導航：**
- 三個頁面統一導航按鈕，可快速切換
- `frontend/app/dashboard/revisions/[id]/bom/page.tsx` 等

**3. 文件提取流程修復：**
- 後端 API 返回 `style_revision_id` + `tech_pack_revision_id`
- BOM/Spec/Tech Pack 提取後正確跳轉
- 提取超時增加到 10 分鐘

**4. 上傳頁面優化：**
- 真實上傳進度條（XHR 追蹤）
- `frontend/app/dashboard/upload/page.tsx`

**5. AI 處理頁面優化：**
- 處理計時器 + 取消按鈕 + Toast 提示 + AbortController
- `frontend/app/dashboard/documents/[id]/processing/page.tsx`

**6. 跳轉延遲移除：**
- 移除 processing→review 1.5秒延遲、review→BOM/Spec 2秒延遲、alert() 彈窗

**7. Documents 文件管理頁面：**
- `/dashboard/tech-packs` — AI 分類 Tab 切換
- 使用 `classification_result.file_type` 自動分類（非檔名）
- Tab 狀態保持用 URL 參數（`?tab=bom`）

---

## P27 Kanban 四大改善 (2026-01-20)

**1. MWO 預檢 (Pre-check)：**
- 轉換前驗證 BOM/Operations 是否完整
- `POST /api/v2/sample-runs/{id}/precheck-transition/`
- `frontend/components/samples/TransitionPrecheckDialog.tsx`

**2. 智能批量轉換：**
- 多選 Run 批量轉換，自動跳過不符合條件的
- `POST /api/v2/sample-runs/batch-transition/`
- 顯示成功/失敗/跳過統計

**3. 狀態回退 (Rollback)：**
- `GET /api/v2/sample-runs/{id}/rollback-targets/`
- `POST /api/v2/sample-runs/{id}/rollback/`
- 回退原因記錄
- `frontend/components/samples/RollbackDialog.tsx`

**4. 甘特圖日期拖曳：**
- 點擊甘特條編輯開始/結束日期
- `POST /api/v2/sample-runs/{id}/update-dates/`

**後端：** `backend/apps/samples/services/run_transitions.py`, `views.py`
**前端：** `frontend/app/dashboard/samples/kanban/page.tsx`, `scheduler/page.tsx`

---

## P28 小助理 Assistant (2026-01-20)

**支援指令：**
| 指令 | 功能 |
|------|------|
| `help` | 查看所有指令 |
| `overdue` | 顯示逾期樣衣 |
| `this week` | 顯示本週待辦 |
| `tasks` | 顯示任務清單 |
| `summary` | 顯示生產總覽 |
| `recent` | 顯示最近更新 |
| `pending po` | 顯示待處理採購單 |
| `check [款號]` | 查詢款式狀態 |
| `add task [內容]` | 新增任務 |
| `add note [內容]` | 新增筆記 |
| `draft email [款號]` | 生成 PO 郵件草稿 |

**後端：**
- `backend/apps/assistant/models.py` - 資料模型
- `backend/apps/assistant/services/command_parser.py` - 指令解析器
- `backend/apps/assistant/views.py` - API 視圖

**前端：**
- `frontend/components/assistant/AssistantButton.tsx` - 浮動按鈕
- `frontend/components/assistant/AssistantDialog.tsx` - 對話框
- `frontend/lib/api/assistant.ts` - API 函數

**API：**
- `POST /api/v2/assistant/chat/` - 發送訊息
- `GET /api/v2/assistant/chat/history/` - 對話記錄
- `DELETE /api/v2/assistant/chat/history/` - 清除記錄
- `GET/POST/PATCH/DELETE /api/v2/assistant/tasks/` - 任務 CRUD
- `GET/POST /api/v2/assistant/notes/` - 筆記 CRUD

---

## P29 Documents 款式整合 (2026-01-20)

- Documents 頁面新增「款式」Tab：`[ Tech Pack | BOM | Mixed | 未分類 | 款式 ]`
- 款式表格：款號、品牌、季節、建立時間、操作
- 支援款號、品牌、季節搜尋
- Sidebar 移除獨立「Styles」連結（後來 STYLE-CENTER 又加回）
- `frontend/app/dashboard/tech-packs/page.tsx`

---

## P23 採購優化 (2026-01-21)

**PO 狀態擴展：**
```
draft → sent → confirmed → in_production → shipped → received (可跳過中間狀態)
任何狀態 → cancelled（除了 received）
```

**逾期檢測：**
- PO 級別：`expected_delivery < today` AND `status not in ['received', 'cancelled']`
- POLine 級別：`(expected_delivery or required_date) < today` AND `delivery_status != 'received'`

**API：**
- `GET /api/v2/purchase-orders/overdue/` - 列出逾期 PO
- `POST .../start_production/` - confirmed → in_production
- `POST .../ship/` - → shipped

**前端：**
- 列表頁逾期標籤 `Overdue Xd` + 統計卡片
- 詳情頁逾期警告橫幅
- Assistant 指令：`overdue po` / `late po` / `delayed po`

---

## DA-2 Celery 異步處理 (2026-01-21)

**架構：**
```
用戶 → Django API 返回 task_id → Celery Worker 後台處理 → 前端輪詢(2.5s) → 完成跳轉
```

**後端：**
- `backend/apps/parsing/tasks/_main.py` - 異步任務定義
- `backend/apps/parsing/services/extraction_service.py` - 提取邏輯
- `backend/apps/parsing/views.py` - TaskStatusViewSet

**前端：**
- `processing/page.tsx` - 分類輪詢
- `review/page.tsx` - 提取輪詢

**API：**
- `POST .../classify/?async=true` → `{"task_id": "...", "status": "pending"}`
- `POST .../extract/?async=true` → 同上
- `GET /api/v2/tasks/{task_id}/` → `{"status": "SUCCESS", "result": {...}}`

**任務狀態：** PENDING → STARTED → SUCCESS/FAILURE
**開關：** 前端 `USE_ASYNC_MODE = true` / 後端 `?async=true`

---

## GLO-1 成衣詞彙庫 (2026-01-22)

- 1252 條英中對照詞彙，34 個分類（縮寫/顏色/車縫裁床/服裝部位/副料...）
- `backend/apps/parsing/data/garment_glossary.json`
- `backend/apps/parsing/utils/translate.py`

**翻譯策略：**
1. 詞彙庫精確匹配 → 直接使用（0 API 調用）
2. 無匹配 → LLM + 相關詞彙參考

```python
from apps.parsing.utils.translate import lookup_glossary, machine_translate, batch_translate
lookup_glossary('LINING')  # → '裏布'
```

---

## FIX-MWO 中文 PDF 修復 (2026-01-20)

- MWO 匯出中文欄位 Fallback：`material_name_zh` 空白時用 `material_name`
- 過濾 AI 垃圾回應（如 "This appears to be..."）
- 藍色 PDF 按鈕改用 `exportMWOCompletePDF`（Pillow + PyMuPDF，非 ReportLab）
- `backend/apps/samples/services/mwo_complete_export.py`

---

## FIX-0126 API URL 統一 + 健康檢查 (2026-01-26)

- 修復 19 個文件硬編 URL，統一 `API_BASE_URL`
- 移除 `127.0.0.1` vs `localhost` 不一致

**健康檢查：**
```
GET /api/v2/health/services/
→ { "status": "healthy|degraded|unhealthy", "database": {...}, "redis": {...}, "celery": {...}, "async_ready": true }
```
- `backend/apps/core/views.py` - `services_health_check()`
- 前端：Redis/Celery 不可用時顯示 amber 色提示

---

## FIX-0128 Mixed 文件提取修復 (2026-01-28)

- Mixed 文件中 bom_table 頁面也加入 Tech Pack 提取列表
- 確保 BOM 頁面上的文字注釋（如 BULK COMMENTS）也被提取和翻譯
- `backend/apps/parsing/services/extraction_service.py`

---

## FIX-0202 組織數據綁定 (2026-02-02)

- 統一所有 Style/StyleRevision/BOMItem/Measurement/SampleRequest/SampleRun 到同一組織
- BOM/Spec 頁面改用 `API_BASE` + 認證 token
- SampleRequestSerializer 添加 `style_number`/`style_name`/`revision_label`
- 列表欄位 "Brand" → "Style"

---

## SaaS-AUTH 前端登入 + JWT 認證 (2026-01-29)

**檔案：**
| 類型 | 檔案 |
|------|------|
| 登入頁 | `frontend/app/login/page.tsx` |
| Auth API | `frontend/lib/api/auth.ts` |
| Auth Store | `frontend/lib/stores/authStore.ts` |
| 路由保護 | `frontend/components/providers/AuthGuard.tsx` |
| API Client | `frontend/lib/api/client.ts` (auto refresh) |
| TopNav | `frontend/components/layout/TopNav.tsx` (logout) |
| 後端 | `backend/config/urls.py` (JWT URLs) |

**Token 時效：** Access 1h / Refresh 7d

---

## SaaS-AUTH-2 記住我 / 註冊 / 忘記密碼 (2026-01-31)

**檔案：**
| 類型 | 檔案 |
|------|------|
| 後端 | `backend/apps/core/serializers.py`, `views.py`, `auth_urls.py` |
| 註冊頁 | `frontend/app/register/page.tsx` |
| 忘記密碼頁 | `frontend/app/forgot-password/page.tsx` |
| 重置密碼頁 | `frontend/app/reset-password/page.tsx` |

**API：**
- `POST /api/v2/auth/register/`
- `GET /api/v2/auth/user/`
- `POST /api/v2/auth/password-reset/`
- `POST /api/v2/auth/password-reset/confirm/`

**生產 Email 設定：**
```python
EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = "your-email@gmail.com"
EMAIL_HOST_PASSWORD = "app-password"
FRONTEND_URL = "https://your-domain.com"
```

---

## SaaS-RBAC 權限控制 (2026-01-31)

**角色：** Admin / Merchandiser / Factory / Viewer

**後端：**
- `backend/apps/core/permissions.py` - 權限定義 + DRF Permission Classes
- `backend/apps/core/views.py` - UserViewSet + OrganizationViewSet
- `backend/apps/core/serializers.py` - User CRUD Serializers

**前端：**
- `frontend/lib/permissions.ts` - 權限常量
- `frontend/lib/hooks/usePermissions.ts` - Hooks
- `frontend/components/providers/PermissionGate.tsx` - 權限控制組件
- `frontend/app/dashboard/settings/users/page.tsx` - 用戶管理頁面

**API：**
- `GET/POST /api/v2/auth/users/`
- `PATCH /api/v2/auth/users/{id}/`
- `POST .../invite/` / `.../activate/` / `.../deactivate/`
- `GET .../roles/` / `.../stats/` / `.../me/`

**前端用法：**
```tsx
<PermissionGate permission="users.view"> ... </PermissionGate>
<PermissionGate adminOnly> ... </PermissionGate>
<PermissionGate editOnly fallback={<span>View only</span>}> ... </PermissionGate>
const { canEdit, isAdmin, hasPermission } = usePermissions();
```

---

## TODO-PERF 提取速度優化 (2026-01-31)

**方案：C（延遲翻譯）+ D（智能跳過）+ B（批量翻譯）**

```
提取流程（~2-3分鐘）：PDF → 提取原文 → 存DB(translation_status=pending) → 完成
翻譯流程（按需）：翻譯頁 → Translate All → 批量翻譯 / Celery 後台
```

**後端：**
- `models_blocks.py` - translation_status/error/retry_count 欄位
- `extraction_service.py` - 提取跳過翻譯 + 智能跳過
- `translation_service.py` - 翻譯服務（單塊/單頁/整份/重試）
- `tasks/_main.py` - Celery 異步翻譯

**前端：**
- `lib/api/translation.ts`
- `components/translation/TranslationProgress.tsx`

**API：**
- `GET /revisions/{id}/translation-progress/`
- `POST /revisions/{id}/translate-batch/`
- `POST /revisions/{id}/translate-page/{page}/`
- `POST /revisions/{id}/retry-failed/`

**翻譯狀態：** pending → translating → done/failed/skipped
**智能跳過：** 純數字 / <=2字元 / 常見標記(-/N/A/TBD//)

---

## STYLE-CENTER 款式中心 UI 重構 (Stage 1-5, 2026-02-03~08)

### Stage 1-2：後端 API + 款式列表頁

- `GET /api/v2/styles/{id}/readiness/` — 聚合就緒狀態
- `POST .../bom/batch-verify/` / `.../measurements/batch-verify/`
- `StyleListSerializer` 含 `readiness` 欄位
- `/dashboard/styles` — 含 Tech Pack / BOM / Spec / MWO 就緒欄位 + Ready/Incomplete 篩選
- `frontend/lib/api/style-detail.ts`, `lib/hooks/useStyleDetail.ts`

### Stage 3：款式詳情頁 + Code Review

- `/dashboard/styles/[id]` — Stepper 五步驟（Documents → Translation → BOM → Spec → Sample & MWO）
- ReadinessBar 整體進度
- Upload 流程 style_id 全鏈路保留
- Phase A 防呆：UUID 驗證 / catch 擴展 / 跨 org 400 / review→processing 保留 style_id
- Phase B 體驗：DocumentsTab Upload 帶 style_id / Kanban ?style= / BOM+Spec+Costing+Translation 掛 Breadcrumb+Banner
- Phase C 清理：刪除孤兒 ReadinessChecklist.tsx

### Stage 4：分頁組件提取

- `DocumentsTab.tsx` / `TranslationTab.tsx` / `BOMTab.tsx` / `SpecTab.tsx` / `SampleTab.tsx`
- `DownloadsSection.tsx` / `CreateSampleForm.tsx`
- 目錄：`frontend/components/styles/detail/`

### Stage 5：上傳流程串接

- Processing/Review 頁面：取消/錯誤回到 Style Center（有 style_id 時）
- Kanban 頁面：`?style=` 篩選時顯示 ReadinessWarningBanner

**Readiness API 格式：**
```json
{
  "style_id": "...", "style_number": "LW1FLPS",
  "documents": [...],
  "translation": {"total": 158, "done": 154, "progress": 97},
  "bom": {"total": 12, "verified": 10, "translated": 11},
  "spec": {"total": 24, "verified": 24, "translated": 22},
  "sample_request": {"id": "...", "status": "draft"},
  "sample_run": {"id": "...", "status": "draft", "mwo_status": null},
  "overall_readiness": 78
}
```

---

## 待做功能規劃

### TODO-EXT 提取預覽/檢查功能

```
上傳 PDF → AI 分類 → 【新增】分類預覽（每頁類型 + 潛在問題警告 + 可手動調整）→ 確認後提取
```

### TODO-i18n 多語言翻譯支援

| 語言 | 品質 | 字體 | 地區 |
|------|------|------|------|
| 中文 | 高 | 微軟雅黑 | 中國/台灣 |
| 越南文 | 高 | 拉丁字母 | 越南 |
| 柬埔寨文 | 中 | 需 Khmer 字體 | 柬埔寨 |
| 印尼文 | 高 | 拉丁字母 | 印尼 |

方案：`translate.py` 加 `target_language` 參數 + 工廠級別語言設定

### TODO-COST 完整成本分析

```
毛利 = 報價金額 - 實際成本
毛利率 = (報價 - 實際) / 報價 × 100%
```

需新增：實際工時記錄 / 損耗記錄 / 結案成本計算 / 成本分析儀表板
