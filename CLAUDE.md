# ApparelTrack - Claude Project Memory

**Last Updated:** 2026-02-20
**Status:** P0-P29 + SaaS + STYLE-CENTER (Stage 1-5) + TRACK-PROGRESS + FIX-0214 + FIX-0215 + DEPLOY-0218 + FIX-0219 全部完成

---

## 核心定位

**AI-Augmented PLM + ERP Lite for Garment Factories**

- 主要用戶 = 成衣廠，目標：1 人管理 300-500+ 款/季，70-80% 自動化
- **核心原則：SampleRun 是唯一的「執行真相來源」**（MWO / Estimate / T2 PO 都是 Run 的輸出文件）

## 文檔導覽

| 文檔 | 說明 |
|------|------|
| [docs/SDD.md](docs/SDD.md) | 軟體設計規格 |
| [docs/TDD.md](docs/TDD.md) | 技術設計文檔 |
| [docs/PROGRESS-CHANGELOG.md](docs/PROGRESS-CHANGELOG.md) | 開發進度詳細記錄（含所有已完成功能細節）|
| [docs/SYSTEM-ACCEPTANCE-REPORT.md](docs/SYSTEM-ACCEPTANCE-REPORT.md) | 系統驗收報告 + SaaS 規劃 |
| [docs/BUSINESS-FLOW.md](docs/BUSINESS-FLOW.md) | 業務流程與數據模型 |

---

## 常用指令

```bash
cd backend && python manage.py runserver 8000   # 後端
cd frontend && npm run dev                       # 前端
redis-server                                     # Redis
cd backend && celery -A config worker -l info --pool=solo  # Celery (Windows)
cd backend && pytest                             # 測試
cd backend && python manage.py makemigrations && python manage.py migrate
cd frontend && npm run type-check                # TS 檢查
cd frontend && npm run lint
```

| 服務 | URL |
|------|-----|
| 前端 | http://localhost:3000 |
| 後端 API | http://localhost:8000/api/v2/ |
| Admin | http://localhost:8000/admin/ |

---

## 技術棧

| 層級 | 技術 |
|------|------|
| Backend | Django 4.2 + DRF + PostgreSQL |
| Frontend | Next.js 14 + React 18 + TanStack Query/Table + shadcn/ui |
| AI | OpenAI GPT-4o Vision |
| PDF | PyMuPDF + Pillow（中文字體：微軟雅黑 msyh.ttc）|
| Auth | JWT (Access 1h / Refresh 7d) + Zustand |
| Async | Celery + Redis（`?async=true` 參數控制）|

---

## 資料模型 & 狀態機

```
Style -> Revision -> BOMItem (Verified)
                  -> SampleRequest -> SampleRun -> MWO / CostSheet / PurchaseOrder
                  -> ProductionOrder -> MaterialRequirement -> PurchaseOrder
```

**SampleRun:**
```
DRAFT -> SUBMITTED -> QUOTED -> PENDING_APPROVAL -> APPROVED
                                                 -> REJECTED
APPROVED -> MATERIALS -> PO_ISSUED -> IN_PRODUCTION -> COMPLETED
ANY -> CANCELLED
```

**PurchaseOrder:** `draft -> sent -> confirmed -> in_production -> shipped -> received` (any -> cancelled, 可跳過中間狀態)

**ProductionOrder:** `draft -> confirmed -> materials_ordered -> in_production -> completed`

---

## 注意事項

1. **快照原則**：Run 的 BOM/Operation 是複製，不是 FK
2. **不可回寫**：Phase 3 資料不得修改 Phase 2 的 verified 資料
3. **採購拆單**：T2 PO 按供應商拆分，分 Draft/Issued
4. **文件編號**：MWO-YYMM-XXXXXX 格式，用 sequence 避免撞號
5. **雙 Revision**：`StyleRevision`（BOM/Measurement 編輯）vs `TechPackRevision (Revision)`（DraftBlocks 翻譯審校）
6. **跨 org 規則**：style_id 不存在/無效 -> warning + fallback 檔名；跨 org -> 400 fail fast；org NULL -> 放行
7. **翻譯流程**：提取時不翻譯（延遲翻譯），用戶進翻譯頁點「Translate All」觸發
8. **成衣詞彙庫**：`backend/apps/parsing/data/garment_glossary.json`（1252 條），精確匹配優先
9. **既有測試失敗**：4 個 costing tests（BOMNotReadyError / UNIQUE constraint）— 非近期引入
10. **中文 PDF**：完整 MWO 使用 Pillow 繪製中文 + PyMuPDF 合併（非 ReportLab）

