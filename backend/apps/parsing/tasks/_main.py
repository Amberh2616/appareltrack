"""
Parsing Tasks - v2.2.1
Celery tasks for AI parsing (Tech Pack extraction)
"""

from celery import shared_task
from django.utils import timezone
from datetime import timedelta
import uuid

from ..models import ExtractionRun
from apps.styles.models import StyleRevision


@shared_task(bind=True)
def parse_techpack_task(self, extraction_run_id: str, targets: list):
    """
    Celery task: Parse Tech Pack and extract BOM/Measurement/Construction

    Phase 1: STUB VERSION - Returns fake data matching AI-JSON-SCHEMA_v2.2.1
    Phase 2+: Real AI implementation with PyMuPDF + GPT-4 Vision

    Args:
        extraction_run_id: UUID of ExtractionRun
        targets: List of ['bom', 'measurement', 'construction']

    Returns:
        dict: Task result
    """
    try:
        # Get extraction run
        extraction_run = ExtractionRun.objects.select_related(
            'style_revision', 'document'
        ).get(pk=extraction_run_id)

        # Update status to processing
        extraction_run.status = 'processing'
        extraction_run.save(update_fields=['status'])

        # STUB: Generate fake AI data matching schema
        stub_data = generate_stub_extraction_data(
            revision=extraction_run.style_revision,
            targets=targets
        )

        # Update revision draft data
        revision = extraction_run.style_revision

        if 'bom' in targets and 'bom' in stub_data:
            revision.draft_bom_data = stub_data['bom']

        if 'measurement' in targets and 'measurement' in stub_data:
            revision.draft_measurement_data = stub_data['measurement']

        if 'construction' in targets and 'construction' in stub_data:
            revision.draft_construction_data = stub_data['construction']

        revision.save(update_fields=[
            'draft_bom_data',
            'draft_measurement_data',
            'draft_construction_data'
        ])

        # Update extraction run
        extraction_run.status = 'completed'
        extraction_run.extracted_data = stub_data
        extraction_run.confidence_score = 0.85  # Stub confidence
        extraction_run.issues = stub_data.get('issues', [])
        extraction_run.ai_model = 'stub-v1.0'
        extraction_run.processing_time_ms = 2500  # Fake 2.5s
        extraction_run.api_cost = 1.20  # Fake $1.20
        extraction_run.completed_at = timezone.now()
        extraction_run.save()

        return {
            'status': 'success',
            'extraction_run_id': str(extraction_run_id),
            'targets_completed': targets,
            'confidence_score': extraction_run.confidence_score,
        }

    except ExtractionRun.DoesNotExist:
        return {
            'status': 'error',
            'message': f'ExtractionRun {extraction_run_id} not found'
        }
    except Exception as e:
        # Update extraction run to failed
        try:
            extraction_run = ExtractionRun.objects.get(pk=extraction_run_id)
            extraction_run.status = 'failed'
            extraction_run.completed_at = timezone.now()
            extraction_run.save()
        except:
            pass

        return {
            'status': 'error',
            'message': str(e)
        }


