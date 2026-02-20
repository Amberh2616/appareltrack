# Technical Design Document (TDD)

## Fashion Production System

---

| 項目 | 內容 |
|------|------|
| **文檔版本** | 1.0 |
| **系統版本** | 4.42.0 |
| **撰寫日期** | 2026-01-29 |
| **狀態** | Draft |

---

## 目錄

1. [概述](#1-概述)
2. [技術選型](#2-技術選型)
3. [系統架構詳解](#3-系統架構詳解)
4. [部署架構](#4-部署架構)
5. [效能設計](#5-效能設計)
6. [可靠性設計](#6-可靠性設計)
7. [監控與日誌](#7-監控與日誌)
8. [安全技術實現](#8-安全技術實現)
9. [開發規範](#9-開發規範)
10. [技術債務與改進計劃](#10-技術債務與改進計劃)

---

## 1. 概述

### 1.1 目的

本文檔詳述 Fashion Production System 的技術實現細節，包括技術選型理由、架構決策、效能優化、部署方案等，供開發團隊和運維人員參考。

### 1.2 讀者

- 後端開發工程師
- 前端開發工程師
- DevOps 工程師
- 新進開發者

### 1.3 相關文檔

| 文檔 | 說明 |
|------|------|
| `docs/SDD.md` | 軟體設計規格 |
| `docs/BUSINESS-FLOW.md` | 業務流程 |
| `CLAUDE.md` | 專案快速參考 |

---

## 2. 技術選型

### 2.1 後端框架

#### 選擇：Django 4.2 + Django REST Framework

**選型理由：**

| 因素 | Django | FastAPI | Node.js/Express |
|------|--------|---------|-----------------|
| **開發速度** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **ORM** | ⭐⭐⭐⭐⭐ (內建) | ⭐⭐⭐ (SQLAlchemy) | ⭐⭐⭐ (Sequelize) |
| **Admin 後台** | ⭐⭐⭐⭐⭐ (內建) | ❌ | ❌ |
| **生態系統** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **異步支援** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **團隊熟悉度** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |

**決策：**
- Django 的 ORM、Admin、認證系統可快速開發 ERP 類應用
- DRF 提供成熟的 REST API 解決方案
- 豐富的第三方套件（Celery、django-cors-headers 等）
- Python 生態對 AI/ML 整合友好（OpenAI SDK）

**權衡：**
- Django 不是原生異步，但透過 Celery 解決長時間任務
- 對於極高併發場景，可能需要考慮 FastAPI

### 2.2 前端框架

#### 選擇：Next.js 16 + React 19 + TypeScript

**選型理由：**

| 因素 | Next.js | Vue.js/Nuxt | Create React App |
|------|---------|-------------|------------------|
| **SSR/SSG** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ❌ |
| **路由** | ⭐⭐⭐⭐⭐ (App Router) | ⭐⭐⭐⭐ | ⭐⭐⭐ (react-router) |
| **TypeScript** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **部署** | ⭐⭐⭐⭐⭐ (Vercel) | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **生態系統** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**決策：**
- Next.js App Router 提供最佳 DX
- React 19 新特性（Server Components、並發特性）
- TypeScript 確保類型安全
- TanStack Query/Table 提供強大的數據管理

### 2.3 資料庫

#### 選擇：PostgreSQL (生產) / SQLite (開發)

**PostgreSQL 優勢：**
- JSONB 支援（儲存分類結果、尺寸數據）
- 全文搜索
- 穩定性與效能
- 未來可擴展 pgvector（向量搜索）

**SQLite 開發用途：**
- 零配置，快速啟動
- 足夠處理開發/測試數據量
- 與 PostgreSQL 語法相容度高

### 2.4 任務隊列

#### 選擇：Celery + Redis

**使用場景：**

| 任務 | 耗時 | 處理方式 |
|------|------|----------|
| AI 分類 | 10-30 秒 | 異步 (Celery) |
| AI 提取 | 60-300 秒 | 異步 (Celery) |
| PDF 生成 | 5-15 秒 | 同步（可接受）|
| Email 發送 | 2-5 秒 | 異步 (Celery) |

**架構：**

```
┌────────────┐     ┌───────────┐     ┌────────────┐
│   Django   │────►│   Redis   │◄────│   Celery   │
│   (API)    │     │  (Broker) │     │  (Worker)  │
└────────────┘     └───────────┘     └────────────┘
      │                                     │
      │         ┌───────────────┐          │
      └────────►│   PostgreSQL  │◄─────────┘
                │   (Results)   │
                └───────────────┘
```

**Celery 配置：**

```python
# config/celery.py
from celery import Celery

app = Celery('fashion_production')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# settings.py
CELERY_BROKER_URL = 'redis://localhost:6379/0'
CELERY_RESULT_BACKEND = 'redis://localhost:6379/0'
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 600  # 10 分鐘
```

### 2.5 AI 服務

#### 選擇：OpenAI GPT-4o / GPT-4o-mini

**模型選用：**

| 用途 | 模型 | 原因 |
|------|------|------|
| PDF 頁面分類 | GPT-4o Vision | 需要圖像理解 |
| 內容提取 | GPT-4o Vision | 需要圖像理解 |
| 文字翻譯 | GPT-4o-mini | 成本效益，翻譯品質足夠 |

**成本優化：**

```python
# 翻譯策略
def translate(text):
    # 1. 優先查詢詞彙庫（0 成本）
    if result := lookup_glossary(text):
        return result

    # 2. LLM 翻譯（附帶相關詞彙提升準確度）
    context = get_relevant_glossary_terms(text)
    return call_openai(text, context)
```

**估算成本（每款）：**

| 操作 | Token 數 | 成本 (USD) |
|------|----------|------------|
| 分類 (10 頁) | ~5,000 | ~$0.025 |
| 提取 (10 頁) | ~20,000 | ~$0.10 |
| 翻譯 (50 項) | ~10,000 | ~$0.005 |
| **總計/款** | ~35,000 | **~$0.13** |

### 2.6 PDF 處理

#### 選擇：PyMuPDF + pdfplumber + Pillow

**分工：**

| 工具 | 用途 |
|------|------|
| **PyMuPDF (fitz)** | PDF 頁面渲染、合併、輸出 |
| **pdfplumber** | 文字層提取、表格解析 |
| **Pillow** | 圖像處理、中文字體繪製 |

**MWO PDF 生成流程：**

```python
def export_mwo_complete_pdf(run):
    """
    完整 MWO PDF 匯出

    流程：
    1. 載入 Tech Pack 頁面圖片
    2. 使用 Pillow 繪製中文翻譯（微軟雅黑字體）
    3. 渲染 BOM 表格
    4. 使用 PyMuPDF 合併所有頁面
    5. 返回 PDF 檔案
    """
    pages = []

    # Tech Pack 頁面 + 中文翻譯
    for page in run.tech_pack_pages:
        img = Image.open(page.image_path)
        draw = ImageDraw.Draw(img)
        font = ImageFont.truetype("msyh.ttc", 12)

        for block in page.blocks:
            if block.translated_text:
                draw.text(
                    (block.position_x, block.position_y),
                    block.translated_text,
                    font=font,
                    fill='red'
                )

        pages.append(img)

    # BOM 表格
    bom_img = render_bom_table(run.bom_lines)
    pages.append(bom_img)

    # 合併為 PDF
    pdf = fitz.open()
    for img in pages:
        pdf_page = pdf.new_page(...)
        pdf_page.insert_image(...)

    return pdf.tobytes()
```

### 2.7 前端狀態管理

#### 選擇：TanStack Query + Zustand

**TanStack Query 用於：**
- 伺服器狀態（API 資料）
- 自動快取、重新獲取
- 樂觀更新

**Zustand 用於：**
- 客戶端狀態（UI 狀態、表單暫存）
- 輕量、簡單

**範例：**

```typescript
// TanStack Query - 伺服器狀態
export function useSampleRuns() {
    return useQuery({
        queryKey: ['sample-runs'],
        queryFn: fetchSampleRuns,
        staleTime: 5 * 60 * 1000, // 5 分鐘
    });
}

export function useTransitionRun() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ runId, action }) => transitionRun(runId, action),
        onSuccess: () => {
            queryClient.invalidateQueries(['sample-runs']);
        },
    });
}

// Zustand - 客戶端狀態
const useUIStore = create((set) => ({
    sidebarOpen: true,
    toggleSidebar: () => set((state) => ({
        sidebarOpen: !state.sidebarOpen
    })),
}));
```

---

## 3. 系統架構詳解

### 3.1 後端模組架構

```
backend/
├── config/                      # 專案配置
│   ├── settings/
│   │   ├── base.py             # 共用設定
│   │   ├── development.py      # 開發環境
│   │   └── production.py       # 生產環境
│   ├── urls.py                 # 主路由
│   ├── celery.py               # Celery 配置
│   └── wsgi.py / asgi.py       # 伺服器入口
│
├── apps/                        # Django Apps
│   ├── core/                   # 核心（組織、審計）
│   │   ├── models.py           # Organization, AuditLog
│   │   ├── mixins.py           # OrganizationMixin
│   │   └── views.py            # 健康檢查 API
│   │
│   ├── styles/                 # 款式管理
│   │   ├── models.py           # Style, Brand, BOMItem, Measurement
│   │   ├── serializers.py      # DRF 序列化器
│   │   └── views.py            # ViewSets
│   │
│   ├── parsing/                # PDF 解析（核心模組）
│   │   ├── models.py           # UploadedDocument, DraftBlock
│   │   ├── services/
│   │   │   ├── extraction_service.py  # AI 提取邏輯
│   │   │   └── classification_service.py
│   │   ├── tasks/
│   │   │   └── _main.py        # Celery 任務
│   │   ├── utils/
│   │   │   └── translate.py    # 翻譯工具
│   │   └── data/
│   │       └── garment_glossary.json  # 詞彙庫
│   │
│   ├── samples/                # 樣衣管理
│   │   ├── models.py           # SampleRequest, SampleRun
│   │   ├── services/
│   │   │   ├── run_transitions.py     # 狀態機邏輯
│   │   │   └── mwo_complete_export.py # MWO 匯出
│   │   └── views.py
│   │
│   ├── costing/                # 報價
│   ├── procurement/            # 採購
│   │   ├── services/
│   │   │   └── email_service.py  # PO 郵件發送
│   │
│   ├── orders/                 # 大貨訂單
│   │   ├── services/
│   │   │   └── mrp_service.py    # MRP 計算
│   │
│   └── assistant/              # 小助理
│       ├── services/
│       │   └── command_parser.py  # 指令解析
│
└── media/                       # 上傳檔案
    └── uploads/
        ├── documents/          # PDF 檔案
        └── images/             # 頁面圖片
```

### 3.2 前端模組架構

```
frontend/
├── app/                         # Next.js App Router
│   ├── layout.tsx              # 根佈局
│   ├── page.tsx                # 首頁
│   ├── globals.css             # 全域樣式
│   │
│   └── dashboard/              # 主要頁面
│       ├── layout.tsx          # Dashboard 佈局（含 Sidebar）
│       ├── page.tsx            # Dashboard 首頁
│       │
│       ├── upload/             # 上傳頁面
│       │   └── page.tsx        # 單筆 + 批量 Tab
│       │
│       ├── tech-packs/         # 文件管理
│       │   └── page.tsx        # Tab: Tech Pack/BOM/Mixed/款式
│       │
│       ├── documents/[id]/     # 文件詳情
│       │   ├── processing/page.tsx  # AI 處理中
│       │   └── review/page.tsx      # 分類審查
│       │
│       ├── revisions/[id]/     # Revision 編輯
│       │   ├── review/page.tsx      # 翻譯審校
│       │   ├── bom/page.tsx         # BOM 編輯
│       │   ├── spec/page.tsx        # Spec 編輯
│       │   └── costing-phase23/page.tsx
│       │
│       ├── samples/            # 樣衣
│       │   ├── page.tsx        # 列表
│       │   └── kanban/page.tsx # Kanban
│       │
│       └── ...                 # 其他頁面
│
├── components/                  # React 元件
│   ├── ui/                     # shadcn/ui 基礎元件
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── table.tsx
│   │   └── ...
│   │
│   ├── layout/                 # 佈局元件
│   │   ├── Sidebar.tsx
│   │   └── Header.tsx
│   │
│   ├── samples/                # 樣衣相關
│   │   ├── TransitionPrecheckDialog.tsx
│   │   └── RollbackDialog.tsx
│   │
│   └── assistant/              # 小助理
│       ├── AssistantButton.tsx
│       └── AssistantDialog.tsx
│
├── lib/                         # 工具庫
│   ├── api/                    # API 函數
│   │   ├── client.ts           # Axios 客戶端
│   │   ├── samples.ts
│   │   └── ...
│   │
│   ├── hooks/                  # Custom Hooks
│   │   ├── useSamples.ts
│   │   └── ...
│   │
│   └── types/                  # TypeScript 類型
│       ├── sample.ts
│       └── ...
│
└── store/                       # Zustand 狀態
```

### 3.3 資料流詳解

#### 3.3.1 PDF 上傳與處理流程

```
┌─────────────────────────────────────────────────────────────┐
│                    PDF 上傳與處理流程                        │
└─────────────────────────────────────────────────────────────┘

用戶上傳 PDF
      │
      ▼
┌──────────────┐
│   Frontend   │
│  /upload     │
└──────┬───────┘
       │ POST /api/v2/uploaded-documents/
       │ (multipart/form-data)
       ▼
┌──────────────┐
│   Django     │
│   View       │
└──────┬───────┘
       │ 1. 儲存檔案到 media/uploads/
       │ 2. 創建 UploadedDocument 記錄
       │ 3. 返回 document_id
       ▼
┌──────────────┐     ┌──────────────┐
│   Frontend   │────►│  Processing  │
│  redirect    │     │    Page      │
└──────────────┘     └──────┬───────┘
                            │ POST /api/v2/uploaded-documents/{id}/classify/?async=true
                            ▼
                     ┌──────────────┐
                     │   Django     │
                     │   View       │
                     └──────┬───────┘
                            │ 發起 Celery 任務
                            │ 返回 task_id
                            ▼
┌──────────────┐     ┌──────────────┐
│   Frontend   │◄────│   Celery     │
│   Polling    │     │   Worker     │
└──────────────┘     └──────┬───────┘
       │                    │
       │ GET /tasks/{id}/   │ 1. 將 PDF 頁面轉為圖片
       │ (每 2.5 秒)        │ 2. 調用 GPT-4o Vision 分類
       │                    │ 3. 更新 classification_result
       ▼                    ▼
┌──────────────┐     ┌──────────────┐
│   SUCCESS    │     │   完成       │
│   跳轉到     │     │   更新 DB    │
│   Review     │     │              │
└──────────────┘     └──────────────┘
```

#### 3.3.2 樣衣狀態流轉

```
┌─────────────────────────────────────────────────────────────┐
│                    樣衣狀態流轉詳解                          │
└─────────────────────────────────────────────────────────────┘

                    創建 SampleRequest
                           │
                           ▼
                   ┌───────────────┐
                   │    DRAFT      │ ◄── 初始狀態
                   └───────┬───────┘
                           │ submit()
                           │ • 驗證 BOM 存在
                           ▼
                   ┌───────────────┐
                   │   SUBMITTED   │
                   └───────┬───────┘
                           │ quote()
                           │ • 生成 CostSheet
                           ▼
                   ┌───────────────┐
                   │    QUOTED     │
                   └───────┬───────┘
                           │ request_approval()
                           ▼
                   ┌───────────────┐
                   │PENDING_APPROVAL│
                   └───────┬───────┘
                          ╱ ╲
                   approve()  reject()
                        │       │
                        ▼       ▼
            ┌───────────────┐ ┌───────────────┐
            │   APPROVED    │ │   REJECTED    │
            └───────┬───────┘ └───────────────┘
                    │ start_materials()
                    │ • 生成採購單草稿
                    ▼
            ┌───────────────┐
            │   MATERIALS   │
            └───────┬───────┘
                    │ issue_po()
                    │ • 發送採購單
                    ▼
            ┌───────────────┐
            │   PO_ISSUED   │
            └───────┬───────┘
                    │ start_production()
                    │ • 物料到齊
                    ▼
            ┌───────────────┐
            │IN_PRODUCTION  │
            └───────┬───────┘
                    │ complete()
                    │ • 記錄實際用量
                    ▼
            ┌───────────────┐
            │   COMPLETED   │
            └───────────────┘
```

#### 3.3.3 快照機制

```python
"""
快照原則：SampleRun 創建時，複製當前 Revision 的資料

目的：
1. 保證 Run 的資料獨立，不受後續修改影響
2. 報價基於快照計算
3. 可追溯歷史版本

實現：
"""

def create_sample_run(request, run_type, quantity):
    """創建 SampleRun + 快照"""

    run = SampleRun.objects.create(
        sample_request=request,
        run_type=run_type,
        quantity=quantity,
        status='draft'
    )

    revision = request.style_revision

    # 快照 BOM
    for bom_item in revision.bom_items.all():
        RunBOMLine.objects.create(
            sample_run=run,
            source_bom_item_id=bom_item.id,  # 記錄來源
            material_name=bom_item.material_name,
            material_name_zh=bom_item.material_name_zh,
            unit_price=bom_item.unit_price,
            consumption=bom_item.consumption,
            # actual_consumption 稍後填寫
        )

    # 快照 Operations
    for step in revision.construction_steps.all():
        RunOperation.objects.create(
            sample_run=run,
            source_step_id=step.id,
            operation_name=step.operation_name,
            operation_name_zh=step.operation_name_zh,
            time_minutes=step.time_minutes,
            labor_rate=step.labor_rate,
        )

    # 快照 Tech Pack
    if revision.tech_pack_revision:
        for page in revision.tech_pack_revision.pages.all():
            run_page = RunTechPackPage.objects.create(
                sample_run=run,
                page_number=page.page_number,
                image_path=page.image_path,
            )
            for block in page.blocks.filter(is_hidden=False):
                RunTechPackBlock.objects.create(
                    run_page=run_page,
                    original_text=block.original_text,
                    translated_text=block.translated_text,
                    position_x=block.position_x,
                    position_y=block.position_y,
                )

    # 生成 MWO
    mwo = SampleMWO.objects.create(
        sample_run=run,
        mwo_number=generate_mwo_number()
    )

    # 生成 CostSheet
    cost_sheet = CostSheetVersion.objects.create(
        sample_run=run,
        version=1
    )
    calculate_cost_sheet(cost_sheet)

    return run
```

---

## 4. 部署架構

### 4.1 開發環境

```
┌─────────────────────────────────────────────────────────────┐
│                    Development Environment                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
│  │   Next.js    │   │    Django    │   │    Redis     │    │
│  │   Dev Server │   │  runserver   │   │    Server    │    │
│  │   :3000      │   │   :8000      │   │   :6379      │    │
│  └──────────────┘   └──────────────┘   └──────────────┘    │
│         │                  │                  │             │
│         └──────────────────┼──────────────────┘             │
│                            │                                 │
│                   ┌────────┴────────┐                       │
│                   │    SQLite DB    │                       │
│                   │   db.sqlite3    │                       │
│                   └─────────────────┘                       │
│                                                              │
│  ┌──────────────┐                                           │
│  │    Celery    │                                           │
│  │    Worker    │ (--pool=solo for Windows)                 │
│  └──────────────┘                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**啟動腳本：**

```bash
# start-dev.sh (Linux/Mac)
#!/bin/bash

# Terminal 1: Redis
redis-server &

# Terminal 2: Celery
cd backend && celery -A config worker -l info &

# Terminal 3: Django
cd backend && python manage.py runserver 8000 &

# Terminal 4: Next.js
cd frontend && npm run dev &

wait

# start-dev.bat (Windows)
start cmd /k "redis-server"
start cmd /k "cd backend && celery -A config worker -l info --pool=solo"
start cmd /k "cd backend && python manage.py runserver 8000"
start cmd /k "cd frontend && npm run dev"
```

### 4.2 生產環境架構

```
┌─────────────────────────────────────────────────────────────┐
│                    Production Environment                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    Load Balancer                       │  │
│  │                    (Nginx / AWS ALB)                   │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │                               │
│           ┌──────────────────┼──────────────────┐           │
│           │                  │                  │           │
│           ▼                  ▼                  ▼           │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
│  │   Frontend   │   │   Backend    │   │   Backend    │    │
│  │   (Vercel)   │   │  (Gunicorn)  │   │  (Gunicorn)  │    │
│  │              │   │   Instance 1 │   │   Instance 2 │    │
│  └──────────────┘   └──────────────┘   └──────────────┘    │
│                              │                               │
│              ┌───────────────┼───────────────┐              │
│              │               │               │              │
│              ▼               ▼               ▼              │
│     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│     │  PostgreSQL  │ │    Redis     │ │     S3       │     │
│     │   (RDS)      │ │ (ElastiCache)│ │   (Files)    │     │
│     └──────────────┘ └──────────────┘ └──────────────┘     │
│                              │                               │
│              ┌───────────────┼───────────────┐              │
│              ▼               ▼               ▼              │
│     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│     │   Celery     │ │   Celery     │ │   Celery     │     │
│     │   Worker 1   │ │   Worker 2   │ │   Beat       │     │
│     └──────────────┘ └──────────────┘ └──────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Docker 部署

**docker-compose.yml:**

```yaml
version: '3.8'

services:
  # PostgreSQL
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: fashion_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  # Redis
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  # Django Backend
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=postgres://postgres:${DB_PASSWORD}@db:5432/fashion_db
      - CELERY_BROKER_URL=redis://redis:6379/0
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - ./backend:/app
      - media_data:/app/media
    ports:
      - "8000:8000"
    depends_on:
      - db
      - redis
    command: gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4

  # Celery Worker
  celery:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=postgres://postgres:${DB_PASSWORD}@db:5432/fashion_db
      - CELERY_BROKER_URL=redis://redis:6379/0
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - ./backend:/app
      - media_data:/app/media
    depends_on:
      - db
      - redis
    command: celery -A config worker -l info --concurrency=4

  # Next.js Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:8000/api/v2
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  postgres_data:
  media_data:
```

**Backend Dockerfile:**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    fonts-wqy-microhei \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Collect static files
RUN python manage.py collectstatic --noinput

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000"]
```

---

## 5. 效能設計

### 5.1 後端效能優化

#### 5.1.1 資料庫查詢優化

```python
# ❌ N+1 問題
runs = SampleRun.objects.all()
for run in runs:
    print(run.sample_request.style.style_number)  # 每次查詢

# ✅ 使用 select_related
runs = SampleRun.objects.select_related(
    'sample_request__style',
    'sample_request__style__brand'
).all()

# ✅ 使用 prefetch_related（多對多/反向關聯）
runs = SampleRun.objects.prefetch_related(
    'bom_lines',
    'operations'
).all()
```

#### 5.1.2 分頁

```python
# settings.py
REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}

# 自訂分頁
class LargeResultsSetPagination(PageNumberPagination):
    page_size = 100
    page_size_query_param = 'page_size'
    max_page_size = 1000
```

#### 5.1.3 快取策略

```python
from django.core.cache import cache

def get_glossary():
    """詞彙庫快取"""
    key = 'garment_glossary'
    data = cache.get(key)
    if data is None:
        data = load_glossary_from_file()
        cache.set(key, data, timeout=3600)  # 1 小時
    return data

# Redis 快取設定
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': 'redis://localhost:6379/1',
    }
}
```

### 5.2 前端效能優化

#### 5.2.1 TanStack Query 快取

```typescript
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,      // 5 分鐘內不重新獲取
            cacheTime: 30 * 60 * 1000,     // 快取保留 30 分鐘
            refetchOnWindowFocus: false,    // 視窗聚焦不自動重新獲取
        },
    },
});
```

#### 5.2.2 列表虛擬化

```typescript
// 大型列表使用虛擬化
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualList({ items }) {
    const parentRef = useRef(null);

    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 50,
    });

    return (
        <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
            <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
                {virtualizer.getVirtualItems().map((virtualItem) => (
                    <div
                        key={virtualItem.key}
                        style={{
                            position: 'absolute',
                            top: 0,
                            transform: `translateY(${virtualItem.start}px)`,
                        }}
                    >
                        {items[virtualItem.index]}
                    </div>
                ))}
            </div>
        </div>
    );
}
```

#### 5.2.3 圖片優化

```typescript
// 使用 Next.js Image 優化
import Image from 'next/image';

<Image
    src={pageImageUrl}
    alt="Tech Pack Page"
    width={800}
    height={1000}
    loading="lazy"
    placeholder="blur"
    blurDataURL="data:image/jpeg;base64,..."
/>
```

### 5.3 AI 處理效能

#### 5.3.1 並行處理（規劃中）

```python
# 當前：串行處理每頁
for page in pages:
    result = extract_page(page)  # 10-30 秒/頁

# 優化：並行處理（需處理 rate limit）
import asyncio
from openai import AsyncOpenAI

async def extract_pages_parallel(pages):
    client = AsyncOpenAI()
    semaphore = asyncio.Semaphore(3)  # 限制併發數

    async def extract_with_limit(page):
        async with semaphore:
            return await client.chat.completions.create(...)

    tasks = [extract_with_limit(page) for page in pages]
    results = await asyncio.gather(*tasks)
    return results
```

#### 5.3.2 延遲翻譯（規劃中）

```python
"""
當前流程：
  提取 → 翻譯 → 儲存（同步，耗時長）

優化流程：
  提取 → 儲存原文（快速）
  後台翻譯 或 用戶進入翻譯頁時觸發
"""

# 提取時不翻譯
def extract_blocks(page):
    blocks = extract_raw_blocks(page)
    for block in blocks:
        DraftBlock.objects.create(
            original_text=block['text'],
            translated_text=None,  # 暫不翻譯
            translation_status='pending'
        )

# 按需翻譯
def translate_blocks_on_demand(revision_id):
    blocks = DraftBlock.objects.filter(
        revision_page__revision_id=revision_id,
        translation_status='pending'
    )
    for block in blocks:
        block.translated_text = translate(block.original_text)
        block.translation_status = 'completed'
        block.save()
```

### 5.4 效能指標目標

| 指標 | 目標 | 當前狀態 |
|------|------|----------|
| 頁面載入時間 | < 2 秒 | ~1.5 秒 ✅ |
| API 回應時間（列表）| < 500ms | ~300ms ✅ |
| API 回應時間（詳情）| < 200ms | ~150ms ✅ |
| AI 分類（10 頁）| < 60 秒 | ~30 秒 ✅ |
| AI 提取（10 頁）| < 5 分鐘 | ~3 分鐘 ✅ |
| MWO PDF 生成 | < 30 秒 | ~15 秒 ✅ |

---

## 6. 可靠性設計

### 6.1 錯誤重試機制

#### Celery 任務重試

```python
@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(OpenAIError, ConnectionError),
    retry_backoff=True,
    retry_backoff_max=600,
)
def extract_document_task(self, doc_id):
    """
    異步提取任務
    - max_retries: 最多重試 3 次
    - retry_backoff: 指數退避（60s, 120s, 240s）
    - autoretry_for: 自動重試的例外類型
    """
    try:
        doc = UploadedDocument.objects.get(id=doc_id)
        result = extraction_service.extract(doc)
        return result
    except Exception as e:
        # 記錄錯誤
        doc.processing_status = 'failed'
        doc.error_message = str(e)
        doc.save()
        raise