---

## 導航結構

```
Dashboard
├── Progress          # 進度追蹤儀表板
├── Styles            # 款式中心（就緒度 + Stepper 詳情頁）
├── Upload            # 單筆 + 批量上傳（Tab 切換）
├── Documents         # 文件管理（Tech Pack/BOM/Mixed/未分類/款式 Tab）
├── BOM               # 物料表
├── Spec              # 尺寸規格
├── Costing           # 報價
├── Samples           # 樣衣列表
├── Kanban            # 看板視圖
├── Scheduler         # 甘特圖
├── Production        # 大貨訂單
├── Purchase Orders   # 採購單
├── Suppliers         # 供應商
└── Materials         # 物料主檔
```

---

## 前端頁面

| 頁面 | 路徑 |
|------|------|
| 進度儀表板 | `/dashboard/progress` |
| 款式列表 | `/dashboard/styles` |
| 款式詳情 | `/dashboard/styles/[id]` |
| 上傳文件 | `/dashboard/upload` |
| 文件管理 | `/dashboard/tech-packs?tab=tech_pack` |
| AI 處理 | `/dashboard/documents/[id]/processing` |
| 分類審查 | `/dashboard/documents/[id]/review` |
| 翻譯審校 | `/dashboard/revisions/[id]/review` |
| BOM 編輯 | `/dashboard/revisions/[id]/bom` |
| Spec 編輯 | `/dashboard/revisions/[id]/spec` |
| Costing | `/dashboard/revisions/[id]/costing-phase23` |
| Kanban 看板 | `/dashboard/samples/kanban` |
| 甘特圖 | `/dashboard/scheduler` |
| 大貨訂單 | `/dashboard/production-orders` |
| 採購單 | `/dashboard/purchase-orders` |
| 供應商 | `/dashboard/suppliers` |
| 物料主檔 | `/dashboard/materials` |
| 用戶管理 | `/dashboard/settings/users` |
| 登入 | `/login` |
| 註冊 | `/register` |

---

## 核心 API 端點

| 功能 | API |
|------|-----|
| **文件上傳** | `POST /api/v2/uploaded-documents/` |
| **批量上傳 ZIP** | `POST /api/v2/uploaded-documents/batch-upload/` |
| **AI 分類** | `POST /api/v2/uploaded-documents/{id}/classify/` (`?async=true`) |
| **AI 提取** | `POST /api/v2/uploaded-documents/{id}/extract/` (`?async=true`) |
| **任務狀態** | `GET /api/v2/tasks/{task_id}/` |
| **批准 Revision** | `POST /api/v2/revisions/{id}/approve/` |
| **翻譯進度** | `GET /api/v2/revisions/{id}/translation-progress/` |
| **翻譯批量** | `POST /api/v2/revisions/{id}/translate-batch/` |
| **翻譯重試** | `POST /api/v2/revisions/{id}/retry-failed/` |
| **Style Readiness** | `GET /api/v2/styles/{id}/readiness/` |
| **BOM 批量驗證** | `POST /api/v2/style-revisions/{id}/bom/batch-verify/` |
| **Spec 批量驗證** | `POST /api/v2/style-revisions/{id}/measurements/batch-verify/` |
| **Sample Request** | `POST /api/v2/sample-requests/` |
| **創建下一輪** | `POST /api/v2/sample-requests/{id}/create-next-run/` |
| **Kanban 列表** | `GET /api/v2/kanban/runs/` |
| **狀態轉換** | `POST /api/v2/sample-runs/{id}/{action}/` |
| **批量轉換** | `POST /api/v2/sample-runs/batch-transition/` |
| **預檢** | `POST /api/v2/sample-runs/{id}/precheck-transition/` |
| **回退** | `POST /api/v2/sample-runs/{id}/rollback/` |
| **MWO 完整匯出** | `GET /api/v2/sample-runs/{id}/export-mwo-complete-pdf/` |
| **進度儀表板** | `GET /api/v2/progress-dashboard/` |
| **大貨訂單** | `GET/POST /api/v2/production-orders/` |
| **MRP 計算** | `POST /api/v2/production-orders/{id}/calculate_mrp/` |
| **PO 寄送** | `POST /api/v2/purchase-orders/{id}/send/` |
| **逾期 PO** | `GET /api/v2/purchase-orders/overdue/` |
| **健康檢查** | `GET /api/v2/health/services/` |
| **Auth Token** | `POST /api/v2/auth/token/` / `.../token/refresh/` |
| **用戶管理** | `GET/POST /api/v2/auth/users/` |
| **Assistant** | `POST /api/v2/assistant/chat/` |
| **轉換歷史** | `GET /api/v2/sample-runs/{id}/transition-logs/` |

