# Software Design Document (SDD)

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
2. [系統概述](#2-系統概述)
3. [架構設計](#3-架構設計)
4. [模組設計](#4-模組設計)
5. [資料庫設計](#5-資料庫設計)
6. [API 設計](#6-api-設計)
7. [使用者介面設計](#7-使用者介面設計)
8. [安全設計](#8-安全設計)
9. [錯誤處理](#9-錯誤處理)
10. [附錄](#10-附錄)

---

## 1. 概述

### 1.1 目的

本文檔定義 Fashion Production System（成衣生產管理系統）的軟體設計規格，供開發團隊、維護人員及新進開發者參考。

### 1.2 範圍

本系統為 AI 增強的 PLM + ERP Lite 解決方案，專為成衣工廠設計，涵蓋：

- Tech Pack / BOM 文件解析與翻譯
- 樣衣管理與 MWO（製造工單）
- 報價與成本計算
- 採購管理與供應商協作
- 大貨訂單與 MRP 物料需求計算

**目標用戶：** 成衣工廠（操作者、付費者）

**設計目標：** 1 人管理 300-500+ 款/季，70-80% 自動化

### 1.3 術語定義

| 術語 | 說明 |
|------|------|
| **Tech Pack** | 技術包，品牌提供的產品規格文件（PDF）|
| **BOM** | Bill of Materials，物料清單 |
| **MWO** | Manufacturing Work Order，製造工單 |
| **Spec** | Specification，尺寸規格表 |
| **Fit Sample** | 試身樣衣 |
| **PP Sample** | Pre-Production Sample，產前樣 |
| **Prod Sample** | Production Sample，大貨樣 |
| **Run** | 樣衣製作批次（同一 Request 可有多輪 Run）|
| **PO** | Purchase Order，採購單 |
| **MRP** | Material Requirements Planning，物料需求計劃 |

### 1.4 參考文檔

| 文檔 | 說明 |
|------|------|
| `CLAUDE.md` | 專案記憶與快速參考 |
| `docs/BUSINESS-FLOW.md` | 業務流程說明 |
| `docs/SYSTEM-ARCHITECTURE-v3.md` | 系統架構圖 |
| `docs/PROGRESS-CHANGELOG.md` | 開發進度記錄 |

---

## 2. 系統概述

### 2.1 系統定位

```
┌─────────────────────────────────────────────────────────────┐
│            AI-Augmented PLM + ERP Lite                      │
│              for Garment Factories                          │
├─────────────────────────────────────────────────────────────┤
│  主要用戶 = 成衣廠（操作者、付費者）                         │
│  次要受益者 = 品牌（獲得可視性，減少派人監督成本）           │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 核心功能

| 功能 | 說明 |
|------|------|
| **文件解析** | AI 自動解析 Tech Pack / BOM PDF |
| **翻譯服務** | 英→中翻譯，整合 1252 條成衣專業詞彙 |
| **樣衣管理** | Kanban 看板、狀態流轉、多輪 Fit Sample |
| **MWO 生成** | 自動生成製造工單 PDF（含中文）|
| **報價計算** | BOM + 人工 + 損耗 自動計算 |
| **採購管理** | 採購單生成、寄送、狀態追蹤 |
| **大貨訂單** | MRP 計算、物料需求自動拆分 |
| **進度追蹤** | 儀表板、甘特圖、逾期提醒 |

### 2.3 系統邊界

```
┌─────────────────────────────────────────────────────────────┐
│                    Fashion Production System                 │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐               │
│  │  Frontend │  │  Backend  │  │  Celery   │               │
│  │ (Next.js) │  │ (Django)  │  │ (Worker)  │               │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘               │
│        │              │              │                      │
│        └──────────────┼──────────────┘                      │
│                       │                                     │
│  ┌────────────────────┼────────────────────┐               │
│  │                    ▼                    │               │
│  │    ┌───────────────────────────┐        │               │
│  │    │      PostgreSQL / SQLite  │        │               │
│  │    └───────────────────────────┘        │               │
│  │    ┌───────────────────────────┐        │               │
│  │    │          Redis            │        │               │
│  │    └───────────────────────────┘        │               │
│  └─────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ OpenAI   │ │  SMTP    │ │  File    │
        │ API      │ │  Server  │ │  Storage │
        └──────────┘ └──────────┘ └──────────┘
```

**外部依賴：**
- OpenAI API（GPT-4o Vision / GPT-4o-mini）
- SMTP Server（PO 郵件發送）
- File Storage（PDF 上傳儲存）

---

## 3. 架構設計

### 3.1 整體架構

```
┌─────────────────────────────────────────────────────────────┐
│                      Presentation Layer                      │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                  Next.js 16 + React 19                  ││
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       ││
│  │  │  Pages  │ │Components│ │  Hooks  │ │  API    │       ││
│  │  │ (App)   │ │ (UI)    │ │(TanStack)│ │ Client  │       ││
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │ HTTP/REST
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       API Layer                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Django REST Framework                       ││
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       ││
│  │  │  Views  │ │Serializ.│ │  URLs   │ │  Auth   │       ││
│  │  │(ViewSet)│ │ (DRF)   │ │(Router) │ │ (JWT)   │       ││
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Business Layer                           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   Django Apps (13)                       ││
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐           ││
│  │  │ styles │ │parsing │ │samples │ │costing │           ││
│  │  ├────────┤ ├────────┤ ├────────┤ ├────────┤           ││
│  │  │procure.│ │ orders │ │ core   │ │assist. │           ││
│  │  └────────┘ └────────┘ └────────┘ └────────┘           ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│   Data Layer     │ │  Cache Layer     │ │  Task Queue      │
│  ┌────────────┐  │ │  ┌────────────┐  │ │  ┌────────────┐  │
│  │ PostgreSQL │  │ │  │   Redis    │  │ │  │   Celery   │  │
│  │  / SQLite  │  │ │  │            │  │ │  │   Worker   │  │
│  └────────────┘  │ │  └────────────┘  │ │  └────────────┘  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

### 3.2 技術棧

| 層級 | 技術 | 版本 |
|------|------|------|
| **Frontend** | Next.js | 16.0.10 |
| | React | 19.2.3 |
| | TypeScript | 5.9.3 |
| | TanStack Query | 5.90.12 |
| | TanStack Table | 8.21.3 |
| | Tailwind CSS | 3.4.19 |
| | shadcn/ui | Radix-based |
| **Backend** | Django | 4.2 |
| | Django REST Framework | 3.14+ |
| | Celery | 5.3+ |
| | Python | 3.11+ |
| **Database** | PostgreSQL (Prod) | 15+ |
| | SQLite (Dev) | 3 |
| **Cache/Queue** | Redis | 7+ |
| **AI** | OpenAI GPT-4o Vision | - |
| | OpenAI GPT-4o-mini | - |
| **PDF** | PyMuPDF | 1.23+ |
| | pdfplumber | 0.10+ |
| | Pillow | 10+ |

### 3.3 部署架構

```
┌─────────────────────────────────────────────────────────────┐
│                    Development Environment                   │
├─────────────────────────────────────────────────────────────┤
│  localhost:3000 ──► Next.js Dev Server                      │
│  localhost:8000 ──► Django Dev Server                       │
│  localhost:6379 ──► Redis                                   │
│  Celery Worker ──► --pool=solo (Windows)                    │
│  SQLite ──► db.sqlite3                                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Production Environment                    │
├─────────────────────────────────────────────────────────────┤
│  Load Balancer ──► Nginx                                    │
│         │                                                    │
│         ├──► Frontend (Vercel / Docker)                     │
│         │                                                    │
│         └──► Backend (Gunicorn + Django)                    │
│                      │                                       │
│                      ├──► PostgreSQL (Managed)              │
│                      ├──► Redis (Managed)                   │
│                      └──► Celery Workers (Multiple)         │
│                                                              │
│  File Storage ──► S3 / Azure Blob                           │
└─────────────────────────────────────────────────────────────┘
```

### 3.4 資料流

```
┌──────────────────────────────────────────────────────────────┐
│                     主要資料流程                              │
└──────────────────────────────────────────────────────────────┘

Phase 1: 上傳與分類
┌──────┐    ┌──────────┐    ┌───────────┐    ┌──────────────┐
│ User │───►│ Frontend │───►│ Django API│───►│UploadedDoc  │
│Upload│    │ /upload  │    │ POST      │    │ (saved)     │
└──────┘    └──────────┘    └───────────┘    └──────────────┘
                                   │
                                   ▼ (async)
                            ┌──────────────┐
                            │ Celery Task  │
                            │ classify()   │
                            └──────┬───────┘
                                   │
                                   ▼
                            ┌──────────────┐
                            │ GPT-4o Vision│
                            │ (分類結果)    │
                            └──────────────┘

Phase 2: 提取與翻譯
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│UploadedDoc   │───►│ extract()    │───►│ GPT-4o Vision│
│(classified)  │    │ (Celery)     │    │ (頁面內容)   │
└──────────────┘    └──────────────┘    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ 詞彙庫查詢   │
                    │ + GPT翻譯    │
                    └──────┬───────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌───────────┐   ┌───────────┐   ┌───────────┐
    │DraftBlock │   │ BOMItem   │   │Measurement│
    │(Tech Pack)│   │ (物料)    │   │ (尺寸)    │
    └───────────┘   └───────────┘   └───────────┘

Phase 3: 樣衣管理
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│SampleRequest │───►│ SampleRun   │───►│ Snapshot     │
│(用戶創建)    │    │ (Fit/PP/...)│    │ BOM/Op/Tech  │
└──────────────┘    └──────────────┘    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ MWO 生成     │
                    │ CostSheet    │
                    └──────────────┘

Phase 4: 採購與大貨
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ProductionOrder───►│ MRP 計算    │───►│MaterialReq  │
│(確認大貨)    │    │              │    │ (需求清單)  │
└──────────────┘    └──────────────┘    └──────────────┘
                                               │
                                               ▼
                                        ┌──────────────┐
                                        │PurchaseOrder │
                                        │(按供應商拆分)│
                                        └──────────────┘
```

---

## 4. 模組設計

### 4.1 模組總覽

```
backend/apps/
├── core/           # 核心系統（組織、審計）
├── styles/         # 款式管理（Style, Brand, BOM, Spec）
├── parsing/        # 文件解析（上傳、AI提取、翻譯）
├── samples/        # 樣衣管理（Request, Run, MWO）
├── costing/        # 報價管理（CostSheet, UsageLine）
├── procurement/    # 採購管理（Supplier, Material, PO）
├── orders/         # 訂單管理（ProductionOrder, MRP）
├── assistant/      # 小助理（指令、任務、通知）
├── documents/      # 文件管理
├── manufacturing/  # 製造工單
└── consumption/    # 消耗管理
```

### 4.2 core 模組

**職責：** 系統核心功能，包括組織管理、審計日誌、健康檢查

**Models：**

| Model | 說明 |
|-------|------|
| `Organization` | 組織/租戶（SaaS 多租戶隔離）|
| `AuditLog` | 審計日誌 |

**主要類別：**

```python
# managers.py
class OrganizationManager:
    """組織管理器，用於多租戶查詢過濾"""

# mixins.py
class OrganizationMixin:
    """Model Mixin，自動綁定組織"""

# views.py
def services_health_check(request):
    """健康檢查 API：Database/Redis/Celery"""
```

**API 端點：**

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/v2/health/services/` | 服務健康檢查 |

### 4.3 styles 模組

**職責：** 款式、品牌、物料表、尺寸規格管理

**Models：**

| Model | 說明 | 關聯 |
|-------|------|------|
| `Brand` | 品牌 | - |
| `Style` | 款式 | → Brand |
| `StyleRevision` | 款式版本 | → Style |
| `BOMItem` | BOM 物料項 | → StyleRevision |
| `Measurement` | 尺寸項 | → StyleRevision |
| `ConstructionStep` | 製作工序 | → StyleRevision |

**核心邏輯：**

```python
class StyleRevision:
    """
    款式版本，用於 BOM/Measurement 編輯
    - 每次修改創建新版本
    - 支援版本比對
    """
    style = FK(Style)
    version = IntegerField()
    is_approved = BooleanField()

class BOMItem:
    """
    物料項，包含：
    - 物料資訊（名稱、規格、顏色）
    - 用量（估算/實際）
    - 單價與總價
    - 翻譯狀態
    """
    style_revision = FK(StyleRevision)
    material_name = CharField()
    material_name_zh = CharField()  # 中文翻譯
    unit_price = DecimalField()
    consumption = DecimalField()
    translation_status = CharField()  # pending/confirmed
```

**API 端點：**

| 方法 | 端點 | 說明 |
|------|------|------|
| GET/POST | `/api/v2/styles/` | 款式 CRUD |
| GET/POST | `/api/v2/brands/` | 品牌 CRUD |
| GET | `/api/v2/styles/{id}/revisions/` | 款式版本列表 |

### 4.4 parsing 模組

**職責：** PDF 上傳、AI 分類、內容提取、翻譯

**Models：**

| Model | 說明 | 關聯 |
|-------|------|------|
| `UploadedDocument` | 上傳的 PDF | → Style |
| `ExtractionRun` | 提取執行記錄 | → UploadedDocument |
| `Revision` | Tech Pack 版本 | → Style |
| `RevisionPage` | Tech Pack 頁面 | → Revision |
| `DraftBlock` | 翻譯區塊 | → RevisionPage |
| `DraftBlockHistory` | 區塊歷史 | → DraftBlock |

**核心服務：**

```python
# services/extraction_service.py
class ExtractionService:
    """
    AI 提取服務
    - classify(): AI 分類（tech_pack/bom/mixed）
    - extract(): AI 提取頁面內容
    """

# utils/translate.py
def machine_translate(text, context=None):
    """
    翻譯服務
    - 優先查詢詞彙庫（1252 條專業術語）
    - 無匹配則調用 GPT-4o-mini
    - 附帶相關詞彙參考提升準確度
    """

def load_glossary():
    """載入成衣詞彙庫"""

def lookup_glossary(term):
    """精確查詢詞彙"""
```

**分類策略：**

```python
FILE_TYPES = [
    'tech_pack',   # 純 Tech Pack（含規格、圖片、說明）
    'bom_only',    # 純 BOM（物料清單）
    'mixed',       # 混合文件（Tech Pack + BOM）
    'other',       # 其他
]
```

**提取流程：**

```
PDF 上傳
    ↓
AI 分類（GPT-4o Vision）
    ↓ 判斷類型
├── tech_pack → 提取 DraftBlock（翻譯區塊）
├── bom_only  → 提取 BOMItem（物料項）
├── mixed     → 同時提取兩者
└── other     → 跳過或手動處理
```

**Celery 任務：**

```python
# tasks/_main.py
@shared_task
def classify_document_task(doc_id):
    """異步分類任務"""

@shared_task
def extract_document_task(doc_id):
    """異步提取任務"""
```

**API 端點：**

| 方法 | 端點 | 說明 |
|------|------|------|
| POST | `/api/v2/uploaded-documents/` | 上傳文件 |
| POST | `/api/v2/uploaded-documents/batch-upload/` | 批量上傳 ZIP |
| POST | `/api/v2/uploaded-documents/{id}/classify/` | AI 分類 |
| POST | `/api/v2/uploaded-documents/{id}/extract/` | AI 提取 |
| GET | `/api/v2/tasks/{task_id}/` | 查詢任務狀態 |
| GET/PATCH | `/api/v2/draft-blocks/{id}/` | 翻譯區塊 CRUD |
| POST | `/api/v2/revisions/{id}/approve/` | 批准 Revision |

### 4.5 samples 模組

**職責：** 樣衣管理、MWO 生成、狀態流轉

**Models：**

| Model | 說明 | 關聯 |
|-------|------|------|
| `SampleRequest` | 樣衣請求 | → Style, StyleRevision |
| `SampleRun` | 樣衣批次 | → SampleRequest |
| `RunBOMLine` | Run BOM 快照 | → SampleRun |
| `RunOperation` | Run 工序快照 | → SampleRun |
| `RunTechPackPage` | Run Tech Pack 快照 | → SampleRun |
| `RunTechPackBlock` | Run 區塊快照 | → RunTechPackPage |
| `SampleMWO` | 製造工單 | → SampleRun |
| `T2POForSample` | 樣衣採購單 | → SampleRun |
| `T2POLineForSample` | 採購單明細 | → T2POForSample |

**狀態機：**

```
SampleRun 狀態流轉：
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  DRAFT ──► SUBMITTED ──► QUOTED ──► PENDING_APPROVAL       │
│                                          │                  │
│                                  ┌───────┴───────┐          │
│                                  ▼               ▼          │
│                              APPROVED        REJECTED       │
│                                  │                          │
│                                  ▼                          │
│  APPROVED ──► MATERIALS ──► PO_ISSUED ──► IN_PRODUCTION    │
│                                                │            │
│                                                ▼            │
│                                           COMPLETED         │
│                                                             │
│  任何狀態 ──► CANCELLED                                     │
└─────────────────────────────────────────────────────────────┘
```

**核心服務：**

```python
# services/run_transitions.py
class RunTransitionService:
    """狀態轉換服務"""

    def precheck_transition(run, target_status):
        """預檢：驗證 BOM/Operations 是否完整"""

    def execute_transition(run, target_status):
        """執行狀態轉換"""

    def get_rollback_targets(run):
        """取得可回退狀態列表"""

    def rollback(run, target_status, reason):
        """回退到前一狀態"""

# services/mwo_complete_export.py
def export_mwo_complete_pdf(run):
    """
    完整 MWO PDF 匯出
    - 使用 Pillow 繪製中文
    - 使用 PyMuPDF 合併頁面
    - 字體：微軟雅黑
    """
```

**快照原則：**

```python
"""
核心原則：SampleRun 是唯一的「執行真相來源」

當創建 SampleRun 時：
1. BOMItem → RunBOMLine（複製，非 FK）
2. ConstructionStep → RunOperation（複製）
3. DraftBlock → RunTechPackBlock（複製）

目的：
- Run 資料不受後續修改影響
- 可追溯歷史版本
- 報價基於快照計算
"""
```

**API 端點：**

| 方法 | 端點 | 說明 |
|------|------|------|
| POST | `/api/v2/sample-requests/` | 創建樣衣請求 |
| POST | `/api/v2/sample-requests/{id}/create-next-run/` | 創建下一輪 Run |
| GET | `/api/v2/sample-runs/` | Run 列表 |
| GET | `/api/v2/kanban/runs/` | Kanban 列表 |
| POST | `/api/v2/sample-runs/{id}/precheck-transition/` | 轉換預檢 |
| POST | `/api/v2/sample-runs/{id}/{action}/` | 狀態轉換 |
| POST | `/api/v2/sample-runs/{id}/rollback/` | 回退狀態 |
| POST | `/api/v2/sample-runs/batch-transition/` | 批量轉換 |
| GET | `/api/v2/sample-runs/{id}/export-mwo-complete-pdf/` | MWO PDF |

### 4.6 costing 模組

**職責：** 報價計算、成本分析

**Models：**

| Model | 說明 | 關聯 |
|-------|------|------|
| `CostSheetVersion` | 報價單版本 | → SampleRun |
| `CostLineV2` | 報價明細行 | → CostSheetVersion |
| `UsageScenario` | 用量場景 | → StyleRevision |
| `UsageLine` | 用量明細 | → UsageScenario |

**成本計算公式：**

```python
"""
總成本 = 物料成本 + 人工成本 + 損耗

物料成本 = Σ (BOMItem.unit_price × consumption)
人工成本 = Σ (Operation.工時 × 單價)
損耗 = (物料成本 + 人工成本) × 損耗率
"""
```

**用量四階段管理：**

```
┌──────────────────────────────────────────────────────────┐
│ 階段 1: 估算用量（BOM 提取）                              │
│   └── BOMItem.consumption (AI 估算)                      │
│                                                          │
│ 階段 2: 確認用量（Spec 審核）                            │
│   └── UsageLine.confirmed_consumption (用戶確認)         │
│                                                          │
│ 階段 3: 快照用量（Run 創建）                             │
│   └── RunBOMLine.consumption (快照)                      │
│                                                          │
│ 階段 4: 實際用量（生產完成）                             │
│   └── RunBOMLine.actual_consumption (實際記錄)           │
└──────────────────────────────────────────────────────────┘
```

**API 端點：**

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/v2/cost-sheets-v2/{id}/` | 報價單詳情 |
| POST | `/api/v2/cost-sheets-v2/{id}/refresh-snapshot/` | 刷新快照 |
| GET/POST | `/api/v2/usage-scenarios/` | 用量場景 CRUD |

### 4.7 procurement 模組

**職責：** 供應商管理、物料主檔、採購單

**Models：**

| Model | 說明 | 關聯 |
|-------|------|------|
| `Supplier` | 供應商 | - |
| `Material` | 物料主檔 | → Supplier |
| `PurchaseOrder` | 採購單 | → Supplier |
| `POLine` | 採購單明細 | → PurchaseOrder, Material |

**PO 狀態流轉：**

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  draft ──► sent ──► confirmed ──► in_production            │
│                          │              │                   │
│                          │              ▼                   │
│                          │          shipped                 │
│                          │              │                   │
│                          └──────────────┼───► received      │
│                                         │                   │
│                    （可跳過中間狀態）     │                   │
│                                                             │
│  任何狀態（except received）──► cancelled                   │
└─────────────────────────────────────────────────────────────┘
```

**Email 發送服務：**

```python
# services/email_service.py
class POEmailService:
    """
    PO 郵件發送服務
    - HTML 模板
    - PDF 附件
    - 發送記錄追蹤
    """

    def send_po_to_supplier(po, recipient_email=None):
        """發送 PO 給供應商"""
```

**API 端點：**

| 方法 | 端點 | 說明 |
|------|------|------|
| GET/POST | `/api/v2/suppliers/` | 供應商 CRUD |
| GET/POST | `/api/v2/materials/` | 物料 CRUD |
| GET/POST | `/api/v2/purchase-orders/` | PO CRUD |
| POST | `/api/v2/purchase-orders/{id}/send/` | 發送 PO |
| POST | `/api/v2/purchase-orders/{id}/confirm/` | 確認 PO |
| POST | `/api/v2/purchase-orders/{id}/start_production/` | 開始生產 |
| POST | `/api/v2/purchase-orders/{id}/ship/` | 標記出貨 |
| POST | `/api/v2/purchase-orders/{id}/receive/` | 確認收貨 |
| GET | `/api/v2/purchase-orders/overdue/` | 逾期 PO 列表 |

### 4.8 orders 模組

**職責：** 大貨訂單管理、MRP 計算

**Models：**

| Model | 說明 | 關聯 |
|-------|------|------|
| `ProductionOrder` | 大貨訂單 | → Style |
| `MaterialRequirement` | 物料需求 | → ProductionOrder |

**MRP 計算邏輯：**

```python
def calculate_mrp(production_order):
    """
    MRP (Material Requirements Planning) 計算

    輸入：ProductionOrder（款號、數量、交期）
    輸出：MaterialRequirement 列表

    計算公式：
    需求量 = 訂單數量 × BOM用量 × (1 + 損耗率)

    結果按供應商拆分，生成 PurchaseOrder
    """
```

**API 端點：**

ㄏ
| 方法 | 端點 | 說明 |
|------|------|------|
| GET/POST | `/api/v2/production-orders/` | 大貨訂單 CRUD |
| POST | `/api/v2/production-orders/{id}/calculate_mrp/` | MRP 計算 |
| POST | `/api/v2/production-orders/{id}/generate_po/` | 生成 PO |

### 4.9 assistant 模組

**職責：** 小助理功能（指令式查詢、任務管理、通知）

**Models：**

| Model | 說明 |
|-------|------|
| `ChatMessage` | 對話訊息 |
| `AssistantTask` | 用戶任務 |
| `AssistantNote` | 用戶筆記 |
| `ReminderRule` | 提醒規則 |
| `Notification` | 系統通知 |

**支援指令：**

| 指令 | 功能 |
|------|------|
| `help` | 查看所有指令 |
| `overdue` | 顯示逾期樣衣 |
| `overdue po` | 顯示逾期 PO |
| `this week` | 顯示本週待辦 |
| `tasks` | 顯示任務清單 |
| `summary` | 顯示生產總覽 |
| `recent` | 顯示最近更新 |
| `pending po` | 顯示待處理 PO |
| `check [款號]` | 查詢款式狀態 |
| `add task [內容]` | 新增任務 |
| `add note [內容]` | 新增筆記 |
| `draft email [款號]` | 生成 PO 郵件草稿 |

**指令解析器：**

```python
# services/command_parser.py
class CommandParser:
    """指令解析器"""

    def parse(message):
        """解析用戶輸入，返回 (command, args)"""

    def execute(command, args):
        """執行指令，返回結果"""
```

**API 端點：**

| 方法 | 端點 | 說明 |
|------|------|------|
| POST | `/api/v2/assistant/chat/` | 發送訊息 |
| GET | `/api/v2/assistant/chat/history/` | 對話記錄 |
| DELETE | `/api/v2/assistant/chat/history/` | 清除記錄 |
| GET/POST | `/api/v2/assistant/tasks/` | 任務 CRUD |
| GET/POST | `/api/v2/assistant/notes/` | 筆記 CRUD |

---

## 5. 資料庫設計

### 5.1 ER 圖

```
┌─────────────────────────────────────────────────────────────┐
│                       Entity Relationship                    │
└─────────────────────────────────────────────────────────────┘

                    ┌───────────┐
                    │   Brand   │
                    └─────┬─────┘
                          │ 1:N
                          ▼
┌───────────┐       ┌───────────┐       ┌───────────────────┐
│ Supplier  │       │   Style   │       │ UploadedDocument  │
└─────┬─────┘       └─────┬─────┘       └─────────┬─────────┘
      │                   │ 1:N                   │
      │                   ▼                       │
      │             ┌───────────────┐             │
      │             │StyleRevision  │◄────────────┘
      │             └───────┬───────┘
      │                     │ 1:N
      │     ┌───────────────┼───────────────┐
      │     ▼               ▼               ▼
      │ ┌───────┐     ┌───────────┐   ┌─────────────┐
      │ │BOMItem│     │Measurement│   │Construction │
      │ └───────┘     └───────────┘   │    Step     │
      │                               └─────────────┘
      │
      │             ┌───────────────┐
      │             │SampleRequest  │
      │             └───────┬───────┘
      │                     │ 1:N
      │                     ▼
      │             ┌───────────────┐
      │             │  SampleRun    │──────────┐
      │             └───────┬───────┘          │
      │                     │                  │
      │     ┌───────────────┼──────────────────┼───────┐
      │     │               │                  │       │
      │     ▼               ▼                  ▼       ▼
      │ ┌────────┐    ┌──────────┐    ┌─────────┐ ┌────────┐
      │ │RunBOM  │    │RunOperat.│    │   MWO   │ │CostSheet│
      │ │ Line   │    │          │    │         │ │Version │
      │ └────────┘    └──────────┘    └─────────┘ └────────┘
      │
      │             ┌───────────────┐
      └────────────►│PurchaseOrder  │
                    └───────┬───────┘
                            │ 1:N
                            ▼
                    ┌───────────────┐
                    │   POLine      │
                    └───────────────┘

┌───────────────────────────────────────────────────────────┐
│                    Tech Pack 翻譯                          │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  UploadedDocument ──► Revision ──► RevisionPage          │
│                                        │                  │
│                                        ▼                  │
│                                   DraftBlock              │
│                                        │                  │
│                                        ▼                  │
│                               DraftBlockHistory           │
└───────────────────────────────────────────────────────────┘
```

### 5.2 核心表結構

#### 5.2.1 Style 相關

```sql
-- 品牌表
CREATE TABLE styles_brand (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20),
    organization_id UUID REFERENCES core_organization(id),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- 款式表
CREATE TABLE styles_style (
    id UUID PRIMARY KEY,
    style_number VARCHAR(100) NOT NULL,  -- 款號
    brand_id UUID REFERENCES styles_brand(id),
    season VARCHAR(20),                   -- 季節
    description TEXT,
    organization_id UUID REFERENCES core_organization(id),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- 款式版本表
CREATE TABLE styles_stylerevision (
    id UUID PRIMARY KEY,
    style_id UUID REFERENCES styles_style(id),
    version INTEGER DEFAULT 1,
    is_approved BOOLEAN DEFAULT FALSE,
    approved_at TIMESTAMP,
    approved_by VARCHAR(100),
    created_at TIMESTAMP
);

-- BOM 物料項表
CREATE TABLE styles_bomitem (
    id UUID PRIMARY KEY,
    style_revision_id UUID REFERENCES styles_stylerevision(id),
    material_name VARCHAR(200),
    material_name_zh VARCHAR(200),        -- 中文名稱
    material_code VARCHAR(50),
    color VARCHAR(100),
    specification VARCHAR(200),
    unit VARCHAR(20),
    unit_price DECIMAL(10,4),
    consumption DECIMAL(10,4),            -- 用量
    supplier_id UUID REFERENCES procurement_supplier(id),
    translation_status VARCHAR(20),       -- pending/confirmed
    sort_order INTEGER,
    created_at TIMESTAMP
);

-- 尺寸表
CREATE TABLE styles_measurement (
    id UUID PRIMARY KEY,
    style_revision_id UUID REFERENCES styles_stylerevision(id),
    measurement_point VARCHAR(100),       -- 量度點
    measurement_point_zh VARCHAR(100),    -- 中文
    size_values JSONB,                    -- {"S": 50, "M": 52, ...}
    tolerance VARCHAR(20),                -- 公差
    sort_order INTEGER
);
```

#### 5.2.2 Parsing 相關

```sql
-- 上傳文件表
CREATE TABLE parsing_uploadeddocument (
    id UUID PRIMARY KEY,
    file_name VARCHAR(255),
    file_path VARCHAR(500),
    file_size INTEGER,
    file_type VARCHAR(20),                -- tech_pack/bom_only/mixed
    classification_result JSONB,
    processing_status VARCHAR(20),        -- pending/processing/completed/failed
    style_id UUID REFERENCES styles_style(id),
    style_revision_id UUID REFERENCES styles_stylerevision(id),
    tech_pack_revision_id UUID REFERENCES parsing_revision(id),
    celery_task_id VARCHAR(255),          -- 異步任務 ID
    organization_id UUID,
    created_at TIMESTAMP
);

-- Tech Pack 版本表
CREATE TABLE parsing_revision (
    id UUID PRIMARY KEY,
    style_id UUID REFERENCES styles_style(id),
    version INTEGER,
    source_document_id UUID REFERENCES parsing_uploadeddocument(id),
    is_approved BOOLEAN DEFAULT FALSE,
    approved_at TIMESTAMP,
    created_at TIMESTAMP
);

-- 翻譯區塊表
CREATE TABLE parsing_draftblock (
    id UUID PRIMARY KEY,
    revision_page_id UUID REFERENCES parsing_revisionpage(id),
    block_type VARCHAR(50),               -- text/table/annotation
    original_text TEXT,                   -- 原文
    translated_text TEXT,                 -- 翻譯
    position_x FLOAT,
    position_y FLOAT,
    width FLOAT,
    height FLOAT,
    is_hidden BOOLEAN DEFAULT FALSE,
    translation_status VARCHAR(20),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

#### 5.2.3 Samples 相關

```sql
-- 樣衣請求表
CREATE TABLE samples_samplerequest (
    id UUID PRIMARY KEY,
    style_id UUID REFERENCES styles_style(id),
    style_revision_id UUID REFERENCES styles_stylerevision(id),
    request_date DATE,
    requested_by VARCHAR(100),
    notes TEXT,
    organization_id UUID,
    created_at TIMESTAMP
);

-- 樣衣批次表
CREATE TABLE samples_samplerun (
    id UUID PRIMARY KEY,
    sample_request_id UUID REFERENCES samples_samplerequest(id),
    run_no INTEGER DEFAULT 1,             -- 輪次編號
    run_type VARCHAR(20),                 -- fit/pp/prod
    status VARCHAR(30),                   -- 狀態
    quantity INTEGER,
    target_date DATE,
    start_date DATE,
    end_date DATE,
    notes TEXT,
    mwo_number VARCHAR(50) UNIQUE,        -- MWO 編號
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Run BOM 快照表
CREATE TABLE samples_runbomline (
    id UUID PRIMARY KEY,
    sample_run_id UUID REFERENCES samples_samplerun(id),
    source_bom_item_id UUID,              -- 來源 BOMItem
    material_name VARCHAR(200),
    material_name_zh VARCHAR(200),
    unit_price DECIMAL(10,4),
    consumption DECIMAL(10,4),            -- 快照用量
    actual_consumption DECIMAL(10,4),     -- 實際用量
    created_at TIMESTAMP
);

-- MWO 表
CREATE TABLE samples_samplemwo (
    id UUID PRIMARY KEY,
    sample_run_id UUID REFERENCES samples_samplerun(id) UNIQUE,
    mwo_number VARCHAR(50),
    generated_at TIMESTAMP,
    pdf_path VARCHAR(500)
);
```

#### 5.2.4 Procurement 相關

```sql
-- 供應商表
CREATE TABLE procurement_supplier (
    id UUID PRIMARY KEY,
    name VARCHAR(200),
    code VARCHAR(50),
    contact_person VARCHAR(100),
    email VARCHAR(254),
    phone VARCHAR(50),
    address TEXT,
    organization_id UUID,
    created_at TIMESTAMP
);

-- 採購單表
CREATE TABLE procurement_purchaseorder (
    id UUID PRIMARY KEY,
    po_number VARCHAR(50) UNIQUE,
    supplier_id UUID REFERENCES procurement_supplier(id),
    sample_run_id UUID REFERENCES samples_samplerun(id),
    status VARCHAR(20),                   -- draft/sent/confirmed/...
    total_amount DECIMAL(12,2),
    expected_delivery DATE,
    sent_at TIMESTAMP,
    sent_to_email VARCHAR(254),
    sent_count INTEGER DEFAULT 0,
    organization_id UUID,
    created_at TIMESTAMP
);

-- 採購單明細表
CREATE TABLE procurement_poline (
    id UUID PRIMARY KEY,
    purchase_order_id UUID REFERENCES procurement_purchaseorder(id),
    material_id UUID REFERENCES procurement_material(id),
    quantity DECIMAL(10,4),
    unit_price DECIMAL(10,4),
    line_total DECIMAL(12,2),
    expected_delivery DATE,
    delivery_status VARCHAR(20),
    received_quantity DECIMAL(10,4)
);
```

### 5.3 索引策略

```sql
-- 常用查詢索引
CREATE INDEX idx_style_style_number ON styles_style(style_number);
CREATE INDEX idx_style_brand ON styles_style(brand_id);
CREATE INDEX idx_style_organization ON styles_style(organization_id);

CREATE INDEX idx_samplerun_status ON samples_samplerun(status);
CREATE INDEX idx_samplerun_request ON samples_samplerun(sample_request_id);

CREATE INDEX idx_po_status ON procurement_purchaseorder(status);
CREATE INDEX idx_po_supplier ON procurement_purchaseorder(supplier_id);
CREATE INDEX idx_po_expected_delivery ON procurement_purchaseorder(expected_delivery);

CREATE INDEX idx_draftblock_revision_page ON parsing_draftblock(revision_page_id);
```

---

## 6. API 設計

### 6.1 API 規範

**Base URL:** `http://localhost:8000/api/v2/`

**認證方式:** JWT (JSON Web Token)

```
Authorization: Bearer <access_token>
```

**請求格式:** JSON

**回應格式:**

```json
// 成功回應
{
    "id": "uuid",
    "field": "value",
    ...
}

// 列表回應（分頁）
{
    "count": 100,
    "next": "http://localhost:8000/api/v2/resource/?page=2",
    "previous": null,
    "results": [...]
}

// 錯誤回應
{
    "error": "Error message",
    "detail": "Detailed description"
}
```

**HTTP 狀態碼:**

| 狀態碼 | 說明 |
|--------|------|
| 200 | 成功 |
| 201 | 創建成功 |
| 204 | 刪除成功（無內容）|
| 400 | 請求錯誤 |
| 401 | 未授權 |
| 403 | 禁止訪問 |
| 404 | 資源不存在 |
| 500 | 伺服器錯誤 |

### 6.2 核心 API 端點

#### 6.2.1 文件上傳與處理

```yaml
POST /api/v2/uploaded-documents/
  description: 上傳 PDF 文件
  request:
    content-type: multipart/form-data
    body:
      file: <binary>
      style_id: uuid (optional)
  response:
    201:
      id: uuid
      file_name: string
      processing_status: "pending"

POST /api/v2/uploaded-documents/{id}/classify/
  description: AI 分類
  query_params:
    async: boolean (default: false)
  response:
    200 (sync):
      classification_result:
        file_type: "tech_pack" | "bom_only" | "mixed"
        pages: [...]
    202 (async):
      task_id: string
      status: "pending"

POST /api/v2/uploaded-documents/{id}/extract/
  description: AI 提取內容
  query_params:
    async: boolean (default: false)
  response:
    200 (sync):
      style_revision_id: uuid
      tech_pack_revision_id: uuid
      bom_items_count: integer
      blocks_count: integer
    202 (async):
      task_id: string
      status: "pending"

GET /api/v2/tasks/{task_id}/
  description: 查詢 Celery 任務狀態
  response:
    200:
      task_id: string
      status: "PENDING" | "STARTED" | "SUCCESS" | "FAILURE"
      result: object (when SUCCESS)
      error: string (when FAILURE)
```

#### 6.2.2 樣衣管理

```yaml
POST /api/v2/sample-requests/
  description: 創建樣衣請求
  request:
    style_id: uuid
    style_revision_id: uuid
    request_date: date
    notes: string
  response:
    201:
      id: uuid
      ...

POST /api/v2/sample-requests/{id}/create-next-run/
  description: 創建下一輪 Run（多輪 Fit Sample）
  request:
    run_type: "fit" | "pp" | "prod" (optional)
    quantity: integer (optional)
    notes: string
  response:
    201:
      id: uuid
      run_no: integer
      mwo_number: string
      ...

GET /api/v2/kanban/runs/
  description: Kanban 看板數據
  response:
    200:
      results:
        - id: uuid
          style_number: string
          status: string
          run_type: string
          run_no: integer
          ...

POST /api/v2/sample-runs/{id}/precheck-transition/
  description: 狀態轉換預檢
  request:
    target_status: string
  response:
    200:
      can_transition: boolean
      missing_items:
        bom: ["Missing unit_price for item X"]
        operations: []
      warnings: []

POST /api/v2/sample-runs/{id}/{action}/
  description: 執行狀態轉換
  actions: submit, approve, reject, start_materials, ...
  response:
    200:
      id: uuid
      status: string (new status)

POST /api/v2/sample-runs/{id}/rollback/
  description: 回退狀態
  request:
    target_status: string
    reason: string
  response:
    200:
      id: uuid
      status: string
      rollback_reason: string

GET /api/v2/sample-runs/{id}/export-mwo-complete-pdf/
  description: 匯出完整 MWO PDF
  response:
    200:
      content-type: application/pdf
      content-disposition: attachment; filename="MWO-XXXX.pdf"
```

#### 6.2.3 採購管理

```yaml
POST /api/v2/purchase-orders/{id}/send/
  description: 發送 PO 給供應商
  request:
    email: string (optional, override supplier.email)
  response:
    200:
      id: uuid
      status: "sent"
      sent_at: datetime
      sent_to_email: string

GET /api/v2/purchase-orders/overdue/
  description: 逾期 PO 列表
  response:
    200:
      results:
        - id: uuid
          po_number: string
          supplier_name: string
          expected_delivery: date
          days_overdue: integer
          total_amount: decimal

POST /api/v2/purchase-orders/{id}/start_production/
  description: 標記開始生產
  response:
    200:
      status: "in_production"

POST /api/v2/purchase-orders/{id}/ship/
  description: 標記已出貨
  response:
    200:
      status: "shipped"
```

#### 6.2.4 健康檢查

```yaml
GET /api/v2/health/services/
  description: 服務健康檢查
  response:
    200:
      status: "healthy" | "degraded" | "unhealthy"
      database:
        status: "ok" | "error"
        message: string
      redis:
        status: "ok" | "error"
        message: string
      celery:
        status: "ok" | "error"
        message: string
      async_ready: boolean
      sync_available: boolean
```

### 6.3 錯誤回應格式

```json
// 驗證錯誤
{
    "error": "Validation Error",
    "detail": {
        "field_name": ["Error message 1", "Error message 2"]
    }
}

// 業務邏輯錯誤
{
    "error": "Cannot transition to APPROVED",
    "detail": "BOM items missing unit_price",
    "missing_items": ["Item A", "Item B"]
}

// 伺服器錯誤
{
    "error": "Internal Server Error",
    "detail": "An unexpected error occurred"
}
```

---

## 7. 使用者介面設計

### 7.1 頁面結構

```
┌─────────────────────────────────────────────────────────────┐
│ Dashboard                                                    │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────────────────────────────────────────┐ │
│ │         │ │                                             │ │
│ │ Sidebar │ │              Main Content                   │ │
│ │         │ │                                             │ │
│ │ - Progress│                                             │ │
│ │ - Upload │ │                                             │ │
│ │ - Docs   │ │                                             │ │
│ │ - BOM    │ │                                             │ │
│ │ - Spec   │ │                                             │ │
│ │ - Costing│ │                                             │ │
│ │ - Samples│ │                                             │ │
│ │ - Kanban │ │                                             │ │
│ │ - Sched. │ │                                             │ │
│ │ - Prod.  │ │                                             │ │
│ │ - PO     │ │                                             │ │
│ │ - Suppl. │ │                                             │ │
│ │ - Mater. │ │                                             │ │
│ └─────────┘ └─────────────────────────────────────────────┘ │
│                                               ┌───────────┐ │
│                                               │ Assistant │ │
│                                               │    ✨     │ │
│                                               └───────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 頁面清單

| 路徑 | 頁面 | 功能 |
|------|------|------|
| `/dashboard/progress` | 進度儀表板 | 總覽、統計、逾期提醒 |
| `/dashboard/upload` | 上傳 | 單筆 + 批量上傳 |
| `/dashboard/tech-packs` | 文件管理 | Tab: Tech Pack/BOM/Mixed/未分類/款式 |
| `/dashboard/documents/{id}/processing` | AI 處理 | 分類進度、計時器 |
| `/dashboard/documents/{id}/review` | 分類審查 | 確認分類結果 |
| `/dashboard/revisions/{id}/review` | 翻譯審校 | DraftBlock 編輯 |
| `/dashboard/revisions/{id}/bom` | BOM 編輯 | 物料表編輯 |
| `/dashboard/revisions/{id}/spec` | Spec 編輯 | 尺寸規格編輯 |
| `/dashboard/revisions/{id}/costing-phase23` | 報價 | 成本計算 |
| `/dashboard/samples/kanban` | Kanban | 看板、狀態轉換 |
| `/dashboard/scheduler` | 甘特圖 | 日期規劃、拖曳 |
| `/dashboard/production-orders` | 大貨訂單 | 訂單列表 |
| `/dashboard/purchase-orders` | 採購單 | PO 管理 |
| `/dashboard/suppliers` | 供應商 | 供應商管理 |
| `/dashboard/materials` | 物料 | 物料主檔 |

### 7.3 UI 元件庫

**基礎元件（shadcn/ui）：**
- Button, Input, Select, Checkbox
- Dialog, Sheet, Drawer
- Table, DataTable
- Card, Tabs
- Toast, Alert
- Form (react-hook-form + zod)

**自訂元件：**

| 元件 | 路徑 | 功能 |
|------|------|------|
| `Sidebar` | `components/layout/Sidebar.tsx` | 導航邊欄 |
| `MeasurementEditDrawer` | `components/measurement/` | Spec 編輯抽屜 |
| `TransitionPrecheckDialog` | `components/samples/` | 轉換預檢對話框 |
| `RollbackDialog` | `components/samples/` | 回退對話框 |
| `SendPOButton` | `components/procurement/` | PO 發送按鈕 |
| `AssistantButton` | `components/assistant/` | 小助理浮動按鈕 |
| `AssistantDialog` | `components/assistant/` | 小助理對話框 |

### 7.4 狀態管理

**TanStack Query（主要）：**

```typescript
// 使用範例
const { data, isLoading, error } = useQuery({
    queryKey: ['samples', 'kanban'],
    queryFn: () => fetchKanbanRuns()
});

const mutation = useMutation({
    mutationFn: (data) => transitionRun(runId, data),
    onSuccess: () => queryClient.invalidateQueries(['samples'])
});
```

**Custom Hooks：**

| Hook | 功能 |
|------|------|
| `useStyles` | 款式 CRUD |
| `useBom` | BOM 操作 |
| `useMeasurement` | Spec 操作 |
| `useSamples` | 樣衣操作 |
| `usePurchaseOrders` | PO 操作 |
| `useDraft` | DraftBlock 操作 |
| `useDraftBlockPosition` | 區塊位置拖曳 |

---

## 8. 安全設計

### 8.1 認證與授權

**認證方式：** JWT (JSON Web Token)

```python
# settings.py
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
}
```

**授權流程：**

```
1. 用戶登入 → POST /api/v2/auth/token/
2. 獲取 access_token + refresh_token
3. 請求時附帶 Authorization: Bearer <access_token>
4. Token 過期 → POST /api/v2/auth/token/refresh/
```

### 8.2 多租戶隔離

```python
# core/mixins.py
class OrganizationMixin(models.Model):
    """
    多租戶 Mixin
    - 自動綁定當前用戶的組織
    - 查詢自動過濾組織
    """
    organization = models.ForeignKey(
        'core.Organization',
        on_delete=models.CASCADE
    )

    class Meta:
        abstract = True

# views.py
class OrganizationFilterMixin:
    """
    ViewSet Mixin
    - 自動過濾當前用戶組織的資料
    """
    def get_queryset(self):
        return super().get_queryset().filter(
            organization=self.request.user.organization
        )
```

### 8.3 輸入驗證

```python
# serializers.py
class BOMItemSerializer(serializers.ModelSerializer):
    """
    輸入驗證：
    - 必填欄位
    - 數值範圍
    - 外鍵存在性
    """
    unit_price = serializers.DecimalField(
        max_digits=10,
        decimal_places=4,
        min_value=0
    )
    consumption = serializers.DecimalField(
        max_digits=10,
        decimal_places=4,
        min_value=0
    )

    def validate_material_name(self, value):
        if len(value) > 200:
            raise serializers.ValidationError("Material name too long")
        return value
```

### 8.4 CORS 配置

```python
# settings.py
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

CORS_ALLOW_CREDENTIALS = True
```

### 8.5 敏感資料保護

```python
# .env 環境變數
DJANGO_SECRET_KEY=<random-string>
OPENAI_API_KEY=<api-key>
EMAIL_HOST_PASSWORD=<email-password>

# settings.py
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')

# 不暴露在 API 回應中
class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        exclude = ['internal_notes', 'payment_terms']
```

---

## 9. 錯誤處理

### 9.1 後端錯誤處理

```python
# 自訂例外
class TransitionError(Exception):
    """狀態轉換錯誤"""
    def __init__(self, message, missing_items=None):
        self.message = message
        self.missing_items = missing_items or []

# views.py
class SampleRunViewSet(viewsets.ModelViewSet):
    def transition(self, request, pk, action):
        try:
            run = self.get_object()
            service = RunTransitionService()
            result = service.execute_transition(run, action)
            return Response(result)
        except TransitionError as e:
            return Response({
                'error': str(e),
                'missing_items': e.missing_items
            }, status=400)
        except Exception as e:
            logger.exception("Transition failed")
            return Response({
                'error': 'Internal Server Error'
            }, status=500)
```

### 9.2 前端錯誤處理

```typescript
// TanStack Query 全域錯誤處理
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            onError: (error) => {
                toast.error(error.message || 'An error occurred');
            }
        },
        mutations: {
            onError: (error) => {
                if (error.response?.status === 400) {
                    // 業務邏輯錯誤，顯示詳細訊息
                    toast.error(error.response.data.detail);
                } else {
                    toast.error('Operation failed');
                }
            }
        }
    }
});

// API 錯誤攔截
const apiClient = axios.create({
    baseURL: API_BASE_URL
});

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token 過期，重新登入
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);
```

### 9.3 Celery 任務錯誤處理

```python
# tasks/_main.py
@shared_task(bind=True, max_retries=3)
def extract_document_task(self, doc_id):
    """
    異步提取任務
    - 最多重試 3 次
    - 指數退避
    - 錯誤記錄到資料庫
    """
    try:
        doc = UploadedDocument.objects.get(id=doc_id)
        result = extraction_service.extract(doc)
        return {'status': 'success', 'result': result}
    except OpenAIError as e:
        # API 錯誤，重試
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))
    except Exception as e:
        # 其他錯誤，標記失敗
        doc.processing_status = 'failed'
        doc.error_message = str(e)
        doc.save()
        raise
```

### 9.4 日誌記錄

```python
# settings.py
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': 'logs/django.log',
            'formatter': 'verbose',
        },
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'apps': {
            'handlers': ['file', 'console'],
            'level': 'INFO',
            'propagate': True,
        },
    },
}