```

### 6.2 資料完整性

#### 交易處理

```python
from django.db import transaction

@transaction.atomic
def create_sample_run(request, run_type, quantity):
    """
    使用交易確保資料完整性
    - 如果任何步驟失敗，整個操作回滾
    """
    run = SampleRun.objects.create(...)

    # 快照 BOM
    for bom_item in request.style_revision.bom_items.all():
        RunBOMLine.objects.create(sample_run=run, ...)

    # 生成 MWO
    SampleMWO.objects.create(sample_run=run, ...)

    # 生成 CostSheet
    cost_sheet = CostSheetVersion.objects.create(sample_run=run, ...)

    return run
```

### 6.3 冪等性設計

```python
def confirm_sample_request(request_id, idempotency_key=None):
    """
    確認 SampleRequest（冪等操作）
    - 重複調用不會創建多個 Run
    """
    request = SampleRequest.objects.get(id=request_id)

    # 檢查是否已有 Run
    existing_run = SampleRun.objects.filter(
        sample_request=request,
        run_no=1
    ).first()

    if existing_run:
        return existing_run  # 返回已存在的 Run

    # 創建新 Run
    return create_sample_run(request, 'fit', 1)
```

### 6.4 備份策略

```bash
# PostgreSQL 每日備份
pg_dump -U postgres fashion_db > backup_$(date +%Y%m%d).sql

