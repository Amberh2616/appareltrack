# 完整流程：上傳 → AI 解析 → 驗證 → 下 Sample Request

**日期：** 2026-01-05
**優先級：** P4 高優先級
**工時估計：** 2-3 天
**目標：** 一個頁面搞定所有上傳、解析、驗證流程

---

## 🎯 核心目標

```
用戶體驗：
1. 拖曳上傳任意檔案（PDF / Excel）
2. AI 自動判斷內容類型 + 智能頁碼偵測
3. AI 自動提取 Tech Pack + BOM + Measurement
4. 人工驗證 AI 解析結果
5. 點擊按鈕下 Sample Request
```

**關鍵原則：**
- ✅ 混合檔案支援（一個 PDF 包含 Tech Pack + BOM + Measurement）
- ✅ AI 智能判斷（不需要人工標記頁碼）
- ✅ 人工驗證（AI 可能出錯，必須檢查）
- ✅ 降級友善（AI 判斷失敗時，可手動指定）

---

## 📊 完整資料流程

```
┌─────────────────────────────────────────────────────────────────┐
│                     Step 1: 上傳檔案                             │
├─────────────────────────────────────────────────────────────────┤
│  前端：/dashboard/upload (新建)                                  │
│  操作：拖曳 PDF/Excel → 上傳到後端                               │
│  API：POST /api/v2/documents/upload/                            │
│  ├─ 接收檔案                                                     │
│  ├─ 儲存到 media/uploads/                                       │
│  └─ 創建 UploadedDocument 記錄                                  │
└─────────────────────────────────────────────────────────────────┘
         ⬇️
┌─────────────────────────────────────────────────────────────────┐
│              Step 2: AI 檔案分類（智能頁碼偵測）                 │
├─────────────────────────────────────────────────────────────────┤
│  觸發：上傳完成後自動執行                                        │
│  服務：apps/parsing/services/file_classifier.py                 │
│  AI：GPT-4o Vision API                                          │
│  ├─ 掃描前 5 頁（或全部頁面）                                   │
│  ├─ 判斷每一頁的內容類型：                                      │
│  │   ├─ tech_pack（構造圖 + 標註）                             │
│  │   ├─ bom_table（物料清單表格）                              │
│  │   ├─ measurement_table（尺寸表）                            │
│  │   └─ other（封面、備註等）                                  │
│  └─ 輸出：分類結果 JSON                                         │
│                                                                  │
│  輸出範例：                                                      │
│  {                                                               │
│    "file_type": "mixed",                                        │
│    "pages": [                                                    │
│      {"page": 1, "type": "tech_pack", "confidence": 0.95},     │
│      {"page": 2, "type": "measurement_table", "confidence": 0.98},│
│      {"page": 3, "type": "bom_table", "confidence": 0.92},     │
│      ...                                                         │
│    ]                                                             │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
         ⬇️
┌─────────────────────────────────────────────────────────────────┐
│              Step 3: AI 內容提取（並行執行）                     │
├─────────────────────────────────────────────────────────────────┤
│  觸發：分類完成後自動執行（3 個任務並行）                        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 3.1 Tech Pack 標註提取                                   │  │
│  │ ────────────────────────────────────────────────────────│  │
│  │ 服務：apps/parsing/utils/vision_extract.py (已有)       │  │
│  │ 輸入：Tech Pack 頁面（Page 1, 19-30）                  │  │
│  │ AI：GPT-4o Vision                                       │  │
│  │ 輸出：DraftBlock 記錄（標註 + 翻譯）                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 3.2 BOM 表格提取                                         │  │
│  │ ────────────────────────────────────────────────────────│  │
│  │ 服務：apps/parsing/services/bom_extractor.py (新建)     │  │
│  │ 輸入：BOM 頁面（Page 3-11）                            │  │
│  │ 方法：pdfplumber 表格提取 + GPT-4o 結構化              │  │
│  │ 輸出：BOMItem 記錄（is_verified=False, 待驗證）        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 3.3 Measurement 表格提取 ⭐ 新功能                      │  │
│  │ ────────────────────────────────────────────────────────│  │
│  │ 服務：apps/parsing/services/measurement_extractor.py    │  │
│  │ 輸入：Measurement 頁面（Page 2）                       │  │
│  │ AI：GPT-4o Vision 表格識別                             │  │
│  │ Prompt：                                                 │  │
│  │   "提取尺寸表，包含：                                   │  │
│  │    - 測量點名稱（Chest Width, Body Length...）        │  │
│  │    - 尺碼值（XS, S, M, L, XL, XXL）                   │  │
│  │    - 公差（Tolerance）                                 │  │
│  │    返回 JSON 格式"                                      │  │
│  │ 輸出：Measurement 記錄（is_verified=False, 待驗證）    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         ⬇️
┌─────────────────────────────────────────────────────────────────┐
│                   Step 4: 驗證頁面（人工檢查）                   │
├─────────────────────────────────────────────────────────────────┤
│  前端：/dashboard/documents/{id}/review (新建)                   │
│  顯示：3 個 Tab 分頁                                             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Tab 1: Tech Pack 標註 (DraftBlock 編輯器)               │  │
│  │ ────────────────────────────────────────────────────────│  │
│  │ - 顯示 PDF 原圖 + 中文翻譯疊層                         │  │
│  │ - 可編輯每個標註的翻譯                                  │  │
│  │ - Status: Auto → Edited → Approved                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Tab 2: BOM 物料清單 (表格編輯器)                        │  │
│  │ ────────────────────────────────────────────────────────│  │
│  │ - 顯示 AI 提取的 BOM 表格                              │  │
│  │ - 可編輯每一筆物料（名稱、供應商、用量...）           │  │
│  │ - 可刪除錯誤的行                                        │  │
│  │ - 可新增缺漏的物料                                      │  │
│  │ - Checkbox: 標記為已驗證 (is_verified=True)           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Tab 3: Measurement 尺寸表 (表格編輯器) ⭐ 新功能        │  │
│  │ ────────────────────────────────────────────────────────│  │
│  │ - 顯示 AI 提取的尺寸表                                 │  │
│  │ - 表格格式：                                            │  │
│  │   | Point Name  | XS   | S    | M    | L    | Tol. |  │  │
│  │   | Chest Width | 40.0 | 42.0 | 44.0 | 46.0 | ±0.5 |  │  │
│  │ - 可編輯每一格的數值                                    │  │
│  │ - Checkbox: 標記為已驗證 (is_verified=True)           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  操作：                                                          │
│  ├─ [儲存草稿] - 儲存但不驗證                                   │
│  ├─ [全部驗證] - 標記所有資料為 is_verified=True               │
│  └─ [下 Sample Request] - 進入 Step 5 ⭐                       │
└─────────────────────────────────────────────────────────────────┘
         ⬇️
┌─────────────────────────────────────────────────────────────────┐
│              Step 5: 建立 Sample Request（最終步驟）             │
├─────────────────────────────────────────────────────────────────┤
│  觸發：點擊 [下 Sample Request] 按鈕                            │
│  前端：彈窗表單                                                  │
│  ├─ Sample Type: Proto / Fit / Sales / Photo                   │
│  ├─ Quantity: 數量                                              │
│  ├─ Priority: Normal / Urgent                                   │
│  ├─ Due Date: 交期                                              │
│  └─ Notes: 備註                                                 │
│                                                                  │
│  API：POST /api/v2/sample-requests/                             │
│  後端：apps/samples/services/auto_generation.py                 │
│  └─ create_with_initial_run()                                   │
│      ├─ 創建 SampleRequest                                      │
│      ├─ 創建 SampleRun #1                                       │
│      ├─ 快照 BOM → RunBOMLine                                  │
│      ├─ 快照 Measurement → measurement_snapshot_json ⭐        │
│      ├─ 快照 Construction → RunOperation                       │
│      ├─ 創建 MWO draft                                          │
│      └─ 創建 Estimate draft                                     │
│                                                                  │
│  完成：跳轉到 Kanban 看板 (/dashboard/samples/kanban)          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗂️ 資料模型設計

### 新增 Model: UploadedDocument

```python
# backend/apps/parsing/models.py

