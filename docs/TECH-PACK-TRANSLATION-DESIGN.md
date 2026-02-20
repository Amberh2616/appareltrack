# Tech Pack Translation - Complete Technical Design

**設計者**: Claude Opus 4.5
**日期**: 2024-12-16
**狀態**: ✅ 設計完成，待實現
**優先級**: P0 (核心功能)

---

## 執行摘要

### 核心需求
- **輸入**: 英文 Tech Pack PDF (8頁，複雜圖文混合)
- **輸出**: 中文 Tech Pack PDF
- **關鍵要求**:
  - ✅ 圖片位置 100% 不變
  - ✅ 文字 100% 翻譯成中文
  - ✅ 保持原始排版
  - ✅ 使用服裝專業術語

### 推薦方案
**PDF 原生提取 + Claude 翻譯 + 精準重繪**

```
PyMuPDF 提取文字+座標
    ↓
Claude Sonnet 批次翻譯
    ↓
PyMuPDF 重建 PDF (圖片保留)
```

---

## 技術架構圖

```
┌─────────────────────────────────────────────────────────────┐
│                    完整處理流程                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tech Pack PDF (English)                                    │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────┐                                           │
│  │ PyMuPDF     │  • 提取文字 + 座標 + 字體資訊              │
│  │ (fitz)      │  • 提取圖片 + 座標                        │
│  │ pdfplumber  │  • 識別表格結構                           │
│  └──────┬──────┘                                           │
│         │                                                   │
│         ▼                                                   │
│  結構化數據                                                 │
│  ├── text_blocks: [{text, x0, y0, x1, y1, font...}]        │
│  ├── image_blocks: [{x0, y0, x1, y1, bytes...}]            │
│  └── tables: [{bbox, data, rows, cols...}]                 │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐                                           │
│  │ Claude API  │  • 批次翻譯文字區塊 (50個/次)             │
│  │ Sonnet 4    │  • 專業術語對照 (500+ terms)              │
│  │             │  • 表格智能翻譯                           │
│  └──────┬──────┘                                           │
│         │                                                   │
│         ▼                                                   │
│  翻譯後數據                                                 │
│  ├── translated_blocks: [{original, translated, bbox...}]  │
│  └── translated_tables: [{original_data, translated_data}] │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐                                           │
│  │ PyMuPDF     │  步驟：                                    │
│  │ 重建引擎    │  1. 複製原始頁面（圖片+背景）              │
│  │             │  2. 白色矩形覆蓋英文文字                   │
│  │             │  3. 在原座標插入中文文字                   │
│  │             │  4. 自動調整字體大小適應空間               │
│  └──────┬──────┘                                           │
│         │                                                   │
│         ▼                                                   │
│  Tech Pack PDF (Chinese) ✅                                 │
│  • 圖片位置完全不變                                         │
│  • 所有文字已翻譯                                           │
│  • 排版保持一致                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 方案對比分析

| 方案 | 優點 | 缺點 | 適用性 | 推薦度 |
|------|------|------|--------|--------|
| **PDF 原生提取** ⭐ | • 精確座標<br>• 字體資訊完整<br>• 速度快 | • 掃描件無法使用 | Tech Pack 通常是數位 PDF | ⭐⭐⭐⭐⭐ |
| OCR (PaddleOCR) | • 支援掃描件<br>• 中英混合 | • 座標誤差<br>• 需要訓練 | 備用方案 | ⭐⭐⭐☆☆ |
| OCR (Google Vision) | • 準確度高 | • 成本高<br>• 座標轉換複雜 | 複雜掃描件 | ⭐⭐⭐⭐☆ |
| GPT-4 Vision 直接 | • 理解圖文關係 | • 無精確座標 | 不適合 | ⭐☆☆☆☆ |

**結論**: 使用 PDF 原生提取，OCR 作為掃描件備用方案

---

## 核心技術組件

### 1. PDF 解析器 (TechPackParser)

```python
# backend/services/translation/pdf_parser.py