# 保留最近 30 天備份
find /backups -name "backup_*.sql" -mtime +30 -delete

# 媒體檔案同步到 S3
aws s3 sync /app/media s3://fashion-backup/media/
```

---

## 7. 監控與日誌

### 7.1 健康檢查 API

```python
# apps/core/views.py
def services_health_check(request):
    """
    健康檢查端點
    - Database 連線
    - Redis 連線
    - Celery Worker 狀態
    """
    status = {
        'status': 'healthy',
        'database': check_database(),
        'redis': check_redis(),
        'celery': check_celery(),
    }

    if any(s['status'] == 'error' for s in [
        status['database'], status['redis'], status['celery']
    ]):
        status['status'] = 'unhealthy'

    return JsonResponse(status)

def check_database():
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        return {'status': 'ok', 'message': 'Connected'}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}

def check_redis():
    try:
        import redis
        r = redis.from_url(settings.CELERY_BROKER_URL)
        r.ping()
        return {'status': 'ok', 'message': f'Connected to {settings.CELERY_BROKER_URL}'}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}

def check_celery():
    try:
        from celery import current_app
        inspect = current_app.control.inspect()
        active = inspect.active()
        if active:
            return {'status': 'ok', 'message': f'{len(active)} worker(s) online'}
        return {'status': 'warning', 'message': 'No workers online'}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}