def generate_stub_extraction_data(revision: StyleRevision, targets: list) -> dict:
    """
    Generate stub AI extraction data matching AI-JSON-SCHEMA_v2.2.1_COMPLETE.md

    This is Phase 1 fake data to enable UI development.
    Replace with real AI parser in Phase 2.

    🆕 Added: Auto-translation using machine_translate()
    """
    from ..utils.translate import machine_translate

    result = {}
    issues = []

    style_number = revision.style.style_number
    style_name = revision.style.style_name

    # BOM stub data
    if 'bom' in targets:
        result['bom'] = {
            'items': [
                {
                    'item_number': 1,
                    'category': 'fabric',
                    'description': 'Nulu fabric',
                    'description_zh': machine_translate('Nulu fabric'),  # 🆕 Auto-translate
                    'material_code': 'NULU-001',
                    'color': 'Black',
                    'supplier': None,  # Missing - will create issue
                    'consumption': None,  # Missing - will create issue
                    'uom': 'yard/pc',
                    'placement': 'Main body',
                    'notes': '',
                    'evidence': {
                        'source': 'techpack',
                        'page': 3,
                        'bbox': [100, 200, 400, 250],
                        'text_snippet': 'Main fabric: Nulu fabric, Black'
                    },
                    'field_confidence': {
                        'description': 0.95,
                        'material_code': 0.80,
                        'color': 0.92,
                        'supplier': 0.0,  # Missing
                        'consumption': 0.0  # Missing
                    }
                },
                {
                    'item_number': 2,
                    'category': 'trim',
                    'description': 'Elastic waistband 1" width',
                    'description_zh': machine_translate('Elastic waistband 1" width'),  # 🆕 Auto-translate
                    'material_code': 'ELAS-WB-1',
                    'color': 'Black',
                    'supplier': None,
                    'consumption': None,
                    'uom': 'cm/pc',
                    'placement': 'Waistband',
                    'notes': '',
                    'evidence': {
                        'source': 'techpack',
                        'page': 3,
                        'bbox': [100, 280, 400, 320],
                        'text_snippet': 'Elastic: 1" waistband elastic, black'
                    },
                    'field_confidence': {
                        'description': 0.90,
                        'material_code': 0.75,
                        'color': 0.88,
                        'supplier': 0.0,
                        'consumption': 0.0
                    }
                }
            ]
        }

        # Generate issues for missing fields
        bom_issues = [
            {
                'type': 'missing_field',
                'severity': 'error',
                'target': 'bom',
                'item_number': 1,
                'field': 'supplier',
                'message': 'Supplier not found in Tech Pack for item #1',
                'suggested_fix': 'Please assign supplier manually'
            },
            {
                'type': 'missing_field',
                'severity': 'error',
                'target': 'bom',
                'item_number': 1,
                'field': 'consumption',
                'message': 'Consumption not found in Tech Pack for item #1',
                'suggested_fix': 'Use pre-estimate or wait for marker report'
            },
            {
                'type': 'missing_field',
                'severity': 'error',
                'target': 'bom',
                'item_number': 2,
                'field': 'supplier',
                'message': 'Supplier not found in Tech Pack for item #2',
                'suggested_fix': 'Please assign supplier manually'
            },
            {
                'type': 'missing_field',
                'severity': 'error',
                'target': 'bom',
                'item_number': 2,
                'field': 'consumption',
                'message': 'Consumption not found in Tech Pack for item #2',
                'suggested_fix': 'Use trim estimation rule or manual input'
            }
        ]

        # Add issues to both BOM data and global issues list
        result['bom']['issues'] = bom_issues
        issues.extend(bom_issues)

    # Measurement stub data
    if 'measurement' in targets:
        result['measurement'] = {
            'points': [
                {
                    'point_code': 'A',
                    'point_name': 'Chest width',
                    'measurement_method': 'Laid flat, across chest 1" below armhole',
                    'tolerance': '+/- 0.5cm',
                    'sizes': {
                        'XS': 40.0,
                        'S': 42.5,
                        'M': 45.0,
                        'L': 47.5,
                        'XL': 50.0
                    },
                    'evidence': {
                        'source': 'techpack',
                        'page': 5,
                        'bbox': [120, 300, 500, 340],
                        'text_snippet': 'A: Chest width - 40/42.5/45/47.5/50'
                    },
                    'field_confidence': {
                        'point_name': 0.92,
                        'measurement_method': 0.75,
                        'sizes': 0.88
                    }
                },
                {
                    'point_code': 'B',
                    'point_name': 'Body length',
                    'measurement_method': 'HPS to bottom hem',
                    'tolerance': '+/- 0.5cm',
                    'sizes': {
                        'XS': 60.0,
                        'S': 61.0,
                        'M': 62.0,
                        'L': 63.0,
                        'XL': 64.0
                    },
                    'evidence': {
                        'source': 'techpack',
                        'page': 5,
                        'bbox': [120, 360, 500, 400],
                        'text_snippet': 'B: Body length HPS - 60/61/62/63/64'
                    },
                    'field_confidence': {
                        'point_name': 0.90,
                        'measurement_method': 0.85,
                        'sizes': 0.92
                    }
                }
            ],
            'issues': []
        }

    # Construction stub data
    if 'construction' in targets:
        result['construction'] = {
            'steps': [
                {
                    'step_number': 1,
                    'step_name': 'Cut fabric',
                    'description': 'Cut main body panels from Nulu fabric per marker',
                    'description_zh': machine_translate('Cut main body panels from Nulu fabric per marker'),  # 🆕 Auto-translate
                    'machine_type': 'Cutting machine',
                    'machine_type_zh': machine_translate('Cutting machine'),  # 🆕 Auto-translate
                    'special_requirements': 'Mind fabric stretch direction',
                    'qc_checkpoints': ['Check grain line', 'Verify pattern placement'],
                    'evidence': {
                        'source': 'techpack',
                        'page': 7,
                        'bbox': [100, 200, 500, 250],
                        'text_snippet': 'Step 1: Cut fabric panels'
                    },
                    'field_confidence': {
                        'step_name': 0.88,
                        'description': 0.75,
                        'machine_type': 0.70
                    }
                },
                {
                    'step_number': 2,
                    'step_name': 'Sew side seams',
                    'description': 'Join front and back panels at side seams using flatlock stitch',
                    'description_zh': machine_translate('Join front and back panels at side seams using flatlock stitch'),  # 🆕 Auto-translate
                    'machine_type': 'Flatlock machine',
                    'machine_type_zh': machine_translate('Flatlock machine'),  # 🆕 Auto-translate
                    'special_requirements': 'Use Nylon thread, 3-thread flatlock',
                    'qc_checkpoints': ['Check seam flatness', 'Verify stitch density'],
                    'evidence': {
                        'source': 'techpack',
                        'page': 7,
                        'bbox': [100, 280, 500, 330],
                        'text_snippet': 'Step 2: Flatlock side seams'
                    },
                    'field_confidence': {
                        'step_name': 0.90,
                        'description': 0.82,
                        'machine_type': 0.85
                    }
                }
            ],
            'issues': []
        }

    # Add global issues
    result['issues'] = issues

    return result