功能：
├── extract_text_blocks()      # 提取文字 + 座標 + 字體資訊
├── extract_images()            # 提取圖片 + 座標
├── extract_tables()            # 使用 pdfplumber 識別表格
└── classify_block()            # 分類區塊類型 (title/label/paragraph)

數據結構：
TextBlock {
    text: str           # 文字內容
    x0, y0, x1, y1      # 座標 (左上、右下)
    font_name: str      # 字體名稱
    font_size: float    # 字體大小
    color: RGB          # 顏色
    page_num: int       # 頁碼
    block_type: str     # 區塊類型
}

ImageBlock {
    x0, y0, x1, y1      # 座標
    page_num: int       # 頁碼
    image_bytes: bytes  # 圖片數據
    image_ext: str      # 圖片格式
}
```

### 2. 專業術語庫 (GarmentTerminology)

```python
# backend/services/translation/terminology.py

內容：
├── 車縫術語 (100+ terms)
│   ├── coverstitch → 雙面車
│   ├── bartack → 打棗
│   └── serge → 拷克
│
├── 面料術語 (80+ terms)
│   ├── Power Mesh → 強力網布
│   ├── Nulu Fabric → Nulu 裸感面料
│   └── Knit Elastic → 針織鬆緊帶
│
├── 部位術語 (100+ terms)
│   ├── neckline → 領口
│   ├── armhole → 袖籠
│   └── hem → 下擺
│
├── 輔料術語 (80+ terms)
│   ├── zipper → 拉鏈
│   ├── elastic → 鬆緊帶
│   └── binding → 滾邊
│
└── 品質術語 (40+ terms)
    ├── quality control → 品質管控
    ├── inspection → 驗貨
    └── tolerance → 公差

總計: 500+ 專業術語
```

### 3. AI 翻譯服務 (TechPackTranslator)

```python
# backend/services/translation/translator.py

功能：
├── translate_batch()          # 批次翻譯 (50個文字區塊/次)
├── translate_table()          # 專門處理表格翻譯
├── _call_translation_api()   # 調用 Claude API
└── _detect_context()         # 檢測上下文 (bom/spec/construction)

策略：
1. 優先使用術語庫 (精確匹配)
2. AI 翻譯 (使用術語上下文)
3. 批次處理 (降低 API 調用次數)
4. 保留數字、代號、品牌名
```

### 4. PDF 重建器 (TechPackRebuilder)

```python
# backend/services/translation/pdf_rebuilder.py

核心功能：
├── _copy_page_with_images_only()  # 複製頁面，僅保留圖片
│   ├── show_pdf_page() 完整複製
│   ├── 遍歷文字區塊
│   └── 白色矩形覆蓋文字
│
├── _insert_translated_text()      # 插入翻譯後文字
│   ├── 使用原座標
│   ├── 選擇中文字體 (china-ss)
│   └── 自動調整字體大小
│
├── _insert_translated_tables()    # 插入翻譯後表格
│   ├── 計算單元格大小
│   └── 逐格插入文字
│
└── _fit_text_to_width()           # 文字寬度自適應
    ├── 估算中英文字寬
    ├── 動態調整字體大小
    └── 必要時換行
```

### 5. 主流程整合 (TranslationPipeline)

```python
# backend/services/translation/pipeline.py

完整流程：
Step 1: 解析 PDF (TechPackParser)
    ├── 提取 text_blocks
    ├── 提取 image_blocks
    └── 提取 tables

Step 2: 翻譯文字 (TechPackTranslator)
    ├── 批次翻譯 text_blocks
    └── 翻譯 tables

Step 3: 重建 PDF (TechPackRebuilder)
    ├── 複製頁面 (保留圖片)
    ├── 覆蓋英文
    ├── 插入中文
    └── 儲存輸出

