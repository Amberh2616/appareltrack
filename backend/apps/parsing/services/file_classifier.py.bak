"""
File Classifier Service
Uses GPT-4o Vision to classify document content types and detect page numbers
"""

from openai import OpenAI
from django.conf import settings
import pdfplumber
import base64
import io
import json
from typing import Dict, List
import logging

logger = logging.getLogger(__name__)


def classify_document(file_path: str) -> Dict:
    """
    Classify a document using GPT-4o Vision

    Args:
        file_path: Path to the uploaded file

    Returns:
        {
            "file_type": "mixed" | "tech_pack_only" | "bom_only" | "measurement_only",
            "total_pages": 30,
            "pages": [
                {"page": 1, "type": "tech_pack", "confidence": 0.95},
                {"page": 2, "type": "measurement_table", "confidence": 0.98},
                {"page": 3, "type": "bom_table", "confidence": 0.92},
                ...
            ]
        }
    """
    if file_path.lower().endswith('.pdf'):
        return classify_pdf(file_path)
    elif file_path.lower().endswith(('.xlsx', '.xls')):
        # For Excel files, assume it's a BOM table
        return {
            "file_type": "bom_only",
            "total_pages": 1,
            "pages": [{"page": 1, "type": "bom_table", "confidence": 1.0}]
        }
    else:
        raise ValueError(f"Unsupported file type: {file_path}")


def classify_pdf(pdf_path: str) -> Dict:
    """
    Classify PDF file by analyzing each page with GPT-4o Vision

    Strategy:
    1. Scan first 5 pages (quick assessment)
    2. If mixed types found, scan remaining pages in batches
    3. If all same type, assume entire document is that type

    Args:
        pdf_path: Path to PDF file

    Returns:
        Classification result dictionary
    """
    import fitz  # PyMuPDF

    client = OpenAI(api_key=settings.OPENAI_API_KEY)

    try:
        # Use PyMuPDF to get page count
        doc = fitz.open(pdf_path)
        total_pages = len(doc)
        doc.close()

        logger.info(f"Classifying PDF with {total_pages} pages")

        page_classifications = []

        # Strategy: Scan in batches of 5 pages
        for batch_start in range(0, min(total_pages, 10), 5):  # Only scan first 10 pages max
            batch_end = min(batch_start + 5, total_pages, 10)
            batch_pages = list(range(batch_start, batch_end))

            logger.info(f"Classifying pages {batch_start+1} to {batch_end}")
            batch_result = classify_page_batch(pdf_path, batch_pages, client)
            page_classifications.extend(batch_result)

            # For remaining pages, assume same type as majority
            if total_pages > 10:
                # Extrapolate the most common type
                types = [p['type'] for p in page_classifications if p['type'] not in ['cover', 'other']]
                if types:
                    most_common_type = max(set(types), key=types.count)
                    for page_num in range(10, total_pages):
                        page_classifications.append({
                            'page': page_num + 1,
                            'type': most_common_type,
                            'confidence': 0.8,
                            'reasoning': 'Extrapolated from first 10 pages'
                        })

        # Analyze result
        file_type = determine_file_type(page_classifications)

        return {
            "file_type": file_type,
            "total_pages": total_pages,
            "pages": page_classifications
        }

    except Exception as e:
        logger.error(f"Error classifying PDF: {str(e)}", exc_info=True)
        raise