# ============================================
# DA-2: Async Document Processing Tasks
# ============================================

@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def classify_document_task(self, document_id: str) -> dict:
    """
    Async task: AI classification of uploaded document

    Args:
        document_id: UUID of UploadedDocument

    Returns:
        dict: {
            'status': 'success' | 'error',
            'document_id': str,
            'classification_result': dict | None,
            'error': str | None
        }
    """
    import logging
    import os
    import tempfile
    from ..models import UploadedDocument
    from ..services import classify_document

    logger = logging.getLogger(__name__)

    def _get_local_path(field_file):
        try:
            return field_file.path, None
        except NotImplementedError:
            ext = os.path.splitext(field_file.name)[1] or '.pdf'
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
            field_file.seek(0)
            tmp.write(field_file.read())
            tmp.close()
            logger.info(f"[S3] Downloaded {field_file.name} to temp file {tmp.name}")
            return tmp.name, tmp.name

    try:
        doc = UploadedDocument.objects.get(pk=document_id)

        # Update status
        doc.status = 'classifying'
        doc.save(update_fields=['status', 'updated_at'])

        file_path, temp_file = _get_local_path(doc.file)
        logger.info(f"[Async] Starting classification for document {doc.id}: {file_path}")

        # Run classification
        try:
            classification_result = classify_document(file_path)
        finally:
            if temp_file:
                try:
                    os.unlink(temp_file)
                except OSError:
                    pass

        # Update document
        doc.classification_result = classification_result
        doc.status = 'classified'
        doc.save(update_fields=['classification_result', 'status', 'updated_at'])

        logger.info(f"[Async] Classification completed for {doc.id}: {classification_result['file_type']}")

        return {
            'status': 'success',
            'document_id': str(doc.id),
            'classification_result': classification_result,
        }

    except UploadedDocument.DoesNotExist:
        return {
            'status': 'error',
            'document_id': document_id,
            'error': f'Document {document_id} not found'
        }
    except Exception as e:
        logger.error(f"[Async] Classification failed for {document_id}: {str(e)}", exc_info=True)

        # Update status to failed
        try:
            doc = UploadedDocument.objects.get(pk=document_id)
            doc.status = 'failed'
            if not doc.extraction_errors:
                doc.extraction_errors = []
            doc.extraction_errors.append({
                'step': 'classification',
                'error': str(e)
            })
            doc.save(update_fields=['status', 'extraction_errors', 'updated_at'])
        except Exception:
            pass

        # Retry on transient errors
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)

        return {
            'status': 'error',
            'document_id': document_id,
            'error': str(e)
        }


