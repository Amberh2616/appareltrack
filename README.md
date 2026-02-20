# ApparelTrack

**AI-Augmented PLM + ERP Lite for Fashion Manufacturing**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![Django](https://img.shields.io/badge/Django-4.2-green)](https://www.djangoproject.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)

---

## 專案概述

一個專為**一個人管理 300 款外銷跟單**設計的智能生產管理系統。

透過 AI 自動化處理從 Tech Pack 解析到製造單生成的完整流程，將原本需要 10 個人的工作量壓縮成 1 個人可控的系統。

### 核心價值

```
傳統方式：                    AI 系統：
├─ 1 人最多管 50 款           ├─ 1 人可管 300 款 ✅
├─ Tech Pack 手動輸入 2hr/款  ├─ Tech Pack 自動解析 5min/款 ✅
├─ Email 處理佔 30% 時間      ├─ 70-80% 工作自動化 ✅
└─ 累到爆... 😫               └─ 節省 $2300/月 人力成本 ✅
```

---

## 快速開始

### 前置需求

- Node.js >= 18.x
- Python >= 3.11
- Redis >= 7.x (可選，用於異步處理)

### 安裝與運行

```bash
# 1. 克隆專案
git clone https://github.com/Amberh2616/appareltrack.git
cd appareltrack

# 2. 啟動後端 (Django)
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux
pip install -e .
python manage.py migrate
python manage.py runserver 8000

# 3. 啟動前端 (Next.js) - 開新終端
cd frontend
npm install
npm run dev

# 4. (可選) 啟動異步處理服務
redis-server                                      # 啟動 Redis
celery -A config worker -l info --pool=solo      # 啟動 Celery Worker
```

### 服務地址

| 服務 | URL |
|------|-----|
| 前端 | http://localhost:3000 |
| 後端 API | http://localhost:8000/api/v2/ |
| Admin | http://localhost:8000/admin/ |
| 健康檢查 | http://localhost:8000/api/v2/health/services/ |

---

## 技術架構

```
┌─────────────────────────────────────────────────┐
│     Next.js 14 Frontend (TypeScript)            │
│  - Document Upload & AI Processing              │
│  - Draft Review Dashboard                       │
│  - Kanban Board & Scheduler                     │
│  - BOM / Spec / Costing Editor                  │
└─────────────────┬───────────────────────────────┘
                  │ REST API
┌─────────────────┴───────────────────────────────┐
│     Django 4.2 Backend + DRF                    │
│  - OpenAI GPT-4o Vision (AI 解析)               │
│  - PyMuPDF + Pillow (PDF 處理)                  │
│  - Celery + Redis (異步任務)                    │
│  - SQLite (開發) / PostgreSQL (生產)            │
└─────────────────────────────────────────────────┘
```

### 技術棧

**前端**
- Next.js 14 (App Router)
- TypeScript
- shadcn/ui + Tailwind CSS
- TanStack Query / Table
- react-pdf

**後端**
- Django 4.2 + Django REST Framework
- OpenAI GPT-4o Vision
- PyMuPDF + Pillow (PDF/圖片處理)
- Celery + Redis (異步處理)
- 成衣詞彙庫 (1252 條專業術語)

---

## 核心功能

### AI 自動化核心

#### 1. Tech Pack 智能解析
```
上傳 PDF → AI 分類頁面 → 提取 BOM/Spec/Construction → 翻譯 → 審核
```
- **準確率**：90%+（經人工審核後 99%+）
- **速度**：3-5 分鐘 vs 傳統 2 小時
- **支援格式**：PDF（含掃描件）

#### 2. BOM 表智能提取
- 自動識別物料清單
- 中英文翻譯（整合成衣詞彙庫）
- 用量四階段管理（AI → 驗證 → 實際 → 當前）

#### 3. 製造單 (MWO) 自動生成
- Tech Pack 翻譯疊加
- BOM + Spec + Operations
- 一鍵匯出 PDF

#### 4. 採購單自動生成
- 按供應商拆分
- MRP 物料需求計算
- Email 發送功能

### 完整功能列表

| 模組 | 功能 |
|------|------|
| **文件管理** | 上傳、AI 分類、批量處理 |
| **Tech Pack** | 翻譯框拖曳編輯、批量翻譯 |
| **BOM** | 自動提取、翻譯、驗證 |
| **Spec** | 尺寸規格管理 |
| **Costing** | 報價單生成 |
| **Samples** | 樣衣管理、Kanban 看板 |
| **Scheduler** | 甘特圖排程 |
| **Production** | 大貨訂單、MRP 計算 |
| **Procurement** | 採購單、供應商管理 |
| **Assistant** | 小助理（指令式對話）|

---

## 頁面導航

```
Dashboard
├── Progress              # 進度追蹤儀表板
├── Upload                # 單筆 + 批量上傳
├── Documents             # 文件管理（AI 分類 Tab）
│   ├── Tech Pack Tab
│   ├── BOM Tab
│   ├── Mixed Tab
│   └── 款式 Tab
├── BOM                   # 物料表
├── Spec                  # 尺寸規格
├── Costing               # 報價
├── Samples               # 樣衣列表
├── Kanban                # 看板視圖
├── Scheduler             # 甘特圖
├── Production            # 大貨訂單
├── Purchase Orders       # 採購單
├── Suppliers             # 供應商
└── Materials             # 物料主檔
```

---

## 專案結構

```
appareltrack/
├── frontend/                 # Next.js 前端
│   ├── app/                  # App Router 頁面
│   ├── components/           # React 組件
│   ├── lib/                  # API + Hooks + Types
│   └── public/               # 靜態資源
│
├── backend/                  # Django 後端
│   ├── config/               # Django 設定 + Celery
│   ├── apps/
│   │   ├── core/             # 健康檢查
│   │   ├── styles/           # Style, Revision
│   │   ├── documents/        # Document 管理
│   │   ├── parsing/          # AI 解析 + 翻譯
│   │   ├── costing/          # 報價單
│   │   ├── samples/          # 樣衣管理
│   │   ├── procurement/      # 採購單
│   │   ├── orders/           # 大貨訂單
│   │   └── assistant/        # 小助理
│   └── demo_data/            # 測試資料
│
├── docs/                     # 文檔
│   ├── PROGRESS-CHANGELOG.md # 開發進度記錄
│   ├── SYSTEM-ACCEPTANCE-REPORT.md
│   └── BUSINESS-FLOW.md
│
├── CLAUDE.md                 # Claude 專案記憶
└── README.md                 # 本檔案
```

---

## 環境變數

### 後端 (.env)

```env
# OpenAI
OPENAI_API_KEY=sk-xxx

# Database (生產環境)
DATABASE_URL=postgres://user:pass@host:5432/dbname

# Celery
CELERY_BROKER_URL=redis://localhost:6379/0

# Email (可選)
EMAIL_HOST=smtp.gmail.com
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=app-password
```

### 前端 (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v2
```

---

## 開發指令

```bash
# 後端
cd backend
python manage.py runserver 8000          # 開發伺服器
python manage.py migrate                  # 資料庫遷移
pytest                                    # 測試

# 前端
cd frontend
npm run dev                               # 開發伺服器
npm run build                             # 生產建置
npm run type-check                        # TypeScript 檢查
npm run lint                              # ESLint

# Celery (異步處理)
redis-server                              # 啟動 Redis
celery -A config worker -l info --pool=solo  # 啟動 Worker
```

---

## 版本記錄

| 版本 | 日期 | 重點功能 |
|------|------|----------|
| v4.39 | 2026-01-24 | 詞彙庫修正 + Tech Pack 提取修復 |
| v4.38 | 2026-01-22 | 成衣詞彙庫整合 (1252 條術語) |
| v4.37 | 2026-01-21 | Celery 異步處理 + 採購優化 |
| v4.36 | 2026-01-20 | Kanban 四大改善 + 小助理 |

詳細記錄請參見 [PROGRESS-CHANGELOG.md](docs/PROGRESS-CHANGELOG.md)

---

## 文檔導航

| 文檔 | 說明 |
|------|------|
| [CLAUDE.md](./CLAUDE.md) | **Claude 專案記憶** - 完整專案資訊 |
| [PROGRESS-CHANGELOG.md](./docs/PROGRESS-CHANGELOG.md) | 開發進度詳細記錄 |
| [SYSTEM-ACCEPTANCE-REPORT.md](./docs/SYSTEM-ACCEPTANCE-REPORT.md) | 系統驗收報告 |
| [BUSINESS-FLOW.md](./docs/BUSINESS-FLOW.md) | 業務流程說明 |

---

## 授權

本專案採用 MIT 授權 - 詳見 [LICENSE](LICENSE) 文件。

---

<div align="center">
  <p>
    <sub>Built with ❤️ for Fashion Merchandisers</sub>
  </p>
</div>