處理時間: 2-3 分鐘/文件
```

---

## 圖片位置不變的保證機制

### 核心原理

```
【關鍵技術】：區分文字區塊和圖片區塊

PyMuPDF 提取的 blocks 有兩種 type：
- type 0 = 文字區塊 (可以被覆蓋)
- type 1 = 圖片區塊 (不可被覆蓋)

處理步驟：
1. 使用 show_pdf_page() 完整複製原始頁面
   → 所有內容（圖片、背景、文字）都保留

2. 僅對 type 0 (文字區塊) 進行白色覆蓋
   → 圖片完全不受影響

3. 在原文字位置插入中文
   → 使用相同座標，圖片位置不變
```

### 視覺示意

```
原始頁面                   複製+覆蓋英文              插入中文
┌────────────────┐        ┌────────────────┐        ┌────────────────┐
│ [TEXT A]       │        │ [██████]       │        │ [文字A翻譯]    │
│ SOME TEXT HERE │        │ ████████████   │        │ 某些文字翻譯   │
│                │   →    │                │   →    │                │
│ ┌──────────┐   │        │ ┌──────────┐   │        │ ┌──────────┐   │
│ │  IMAGE   │   │        │ │  IMAGE   │   │        │ │  IMAGE   │   │
│ │  圖片保留 │   │        │ │  未被覆蓋 │   │        │ │  位置不變 │   │
│ └──────────┘   │        │ └──────────┘   │        │ └──────────┘   │
│                │        │                │        │                │
│ [TEXT B]       │        │ [██████]       │        │ [文字B翻譯]    │
└────────────────┘        └────────────────┘        └────────────────┘

type 0 文字            白色覆蓋 ████          中文替換 ✅
type 1 圖片            完全保留 ✅            完全保留 ✅
```

### 代碼實現

```python
def _copy_page_with_images_only(self, page_num: int) -> fitz.Page:
    """複製頁面，僅保留圖片"""

    original_page = self.original_pdf[page_num]
    new_page = self.output_pdf.new_page(width=rect.width, height=rect.height)

    # 1. 完整複製原始頁面
    new_page.show_pdf_page(new_page.rect, self.original_pdf, page_num)

    # 2. 獲取所有區塊
    blocks = original_page.get_text("dict")["blocks"]

    # 3. 僅覆蓋文字區塊 (type 0)
    for block in blocks:
        if block["type"] == 0:  # 文字區塊
            bbox = fitz.Rect(block["bbox"])
            new_page.draw_rect(bbox, color=(1,1,1), fill=(1,1,1))  # 白色覆蓋
        # type 1 (圖片) 不處理，自動保留

    return new_page
```

---

## 表格翻譯處理

### 表格類型識別

```python
def detect_table_type(table_data):
    """智能識別表格類型"""

    first_row = table_data[0]

    # BOM 表格
    if "item" in first_row or "material" in first_row:
        return "bom"

    # 尺寸表
    if "size" in first_row or "measurement" in first_row:
        return "measurement"

    # 工藝表
    if "process" in first_row or "operation" in first_row:
        return "process"

    return "general"
```

### 翻譯策略

| 表格類型 | 翻譯策略 | 保留內容 |
|---------|---------|---------|
| **BOM 表格** | 表頭翻譯<br>Description 翻譯 | 數量、單位、供應商代碼 |
| **尺寸表** | 測量點名稱翻譯 | 所有數字、尺碼標籤 |
| **工藝表** | 工序說明翻譯 | 工序編號、設備代碼 |
| **一般表格** | 全部翻譯 | 數字、代碼 |

---

## 專業術語處理

### 術語管理系統

```python
class TerminologyManager:
    """三層術語系統"""

    優先級：
    1. 客戶自訂術語 (最高優先)
    2. AI 學習術語 (出現 3 次以上)
    3. 基礎術語庫 (500+ terms)

    功能：
    ├── load_custom_terms()      # 載入客戶專用術語
    ├── add_learned_term()       # 從校正中學習
    ├── get_translation()        # 獲取翻譯
    └── export_prompt_context()  # 生成 AI 提示詞
