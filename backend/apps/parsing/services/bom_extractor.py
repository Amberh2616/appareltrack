"""
BOM Extractor Service
Uses GPT-4o Vision to intelligently extract BOM tables from PDF pages

2026-01-10: 重写，改用 Vision 智能识别表格结构（取代 pdfplumber 硬编码）
2026-01-27: 新增品牌 BOM 格式模板支援
- 自动识别列结构
- 智能跳过表头
- 支持不同 BOM 格式
- 品牌模板：vertical_table, horizontal_table, free_text, mixed
"""

from openai import OpenAI
from django.conf import settings
from decimal import Decimal, InvalidOperation
from typing import List, Dict, Tuple
from apps.styles.models import StyleRevision, BOMItem
import fitz  # PyMuPDF
import base64
import json
import logging

logger = logging.getLogger(__name__)


def get_brand_config(revision: StyleRevision) -> Tuple[str, dict]:
    """
    Get BOM format configuration from brand
    Returns: (bom_format, extraction_rules)
    """
    try:
        style = revision.style
        if style and style.brand:
            brand = style.brand
            logger.info(f"Using brand config: {brand.code} - format={brand.bom_format}")
            return brand.bom_format, brand.bom_extraction_rules or {}
    except Exception as e:
        logger.warning(f"Failed to get brand config: {e}")

    return 'auto', {}


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
    logger.info(f"[Vision] Extracting BOM from pages {page_numbers} in {pdf_path}")

    # Get brand configuration
    bom_format, extraction_rules = get_brand_config(revision)

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    total_created = 0

    for page_num in page_numbers:
        try:
            count = extract_bom_from_single_page(
                pdf_path, page_num, revision, client,
                bom_format=bom_format,
                extraction_rules=extraction_rules
            )
            total_created += count
        except Exception as e:
            logger.error(f"Failed to extract BOM from page {page_num}: {str(e)}")
            continue

    logger.info(f"[Vision] BOM extraction completed: {total_created} items created")
    return total_created


def _build_extraction_prompt(bom_format: str, extraction_rules: dict = None) -> str:
    """
    Build extraction prompt based on brand BOM format configuration
    """
    rules = extraction_rules or {}

    # Format-specific instructions
    format_instructions = {
        'vertical_table': """
**FORMAT: VERTICAL TABLE**
This document uses a standard vertical BOM table layout with columns.
Focus on extracting data from rows, where each row is one material.
""",
        'horizontal_table': """
**FORMAT: HORIZONTAL TABLE**
This document uses a horizontal table layout where:
- Material names/types are listed in the LEFT column (e.g., BODY, MESH, LINING, ELASTIC)
- Colors or sizes are listed across the TOP row
- Each ROW represents one material item
Extract each unique material from the left column.
""",
        'free_text': """
**FORMAT: FREE TEXT / FABRIC INFO SECTIONS**
This document contains fabric information in free-text format.
Look for patterns like:
- "BODY: Q040923 - NYLON 91%"
- "FABRIC INFO:" sections
- Material codes followed by composition percentages
""",
        'mixed': """
**FORMAT: MIXED**
This document may contain multiple formats. Look for:
1. Tables (vertical or horizontal)
2. Free-text fabric info sections
3. Material specifications anywhere on the page
""",
        'auto': """
**FORMAT: AUTO-DETECT**
Analyze the page and identify the format:
1. VERTICAL TABLE - columns with Material, Supplier, Price, etc.
2. HORIZONTAL TABLE - materials on left, colors/sizes across top
3. FREE TEXT - FABRIC INFO sections, "BODY:", "SHELL:" patterns
Extract all materials regardless of format.
"""
    }

    # Custom keywords from brand rules
    fabric_keywords = rules.get('fabric_section_keywords', [])
    skip_keywords = rules.get('skip_keywords', [])

    custom_rules = ""
    if fabric_keywords:
        custom_rules += f"\nLook for these fabric section keywords: {', '.join(fabric_keywords)}"
    if skip_keywords:
        custom_rules += f"\nSkip items containing: {', '.join(skip_keywords)}"

    # Build full prompt
    prompt = f"""You are a Fashion BOM (Bill of Materials) extraction expert.

{format_instructions.get(bom_format, format_instructions['auto'])}

Extract ALL material items from this page.
{custom_rules}

CRITICAL RULES:
1. **SKIP ALL HEADER ROWS** - Do NOT extract column titles like:
   - "Material Name", "Supplier", "Article", "Description"
   - "Consumption", "Unit", "Price", "Color", "Size"

2. **SKIP CATEGORY HEADERS** - Do NOT extract rows like:
   - "FABRIC", "TRIM", "PACKAGING", "LABEL", "ACCESSORY" (unless followed by actual material info)

3. **EXTRACT FROM FREE-TEXT SECTIONS** - Look for fabric info in formats like:
   - "BODY: Q040923 - 6 SUPERSHINE NYLON 91% NYLON, 9% SPANDEX"
   - "HONEYCOMB MESH: BWK 7137W: 87% Polyester, 13% Spandex"
   - "Gusset lining: Q130714-1 95/5 poly span"
   - "FABRIC INFO:" sections with material descriptions

4. **EXTRACT ACTUAL MATERIALS** - Real materials like:
   - "NULU LIGHT 4-WAY STRETCH" (fabric name)
   - "YKK ZIPPER 18CM" (trim name)
   - "WOVEN LABEL MAIN" (label name)
   - Any fabric with composition percentages

5. **NO DUPLICATES** - Each material should appear only once

For each material, extract:
{{
  "category": "fabric" | "trim" | "packaging" | "label" | "other",
  "material_name": "actual material name (include composition if available)",
  "supplier": "supplier name or null",
  "supplier_article_no": "article number/code or null",
  "consumption": number or null,
  "unit": "YD" | "PCS" | "M" | "SET" | etc or null,
  "unit_price": number or null
}}

Return JSON array of materials ONLY (no headers, no categories):
[
  {{"category": "fabric", "material_name": "SUPERSHINE NYLON 91% NYLON 9% SPANDEX 250GSM", "supplier": null, "supplier_article_no": "Q040923"}},
  ...
]

Return ONLY valid JSON, no explanation, no markdown. Return [] if no materials found."""

    return prompt