class UploadedDocument(models.Model):
    """
    上傳的文檔（PDF / Excel）
    用於追蹤上傳、分類、解析狀態
    """
    STATUS_CHOICES = [
        ('uploaded', 'Uploaded'),
        ('classifying', 'AI Classifying'),
        ('classified', 'Classified'),
        ('extracting', 'AI Extracting'),
        ('extracted', 'Extracted'),
        ('reviewing', 'Under Review'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    organization = models.ForeignKey('core.Organization', on_delete=models.CASCADE)

    # File info
    file = models.FileField(upload_to='uploads/')
    filename = models.CharField(max_length=255)
    file_type = models.CharField(max_length=10)  # pdf, xlsx
    file_size = models.IntegerField()  # bytes

    # Classification result (AI 判斷)
    classification_result = models.JSONField(
        null=True,
        blank=True,
        help_text="""
        AI classification result:
        {
            "file_type": "mixed",
            "pages": [
                {"page": 1, "type": "tech_pack", "confidence": 0.95},
                {"page": 2, "type": "measurement_table", "confidence": 0.98},
                ...
            ]
        }
        """
    )

    # Extraction status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='uploaded')
    extraction_errors = models.JSONField(default=list, blank=True)

    # Links to extracted data
    style_revision = models.ForeignKey(
        'styles.StyleRevision',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Created StyleRevision after extraction"
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True)

    class Meta:
        db_table = 'uploaded_documents'
        ordering = ['-created_at']
```

---

## 🛠️ 後端服務設計

### Service 1: 檔案分類器（智能頁碼偵測）

```python
# backend/apps/parsing/services/file_classifier.py

from openai import OpenAI
from django.conf import settings
import pdfplumber
import base64
from typing import Dict, List

def classify_document(file_path: str) -> Dict:
    """
    使用 GPT-4o Vision 分類文檔內容

    Args:
        file_path: 上傳的檔案路徑

    Returns:
        {
            "file_type": "mixed" | "tech_pack_only" | "bom_only" | "measurement_only",
            "pages": [
                {"page": 1, "type": "tech_pack", "confidence": 0.95},
                {"page": 2, "type": "measurement_table", "confidence": 0.98},
                {"page": 3, "type": "bom_table", "confidence": 0.92},
                ...
            ]
        }
    """

    if file_path.endswith('.pdf'):
        return classify_pdf(file_path)
    elif file_path.endswith('.xlsx'):
        return classify_excel(file_path)
    else:
        raise ValueError(f"Unsupported file type: {file_path}")


def classify_pdf(pdf_path: str) -> Dict:
    """
    分類 PDF 檔案，判斷每一頁的內容類型

    Strategy:
    1. 先掃描前 5 頁（快速判斷）
    2. 如果找到 tech_pack, bom_table, measurement_table，繼續掃描剩餘頁面
    3. 如果前 5 頁都是同一類型，則假設全部都是該類型
    """

    client = OpenAI(api_key=settings.OPENAI_API_KEY)

    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        page_classifications = []

        # Strategy: 分批掃描（每次 5 頁）
        for batch_start in range(0, total_pages, 5):
            batch_end = min(batch_start + 5, total_pages)
            batch_pages = list(range(batch_start, batch_end))

            # 將這 5 頁轉為圖片並發送給 GPT-4o Vision
            batch_result = classify_page_batch(pdf, batch_pages, client)
            page_classifications.extend(batch_result)

    # 分析結果
    file_type = determine_file_type(page_classifications)

    return {
        "file_type": file_type,
        "total_pages": total_pages,
        "pages": page_classifications
    }


def classify_page_batch(pdf, page_numbers: List[int], client: OpenAI) -> List[Dict]:
    """
    批次分類多個頁面（一次 API call 處理 5 頁）
    """

    # 將頁面轉為 base64 圖片
    images_base64 = []
    for page_num in page_numbers:
        page = pdf.pages[page_num]
        im = page.to_image(resolution=150)
        pil_image = im.original

        buffered = io.BytesIO()
        pil_image.save(buffered, format="PNG")
        img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
        images_base64.append(img_base64)

    # Prompt
    prompt = f"""You are a Fashion Tech Pack classification expert.

Analyze these {len(page_numbers)} pages and classify each page into ONE of these types:

1. **tech_pack**: Technical drawings with construction annotations (callouts, dimension lines, sewing instructions)
2. **bom_table**: Bill of Materials table (material list with columns like: Item#, Material Name, Supplier, Quantity, Unit, Price)
3. **measurement_table**: Measurement specification table (size chart with columns like: Point Name, XS, S, M, L, XL, XXL, Tolerance)
4. **cover**: Cover page or title page
5. **other**: Other content (notes, blank pages, etc.)

For each page, return:
- page_number (1-indexed)
- type (one of the above)
- confidence (0.0-1.0)
- reasoning (brief explanation)

Return ONLY a JSON array, no explanation:
[
  {{"page": 1, "type": "tech_pack", "confidence": 0.95, "reasoning": "Contains technical drawings with dimension callouts"}},
  {{"page": 2, "type": "measurement_table", "confidence": 0.98, "reasoning": "Size chart with XS-XXL columns"}},
  ...
]
"""

    # 構建 API 請求（多張圖片）
    content = [{"type": "text", "text": prompt}]
    for img_b64 in images_base64:
        content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:image/png;base64,{img_b64}",
                "detail": "high"
            }
        })

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": content}],
        max_tokens=2000,
        temperature=0.1
    )

    # 解析回應
    import json
    result_text = response.choices[0].message.content

    if "```json" in result_text:
        result_text = result_text.split("```json")[1].split("```")[0].strip()
    elif "```" in result_text:
        result_text = result_text.split("```")[1].split("```")[0].strip()

    classifications = json.loads(result_text)
    return classifications