# 使用
import logging
logger = logging.getLogger(__name__)

logger.info(f"Processing document {doc.id}")
logger.error(f"Extraction failed: {e}", exc_info=True)
```

---

## 10. 附錄

### 10.1 環境變數

```env
# Django
DJANGO_SECRET_KEY=your-secret-key
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
DEFAULT_FROM_EMAIL=Fashion System <your-email@gmail.com>
```

### 10.2 開發環境設置

```bash
# 1. 克隆專案
git clone <repo-url>
cd fashion-production-system

# 2. 後端設置
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # 編輯 .env
python manage.py migrate
python manage.py createsuperuser

# 3. 前端設置
cd ../frontend
npm install

# 4. 啟動服務
# Terminal 1: Redis
redis-server

# Terminal 2: Celery
cd backend && celery -A config worker -l info --pool=solo

# Terminal 3: Django
cd backend && python manage.py runserver 8000

# Terminal 4: Next.js
cd frontend && npm run dev
```

### 10.3 程式碼規範

**Python (Backend):**
- PEP 8 風格指南
- 使用 Black 格式化
- 使用 isort 排序 imports
- Docstring: Google 風格

**TypeScript (Frontend):**
- ESLint + Prettier
- 使用 TypeScript strict mode
- 組件使用 PascalCase
- 函數使用 camelCase

### 10.4 版本歷史

| 版本 | 日期 | 變更 |
|------|------|------|
| 1.0 | 2026-01-29 | 初版 |

---

## 文檔資訊

| 項目 | 內容 |
|------|------|
| **文檔名稱** | Software Design Document (SDD) |
| **專案名稱** | Fashion Production System |
| **撰寫者** | Development Team |
| **審核者** | - |
| **最後更新** | 2026-01-29 |