```

### AI 提示詞範例

```
你是服裝行業專業翻譯。請使用以下標準術語：

【服裝專業術語對照表】
- coverstitch → 雙面車
- bartack → 打棗
- serge → 拷克
- Power Mesh → 強力網布
- Knit Elastic → 針織鬆緊帶
[... 500+ terms ...]

【翻譯規則】
1. 優先使用術語表中的翻譯
2. 品牌名、型號保持英文
3. 數字和單位保持原樣
4. 保持格式結構

【待翻譯內容】
[批次文字列表]
```

---

## 潛在問題與解決方案

### 問題 1: 掃描件 PDF

**問題**: 某些 Tech Pack 是掃描的紙本，無法提取原生文字

**檢測方法**:
```python
def is_scanned_pdf(pdf_path):
    total_text = extract_all_text(pdf_path)
    # 8頁 PDF，文字少於 500 字符 → 可能是掃描件
    return len(total_text) < 500
```

**解決方案**:
```
如果是掃描件：
├── 使用 PaddleOCR 進行文字識別
├── 獲取文字 + bbox 座標
├── 後處理座標對齊
└── 繼續翻譯流程
```

### 問題 2: 中英文字寬差異

**問題**:
- "Coverstitch" (11字符) → "雙面車" (3字符)
- "Hem" (3字符) → "下擺摺邊" (4字符)

**解決方案**:
```python
def adjust_text_for_space(text, available_width, font_size):
    """動態調整文字以適應空間"""

    # 1. 估算文字寬度
    estimated_width = calculate_width(text, font_size)

    # 2. 如果超過寬度，縮小字體
    while estimated_width > available_width and font_size > 6:
        font_size -= 0.5
        estimated_width = calculate_width(text, font_size)

    return text, font_size
```

### 問題 3: 特殊格式保持

**問題**: 粗體、斜體、下劃線等格式

**解決方案**:
```python
# 提取時記錄格式
flags = span.get("flags", 0)
is_bold = bool(flags & 2**4)
is_italic = bool(flags & 2**1)

# 重建時應用格式
if is_bold:
    page.insert_text(..., fontname="china-ss-bold")
```

### 問題 4: 複雜圖文標註

**問題**: 圖片上的標註線和標註文字

**策略**:
- 極短標註 (如 "A", "1") 不翻譯
- 必要時使用括號: "A (前片)"
- 保持標註在原位置

### 問題 5: 字體嵌入問題

**問題**: 中文字體顯示為方框

**解決方案**:
```python
# 使用 PyMuPDF 內建中文字體
CHINESE_FONTS = [
    "china-s",    # 思源宋體 (細體)
    "china-ss",   # 思源黑體 (粗體) ← 推薦
    "china-t",    # 繁體宋體
    "china-ts",   # 繁體黑體
]

# 或嵌入自訂字體
page.insert_font(fontname="CustomFont", fontfile="/path/to/font.ttf")
```

---

## 成本分析

### 單個 Tech Pack 成本

**假設條件**:
- 8 頁 Tech Pack
- 每頁約 500 個英文單詞
- 總計約 20,000 字符輸入，30,000 字符輸出

| AI 模型 | 輸入成本 | 輸出成本 | 總成本/檔 |
|---------|---------|---------|-----------|
| **Claude Sonnet** ⭐ | $0.06 | $0.45 | **$0.51** |
| Claude Opus 4.5 | $0.30 | $2.25 | $2.55 |
| GPT-4o | $0.05 | $0.30 | $0.35 |
| GPT-4o Mini | $0.003 | $0.018 | $0.02 |

### 月度成本估算

**假設每月處理 50 個 Tech Pack**:

```
┌──────────────────┬────────────┬────────────┬────────────┐
│ 模型             │ 單價       │ 50個/月    │ 年度成本   │
├──────────────────┼────────────┼────────────┼────────────┤
│ GPT-4o Mini     │ $0.02      │ $1         │ $12        │
│ GPT-4o          │ $0.35      │ $17.50     │ $210       │
│ Claude Sonnet   │ $0.51      │ $25.50     │ $306       │ ⭐
│ Claude Opus     │ $2.55      │ $127.50    │ $1,530     │
└──────────────────┴────────────┴────────────┴────────────┘
```

### 完整月度成本

```
AI 翻譯成本（Claude Sonnet, 50檔）    $25.50
基礎設施成本（VPS + 儲存）            $35.00
────────────────────────────────────────────
月度總成本                            $60.50