@shared_task(bind=True, max_retries=1, time_limit=600, soft_time_limit=540)
def extract_document_task(self, document_id: str, target_style_id: str = None) -> dict:
    """
    Async task: AI extraction for classified document

    This is a long-running task (60-150 seconds typically).
    time_limit=600 (10 minutes) to handle large PDFs.

    Args:
        document_id: UUID of UploadedDocument
        target_style_id: Optional UUID of existing Style to link to

    Returns:
        dict: {
            'status': 'success' | 'error',
            'document_id': str,
            'style_revision_id': str | None,
            'tech_pack_revision_id': str | None,
            'extraction_stats': dict | None,
            'error': str | None
        }
    """
    import logging
    from ..models import UploadedDocument
    from ..services.extraction_service import perform_extraction

    logger = logging.getLogger(__name__)

    try:
        doc = UploadedDocument.objects.get(pk=document_id)

        # Validate status
        if doc.status not in ['classified', 'extracting']:
            return {
                'status': 'error',
                'document_id': document_id,
                'error': f'Cannot extract document in status: {doc.status}'
            }

        # Update status
        doc.status = 'extracting'
        doc.save(update_fields=['status', 'updated_at'])

        logger.info(f"[Async] Starting extraction for document {doc.id}")

        # Perform extraction (refactored from views.py)
        result = perform_extraction(doc, target_style_id=target_style_id)

        logger.info(f"[Async] Extraction completed for {doc.id}: {result['extraction_stats']}")

        return {
            'status': 'success',
            'document_id': str(doc.id),
            'style_revision_id': result.get('style_revision_id'),
            'tech_pack_revision_id': result.get('tech_pack_revision_id'),
            'extraction_stats': result.get('extraction_stats'),
        }

    except UploadedDocument.DoesNotExist:
        return {
            'status': 'error',
            'document_id': document_id,
            'error': f'Document {document_id} not found'
        }
    except Exception as e:
        logger.error(f"[Async] Extraction failed for {document_id}: {str(e)}", exc_info=True)

        # Update status to failed
        try:
            doc = UploadedDocument.objects.get(pk=document_id)
            doc.status = 'failed'
            if not doc.extraction_errors:
                doc.extraction_errors = []
            doc.extraction_errors.append({
                'step': 'extraction',
                'error': str(e)
            })
            doc.save(update_fields=['status', 'extraction_errors', 'updated_at'])
        except Exception:
            pass

        return {
            'status': 'error',
            'document_id': document_id,
            'error': str(e)
        }


# =============================================================================
# Translation Tasks (延遲翻譯優化)
# =============================================================================