---

## 已完成功能詳細參考

### TRACK-PROGRESS 進度追蹤優化 (2026-02-09~11)

- **Migration `0013`**：`status_timestamps` JSONField + `SampleRunTransitionLog` 表 + 既有資料回填
- **Backend**：transition/rollback 自動寫 timestamps + log，kanban_runs 加 `days_in_status`，transition-logs API
- **Frontend**：Kanban 卡片 >7d 琥珀色停留天數警告，OverviewTab 真實時間戳，ProgressTab 里程碑 + 操作歷史表
- **API**：`GET /api/v2/sample-runs/{id}/transition-logs/`
- **關鍵檔案**：`models.py`（SampleRunTransitionLog）/ `run_transitions.py` / `views.py` / `OverviewTab.tsx` / `ProgressTab.tsx` / `kanban/page.tsx`

### STYLE-CENTER 款式中心 UI 重構 (Stage 1-5, 2026-02-03~08)

- **Readiness API：** `GET /api/v2/styles/{id}/readiness/` 聚合就緒狀態
- **款式列表頁：** `/dashboard/styles` 含 Tech Pack / BOM / Spec / MWO 就緒欄位 + Ready/Incomplete 篩選
- **款式詳情頁：** `/dashboard/styles/[id]` Stepper 五步驟（Documents → Translation → BOM → Spec → Sample & MWO）
- **分頁組件：** DocumentsTab / TranslationTab / BOMTab / SpecTab / SampleTab / DownloadsSection / CreateSampleForm
- **Upload 流程串接：** Processing/Review 頁面有 style_id 時回到 Style Center
- **Kanban 篩選：** `?style=` 時顯示 ReadinessWarningBanner
- **Code Review 修正：** UUID 驗證 / 跨 org 400 / BOM+Spec+Costing+Translation 掛 StyleBreadcrumb+Banner

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

**關鍵檔案：**
- 後端：`backend/apps/styles/views.py`, `serializers.py`, `urls.py`
- 前端：`frontend/app/dashboard/styles/[id]/page.tsx`, `lib/api/style-detail.ts`, `lib/hooks/useStyleDetail.ts`
- 分頁：`frontend/components/styles/detail/` 下各 Tab 組件

### SaaS 認證 + RBAC (2026-01-29~31)

**Auth 檔案：**
| 類型 | 檔案 |
|------|------|
| Auth Store | `frontend/lib/stores/authStore.ts` |
| Auth API | `frontend/lib/api/auth.ts` |
| 路由保護 | `frontend/components/providers/AuthGuard.tsx` |
| API Client | `frontend/lib/api/client.ts` (auto refresh) |
| 登入頁 | `frontend/app/login/page.tsx` |
| 註冊頁 | `frontend/app/register/page.tsx` |
| 後端 Auth URLs | `backend/apps/core/auth_urls.py` |

**角色權限矩陣：**

| 功能 | Admin | Merchandiser | Factory | Viewer |
|------|-------|--------------|---------|--------|
| 用戶管理 | O | - | - | - |
| 創建/編輯款式 | O | O | - | - |
| 查看報價 | O | O | - | - |
| 更新生產狀態 | O | O | O | - |
| 查看資料 | O | O | O | O |

**前端權限：**
```tsx
<PermissionGate permission="users.view"> ... </PermissionGate>
<PermissionGate adminOnly> ... </PermissionGate>
const { canEdit, isAdmin, hasPermission } = usePermissions();
```

**檔案：** `frontend/lib/permissions.ts`, `lib/hooks/usePermissions.ts`, `components/providers/PermissionGate.tsx`

### Celery 異步處理 (DA-2, 2026-01-21)

```
用戶點擊「AI 提取」→ API 返回 task_id → Celery Worker 後台處理 → 前端輪詢(每 2.5s) → 完成跳轉
```
- 後端：`parsing/tasks/_main.py`（任務定義）/ `parsing/services/extraction_service.py`（提取邏輯）
- 前端：`processing/page.tsx`（分類輪詢）/ `review/page.tsx`（提取輪詢）
- 開關：前端 `USE_ASYNC_MODE = true` / 後端 `?async=true`
- 任務狀態：PENDING → STARTED → SUCCESS/FAILURE

### 翻譯系統 (TODO-PERF + GLO-1)

