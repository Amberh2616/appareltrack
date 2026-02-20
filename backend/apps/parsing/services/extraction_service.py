"""
Extraction Service - DA-2

Refactored extraction logic from views.py for async task usage.
This service handles the core extraction pipeline:
1. Create StyleRevision and TechPackRevision
2. Extract Tech Pack annotations
3. Extract BOM
4. Extract Measurements
"""

import logging
import pdfplumber
import fitz  # PyMuPDF

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.parsing.models import UploadedDocument
from apps.parsing.models_blocks import Revision as TechPackRevision, RevisionPage, DraftBlock
from apps.styles.models import Style, StyleRevision

logger = logging.getLogger(__name__)


def perform_extraction(doc: UploadedDocument, target_style_id: str = None) -> dict:
    """
    Perform AI extraction on a classified document.

    Args:
        doc: UploadedDocument instance (must be in 'classified' or 'extracting' status)
        target_style_id: Optional UUID of an existing Style to link this document to.
                         If provided, skips style creation from filename.

    Returns:
        dict: {
            'style_revision_id': str,
            'tech_pack_revision_id': str,
            'extraction_stats': {
                'tech_pack_blocks': int,
                'bom_items': int,
                'measurements': int
            }
        }

    Raises:
        ValueError: If classification result is missing
        Exception: On extraction failure
    """
    # Get classification result
    classification = doc.classification_result
    if not classification:
        raise ValueError("No classification result found")

    # 1. Create Revision (for Tech Pack review) and StyleRevision (for BOM/Measurement)
    if target_style_id:
        # Use existing Style if target_style_id is provided
        try:
            style = Style.objects.get(id=target_style_id)
        except (Style.DoesNotExist, ValueError, ValidationError):
            # Not found or invalid UUID → fallback to filename
            logger.warning(f"target_style_id {target_style_id} invalid or not found, falling back to filename")
            target_style_id = None
        else:
            # Found — enforce org boundary (both non-NULL and different → reject)
            if doc.organization and style.organization and doc.organization != style.organization:
                raise ValueError(
                    f"Cross-organization binding rejected: "
                    f"document org={doc.organization} vs style org={style.organization}"
                )

    if not target_style_id:
        # Extract style number from filename (e.g., "LW1FLWS TECH PACK.pdf" → "LW1FLWS")
        style_number = doc.filename.split()[0] if ' ' in doc.filename else doc.filename.split('.')[0]

        # Get or create Style
        style, _ = Style.objects.get_or_create(
            organization=doc.organization,
            style_number=style_number,
            defaults={
                'style_name': f'{style_number} (Auto-generated)',
                'season': 'SS25',  # Default season
                'customer': 'Unknown',  # Default customer
            }
        )

    # Create StyleRevision (for BOM and Measurement)
    style_revision = StyleRevision.objects.create(
        organization=doc.organization,
        style=style,
        revision_label=f'Rev {StyleRevision.objects.filter(style=style).count() + 1}',
        status='draft'
    )

    # Get page count
    with pdfplumber.open(doc.file.path) as pdf:
        page_count = len(pdf.pages)

    # Create TechPackRevision (for Tech Pack review with DraftBlocks)
    tech_pack_revision = TechPackRevision.objects.create(
        file=doc.file,
        filename=doc.filename,
        page_count=page_count,
        status='uploaded'
    )

    logger.info(f"Created StyleRevision {style_revision.id} and TechPackRevision {tech_pack_revision.id} for Style {style.style_number}")

    # Use style_revision for BOM/Measurement, tech_pack_revision for DraftBlocks
    revision = style_revision

    # 2. Extract based on page types
    file_type = classification.get('file_type', 'other')
    is_mixed = file_type == 'mixed'

    tech_pack_pages = [p['page'] for p in classification['pages'] if p['type'] == 'tech_pack']
    bom_pages = [p['page'] for p in classification['pages'] if p['type'] == 'bom_table']
    measurement_pages = [p['page'] for p in classification['pages'] if p['type'] == 'measurement_table']
    other_pages = [p['page'] for p in classification['pages'] if p['type'] in ['other', 'cover']]

    # FIX: For mixed files, try to extract "other" pages as both tech_pack and bom
    # This prevents content loss when AI classification is uncertain
    if is_mixed:
        # Add "other" pages to both tech_pack and bom extraction lists
        if other_pages:
            logger.info(f"Mixed file: adding {len(other_pages)} 'other' pages to extraction")
            tech_pack_pages = sorted(set(tech_pack_pages + other_pages))
            bom_pages = sorted(set(bom_pages + other_pages))

        # FIX: BOM pages may also contain Tech Pack text (e.g., BULK COMMENTS)
        # Extract Tech Pack blocks from BOM pages too
        if bom_pages:
            logger.info(f"Mixed file: adding {len(bom_pages)} 'bom_table' pages to Tech Pack extraction")
            tech_pack_pages = sorted(set(tech_pack_pages + bom_pages))

    extraction_stats = {
        'tech_pack_blocks': 0,
        'bom_items': 0,
        'measurements': 0,
    }

    # 3. Extract Tech Pack annotations (if any)
    if tech_pack_pages:
        logger.info(f"Extracting Tech Pack from pages: {tech_pack_pages}")
        extraction_stats['tech_pack_blocks'] = _extract_tech_pack_blocks(
            doc.file.path, tech_pack_pages, tech_pack_revision
        )

    # 4. Extract BOM (if any)
    if bom_pages:
        logger.info(f"Extracting BOM from pages: {bom_pages}")
        from apps.parsing.services.bom_extractor import extract_bom_from_pages

        try:
            bom_count = extract_bom_from_pages(doc.file.path, bom_pages, revision)
            extraction_stats['bom_items'] = bom_count
            logger.info(f"BOM extraction completed: {bom_count} items")
        except Exception as e:
            logger.error(f"BOM extraction failed: {str(e)}")
            if not doc.extraction_errors:
                doc.extraction_errors = []
            doc.extraction_errors.append({
                'step': 'bom_extraction',
                'error': str(e)
            })

    # 5. Extract Measurement (if any)
    if measurement_pages:
        logger.info(f"Extracting Measurement from pages: {measurement_pages}")
        from apps.parsing.services.measurement_extractor import extract_measurements_from_page

        for page_num in measurement_pages[:2]:  # Limit to first 2 pages
            try:
                measurement_count = extract_measurements_from_page(doc.file.path, page_num, revision)
                extraction_stats['measurements'] += measurement_count
                logger.info(f"Page {page_num}: Extracted {measurement_count} measurements")
            except Exception as e:
                logger.error(f"Measurement extraction failed for page {page_num}: {str(e)}")
                if not doc.extraction_errors:
                    doc.extraction_errors = []
                doc.extraction_errors.append({
                    'step': 'measurement_extraction',
                    'page': page_num,
                    'error': str(e)
                })

    # 6. Update document status
    doc.style_revision = revision
    doc.tech_pack_revision = tech_pack_revision
    doc.status = 'extracted'
    doc.save(update_fields=['style_revision', 'tech_pack_revision', 'status', 'extraction_errors', 'updated_at'])

    logger.info(f"Extraction completed for {doc.id}: {extraction_stats}")

    return {
        'style_revision_id': str(revision.id),
        'tech_pack_revision_id': str(tech_pack_revision.id),
        'extraction_stats': extraction_stats,
    }