@shared_task(bind=True, max_retries=2, time_limit=300, soft_time_limit=270)
def translate_page_task(self, page_id: int, force: bool = False) -> dict:
    """
    Async task: 翻譯單頁所有 pending blocks

    Args:
        page_id: RevisionPage ID
        force: 是否重新翻譯已翻譯的 blocks

    Returns:
        dict: {
            'status': 'success' | 'error',
            'page_id': int,
            'stats': {'total': int, 'success': int, 'failed': int},
            'error': str | None
        }
    """
    import logging
    from ..models_blocks import RevisionPage
    from ..services.translation_service import translate_page

    logger = logging.getLogger(__name__)

    try:
        page = RevisionPage.objects.get(pk=page_id)
        logger.info(f"[Async] Starting translation for page {page.page_number}")

        stats = translate_page(page, force=force)

        logger.info(f"[Async] Page {page.page_number} translation completed: {stats}")

        return {
            'status': 'success',
            'page_id': page_id,
            'stats': stats,
        }

    except RevisionPage.DoesNotExist:
        return {
            'status': 'error',
            'page_id': page_id,
            'error': f'Page {page_id} not found'
        }
    except Exception as e:
        logger.error(f"[Async] Translation failed for page {page_id}: {str(e)}", exc_info=True)

        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)

        return {
            'status': 'error',
            'page_id': page_id,
            'error': str(e)
        }


@shared_task(bind=True, max_retries=1, time_limit=1800, soft_time_limit=1700)
def translate_document_task(self, revision_id: str, mode: str = 'missing_only') -> dict:
    """
    Async task: 翻譯整份文件

    Args:
        revision_id: TechPackRevision UUID
        mode: 'missing_only' (只翻譯 pending) | 'all' (全部重新翻譯)

    Returns:
        dict: {
            'status': 'success' | 'error',
            'revision_id': str,
            'stats': {'total': int, 'success': int, 'failed': int, 'pages': int},
            'error': str | None
        }
    """
    import logging
    from ..models_blocks import Revision as TechPackRevision
    from ..services.translation_service import translate_document

    logger = logging.getLogger(__name__)

    try:
        revision = TechPackRevision.objects.get(pk=revision_id)
        logger.info(f"[Async] Starting document translation for {revision.filename}, mode={mode}")

        stats = translate_document(revision, mode=mode)

        logger.info(f"[Async] Document translation completed: {stats}")

        return {
            'status': 'success',
            'revision_id': str(revision.id),
            'stats': stats,
        }

    except TechPackRevision.DoesNotExist:
        return {
            'status': 'error',
            'revision_id': revision_id,
            'error': f'Revision {revision_id} not found'
        }
    except Exception as e:
        logger.error(f"[Async] Document translation failed for {revision_id}: {str(e)}", exc_info=True)

        return {
            'status': 'error',
            'revision_id': revision_id,
            'error': str(e)
        }


@shared_task(bind=True, max_retries=1, time_limit=600, soft_time_limit=540)
def retry_failed_translations_task(self, revision_id: str) -> dict:
    """
    Async task: 重試失敗的翻譯

    Args:
        revision_id: TechPackRevision UUID

    Returns:
        dict: {
            'status': 'success' | 'error',
            'revision_id': str,
            'stats': {'total': int, 'success': int, 'failed': int},
            'error': str | None
        }
    """
    import logging
    from ..models_blocks import Revision as TechPackRevision
    from ..services.translation_service import retry_failed_blocks

    logger = logging.getLogger(__name__)

    try:
        revision = TechPackRevision.objects.get(pk=revision_id)
        logger.info(f"[Async] Retrying failed translations for {revision.filename}")

        stats = retry_failed_blocks(revision)

        logger.info(f"[Async] Retry completed: {stats}")

        return {
            'status': 'success',
            'revision_id': str(revision.id),
            'stats': stats,
        }

    except TechPackRevision.DoesNotExist:
        return {
            'status': 'error',
            'revision_id': revision_id,
            'error': f'Revision {revision_id} not found'
        }
    except Exception as e:
        logger.error(f"[Async] Retry failed for {revision_id}: {str(e)}", exc_info=True)

        return {
            'status': 'error',
            'revision_id': revision_id,
            'error': str(e)
        }