- **延遲翻譯**：提取時不翻譯，存 `translation_status=pending`
- **翻譯服務**：`backend/apps/parsing/services/translation_service.py`（單塊/單頁/整份/重試）
- **詞彙庫**：`garment_glossary.json` 1252 條，精確匹配 → 0 API 調用（~60% BOM 項目命中）
- **智能跳過**：純數字 / 短文字(<=2字元) / 常見標記(-/N/A/TBD) → `skipped`
- **翻譯狀態**：pending → translating → done/failed/skipped
- **前端**：`components/translation/TranslationProgress.tsx`（進度卡片 + 按鈕）

### Kanban 四大改善 (P27, 2026-01-20)

1. **MWO 預檢**：轉換前驗證 BOM/Operations → `precheck-transition/`
2. **批量轉換**：多選 Run → `batch-transition/` → 成功/失敗/跳過統計
3. **狀態回退**：`rollback-targets/` + `rollback/` + 回退原因記錄 → `RollbackDialog.tsx`
4. **甘特圖日期拖曳**：點擊甘特條編輯日期 → `update-dates/`

### 多輪 Fit Sample (P25, 2026-01-18)

- `POST /api/v2/sample-requests/{id}/create-next-run/` — 自動 run_no+1、繼承配置、快照 BOM/Ops、生成 MWO+CostSheet
- `GET /api/v2/sample-requests/{id}/runs-summary/`

### PO 寄送供應商 (P24, 2026-01-17)

- `POST /api/v2/purchase-orders/{id}/send/` — 可選 body `{"email": "custom@email.com"}`
- Email 模板：`backend/templates/emails/po_to_supplier.html`
- 目前用 console backend，生產需配 SMTP

### Assistant 小助理 (P28, 2026-01-20)

指令式對話，浮動按鈕：`help` / `overdue` / `this week` / `tasks` / `summary` / `recent` / `pending po` / `check [款號]` / `add task [...]` / `draft email [款號]`

- 後端：`backend/apps/assistant/` (models/views/services/command_parser)
- 前端：`frontend/components/assistant/` (AssistantButton/AssistantDialog) + `lib/api/assistant.ts`

### 採購優化 (P23, 2026-01-21)

- PO 狀態新增：`in_production`、`shipped`（可跳過中間狀態）
- 逾期檢測：`expected_delivery < today` AND status not received/cancelled
- `GET /api/v2/purchase-orders/overdue/`
- `POST .../start_production/` / `POST .../ship/`

---

## 待做清單

| 編號 | 功能 | 優先級 |
|------|------|--------|
| TODO-EXT | 提取預覽/檢查功能（分類確認後再提取）| P2 |
| TODO-COST | 完整成本分析（報價 vs 實際成本：物料+人工+損耗）| P2 |
| TODO-i18n | 多語言翻譯支援（中/越/柬/印尼）| P3 |
| SaaS-BILLING | 計費系統整合 (Stripe) | 待做 |
| P22 | 庫存管理 (Inventory) | 規劃中 |
| P12 | 自訂 Excel/PDF 模板 | 計劃中 |
| Phase B | Supplier Portal | 計劃中 |

---

## 已完成功能摘要