```

### 7.2 日誌配置

```python
# settings.py
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{asctime}] {levelname} {name} {message}',
            'style': '{',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
        'json': {
            '()': 'pythonjsonlogger.jsonlogger.JsonFormatter',
            'format': '%(asctime)s %(levelname)s %(name)s %(message)s',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': 'logs/app.log',
            'maxBytes': 10 * 1024 * 1024,  # 10 MB
            'backupCount': 5,
            'formatter': 'verbose',
        },
        'celery_file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': 'logs/celery.log',
            'maxBytes': 10 * 1024 * 1024,
            'backupCount': 5,
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'apps': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
        },
        'celery': {
            'handlers': ['console', 'celery_file'],
            'level': 'INFO',
        },
        'django.request': {
            'handlers': ['console', 'file'],
            'level': 'WARNING',
        },
    },
}
```

### 7.3 監控指標

**應用指標：**

| 指標 | 說明 | 告警閾值 |
|------|------|----------|
| API 回應時間 | P95 延遲 | > 2 秒 |
| 錯誤率 | 5xx 錯誤比例 | > 1% |
| Celery 任務佇列長度 | 待處理任務數 | > 100 |
| Celery 任務失敗率 | 失敗任務比例 | > 5% |

**系統指標：**

| 指標 | 說明 | 告警閾值 |
|------|------|----------|
| CPU 使用率 | - | > 80% |
| 記憶體使用率 | - | > 85% |
| 磁碟使用率 | - | > 90% |
| PostgreSQL 連線數 | - | > 80% max |

---

## 8. 安全技術實現

### 8.1 認證實現

```python
# JWT 配置
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': settings.SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# Token 驗證流程
"""
1. 用戶登入
   POST /api/v2/auth/token/
   Request: { "username": "...", "password": "..." }
   Response: { "access": "...", "refresh": "..." }

2. 請求帶 Token
   Authorization: Bearer <access_token>

3. Token 刷新
   POST /api/v2/auth/token/refresh/
   Request: { "refresh": "..." }
   Response: { "access": "..." }
"""
```

### 8.2 輸入驗證

```python
# DRF Serializer 驗證
class UploadDocumentSerializer(serializers.Serializer):
    file = serializers.FileField()

    def validate_file(self, value):
        # 檔案大小限制（50MB）
        if value.size > 50 * 1024 * 1024:
            raise serializers.ValidationError("File too large (max 50MB)")

        # 檔案類型限制
        allowed_types = ['application/pdf']
        if value.content_type not in allowed_types:
            raise serializers.ValidationError("Only PDF files allowed")

        # 檔名安全檢查
        if '..' in value.name or '/' in value.name:
            raise serializers.ValidationError("Invalid file name")

        return value
