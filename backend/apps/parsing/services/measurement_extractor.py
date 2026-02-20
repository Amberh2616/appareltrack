"""
Measurement Extractor Service
Uses GPT-4o Vision to extract measurement specifications from PDF tables

2026-01-10: 改用 PyMuPDF + 300 DPI，與其他提取器保持一致
"""

from openai import OpenAI
from django.conf import settings
from apps.styles.models import StyleRevision, Measurement
import fitz  # PyMuPDF
import base64
import json
from decimal import Decimal
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)


def extract_measurements_from_page(
    pdf_path: str,
    page_number: int,
    revision: StyleRevision
) -> int:
    """
    Extract measurement specifications from a PDF page using GPT-4o Vision

    Args:
        pdf_path: Path to PDF file
        page_number: Page number (1-indexed)
        revision: Target StyleRevision to attach measurements

    Returns:
        Number of Measurement records created
    """
    client = OpenAI(api_key=settings.OPENAI_API_KEY)

    try:
        # 1. Convert page to high-resolution image (PyMuPDF + 300 DPI)
        doc = fitz.open(pdf_path)
        page = doc.load_page(page_number - 1)  # Convert to 0-indexed
        pix = page.get_pixmap(matrix=fitz.Matrix(300/72, 300/72))  # 300 DPI
        img_bytes = pix.tobytes("png")
        img_base64 = base64.b64encode(img_bytes).decode('utf-8')
        doc.close()

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
4. If tolerance is "+0.5/-0.3", set tolerance_plus=0.5 and tolerance_minus=0.3
5. If a size is missing, omit it from the values object
6. Return ONLY the JSON array, no explanation, no markdown formatting
"""

        # 3. API call
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
                                "detail": "high"  # High detail for accurate table extraction
                            }
                        }
                    ]
                }
            ],
            max_tokens=4000,
            temperature=0.1
        )

        # 4. Parse response
        result_text = response.choices[0].message.content

        # Clean up markdown formatting if present
        if "```json" in result_text:
            result_text = result_text.split("```json")[1].split("```")[0].strip()
        elif "```" in result_text:
            result_text = result_text.split("```")[1].split("```")[0].strip()

        measurements_data = json.loads(result_text)
        logger.info(f"Extracted {len(measurements_data)} measurement points")

        # 5. Create Measurement records
        from apps.parsing.utils.translate import machine_translate

        created_count = 0
        for m_data in measurements_data:
            try:
                point_name = m_data.get('point_name', '')

                # 翻譯 point_name
                point_name_zh = machine_translate(point_name)

                Measurement.objects.create(
                    organization=revision.organization,
                    revision=revision,
                    point_name=point_name,
                    point_name_zh=point_name_zh,  # 中文翻譯
                    point_code=m_data.get('point_code', ''),
                    values=m_data.get('values', {}),  # JSON field
                    tolerance_plus=Decimal(str(m_data.get('tolerance_plus', 0.5))),
                    tolerance_minus=Decimal(str(m_data.get('tolerance_minus', 0.5))),
                    unit=m_data.get('unit', 'cm'),
                    is_verified=False,  # Requires human verification
                    ai_confidence=0.90,  # Vision-based extraction confidence
                )
                created_count += 1
            except Exception as e:
                logger.warning(f"Failed to create measurement for {m_data.get('point_name')}: {str(e)}")
                continue

        logger.info(f"Successfully created {created_count} Measurement records")
        return created_count

    except Exception as e:
        logger.error(f"Error extracting measurements from page {page_number}: {str(e)}", exc_info=True)
        raise


def extract_measurements_from_pages(
    pdf_path: str,
    page_numbers: List[int],
    revision: StyleRevision
) -> int:
    """
    Extract measurements from multiple pages

    Args:
        pdf_path: Path to PDF file
        page_numbers: List of page numbers (1-indexed)
        revision: Target StyleRevision

    Returns:
        Total number of Measurement records created
    """
    total_created = 0

    for page_num in page_numbers:
        try:
            count = extract_measurements_from_page(pdf_path, page_num, revision)
            total_created += count
        except Exception as e:
            logger.error(f"Failed to extract from page {page_num}: {str(e)}")
            continue

    return total_created


def extract_measurements_from_classification(
    pdf_path: str,
    classification_result: Dict,
    revision: StyleRevision
) -> int:
    """
    Extract measurements based on classification result

    Args:
        pdf_path: Path to PDF file
        classification_result: Result from file_classifier
        revision: Target StyleRevision

    Returns:
        Total number of Measurement records created
    """
    # Find all pages classified as "measurement_table"
    measurement_pages = [
        p['page'] for p in classification_result.get('pages', [])
        if p['type'] == 'measurement_table'
    ]

    if not measurement_pages:
        logger.info("No measurement table pages found in classification")
        return 0

    logger.info(f"Found {len(measurement_pages)} measurement table pages: {measurement_pages}")
    return extract_measurements_from_pages(pdf_path, measurement_pages, revision)