def determine_file_type(page_classifications: List[Dict]) -> str:
    """
    根據頁面分類結果，判斷整個檔案的類型
    """
    types = [p['type'] for p in page_classifications]

    has_tech_pack = 'tech_pack' in types
    has_bom = 'bom_table' in types
    has_measurement = 'measurement_table' in types

    if sum([has_tech_pack, has_bom, has_measurement]) >= 2:
        return 'mixed'
    elif has_tech_pack:
        return 'tech_pack_only'
    elif has_bom:
        return 'bom_only'
    elif has_measurement:
        return 'measurement_only'
    else:
        return 'other'
```

---

### Service 2: BOM 提取器（增強版）

```python
# backend/apps/parsing/services/bom_extractor.py

from apps.styles.models import StyleRevision, BOMItem
import pdfplumber
from decimal import Decimal

def extract_bom_from_pages(
    pdf_path: str,
    page_numbers: List[int],
    revision: StyleRevision
) -> int:
    """
    從指定頁面提取 BOM 表格

    Args:
        pdf_path: PDF 檔案路徑
        page_numbers: BOM 表格所在頁碼（1-indexed）
        revision: 目標 StyleRevision

    Returns:
        創建的 BOMItem 數量
    """

    # 使用現有的 pdfplumber 提取邏輯
    # （參考 import_bom_batch.py）

    all_rows = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_num in page_numbers:
            page = pdf.pages[page_num - 1]  # 轉為 0-indexed
            tables = page.extract_tables()

            if tables:
                main_table = max(tables, key=len)
                all_rows.extend(main_table)

    # 解析表格並創建 BOMItem
    # （邏輯同 import_bom_batch.py，但加上 is_verified=False）

    created_count = 0
    item_number = 1
    current_category = 'fabric'

    for row in all_rows:
        # 判斷是否為 category header
        first_cell = str(row[0]).lower() if row[0] else ''
        if first_cell in ['fabric', 'trim', 'packaging', 'label']:
            current_category = first_cell
            continue

        # 跳過 header rows
        if 'supplier article' in str(row).lower():
            continue

        # 解析欄位
        material_name = clean_cell(row[5]) if len(row) > 5 else ''
        if not material_name or len(material_name) < 3:
            continue

        # 創建 BOMItem（is_verified=False，待人工驗證）
        BOMItem.objects.create(
            organization=revision.organization,
            revision=revision,
            item_number=item_number,
            category=current_category,
            material_name=material_name[:200],
            supplier=clean_cell(row[6]) if len(row) > 6 else '',
            supplier_article_no=clean_cell(row[3]) if len(row) > 3 else '',
            consumption=parse_decimal(row[11]) if len(row) > 11 else Decimal('0'),
            unit=clean_cell(row[12]) if len(row) > 12 else 'pcs',
            unit_price=parse_decimal(row[13]) if len(row) > 13 else None,
            is_verified=False,  # ⭐ 待驗證
            ai_confidence=0.85,  # pdfplumber 提取信心度
        )

        item_number += 1
        created_count += 1

    return created_count