對比人工翻譯：
├── 專業翻譯: $400/檔 × 50 = $20,000/月
└── AI 節省: 99.7% ⭐⭐⭐⭐⭐
```

### 推薦策略

```
【混合策略 - 平衡品質與成本】

一般文件:  Claude Sonnet    $0.51/檔  ⭐⭐⭐⭐⭐
重要文件:  Claude Opus      $2.55/檔  ⭐⭐⭐⭐⭐
大量處理:  GPT-4o Mini      $0.02/檔  ⭐⭐⭐☆☆ + 人工校對

月處理 50 檔，建議分配：
├── 40 檔 Claude Sonnet  = $20.40
├── 5 檔 Claude Opus     = $12.75
└── 5 檔 GPT-4o Mini     = $0.10
總計: $33.25/月
```

---

## 實施計畫

### Phase 1: 基礎功能（1 週）

```
Day 1-2: PDF 解析器
├── TechPackParser 類實現
├── extract_text_blocks()
├── extract_images()
├── extract_tables()
└── 測試 5 個樣本 Tech Pack

Day 3-4: 翻譯服務
├── GarmentTerminology 術語庫 (500+ terms)
├── TechPackTranslator 類實現
├── Claude API 整合
└── 批次翻譯測試

Day 5-7: PDF 重建
├── TechPackRebuilder 類實現
├── _copy_page_with_images_only()
├── _insert_translated_text()
└── 完整流程測試

交付物：
✅ 可翻譯單個 Tech Pack
✅ 圖片位置保持不變
✅ 基本專業術語支持
```

### Phase 2: 專業化（1 週）

```
Day 1-2: 術語庫完善
├── 補充到 500+ 術語
├── 客戶自訂術語支持
└── 術語學習機制

Day 3-4: 表格處理優化
├── 表格類型識別
├── BOM 表格專門處理
├── 尺寸表專門處理
└── 工藝表專門處理

Day 5-7: 字體和排版調整
├── 中文字體選擇
├── 字體大小自適應
├── 文字寬度計算
└── 測試 20 個樣本

交付物：
✅ 專業術語翻譯準確
✅ 表格翻譯正確
✅ 排版美觀
```

### Phase 3: 優化和部署（1 週）

```
Day 1-2: 掃描件 OCR 支持
├── 掃描件檢測
├── PaddleOCR 整合
└── OCR 結果後處理

Day 3-4: 批次處理
├── Celery 異步任務
├── 進度追蹤
└── 錯誤處理

Day 5-7: 生產環境部署
├── Django API 整合
├── 前端上傳下載 UI
├── 性能優化
└── 監控和日誌

交付物：
✅ 完整系統上線
✅ 支援批次處理
✅ 生產環境穩定
```

---

## 文件結構

```
backend/services/translation/
├── __init__.py
├── pdf_parser.py                 # PDF 解析器
│   └── class TechPackParser
├── terminology.py                # 術語庫
│   ├── class GarmentTerminology
│   └── class TerminologyManager
├── translator.py                 # AI 翻譯服務
│   └── class TechPackTranslator
├── pdf_rebuilder.py             # PDF 重建器
│   └── class TechPackRebuilder
├── pipeline.py                   # 主流程
│   ├── class TranslationPipeline
│   └── @celery_task translate_techpack_async()
└── ocr_fallback.py              # OCR 備用方案
    └── class OCRProcessor