| Phase | 功能 | 日期 |
|-------|------|------|
| P0-P3 | 基礎功能（Upload/Parse/Kanban/Export）| 01-04 |
| P4-P8 | 翻譯流程（Tech Pack/BOM/Spec/MWO）| 01-09 |
| P9-P11 | 甘特圖 + 流程測試 + AI 準確度提升 | 01-10 |
| P14-P17 | 主檔管理 + 採購 + 大貨訂單 + MRP | 01-10 |
| P18 | 流程連結 + 進度追蹤儀表板 | 01-11 |
| DA-1 | 批量上傳 Tech Pack（ZIP）| 01-11 |
| P19 | BOM 用量四階段管理 + 100款性能測試 | 01-13~17 |
| P20-A | Sample Request 兩步確認流程 | 01-14 |
| P21 | Tech Pack 翻譯框（拖曳+縮放+編輯+隱藏）| 01-17 |
| P24 | PO 寄送供應商（Email + PDF 附件）| 01-17 |
| P25 | 多輪 Fit Sample 支援 | 01-18 |
| P26 | UI/UX 優化（導航、編輯介面、提取流程）| 01-18 |
| P27 | Kanban 四大改善 | 01-20 |
| P28 | Assistant 小助理 | 01-20 |
| P29 | Documents 款式整合（Styles Tab）| 01-20 |
| DA-2 | Celery 異步處理 | 01-21 |
| P23 | 採購優化（交期追蹤 + 中間狀態）| 01-21 |
| GLO-1 | 成衣詞彙庫 1252 條 | 01-22 |
| FIX-0124 | 詞彙庫修正 + Tech Pack 提取修復 | 01-24 |
| FIX-0126 | API URL 統一 + 健康檢查 | 01-26 |
| FIX-0128 | Mixed 文件提取修復 | 01-28 |
| SaaS-AUTH | 前端登入 + JWT 認證 | 01-29 |
| TODO-PERF | 延遲翻譯 + 智能跳過 | 01-31 |
| SaaS-AUTH-2 | 記住我 / 註冊 / 忘記密碼 | 01-31 |
| SaaS-RBAC | 權限控制 + 用戶管理 | 01-31 |
| FIX-0202 | 組織數據綁定 + API 修復 | 02-02 |
| STYLE-CENTER | 款式中心 UI 重構（5 Stages）| 02-03~08 |
| TRACK-PROGRESS | 進度追蹤優化（時間戳 + 操作歷史）| 02-09~11 |
| FIX-0214 | Decimal toFixed bug + 全站搜尋修復 + 300ms Debounce | 02-14 |
| FIX-0215 | useMemo 修復全站無限 re-render + TopNav 移除無用搜尋框 | 02-15 |
| DEPLOY-0218 | Railway + Vercel 正式部署完成 | 02-18 |
| FIX-0219 | 部署後頁面修復（PageNumberPagination + Superuser org + JWT fetch）| 02-20 |

**完整細節：** [docs/PROGRESS-CHANGELOG.md](docs/PROGRESS-CHANGELOG.md)

---

---

## 🚀 部署（2026-02-18 完成）

### 線上網址
| 服務 | URL |
|------|-----|
| 前端 | https://appareltrack.vercel.app |
| 後端 API | https://appareltrack-production.up.railway.app/api/v2/ |
| Django Admin | https://appareltrack-production.up.railway.app/admin/ |
| GitHub Repo | https://github.com/Amberh2616/appareltrack |

### 架構
- 前端 → **Vercel**（免費）
- 後端 → **Railway**（Nixpacks，start.sh 啟動）
- 資料庫 → **Railway PostgreSQL**（自動注入 DATABASE_URL）
- 靜態檔案 → whitenoise

### 帳號
- superuser：`Amber` / `Amber2026!`

### Railway 必要環境變數
| 變數 | 說明 |
|------|------|
| `DATABASE_URL` | Railway PostgreSQL 自動提供 |
| `DJANGO_SECRET_KEY` | Django secret key |
| `DJANGO_ALLOWED_HOSTS` | `appareltrack-production.up.railway.app` |
| `CORS_ALLOWED_ORIGINS` | `https://appareltrack.vercel.app` |
| `DJANGO_SETTINGS_MODULE` | `config.settings.production` |

### Vercel 必要環境變數
| 變數 | 值 |
|------|-----|
| `NEXT_PUBLIC_API_URL` | `https://appareltrack-production.up.railway.app/api/v2` |

### 踩過的坑（2026-02-18）
1. Railway 新專案預設 Railpack → 需改為 Nixpacks
2. requirements.txt 用 `-r` 引用其他檔案 Railway 不更新 cache → 展開為完整清單
3. Migration 斷鏈（0006 parsing / 0008 procurement）→ 補 commit
4. `DJANGO_ALLOWED_HOSTS` 沒設 → DisallowedHost 400（前端看到 CORS 錯誤）
5. `railway.json` startCommand 覆蓋 start.sh → 改為 `bash start.sh`
6. 忘記新增 PostgreSQL service → DB_HOST 亂指向
7. CORS_ALLOWED_ORIGINS 沒設 → 前端登入被 CORS 擋

### 待做
- [x] **FIX-0219**：Documents / BOM / Spec / Costing 頁面壞掉 → 已修復（2026-02-20）
- [ ] 決定域名 → 買 appareltrack.com（$6.79首年）
- [ ] 準備 Demo 資料
- [ ] 練習 Demo Pitch 流程
- [ ] Cloudflare R2 檔案儲存（目前用本地，重啟會清空）
- [ ] SendGrid Email（目前 Email 功能關閉）

---

## 測試資料

| 文件 | 路徑 |
|------|------|
| LW1FLWS TECH PACK.pdf (9MB) | `backend/demo_data/techpacks/` |
| LW1FLWS_BOM.pdf (5.8MB) | `backend/demo_data/bom/` |