```

### 8.3 CSRF 保護

```python
# settings.py
CSRF_COOKIE_SECURE = True  # 僅 HTTPS
CSRF_COOKIE_HTTPONLY = True
CSRF_TRUSTED_ORIGINS = [
    'https://your-domain.com',
]

# API 請求豁免（使用 JWT 認證）
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
}
```

### 8.4 檔案上傳安全

```python
# 上傳目錄隔離
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
MEDIA_URL = '/media/'

# 檔案儲存到隨機命名的目錄
def upload_to(instance, filename):
    ext = filename.split('.')[-1]
    new_filename = f"{uuid.uuid4()}.{ext}"
    return f"uploads/{instance.organization_id}/{new_filename}"

# 限制可訪問的檔案類型
def serve_media(request, path):
    allowed_extensions = ['.pdf', '.png', '.jpg']
    if not any(path.endswith(ext) for ext in allowed_extensions):
        raise Http404
    return serve(request, path, document_root=settings.MEDIA_ROOT)
```

---

## 9. 開發規範

### 9.1 程式碼風格

#### Python

```python
# 使用 Black 格式化（行寬 88）
# 使用 isort 排序 imports

# 命名規範
class SampleRunService:  # PascalCase
    def create_sample_run(self):  # snake_case
        pass

SAMPLE_STATUS_CHOICES = [...]  # UPPER_SNAKE_CASE