```

---

### Service 3: Measurement 提取器 ⭐ 新功能

```python
# backend/apps/parsing/services/measurement_extractor.py

from openai import OpenAI
from django.conf import settings
from apps.styles.models import StyleRevision, Measurement
import pdfplumber
import base64
import io
import json

def extract_measurements_from_page(
    pdf_path: str,
    page_number: int,
    revision: StyleRevision
) -> int:
    """
    使用 GPT-4o Vision 提取尺寸表

    Args:
        pdf_path: PDF 檔案路徑
        page_number: 尺寸表所在頁碼（1-indexed）
        revision: 目標 StyleRevision

    Returns:
        創建的 Measurement 數量
    """

    client = OpenAI(api_key=settings.OPENAI_API_KEY)

    # 1. 將頁面轉為圖片
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[page_number - 1]
        im = page.to_image(resolution=200)  # 高解析度，確保表格清晰
        pil_image = im.original

        buffered = io.BytesIO()
        pil_image.save(buffered, format="PNG")
        img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')

    # 2. GPT-4o Vision Prompt
    prompt = """You are a Fashion Tech Pack measurement table extraction expert.

Extract the COMPLETE measurement specification table from this image.

The table should have:
- **Point Name** (e.g., "Chest Width", "Body Length", "Sleeve Length")
- **Point Code** (optional, e.g., "A", "B", "C")
- **Size Values** for each size (e.g., XS, S, M, L, XL, XXL)
- **Tolerance** (e.g., ±0.5, +0.5/-0.5)
- **Unit** (e.g., cm, inches)

Return a JSON array with this structure:
[
  {
    "point_name": "Chest Width",
    "point_code": "A",
    "values": {
      "XS": 40.0,
      "S": 42.0,
      "M": 44.0,
      "L": 46.0,
      "XL": 48.0,
      "XXL": 50.0
    },
    "tolerance_plus": 0.5,
    "tolerance_minus": 0.5,
    "unit": "cm"
  },
  ...
]

IMPORTANT:
1. Extract ALL measurement points (typically 20-30 points)
2. Convert all values to numbers (remove units from values)
3. If tolerance is "±0.5", set both tolerance_plus and tolerance_minus to 0.5
4. If a size is missing, omit it from the values object
5. Return ONLY the JSON array, no explanation
"""

    # 3. API 調用
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{img_base64}",
                            "detail": "high"
                        }
                    }
                ]
            }
        ],
        max_tokens=4000,
        temperature=0.1
    )

    # 4. 解析回應
    result_text = response.choices[0].message.content

    if "```json" in result_text:
        result_text = result_text.split("```json")[1].split("```")[0].strip()
    elif "```" in result_text:
        result_text = result_text.split("```")[1].split("```")[0].strip()

    measurements_data = json.loads(result_text)

    # 5. 創建 Measurement 記錄
    created_count = 0
    for m_data in measurements_data:
        Measurement.objects.create(
            organization=revision.organization,
            revision=revision,
            point_name=m_data['point_name'],
            point_code=m_data.get('point_code', ''),
            values=m_data['values'],  # JSON field
            tolerance_plus=Decimal(str(m_data.get('tolerance_plus', 0.5))),
            tolerance_minus=Decimal(str(m_data.get('tolerance_minus', 0.5))),
            unit=m_data.get('unit', 'cm'),
            is_verified=False,  # ⭐ 待驗證
            ai_confidence=0.90,
        )
        created_count += 1

    return created_count