backend/data/
└── fashion_terms.json            # 術語資料庫 (500+ terms)

backend/apps/techpack/
├── models.py
│   └── class TranslationJob      # 翻譯任務模型
├── views.py
│   └── POST /api/techpacks/{id}/translate/
└── serializers.py

frontend/components/techpack/
├── TranslationButton.tsx         # 翻譯按鈕
├── TranslationProgress.tsx       # 進度顯示
└── TranslatedPDFViewer.tsx      # 中文 PDF 預覽
```

---

## API 設計

### Django REST API

```python
# POST /api/techpacks/{id}/translate/
{
  "target_language": "zh-TW",      # zh-TW / zh-CN
  "quality": "standard",           # standard / high / economy
  "custom_terms": {                # 可選：客戶自訂術語
    "Brand Name": "品牌名稱"
  }
}

# Response
{
  "task_id": "uuid",
  "status": "processing",
  "estimated_time": 180            # 秒
}

# GET /api/translation-jobs/{task_id}/
{
  "id": "uuid",
  "status": "completed",           # processing / completed / failed
  "progress": 100,
  "original_pdf": "/media/...",
  "translated_pdf": "/media/...",
  "cost": 0.51,
  "created_at": "2024-12-16T10:00:00Z",
  "completed_at": "2024-12-16T10:03:00Z"
}
```

---

## 測試計畫

### 單元測試

```python
# tests/test_pdf_parser.py
def test_extract_text_blocks():
    """測試文字提取"""
    parser = TechPackParser("sample.pdf")
    blocks = parser.extract_text_blocks(page_num=0)
    assert len(blocks) > 0
    assert all('text' in b for b in blocks)
    assert all('bbox' in b for b in blocks)

# tests/test_translator.py
def test_translate_batch():
    """測試批次翻譯"""
    translator = TechPackTranslator()
    blocks = [{"text": "Coverstitch", "block_type": "construction"}]
    result = translator.translate_batch(blocks)
    assert result[0]["text"] == "雙面車"

# tests/test_terminology.py
def test_terminology_lookup():
    """測試術語查詢"""
    term = GarmentTerminology.get_translation("bartack")
    assert term == "打棗"
```

### 集成測試

```python
# tests/test_pipeline.py
def test_full_translation():
    """測試完整翻譯流程"""
    pipeline = TranslationPipeline()
    result = pipeline.process(
        input_pdf="tests/samples/LW1FLPS.pdf",
        output_dir="tests/output/"
    )

    assert result["status"] == "completed"
    assert os.path.exists(result["output_path"])
    assert result["cost"] < 1.0  # 成本合理
```

### 品質測試

```
測試案例：
├── 標準 Tech Pack (8頁, 圖文混合)
├── 複雜表格 Tech Pack (大量 BOM)
├── 高密度文字 Tech Pack
├── 掃描件 Tech Pack
└── 手繪標註 Tech Pack

評估標準：
├── 圖片位置準確度: 100%
├── 文字翻譯完整度: 100%
├── 專業術語準確度: >95%
├── 排版美觀度: >90%
└── 處理速度: <3分鐘
```

---

## 監控和維護

### 關鍵指標

```
性能指標：
├── 平均處理時間: 目標 <3分鐘
├── API 成功率: 目標 >99%
├── 翻譯準確率: 目標 >95%
└── 成本控制: 目標 <$1/檔