# Docstring (Google 風格)
def create_sample_run(request: SampleRequest, run_type: str) -> SampleRun:
    """
    創建 SampleRun 並生成相關資料。

    Args:
        request: SampleRequest 實例
        run_type: 類型 ('fit', 'pp', 'prod')

    Returns:
        新創建的 SampleRun 實例

    Raises:
        ValidationError: 當 request 未批准時
    """
    pass
```

#### TypeScript

```typescript
// 使用 ESLint + Prettier
// 嚴格模式 (strict: true)

// 命名規範
interface SampleRun {}  // PascalCase (類型)
function createSampleRun() {}  // camelCase (函數)
const SAMPLE_STATUS = {}  // UPPER_SNAKE_CASE (常量)

// 元件命名
function SampleRunCard() {}  // PascalCase (React 元件)

// 類型定義
type SampleStatus = 'draft' | 'submitted' | 'approved';

interface SampleRun {
    id: string;
    status: SampleStatus;
    createdAt: string;  // camelCase
}

// Props 類型
interface SampleRunCardProps {
    run: SampleRun;
    onTransition?: (action: string) => void;
}

function SampleRunCard({ run, onTransition }: SampleRunCardProps) {
    // ...
}
```

### 9.2 Git 規範

#### Commit Message

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type:**
- `feat`: 新功能
- `fix`: 修復 bug
- `docs`: 文檔
- `style`: 格式（不影響程式碼）
- `refactor`: 重構
- `test`: 測試
- `chore`: 雜務

**範例：**

```
feat(samples): add multi-round fit sample support