def extract_bom_from_single_page(
    pdf_path: str,
    page_number: int,
    revision: StyleRevision,
    client: OpenAI,
    bom_format: str = 'auto',
    extraction_rules: dict = None
) -> int:
    """
    從單一頁面提取 BOM 表格
    支援品牌模板配置
    """
    # 1. 轉換 PDF 頁面為圖片（300 DPI）
    doc = fitz.open(pdf_path)
    page = doc.load_page(page_number - 1)
    pix = page.get_pixmap(matrix=fitz.Matrix(300/72, 300/72))
    img_bytes = pix.tobytes("png")
    img_base64 = base64.b64encode(img_bytes).decode('utf-8')
    doc.close()

    # 2. Build prompt based on brand format configuration
    prompt = _build_extraction_prompt(bom_format, extraction_rules)

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

    logger.info(f"Page {page_number}: Vision extracted {len(bom_data)} BOM items (format={bom_format})")

    # 5. 創建 BOMItem 記錄
    from apps.parsing.utils.translate import machine_translate

    created_count = 0
    existing_items = BOMItem.objects.filter(revision=revision).count()
    item_number = existing_items + 1

    # 表頭關鍵字黑名單（二次過濾）
    header_keywords = [
        'material name', 'supplier', 'article', 'consumption',
        'unit price', 'description', 'component', 'qty', 'uom',
        'vendor', 'color', 'size', 'price', 'total', 'subtotal',
        'item', 'no.', 'ref', 'code'
    ]

    for item in bom_data:
        try:
            material_name = str(item.get('material_name', '')).strip()

            # 跳過空的
            if not material_name or len(material_name) < 2:
                continue

            # 二次過濾：跳過疑似表頭
            material_lower = material_name.lower()
            if any(kw in material_lower for kw in header_keywords):
                logger.debug(f"Skipping header-like row: {material_name}")
                continue

            # 跳過純數字或單字母
            if material_name.isdigit() or (len(material_name) == 1 and material_name.isalpha()):
                continue

            # 翻譯 material_name
            material_name_zh = machine_translate(material_name)

            BOMItem.objects.create(
                organization=revision.organization,
                revision=revision,
                item_number=item_number,
                category=str(item.get('category', 'other'))[:20],
                material_name=material_name[:200],
                material_name_zh=material_name_zh[:200] if material_name_zh else '',
                supplier=str(item.get('supplier') or '')[:200],
                supplier_article_no=str(item.get('supplier_article_no') or '')[:100],
                consumption=parse_decimal(item.get('consumption')),
                unit=str(item.get('unit') or 'pcs')[:20],
                unit_price=parse_decimal(item.get('unit_price')) if item.get('unit_price') else None,
                is_verified=False,
                ai_confidence=0.90,
            )

            item_number += 1
            created_count += 1
            logger.debug(f"Created BOMItem #{item_number-1}: {material_name}")

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

        clean_value = ''.join(c for c in str(value) if c.isdigit() or c in '.-')

        if not clean_value or clean_value in ['-', '.', '-.']:
            return Decimal('0')

        return Decimal(clean_value)
    except (InvalidOperation, ValueError):
        return Decimal('0')