```

---

## 🎨 前端設計

### Page 1: 上傳頁面

```typescript
// frontend/app/dashboard/upload/page.tsx

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, FileSpreadsheet } from 'lucide-react'

export default function UploadPage() {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/v2/documents/upload/', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      // 上傳成功，跳轉到 AI 處理頁面
      router.push(`/dashboard/documents/${data.id}/processing`)

    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">上傳 Tech Pack / BOM / Spec</h1>

      {/* Dropzone */}
      <div
        className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition cursor-pointer"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const droppedFile = e.dataTransfer.files[0]
          if (droppedFile) setFile(droppedFile)
        }}
      >
        {file ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              {file.name.endsWith('.pdf') ? (
                <FileText className="h-12 w-12 text-red-500" />
              ) : (
                <FileSpreadsheet className="h-12 w-12 text-green-500" />
              )}
              <div className="text-left">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>

            <button
              onClick={handleUpload}
              disabled={uploading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : '開始上傳並解析'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <Upload className="h-16 w-16 mx-auto text-gray-400" />
            <div>
              <p className="text-lg font-medium">拖曳檔案到這裡</p>
              <p className="text-sm text-gray-500">或點擊選擇檔案</p>
            </div>
            <p className="text-xs text-gray-400">
              支援：PDF, Excel (.xlsx)
            </p>
            <input
              type="file"
              accept=".pdf,.xlsx"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0]
                if (selectedFile) setFile(selectedFile)
              }}
              className="hidden"
              id="file-input"
            />
            <label
              htmlFor="file-input"
              className="inline-block px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer"
            >
              選擇檔案
            </label>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">📌 系統會自動處理：</h3>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>✅ AI 智能判斷檔案內容類型</li>
          <li>✅ 自動提取 Tech Pack 標註並翻譯</li>
          <li>✅ 自動提取 BOM 物料清單</li>
          <li>✅ 自動提取 Measurement 尺寸表</li>
          <li>⚠️ 提取完成後，請人工驗證資料</li>
        </ul>
      </div>
    </div>
  )
}
```

---

### Page 2: AI 處理中頁面

```typescript
// frontend/app/dashboard/documents/[id]/processing/page.tsx

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react'