- Add create_next_run API endpoint
- Implement run_no auto-increment
- Snapshot previous run's configuration

Closes #123
```

#### Branch 命名

```
feature/P25-multi-round-fit-sample
bugfix/FIX-0128-mixed-extraction
hotfix/urgent-security-patch
```

### 9.3 API 設計規範

```yaml
# RESTful 規範
GET    /api/v2/resources/          # 列表
POST   /api/v2/resources/          # 創建
GET    /api/v2/resources/{id}/     # 詳情
PUT    /api/v2/resources/{id}/     # 完整更新
PATCH  /api/v2/resources/{id}/     # 部分更新
DELETE /api/v2/resources/{id}/     # 刪除

# 自訂動作
POST   /api/v2/resources/{id}/action/  # 執行動作

# 查詢參數
GET    /api/v2/resources/?status=draft&page=1&page_size=20

# 回應格式
{
    "id": "uuid",
    "field": "value",
    "created_at": "2026-01-29T10:00:00Z",
    "updated_at": "2026-01-29T10:00:00Z"
}

# 錯誤回應
{
    "error": "Error Type",
    "detail": "Detailed message",
    "code": "ERROR_CODE"
}
```

### 9.4 測試規範

#### 後端測試

```python
# tests/test_samples.py
import pytest
from django.test import TestCase
from apps.samples.models import SampleRun
from apps.samples.services import create_sample_run

