"""
Vision LLM - Extract text from Tech Pack images (including annotations)
混合策略：pdfplumber (文字層) + GPT-4o Vision (圖形標註)

2026-01-10: 升級為 high detail 模式，提升提取準確度 (+40% 內容)
"""

import base64
from openai import OpenAI
from django.conf import settings
import pdfplumber
import fitz  # PyMuPDF
from typing import List, Dict
import json
import logging

logger = logging.getLogger(__name__)


def extract_text_from_pdf_page_vision(pdf_path: str, page_number: int) -> list[dict]:
    """
    混合提取策略：
    1. pdfplumber 提取文字層（精確 bbox + 智能合併）
    2. GPT-4o Vision 提取圖形標註（圖片中的文字）
    3. 合併兩者結果

    Args:
        pdf_path: PDF 檔案路徑
        page_number: 頁碼（1-indexed）

    Returns:
        List of extracted text blocks with bbox
    """
    # ===== Part 1: pdfplumber 提取文字層 =====
    text_layer_blocks = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            page = pdf.pages[page_number - 1]
            words = page.extract_words(
                x_tolerance=3,
                y_tolerance=3,
                keep_blank_chars=False,
                use_text_flow=True
            )

        # 智能合併
        from apps.parsing.utils.text_merger import smart_merge_words
        sorted_words = sorted(words, key=lambda w: (w['top'], w['x0']))
        merged_blocks = smart_merge_words(sorted_words)

        # 轉換格式
        for block in merged_blocks:
            text_layer_blocks.append({
                "text": block["text"],
                "type": "text_layer",
                "bbox": {
                    "x": block["x0"],
                    "y": block["top"],
                    "width": block["x1"] - block["x0"],
                    "height": block["bottom"] - block["top"]
                }
            })

        logger.info(f"Page {page_number}: Extracted {len(text_layer_blocks)} text layer blocks")
    except Exception as e:
        logger.warning(f"pdfplumber extraction failed: {str(e)}")

    # ===== Part 2: GPT-4o Vision 提取圖形標註 =====
    annotation_blocks = []
    try:
        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        # 轉換為圖片
        doc = fitz.open(pdf_path)
        page = doc.load_page(page_number - 1)
        pix = page.get_pixmap(matrix=fitz.Matrix(300/72, 300/72))  # 2026-01-10: 提高解析度
        img_bytes = pix.tobytes("png")
        img_base64 = base64.b64encode(img_bytes).decode('utf-8')
        doc.close()

        # 2026-01-23: 根據是否有文字層選擇不同的提取策略
        has_text_layer = len(text_layer_blocks) > 0

        if has_text_layer:
            # 有文字層：只提取圖形標註（避免重複）
            prompt = """Extract ONLY graphic annotations from this technical drawing:
- Dimension lines with measurements (e.g., "5.5\" from CB")
- Arrow callouts pointing to design elements
- Handwritten notes
- Text embedded in graphics/images

DO NOT extract regular body text (already extracted separately).

Return JSON array:
[
  {"text": "annotation text", "type": "dimension"},
  ...
]

Types: "dimension", "callout", "note"
Return ONLY JSON, no explanation."""
        else:
            # 無文字層：提取所有可見文字（封面、圖形重的頁面）
            logger.info(f"Page {page_number}: No text layer found, using comprehensive Vision extraction")
            prompt = """Extract ALL visible text from this garment tech pack page, including:
- Title and headers
- Style numbers, season codes
- Construction notes and annotations
- Dimension callouts (e.g., "5.5\" from CB")
- Material descriptions
- Any labels or captions

Return JSON array:
[
  {"text": "extracted text", "type": "note"},
  ...
]

Types:
- "title" for headers/titles
- "callout" for labels pointing to parts
- "dimension" for measurements
- "note" for construction notes and other text

Return ONLY JSON, no explanation. Extract everything you can read."""

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
                            "detail": "high"  # 2026-01-10: 改用 high detail 提升準確度
                        }
                    }
                ]
            }],
            max_tokens=4000,  # 增加 token 限制
            temperature=0.1
        )

        result_text = response.choices[0].message.content

        # 清理 markdown
        if "```json" in result_text:
            result_text = result_text.split("```json")[1].split("```")[0].strip()
        elif "```" in result_text:
            result_text = result_text.split("```")[1].split("```")[0].strip()

        vision_results = json.loads(result_text)

        # 為 Vision 結果添加假 bbox（因為 Vision 無法提供精確坐標）
        for i, item in enumerate(vision_results):
            annotation_blocks.append({
                "text": item.get("text", ""),
                "type": item.get("type", "annotation"),
                "bbox": {
                    "x": 0,
                    "y": 0,
                    "width": 100,
                    "height": 20
                },
                "is_vision": True  # 標記來源
            })

        logger.info(f"Page {page_number}: Extracted {len(annotation_blocks)} vision annotations (comprehensive={not has_text_layer})")
    except Exception as e:
        logger.warning(f"Vision extraction failed: {str(e)}")

    # ===== Part 3: 合併結果 =====
    # 優先使用文字層（有精確 bbox），補充 Vision 標註
    all_blocks = text_layer_blocks + annotation_blocks

    logger.info(f"Page {page_number}: Total {len(all_blocks)} blocks")
    return all_blocks