export default function ProcessingPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [status, setStatus] = useState<string>('classifying')
  const [progress, setProgress] = useState<any>(null)

  useEffect(() => {
    const pollStatus = setInterval(async () => {
      const res = await fetch(`/api/v2/documents/${params.id}/status/`)
      const data = await res.json()

      setStatus(data.status)
      setProgress(data.progress)

      if (data.status === 'completed') {
        clearInterval(pollStatus)
        setTimeout(() => {
          router.push(`/dashboard/documents/${params.id}/review`)
        }, 2000)
      }

      if (data.status === 'failed') {
        clearInterval(pollStatus)
      }
    }, 2000)

    return () => clearInterval(pollStatus)
  }, [params.id])

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-8">AI 處理中...</h1>

      <div className="space-y-4">
        {/* Step 1: 分類 */}
        <StatusItem
          label="1. AI 檔案分類（智能頁碼偵測）"
          status={status === 'classifying' ? 'processing' : 'completed'}
          message={progress?.classification_message}
        />

        {/* Step 2: 提取 */}
        <StatusItem
          label="2. AI 內容提取"
          status={status === 'extracting' ? 'processing' : status === 'extracted' ? 'completed' : 'pending'}
        >
          <div className="ml-6 mt-2 space-y-1 text-sm">
            <StatusSubItem label="Tech Pack 標註" completed={progress?.tech_pack_done} count={progress?.tech_pack_count} />
            <StatusSubItem label="BOM 物料清單" completed={progress?.bom_done} count={progress?.bom_count} />
            <StatusSubItem label="Measurement 尺寸表" completed={progress?.measurement_done} count={progress?.measurement_count} />
          </div>
        </StatusItem>

        {/* Step 3: 完成 */}
        <StatusItem
          label="3. 準備驗證頁面"
          status={status === 'completed' ? 'completed' : 'pending'}
        />
      </div>

      {status === 'completed' && (
        <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800 font-medium">✅ AI 處理完成！正在跳轉到驗證頁面...</p>
        </div>
      )}

      {status === 'failed' && (
        <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 font-medium">❌ AI 處理失敗</p>
          <p className="text-sm text-red-600 mt-2">{progress?.error_message}</p>
        </div>
      )}
    </div>
  )
}