class TestSampleRunService(TestCase):
    def setUp(self):
        self.request = SampleRequestFactory()

    def test_create_sample_run_success(self):
        """測試成功創建 SampleRun"""
        run = create_sample_run(self.request, 'fit', 1)

        self.assertEqual(run.status, 'draft')
        self.assertEqual(run.run_no, 1)
        self.assertTrue(run.bom_lines.exists())

    def test_create_sample_run_without_bom(self):
        """測試無 BOM 時創建失敗"""
        self.request.style_revision.bom_items.all().delete()

        with self.assertRaises(ValidationError):
            create_sample_run(self.request, 'fit', 1)

# 執行測試
# cd backend && pytest
# cd backend && pytest --cov=apps --cov-report=html
```

#### 前端測試

```typescript
// __tests__/components/SampleRunCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { SampleRunCard } from '@/components/samples/SampleRunCard';

describe('SampleRunCard', () => {
    const mockRun = {
        id: '1',
        status: 'draft',
        styleNumber: 'LW1FLWS',
    };

    it('renders run information', () => {
        render(<SampleRunCard run={mockRun} />);

        expect(screen.getByText('LW1FLWS')).toBeInTheDocument();
        expect(screen.getByText('draft')).toBeInTheDocument();
    });

    it('calls onTransition when button clicked', () => {
        const onTransition = jest.fn();
        render(<SampleRunCard run={mockRun} onTransition={onTransition} />);

        fireEvent.click(screen.getByRole('button', { name: /submit/i }));

        expect(onTransition).toHaveBeenCalledWith('submit');
    });
});

// 執行測試
// cd frontend && npm test
```

---

## 10. 技術債務與改進計劃

### 10.1 已知技術債務

| 編號 | 描述 | 影響 | 優先級 |
|------|------|------|--------|
| TD-01 | SQLite 用於開發，需遷移到 PostgreSQL | 資料量受限 | P2 |
| TD-02 | 前端缺少單元測試 | 品質風險 | P2 |
| TD-03 | AI 提取串行處理 | 效能瓶頸 | P2 |
| TD-04 | 翻譯與提取耦合 | 處理時間長 | P2 |
| TD-05 | 缺少 API 版本控制策略 | 升級困難 | P3 |
| TD-06 | 部分 API 缺少 Rate Limiting | 安全風險 | P2 |

### 10.2 改進計劃

#### 短期（1-2 週）

| 項目 | 說明 |
|------|------|
| TODO-EXT | 提取預覽/檢查功能 |
| TD-06 | 添加 API Rate Limiting |

#### 中期（1-2 月）

| 項目 | 說明 |
|------|------|
| TODO-PERF | 提取速度優化（延遲翻譯 + 並行處理）|
| TD-02 | 前端測試覆蓋率達 60% |
| TODO-i18n | 多語言翻譯支援 |

#### 長期（3-6 月）

| 項目 | 說明 |
|------|------|
| TODO-COST | 完整成本分析 |
| SaaS-RBAC | 權限控制 + 用戶管理 |
| Phase B | Supplier Portal |

### 10.3 效能優化路線圖

```
當前狀態                          目標狀態
─────────────────────────────────────────────────────────
AI 提取（10 頁）
  ~3 分鐘（串行）      →         ~1 分鐘（並行）

翻譯處理
  提取時同步翻譯       →         延遲翻譯（按需）

資料庫
  SQLite             →         PostgreSQL + 連線池

快取
  無                 →         Redis 快取熱點資料
```

---

## 附錄

### A. 常用命令

```bash
# 開發
cd backend && python manage.py runserver 8000
cd frontend && npm run dev
celery -A config worker -l info --pool=solo

# 資料庫
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser

# 測試
cd backend && pytest
cd frontend && npm test

# 程式碼品質
cd backend && black . && isort .
cd frontend && npm run lint && npm run type-check

# Docker
docker-compose up -d
docker-compose logs -f
docker-compose exec backend python manage.py migrate
```

### B. 環境變數參考

```env
# Django
DJANGO_SECRET_KEY=your-secret-key-here
DJANGO_DEBUG=True
DJANGO_SETTINGS_MODULE=config.settings.development

# Database
DATABASE_URL=postgres://user:pass@localhost:5432/fashion_db

# Redis & Celery
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# OpenAI
OPENAI_API_KEY=sk-...
TRANSLATION_MODEL=gpt-4o-mini

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=app-password

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v2
```

### C. 故障排除

| 問題 | 原因 | 解決方案 |
|------|------|----------|
| Celery 無法連接 Redis | Redis 未啟動 | `redis-server` |
| AI 提取超時 | 網路或 OpenAI 問題 | 檢查 API Key、重試 |
| MWO PDF 中文亂碼 | 缺少字體 | 安裝微軟雅黑字體 |
| 前端 API 404 | 後端未啟動 | 確認 Django 運行中 |
| Windows Celery 錯誤 | Pool 不相容 | 使用 `--pool=solo` |

---

## 文檔資訊

| 項目 | 內容 |
|------|------|
| **文檔名稱** | Technical Design Document (TDD) |
| **專案名稱** | Fashion Production System |
| **撰寫者** | Development Team |
| **審核者** | - |
| **最後更新** | 2026-01-29 |