def _extract_tech_pack_blocks(file_path: str, tech_pack_pages: list, tech_pack_revision: TechPackRevision) -> int:
    """
    Extract Tech Pack text blocks from PDF pages.

    Args:
        file_path: Path to PDF file
        tech_pack_pages: List of page numbers to extract
        tech_pack_revision: TechPackRevision to save blocks to

    Returns:
        int: Number of blocks extracted
    """
    from apps.parsing.utils.vision_extract import extract_text_from_pdf_page_vision
    from apps.parsing.utils.translate import batch_translate

    total_blocks = 0

    # Open PDF to get page dimensions
    pdf_doc = fitz.open(file_path)

    try:
        for page_num in tech_pack_pages:
            try:
                # Extract text blocks
                extracted_blocks = extract_text_from_pdf_page_vision(file_path, page_num)

                # Get page dimensions from PDF
                pdf_page = pdf_doc.load_page(page_num - 1)  # 0-indexed
                page_width = int(pdf_page.rect.width)
                page_height = int(pdf_page.rect.height)

                # Get or create page
                page_obj, _ = RevisionPage.objects.get_or_create(
                    revision=tech_pack_revision,
                    page_number=page_num,
                    defaults={
                        'width': page_width,
                        'height': page_height
                    }
                )

                # Batch translate
                texts_to_translate = [block.get('text', '').strip() for block in extracted_blocks]
                translations = batch_translate(texts_to_translate)

                # Save blocks with translation
                with transaction.atomic():
                    for i, block in enumerate(extracted_blocks):
                        text = texts_to_translate[i]
                        if not text:
                            continue

                        translation = translations[i] if i < len(translations) else ""

                        # Get bbox from block
                        bbox = block.get('bbox', {})
                        bbox_x = bbox.get('x', 0)
                        bbox_y = bbox.get('y', 0)
                        bbox_width = bbox.get('width', 100)
                        bbox_height = bbox.get('height', 20)

                        # Filter strategy: only save important blocks
                        is_text_layer = block.get('type') == 'text_layer'

                        # Skip short text from text_layer
                        if is_text_layer and len(text) <= 3:
                            continue

                        # Create DraftBlock with translation
                        DraftBlock.objects.create(
                            page=page_obj,
                            source_text=text,
                            translated_text=translation,
                            bbox_x=bbox_x,
                            bbox_y=bbox_y,
                            bbox_width=bbox_width,
                            bbox_height=bbox_height,
                            block_type=block.get('type', 'callout'),
                            status='auto',
                            translation_status='done' if translation else 'pending',
                        )
                        total_blocks += 1

                logger.info(f"Page {page_num}: Extracted {len(extracted_blocks)} blocks")
            except Exception as e:
                logger.error(f"Failed to extract Tech Pack page {page_num}: {str(e)}")

    finally:
        pdf_doc.close()

    return total_blocks


def _should_skip_translation(text: str) -> bool:
    """
    判斷是否應跳過翻譯（方案 D：智能跳過）

    跳過情況：
    - 純數字（如尺寸數值）
    - 極短文字（< 2 字元）
    - 常見不需翻譯的標記（如 "N/A", "TBD"）
    """
    if not text:
        return True

    text = text.strip()

    # 極短文字
    if len(text) < 2:
        return True

    # 純數字（含小數點、斜線）
    import re
    if re.match(r'^[\d\.\-\/\s\"\'\,]+$', text):
        return True

    # 常見不需翻譯的標記
    skip_patterns = [
        'N/A', 'TBD', 'TBC', 'NA', '-', '--', '—',
        'YES', 'NO', 'OK', 'X', '✓', '✗',
    ]
    if text.upper() in skip_patterns:
        return True

    return False