function StatusItem({ label, status, message, children }: any) {
  return (
    <div className="flex items-start gap-3 p-4 border rounded-lg">
      {status === 'completed' && <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />}
      {status === 'processing' && <Loader2 className="h-6 w-6 text-blue-500 animate-spin flex-shrink-0" />}
      {status === 'pending' && <div className="h-6 w-6 rounded-full border-2 border-gray-300 flex-shrink-0" />}

      <div className="flex-1">
        <p className="font-medium">{label}</p>
        {message && <p className="text-sm text-gray-600 mt-1">{message}</p>}
        {children}
      </div>
    </div>
  )
}

function StatusSubItem({ label, completed, count }: any) {
  return (
    <div className="flex items-center gap-2">
      {completed ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : (
        <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      )}
      <span className="text-gray-700">{label}</span>
      {count !== undefined && <span className="text-gray-500">({count} 筆)</span>}
    </div>
  )
}
```

---

### Page 3: 驗證頁面（3 個 Tab）

```typescript
// frontend/app/dashboard/documents/[id]/review/page.tsx

'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'

export default function ReviewPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState('bom')

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">驗證 AI 解析結果</h1>
        <Button size="lg" onClick={handleCreateRequest}>
          ✅ 驗證完成，下 Sample Request
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="bom">BOM 物料清單</TabsTrigger>
          <TabsTrigger value="measurement">Measurement 尺寸表</TabsTrigger>
          <TabsTrigger value="techpack">Tech Pack 標註</TabsTrigger>
        </TabsList>

        <TabsContent value="bom">
          <BOMEditor documentId={params.id} />
        </TabsContent>

        <TabsContent value="measurement">
          <MeasurementEditor documentId={params.id} />
        </TabsContent>

        <TabsContent value="techpack">
          <TechPackEditor documentId={params.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

---

## 📅 實施計劃

### Phase 1: 基礎架構（2-3 天）

**Day 1: 後端服務**
- [ ] 創建 UploadedDocument Model + Migration
- [ ] 實現檔案分類服務（file_classifier.py）
- [ ] 實現 Measurement 提取服務（measurement_extractor.py）
- [ ] 測試 AI 分類準確度

**Day 2: API 端點**
- [ ] POST /api/v2/documents/upload/
- [ ] GET /api/v2/documents/{id}/status/
- [ ] GET /api/v2/documents/{id}/classification/
- [ ] POST /api/v2/documents/{id}/extract/

**Day 3: 前端頁面**
- [ ] 上傳頁面（/dashboard/upload）
- [ ] 處理中頁面（/dashboard/documents/{id}/processing）
- [ ] 驗證頁面框架（/dashboard/documents/{id}/review）

### Phase 2: 驗證編輯器（1-2 天）

**Day 4: BOM & Measurement 編輯器**
- [ ] BOMEditor 組件（表格編輯）
- [ ] MeasurementEditor 組件（表格編輯）
- [ ] API: PATCH /api/v2/bom-items/{id}/
- [ ] API: PATCH /api/v2/measurements/{id}/

**Day 5: Tech Pack 編輯器**
- [ ] TechPackEditor 組件（DraftBlock 編輯）
- [ ] PDF 預覽 + 翻譯疊層
- [ ] API: 複用現有 DraftBlock API

### Phase 3: 整合與測試（1 天）

**Day 6: 端到端流程**
- [ ] 整合 create_with_initial_run()（加入 measurement_snapshot）
- [ ] 測試完整流程：上傳 → 驗證 → 下 Request → 生成 MWO
- [ ] 錯誤處理與降級機制
- [ ] 文檔更新

---

## ✅ 成功標準

- [ ] 可以上傳任意 PDF/Excel 檔案
- [ ] AI 自動判斷檔案類型（準確率 > 90%）
- [ ] AI 自動提取 BOM + Measurement（準確率 > 85%）
- [ ] 人工可以編輯所有 AI 提取的資料
- [ ] 點擊按鈕可以直接下 Sample Request
- [ ] MWO 包含完整的 measurement_snapshot_json

---

## 🎯 下一步（30 分鐘後開始實施）

1. 先實施 UploadedDocument Model
2. 實現檔案分類服務
3. 實現 Measurement 提取服務
4. 測試 AI 準確度
5. 前端上傳頁面
6. 完整流程測試

**預計完成時間：2-3 個工作天**