def classify_page_batch(pdf_path: str, page_numbers: List[int], client: OpenAI) -> List[Dict]:
    """
    Batch classify multiple pages (one API call for up to 5 pages)

    Args:
        pdf_path: Path to PDF file
        page_numbers: List of 0-indexed page numbers
        client: OpenAI client

    Returns:
        List of classification results
    """
    import fitz  # PyMuPDF

    # Convert pages to base64 images using PyMuPDF
    images_base64 = []
    try:
        doc = fitz.open(pdf_path)

        for page_num in page_numbers:
            try:
                page = doc.load_page(page_num)

                # Convert to PNG image (150 DPI for classification)
                pix = page.get_pixmap(matrix=fitz.Matrix(150/72, 150/72))
                img_bytes = pix.tobytes("png")

                # Convert to base64
                img_base64 = base64.b64encode(img_bytes).decode('utf-8')
                images_base64.append(img_base64)

            except Exception as e:
                logger.warning(f"Failed to convert page {page_num+1} to image: {str(e)}")
                doc.close()
                return [{
                    'page': page_num + 1,
                    'type': 'other',
                    'confidence': 0.0,
                    'reasoning': f'Failed to process: {str(e)}'
                } for page_num in page_numbers]

        doc.close()

    except Exception as e:
        logger.error(f"Failed to open PDF: {str(e)}")
        return [{
            'page': page_num + 1,
            'type': 'other',
            'confidence': 0.0,
            'reasoning': f'Failed to open PDF: {str(e)}'
        } for page_num in page_numbers]

    # Construct prompt
    prompt = f"""You are a Fashion Tech Pack classification expert.

Analyze these {len(page_numbers)} pages and classify each page into ONE of these types:

1. **tech_pack**: Technical drawings with construction annotations (callouts, dimension lines, sewing instructions, CAD drawings)
2. **bom_table**: Bill of Materials table (material list with columns like: Item#, Material Name, Supplier, Quantity, Unit, Price)
3. **measurement_table**: Measurement specification table (size chart with columns like: Point Name, XS, S, M, L, XL, XXL, Tolerance)
4. **cover**: Cover page or title page
5. **other**: Other content (notes, blank pages, approval signatures, etc.)

For each page, return:
- page_number (1-indexed)
- type (one of the above)
- confidence (0.0-1.0)
- reasoning (brief explanation in English)

Return ONLY a JSON array, no markdown formatting, no explanation:
[
  {{"page": 1, "type": "tech_pack", "confidence": 0.95, "reasoning": "Contains technical drawings with dimension callouts"}},
  {{"page": 2, "type": "measurement_table", "confidence": 0.98, "reasoning": "Size chart with XS-XXL columns"}},
  ...
]
"""

    # Construct API request (multiple images)
    content = [{"type": "text", "text": prompt}]
    for img_b64 in images_base64:
        content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:image/png;base64,{img_b64}",
                "detail": "low"  # Use low detail for faster/cheaper classification
            }
        })

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": content}],
            max_tokens=2000,
            temperature=0.1
        )

        # Parse response
        result_text = response.choices[0].message.content
        logger.info(f"Raw GPT-4o response: {result_text[:500]}")  # Log first 500 chars

        # Clean up markdown formatting if present
        if "```json" in result_text:
            result_text = result_text.split("```json")[1].split("```")[0].strip()
        elif "```" in result_text:
            result_text = result_text.split("```")[1].split("```")[0].strip()

        classifications = json.loads(result_text)
        logger.info(f"Successfully classified {len(classifications)} pages: {json.dumps(classifications, indent=2)}")
        return classifications

    except Exception as e:
        logger.error(f"Error calling OpenAI API: {str(e)}", exc_info=True)
        # Return fallback result
        return [{
            'page': page_num + 1,
            'type': 'other',
            'confidence': 0.0,
            'reasoning': f'Classification failed: {str(e)}'
        } for page_num in page_numbers]


def determine_file_type(page_classifications: List[Dict]) -> str:
    """
    Determine overall file type based on page classifications

    Args:
        page_classifications: List of page classification results

    Returns:
        One of: "mixed", "tech_pack_only", "bom_only", "measurement_only", "other"
    """
    types = [p['type'] for p in page_classifications if p['type'] not in ['cover', 'other']]

    if not types:
        return 'other'

    has_tech_pack = 'tech_pack' in types
    has_bom = 'bom_table' in types
    has_measurement = 'measurement_table' in types

    # Count how many different types exist
    type_count = sum([has_tech_pack, has_bom, has_measurement])

    if type_count >= 2:
        return 'mixed'
    elif has_tech_pack:
        return 'tech_pack_only'
    elif has_bom:
        return 'bom_only'
    elif has_measurement:
        return 'measurement_only'
    else:
        return 'other'