錯誤追蹤：
├── PDF 解析失敗率
├── AI API 調用失敗率
├── PDF 生成失敗率
└── 使用者回報問題
```

### 日誌記錄

```python
# 記錄所有關鍵步驟
logger.info(f"[TRANSLATION] Started: {techpack_id}")
logger.info(f"[PARSE] Extracted {len(blocks)} text blocks")
logger.info(f"[TRANSLATE] Cost: ${cost:.2f}")
logger.info(f"[REBUILD] Output saved: {output_path}")
logger.info(f"[TRANSLATION] Completed in {elapsed}s")
```

---

## 未來優化方向

### 短期優化 (1-3 個月)

```
1. 多語言支持
   ├── 英文 → 繁體中文 ✅
   ├── 英文 → 簡體中文
   ├── 英文 → 日文
   └── 英文 → 韓文

2. 翻譯記憶庫 (Translation Memory)
   ├── 記錄已翻譯片段
   ├── 自動重用相同內容
   └── 降低 API 成本

3. 人工校對接口
   ├── 標記低信心度區塊
   ├── 支援線上修改
   └── 從修改中學習
```

### 長期優化 (3-12 個月)

```
1. AI 模型微調
   ├── 收集 10,000+ 專業句對
   ├── 微調專用翻譯模型
   └── 提升專業準確度

2. 多模態理解
   ├── 圖文關係理解
   ├── 自動識別標註指向
   └── 智能調整文字位置

3. 批次優化
   ├── 相似 Tech Pack 模板識別
   ├── 批次處理加速
   └── 成本進一步降低 50%
```

---

## 關鍵決策記錄

| 決策點 | 選擇 | 理由 |
|--------|------|------|
| PDF 處理方式 | 原生提取 > OCR | 座標精確、速度快 |
| AI 翻譯模型 | Claude Sonnet | 品質與成本平衡 |
| PDF 重建策略 | PyMuPDF 覆蓋+插入 | 圖片位置完全保持 |
| 術語管理 | 三層優先級 | 靈活且可學習 |
| 表格處理 | 類型識別+專門策略 | 提升準確度 |
| 字體選擇 | PyMuPDF 內建字體 | 跨平台兼容 |
| 批次大小 | 50 個文字區塊/次 | 平衡速度與成本 |

---

## 附錄

### A. 完整術語庫示例

```json
{
  "coverstitch": "雙面車",
  "bartack": "打棗",
  "serge": "拷克",
  "topstitch": "壓線",
  "binding": "滾邊",
  "Power Mesh": "強力網布",
  "Nulu Fabric": "Nulu 裸感面料",
  "Knit Elastic": "針織鬆緊帶",
  "neckline": "領口",
  "armhole": "袖籠",
  "hem": "下擺",
  "quality control": "品質管控",
  "inspection": "驗貨",
  "tolerance": "公差"
}
```

### B. 完整處理流程範例

```python
# 使用範例
from services.translation import TranslationPipeline

pipeline = TranslationPipeline()
result = pipeline.process(
    input_pdf_path="path/to/LW1FLPS_TechPack.pdf",
    output_dir="path/to/output/"
)

# 結果
{
    "status": "completed",
    "total_pages": 8,
    "translated_blocks": 156,
    "cost": 0.51,
    "time_elapsed": 145.2,
    "output_path": "path/to/output/LW1FLPS_TechPack_zh.pdf"
}
```

### C. 參考資源

- [PyMuPDF 文檔](https://pymupdf.readthedocs.io/)
- [pdfplumber 文檔](https://github.com/jsvine/pdfplumber)
- [Claude API 文檔](https://docs.anthropic.com/)
- [PaddleOCR 文檔](https://github.com/PaddlePaddle/PaddleOCR)

---

**文檔版本**: 1.0
**最後更新**: 2024-12-16
**設計審查**: Opus 4.5 ✅
**實施狀態**: 待開發
**預計開發時間**: 3 週
**預計成本**: $0.51/檔 (Claude Sonnet)

---

## 下一步行動

1. ✅ 技術方案已設計完成
2. ⏳ 等待實施決策
3. ⏳ 準備開發環境
4. ⏳ 建立術語資料庫
5. ⏳ 開始 Phase 1 開發
