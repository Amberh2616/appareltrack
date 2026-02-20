"""
BOM Extractor Service V2
Uses GPT-4o Vision to intelligently extract BOM tables from PDF pages

2026-01-10: 完全重写，使用 Vision 智能识别表格结构
"""

from openai import OpenAI
from django.conf import settings
from decimal import Decimal, InvalidOperation
from typing import List, Dict
from apps.styles.models import StyleRevision, BOMItem
import fitz  # PyMuPDF
import base64
import json
import logging

logger = logging.getLogger(__name__)


def extract_bom_from_pages(
    pdf_path: str,
    page_numbers: List[int],
    revision: StyleRevision
) -> int:
    """
    從指定頁面提取 BOM 表格（使用 GPT-4o Vision）

    Args:
        pdf_path: PDF 檔案路徑
        page_numbers: BOM 表格所在頁碼（1-indexed）
        revision: 目標 StyleRevision

    Returns:
        創建的 BOMItem 數量
    """
    logger.info(f"Extracting BOM from pages {page_numbers} in {pdf_path}")

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    total_created = 0

    for page_num in page_numbers:
        try:
            count = extract_bom_from_single_page(pdf_path, page_num, revision, client)
            total_created += count
        except Exception as e:
            logger.error(f"Failed to extract BOM from page {page_num}: {str(e)}")
            continue

    logger.info(f"BOM extraction completed: {total_created} items created")
    return total_created


def extract_bom_from_single_page(
    pdf_path: str,
    page_number: int,
    revision: StyleRevision,
    client: OpenAI
) -> int:
    """
    從單一頁面提取 BOM 表格

    Args:
        pdf_path: PDF 檔案路徑
        page_number: 頁碼（1-indexed）
        revision: 目標 StyleRevision
        client: OpenAI client

    Returns:
        創建的 BOMItem 數量
    """
    # 1. 轉換 PDF 頁面為圖片（300 DPI）
    doc = fitz.open(pdf_path)
    page = doc.load_page(page_number - 1)
    pix = page.get_pixmap(matrix=fitz.Matrix(300/72, 300/72))
    img_bytes = pix.tobytes("png")
    img_base64 = base64.b64encode(img_bytes).decode('utf-8')
    doc.close()

    # 2. GPT-4o Vision Prompt
    prompt = """You are a Fashion BOM (Bill of Materials) extraction expert.

Extract ALL material items from this BOM table.

IMPORTANT RULES:
1. SKIP header rows (rows containing "Material Name", "Supplier", "Article", etc.)
2. SKIP category headers (rows like "FABRIC", "TRIM", "PACKAGING", "LABEL")
3. ONLY extract actual material data rows
4. Each material should appear ONLY ONCE

For each material item, extract:
- category: "fabric" | "trim" | "packaging" | "label" | "other"
- material_name: The material/component name (e.g., "NULU LIGHT 4-WAY STRETCH")
- supplier: Supplier/vendor name
- supplier_article_no: Supplier's article number
- consumption: Usage quantity (number only, e.g., 0.85)
- unit: Unit of measurement (e.g., "YD", "PCS", "M")
- unit_price: Price per unit (number only)

Return a JSON array:
[
  {
    "category": "fabric",
    "material_name": "NULU LIGHT 4-WAY STRETCH",
    "supplier": "TAI YUAN",
    "supplier_article_no": "TY-1234",
    "consumption": 0.85,
    "unit": "YD",
    "unit_price": 5.50
  },
  ...
]

CRITICAL:
- Do NOT include header rows as data
- Do NOT duplicate materials
- If a value is missing or unclear, use null
- Return ONLY valid JSON, no explanation
"""

    # 3. API 調用
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{
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
        }],
        max_tokens=4000,
        temperature=0.1
    )

    # 4. 解析回應
    result_text = response.choices[0].message.content

    # 清理 markdown
    if "```json" in result_text:
        result_text = result_text.split("```json")[1].split("```")[0].strip()
    elif "```" in result_text:
        result_text = result_text.split("```")[1].split("```")[0].strip()

    try:
        bom_data = json.loads(result_text)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse BOM JSON: {str(e)}")
        logger.error(f"Raw response: {result_text[:500]}")
        return 0

    logger.info(f"Page {page_number}: Extracted {len(bom_data)} BOM items")

    # 5. 創建 BOMItem 記錄
    from apps.parsing.utils.translate import machine_translate

    created_count = 0
    existing_items = BOMItem.objects.filter(revision=revision).count()
    item_number = existing_items + 1

    for item in bom_data:
        try:
            material_name = item.get('material_name', '')

            # 跳過空的或可疑的表頭
            if not material_name or len(material_name) < 3:
                continue

            # 額外檢查：跳過明顯的表頭文字
            skip_keywords = ['material name', 'supplier', 'article', 'consumption',
                           'unit price', 'description', 'component', 'qty', 'uom']
            if any(kw in material_name.lower() for kw in skip_keywords):
                logger.debug(f"Skipping header-like row: {material_name}")
                continue

            # 翻譯 material_name
            material_name_zh = machine_translate(material_name)

            BOMItem.objects.create(
                organization=revision.organization,
                revision=revision,
                item_number=item_number,
                category=item.get('category', 'other')[:20],
                material_name=material_name[:200],
                material_name_zh=material_name_zh[:200] if material_name_zh else '',
                supplier=str(item.get('supplier', ''))[:200],
                supplier_article_no=str(item.get('supplier_article_no', ''))[:100],
                consumption=parse_decimal(item.get('consumption')),
                unit=str(item.get('unit', 'pcs'))[:20],
                unit_price=parse_decimal(item.get('unit_price')) if item.get('unit_price') else None,
                is_verified=False,
                ai_confidence=0.90,  # Vision-based extraction
            )

            item_number += 1
            created_count += 1
            logger.debug(f"Created BOMItem: {material_name}")

        except Exception as e:
            logger.warning(f"Failed to create BOMItem: {str(e)}")
            continue

    return created_count


def parse_decimal(value) -> Decimal:
    """解析 Decimal 值"""
    if value is None:
        return Decimal('0')

    try:
        if isinstance(value, (int, float)):
            return Decimal(str(value))

        # 移除非數字字元（保留小數點和負號）
        clean_value = ''.join(c for c in str(value) if c.isdigit() or c in '.-')

        if not clean_value or clean_value in ['-', '.', '-.']:
            return Decimal('0')

        return Decimal(clean_value)
    except (InvalidOperation, ValueError):
        return Decimal('0')
