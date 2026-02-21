from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.core.files.storage import default_storage
from celery.result import AsyncResult
from .models import ExtractionRun, DraftReviewItem, UploadedDocument
from .models_blocks import Revision, RevisionPage, DraftBlock, DraftBlockHistory
from .serializers import (
    ExtractionRunSerializer,
    DraftReviewItemSerializer,
    RevisionSerializer,
    RevisionListSerializer,
    DraftBlockSerializer,
    DraftBlockPatchSerializer,
    DraftBlockPositionSerializer,
    DraftBlockBatchPositionSerializer,
    UploadedDocumentSerializer,
    DocumentUploadSerializer,
)
from .services import classify_document
from .tasks import classify_document_task, extract_document_task
import os
import logging

logger = logging.getLogger(__name__)


# ============================================
# DA-2: Task Status API
# ============================================

class TaskStatusViewSet(viewsets.ViewSet):
    """
    Task Status ViewSet for checking Celery task progress

    GET /api/v2/tasks/{task_id}/status/
    """

    def retrieve(self, request, pk=None):
        """
        Get status of a Celery task

        Returns:
        - task_id: The task ID
        - status: PENDING | STARTED | SUCCESS | FAILURE | RETRY | REVOKED
        - ready: Whether the task has completed (success or failure)
        - result: Task result if completed (None if still running)
        - progress: Optional progress info (for tasks that report it)
        """
        if not pk:
            return Response(
                {'error': 'Task ID is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        result = AsyncResult(pk)

        response_data = {
            'task_id': pk,
            'status': result.status,
            'ready': result.ready(),
            'successful': result.successful() if result.ready() else None,
        }

        # Include result if task is complete
        if result.ready():
            try:
                task_result = result.result
                # If result is an exception, convert to error dict
                if isinstance(task_result, Exception):
                    response_data['result'] = {
                        'status': 'error',
                        'error': str(task_result),
                        'error_type': type(task_result).__name__
                    }
                else:
                    response_data['result'] = task_result
            except Exception as e:
                # Handle cases where result can't be serialized
                response_data['result'] = {'error': str(e)}

        # For STARTED tasks, try to get progress info
        if result.status == 'STARTED' and hasattr(result, 'info') and result.info:
            response_data['progress'] = result.info

        return Response(response_data)


class ExtractionRunViewSet(viewsets.ModelViewSet):
    queryset = ExtractionRun.objects.all()
    serializer_class = ExtractionRunSerializer


class DraftReviewItemViewSet(viewsets.ModelViewSet):
    queryset = DraftReviewItem.objects.all()
    serializer_class = DraftReviewItemSerializer


# ============================================
# Block-Based Parsing Views
# ============================================

class RevisionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Revision ViewSet - Draft Review 主 API

    GET /api/v2/revisions/          - 列表（輕量）
    GET /api/v2/revisions/{id}/     - 詳細（含 pages + blocks）
    POST /api/v2/revisions/{id}/approve/ - Approve revision
    """
    queryset = Revision.objects.all()
    ordering = ['-created_at']  # Fix: Use created_at, not created

    def get_queryset(self):
        """
        根據 action 動態調整 prefetch
        """
        queryset = super().get_queryset()
        if self.action == 'retrieve':
            queryset = queryset.prefetch_related('pages__blocks')
        return queryset

    def get_serializer_class(self):
        if self.action == 'list':
            return RevisionListSerializer
        return RevisionSerializer

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        """
        Approve a revision - marks it as completed

        Validation:
        - Must have at least 1 block

        State transition:
        - Any status → "completed"
        """
        revision = self.get_object()

        # ✅ 基本驗證：必須至少有 1 個 block
        has_blocks = DraftBlock.objects.filter(page__revision=revision).exists()
        if not has_blocks:
            return Response(
                {"detail": "Cannot approve: no blocks found for this revision."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ✅ 狀態切換
        # STATUS_CHOICES: uploaded, parsing, parsed, reviewing, completed
        # 沒有 "approved"，所以用 "completed"
        revision.status = "completed"
        revision.save(update_fields=["status", "updated_at"])

        serializer = self.get_serializer(revision)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="translate-batch")
    def translate_batch(self, request, pk=None):
        """
        Batch translate all DraftBlocks for a revision (延遲翻譯優化)

        POST /api/v2/revisions/{id}/translate-batch/
        Body: {
            "mode": "missing_only" | "all",
            "async": true | false
        }

        Returns:
            Sync: { "total": int, "success": int, "failed": int, "pages": int }
            Async: { "task_id": str, "status": "pending" }
        """
        from .services.translation_service import translate_document, get_translation_progress
        from .tasks._main import translate_document_task

        mode = request.data.get('mode', 'missing_only')
        use_async = request.data.get('async', False)

        revision = self.get_object()

        if use_async:
            # 異步翻譯
            task = translate_document_task.delay(str(revision.id), mode=mode)
            return Response({
                'task_id': task.id,
                'status': 'pending',
            }, status=status.HTTP_202_ACCEPTED)
        else:
            # 同步翻譯
            result = translate_document(revision, mode=mode)
            return Response(result, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="translation-progress")
    def translation_progress(self, request, pk=None):
        """
        Get translation progress for a revision

        GET /api/v2/revisions/{id}/translation-progress/

        Returns:
            {
                "total": int,
                "done": int,
                "pending": int,
                "failed": int,
                "skipped": int,
                "progress": int (0-100),
                "pages": [{ "page_number": int, "progress": int, ... }, ...]
            }
        """
        from .services.translation_service import get_translation_progress

        revision = self.get_object()
        progress = get_translation_progress(revision)
        return Response(progress, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="translate-page/(?P<page_num>[0-9]+)")
    def translate_page(self, request, pk=None, page_num=None):
        """
        Translate a single page (延遲翻譯優化)

        POST /api/v2/revisions/{id}/translate-page/{page_num}/
        Body: {
            "force": false,
            "async": false
        }

        Returns:
            Sync: { "total": int, "success": int, "failed": int }
            Async: { "task_id": str, "status": "pending" }
        """
        from .services.translation_service import translate_page as do_translate_page
        from .tasks._main import translate_page_task

        revision = self.get_object()
        page_num = int(page_num)

        # Find page
        try:
            page = revision.pages.get(page_number=page_num)
        except RevisionPage.DoesNotExist:
            return Response(
                {"detail": f"Page {page_num} not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        force = request.data.get('force', False)
        use_async = request.data.get('async', False)

        if use_async:
            task = translate_page_task.delay(page.id, force=force)
            return Response({
                'task_id': task.id,
                'status': 'pending',
            }, status=status.HTTP_202_ACCEPTED)
        else:
            result = do_translate_page(page, force=force)
            return Response(result, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="retry-failed")
    def retry_failed(self, request, pk=None):
        """
        Retry failed translations

        POST /api/v2/revisions/{id}/retry-failed/
        Body: { "async": false }

        Returns:
            { "total": int, "success": int, "failed": int }
        """
        from .services.translation_service import retry_failed_blocks
        from .tasks._main import retry_failed_translations_task

        revision = self.get_object()
        use_async = request.data.get('async', False)

        if use_async:
            task = retry_failed_translations_task.delay(str(revision.id))
            return Response({
                'task_id': task.id,
                'status': 'pending',
            }, status=status.HTTP_202_ACCEPTED)
        else:
            result = retry_failed_blocks(revision)
            return Response(result, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="export-bilingual-pdf")
    def export_bilingual_pdf(self, request, pk=None):
        """
        Export bilingual Tech Pack PDF (原始 PDF + 中文疊加)

        Query params:
        - font_size: 中文字體大小 (7/9/11，預設 9)

        Returns:
            PDF file download
        """
        from .services.techpack_pdf_export import export_techpack_bilingual_pdf

        revision = self.get_object()

        # 獲取字體大小參數
        font_size = int(request.query_params.get('font_size', 9))
        if font_size not in [7, 9, 11]:
            font_size = 9

        try:
            return export_techpack_bilingual_pdf(revision, font_size)
        except Exception as e:
            logger.error(f"Failed to export bilingual PDF for revision {pk}: {str(e)}")
            return Response(
                {"detail": f"Failed to export PDF: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["get"], url_path="page-image/(?P<page_num>[0-9]+)")
    def page_image(self, request, pk=None, page_num=None):
        """
        Render a PDF page as a PNG image

        GET /api/v2/revisions/{id}/page-image/{page_num}/

        Query params:
        - scale: Image scale factor (0.5-3.0, default 1.5)

        Returns:
            PNG image (image/png)
        """
        import fitz  # PyMuPDF
        from django.http import HttpResponse
        import io

        revision = self.get_object()
        page_num = int(page_num)

        # Validate page number
        if page_num < 1 or page_num > revision.page_count:
            return Response(
                {"detail": f"Page {page_num} out of range (1-{revision.page_count})"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get scale parameter
        scale = float(request.query_params.get('scale', 1.5))
        scale = max(0.5, min(3.0, scale))  # Clamp to 0.5-3.0

        try:
            from django.core.cache import cache
            import os as _os, tempfile as _tempfile

            # Redis cache key: revision + page + scale
            cache_key = f"page_img:{pk}:{page_num}:{scale}"
            img_data = cache.get(cache_key)

            if img_data is None:
                # Cache miss → download PDF from R2 and render
                def _get_local_path(f):
                    try:
                        return f.path, None
                    except NotImplementedError:
                        ext = _os.path.splitext(f.name)[1] or '.pdf'
                        tmp = _tempfile.NamedTemporaryFile(delete=False, suffix=ext)
                        f.seek(0)
                        tmp.write(f.read())
                        tmp.close()
                        return tmp.name, tmp.name

                local_path, temp_file = _get_local_path(revision.file)
                try:
                    pdf_doc = fitz.open(local_path)
                    page = pdf_doc.load_page(page_num - 1)  # 0-indexed
                    mat = fitz.Matrix(scale, scale)
                    pix = page.get_pixmap(matrix=mat)
                    img_data = pix.tobytes("png")
                    pdf_doc.close()
                finally:
                    if temp_file:
                        try:
                            _os.unlink(temp_file)
                        except OSError:
                            pass

                # Cache for 24 hours (PDF pages don't change)
                cache.set(cache_key, img_data, timeout=86400)

            # Return as image response with browser cache headers
            response = HttpResponse(img_data, content_type="image/png")
            response['Content-Disposition'] = f'inline; filename="page_{page_num}.png"'
            response['Cache-Control'] = 'private, max-age=3600'
            return response

        except Exception as e:
            logger.error(f"Failed to render page {page_num} for revision {pk}: {str(e)}")
            return Response(
                {"detail": f"Failed to render page: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["patch"], url_path="blocks/positions")
    def update_block_positions(self, request, pk=None):
        """
        批量更新 Block 的翻譯疊加位置

        PATCH /api/v2/revisions/{id}/blocks/positions/

        Request:
        {
            "positions": [
                {"id": "uuid1", "overlay_x": 100, "overlay_y": 200, "overlay_visible": true},
                {"id": "uuid2", "overlay_x": 150, "overlay_y": 250, "overlay_visible": false}
            ]
        }

        Response:
        {
            "updated": 2,
            "errors": []
        }
        """
        revision = self.get_object()

        serializer = DraftBlockBatchPositionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        positions = serializer.validated_data['positions']
        updated = 0
        errors = []

        # 獲取這個 revision 下的所有 block IDs
        valid_block_ids = set(
            str(b.id) for b in DraftBlock.objects.filter(page__revision=revision)
        )

        for pos in positions:
            block_id = str(pos.get('id'))

            # 驗證 block 屬於這個 revision
            if block_id not in valid_block_ids:
                errors.append(f"Block {block_id} not found in this revision")
                continue

            try:
                DraftBlock.objects.filter(id=block_id).update(
                    overlay_x=pos.get('overlay_x'),
                    overlay_y=pos.get('overlay_y'),
                    overlay_visible=pos.get('overlay_visible', True)
                )
                updated += 1
            except Exception as e:
                errors.append(f"Failed to update block {block_id}: {str(e)}")

        return Response({
            "updated": updated,
            "errors": errors
        }, status=status.HTTP_200_OK)


class DraftBlockViewSet(viewsets.ModelViewSet):
    """
    DraftBlock ViewSet - 審稿編輯 API

    GET    /api/v2/draft-blocks/{id}/      - 取得單個 block
    PATCH  /api/v2/draft-blocks/{id}/      - 編輯 edited_text + status
    """
    queryset = DraftBlock.objects.select_related('page__revision').all()

    def get_serializer_class(self):
        if self.action in ['partial_update', 'update']:
            return DraftBlockPatchSerializer
        return DraftBlockSerializer

    def perform_update(self, serializer):
        """
        審稿時自動切換 status + 記錄 History

        規則：
        - 如果 edited_text 有改 → status = "edited"
        - 自動創建 DraftBlockHistory 記錄
        """
        instance = self.get_object()

        # 記錄修改前的值
        previous_text = instance.edited_text or instance.translated_text or instance.source_text

        # 如果 edited_text 被修改，自動設為 "edited"
        if 'edited_text' in serializer.validated_data:
            new_text = serializer.validated_data['edited_text']
            if new_text and new_text != instance.translated_text:
                serializer.validated_data['status'] = 'edited'

            # ✅ P2: 自動寫入 DraftBlockHistory
            if new_text != previous_text:
                # 先保存以獲取最新的 instance
                updated_instance = serializer.save()

                # 創建歷史記錄
                DraftBlockHistory.objects.create(
                    block=updated_instance,
                    previous_text=previous_text,
                    new_text=new_text,
                    changed_by='',  # TODO: 接入真實用戶系統後填入 request.user
                )
                return  # 已經 save 過了，不要再 save

        # 如果沒有創建 history，正常 save
        serializer.save()

    @action(detail=True, methods=["patch"], url_path="position")
    def update_position(self, request, pk=None):
        """
        更新單個 Block 的翻譯疊加位置

        PATCH /api/v2/draft-blocks/{id}/position/

        Request:
        {
            "overlay_x": 100,
            "overlay_y": 200,
            "overlay_visible": true
        }
        """
        block = self.get_object()

        serializer = DraftBlockPositionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        block.overlay_x = serializer.validated_data['overlay_x']
        block.overlay_y = serializer.validated_data['overlay_y']
        block.overlay_visible = serializer.validated_data.get('overlay_visible', True)
        block.save(update_fields=['overlay_x', 'overlay_y', 'overlay_visible', 'updated_at'])

        return Response(DraftBlockSerializer(block).data, status=status.HTTP_200_OK)


# ============================================
# UploadedDocument Views (P4)
# ============================================

class UploadedDocumentViewSet(viewsets.ModelViewSet):
    """
    UploadedDocument ViewSet for P4: Upload → Classify → Extract pipeline

    POST   /api/v2/uploaded-documents/        - Upload file
    GET    /api/v2/uploaded-documents/{id}/   - Get document details
    POST   /api/v2/uploaded-documents/{id}/classify/  - Trigger AI classification
    GET    /api/v2/uploaded-documents/{id}/status/    - Get processing status
    """
    queryset = UploadedDocument.objects.all()
    serializer_class = UploadedDocumentSerializer
    parser_classes = (MultiPartParser, FormParser)

    def create(self, request, *args, **kwargs):
        """
        Upload a document file

        POST /api/v2/uploaded-documents/
        Body: multipart/form-data with 'file' field
        """
        upload_serializer = DocumentUploadSerializer(data=request.data)
        upload_serializer.is_valid(raise_exception=True)

        uploaded_file = upload_serializer.validated_data['file']
        filename = uploaded_file.name
        file_ext = '.' + filename.split('.')[-1].lower()

        try:
            # Get organization from user, fallback to get_or_create default
            from apps.core.models import Organization
            org = getattr(request.user, 'organization', None)
            if org is None:
                org = Organization.objects.first()
                if org is None:
                    org = Organization.objects.create(name="Default Organization")
                # Bind org to superuser for future requests
                if request.user.is_authenticated and request.user.is_superuser:
                    request.user.organization = org
                    request.user.save(update_fields=['organization'])

            # Create UploadedDocument record
            doc = UploadedDocument.objects.create(
                organization=org,
                file=uploaded_file,
                filename=filename,
                file_type=file_ext[1:],  # Remove leading dot
                file_size=uploaded_file.size,
                status='uploaded',
                created_by=request.user if request.user.is_authenticated else None,
            )

            logger.info(f"Document uploaded successfully: {doc.id} - {filename}")

            # Return document details
            serializer = self.get_serializer(doc)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Error uploading document: {str(e)}", exc_info=True)
            return Response(
                {'error': f'Upload failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'], url_path='classify')
    def classify(self, request, pk=None):
        """
        Trigger AI classification for uploaded document

        POST /api/v2/uploaded-documents/{id}/classify/
        POST /api/v2/uploaded-documents/{id}/classify/?async=true  (async mode)

        Query params:
        - async: Set to 'true' for async processing (returns task_id)

        This action:
        1. Reads the uploaded file
        2. Uses GPT-4o Vision to classify content types
        3. Updates classification_result field
        4. Changes status to 'classified'
        """
        doc = self.get_object()

        if doc.status not in ['uploaded', 'classifying', 'failed']:
            return Response(
                {'error': f'Cannot classify document in status: {doc.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check for async mode
        use_async = request.query_params.get('async', 'false').lower() == 'true'

        if use_async:
            # DA-2: Async mode - dispatch Celery task
            try:
                task = classify_document_task.delay(str(doc.id))
                doc.classify_task_id = task.id
                doc.status = 'classifying'
                doc.save(update_fields=['classify_task_id', 'status', 'updated_at'])

                logger.info(f"[Async] Classification task dispatched for {doc.id}: task_id={task.id}")

                return Response({
                    'task_id': task.id,
                    'document_id': str(doc.id),
                    'status': 'pending',
                    'message': 'Classification task dispatched'
                }, status=status.HTTP_202_ACCEPTED)

            except Exception as e:
                logger.error(f"Failed to dispatch classification task for {doc.id}: {str(e)}")
                return Response(
                    {'error': f'Failed to dispatch task: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        # Sync mode (original behavior)
        try:
            # Update status
            doc.status = 'classifying'
            doc.save(update_fields=['status', 'updated_at'])

            # Get file path (handles S3/R2 by downloading to temp file)
            import os as _os, tempfile as _tempfile
            def _get_local_path(f):
                try:
                    return f.path, None
                except NotImplementedError:
                    ext = _os.path.splitext(f.name)[1] or '.pdf'
                    tmp = _tempfile.NamedTemporaryFile(delete=False, suffix=ext)
                    f.seek(0)
                    tmp.write(f.read())
                    tmp.close()
                    return tmp.name, tmp.name

            file_path, temp_file = _get_local_path(doc.file)
            logger.info(f"Starting classification for document {doc.id}: {file_path}")

            # Classify document using AI
            try:
                classification_result = classify_document(file_path)
            finally:
                if temp_file:
                    try:
                        _os.unlink(temp_file)
                    except OSError:
                        pass

            # Update document
            doc.classification_result = classification_result
            doc.status = 'classified'
            doc.save(update_fields=['classification_result', 'status', 'updated_at'])

            logger.info(f"Classification completed for {doc.id}: {classification_result['file_type']}")

            serializer = self.get_serializer(doc)
            return Response(serializer.data)

        except Exception as e:
            logger.error(f"Classification failed for {doc.id}: {str(e)}", exc_info=True)

            # Update status to failed
            doc.status = 'failed'
            doc.extraction_errors.append({
                'step': 'classification',
                'error': str(e)
            })
            doc.save(update_fields=['status', 'extraction_errors', 'updated_at'])

            return Response(
                {'error': f'Classification failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get'], url_path='status')
    def get_status(self, request, pk=None):
        """
        Get processing status for uploaded document

        GET /api/v2/uploaded-documents/{id}/status/

        Returns:
        - status: current processing status
        - classification_result: AI classification result (if available)
        - progress: processing progress information
        """
        doc = self.get_object()

        progress = {
            'uploaded': doc.status != 'uploaded',
            'classified': doc.status in ['classified', 'extracting', 'extracted', 'completed'],
            'extracted': doc.status in ['extracted', 'completed'],
        }

        response_data = {
            'id': str(doc.id),
            'status': doc.status,
            'filename': doc.filename,
            'classification_result': doc.classification_result,
            'extraction_errors': doc.extraction_errors,
            'progress': progress,
            'created_at': doc.created_at.isoformat(),
            'updated_at': doc.updated_at.isoformat(),
        }

        # ⚡ Add revision IDs if available (for navigation after extraction)
        if doc.style_revision:
            response_data['style_revision_id'] = str(doc.style_revision.id)
        if doc.tech_pack_revision:
            response_data['tech_pack_revision_id'] = str(doc.tech_pack_revision.id)

        return Response(response_data)

    @action(detail=True, methods=['post'], url_path='extract')
    def extract(self, request, pk=None):
        """
        Trigger AI extraction for classified document

        POST /api/v2/uploaded-documents/{id}/extract/
        POST /api/v2/uploaded-documents/{id}/extract/?async=true  (async mode)

        Query params:
        - async: Set to 'true' for async processing (returns task_id)

        This action:
        1. Validates document is classified
        2. Extracts Tech Pack, BOM, and Measurement data using AI
        3. Creates StyleRevision with extracted data
        4. Changes status to 'extracted'
        """
        doc = self.get_object()

        if doc.status not in ['classified', 'extracting']:
            return Response(
                {'error': f'Cannot extract document in status: {doc.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check for async mode
        use_async = request.query_params.get('async', 'false').lower() == 'true'

        # Check for style_id binding (from Style Center upload flow)
        target_style_id = request.query_params.get('style_id', None)
        if target_style_id:
            import uuid as _uuid
            try:
                _uuid.UUID(target_style_id)
            except (ValueError, AttributeError):
                return Response(
                    {'error': f'Invalid style_id format: {target_style_id}. Must be a valid UUID.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        if use_async:
            # DA-2: Async mode - dispatch Celery task
            try:
                task = extract_document_task.delay(str(doc.id), target_style_id=target_style_id)
                doc.extract_task_id = task.id
                doc.status = 'extracting'
                doc.save(update_fields=['extract_task_id', 'status', 'updated_at'])

                logger.info(f"[Async] Extraction task dispatched for {doc.id}: task_id={task.id}")

                return Response({
                    'task_id': task.id,
                    'document_id': str(doc.id),
                    'status': 'pending',
                    'message': 'Extraction task dispatched'
                }, status=status.HTTP_202_ACCEPTED)

            except Exception as e:
                logger.error(f"Failed to dispatch extraction task for {doc.id}: {str(e)}")
                return Response(
                    {'error': f'Failed to dispatch task: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        # Sync mode - run extraction in background thread, return 202 immediately
        # (avoids Railway proxy 60s timeout and gunicorn worker kill)
        import threading
        from django.utils import timezone

        def _run_extraction_background(doc_id, target_style_id):
            import django.db
            try:
                doc_obj = UploadedDocument.objects.get(id=doc_id)
                from .services.extraction_service import perform_extraction
                perform_extraction(doc_obj, target_style_id=target_style_id)
                logger.info(f"[Thread] Extraction completed for {doc_id}")
            except ValueError as e:
                logger.warning(f"[Thread] Extraction rejected for {doc_id}: {str(e)}")
                UploadedDocument.objects.filter(id=doc_id).update(
                    status='classified',
                    updated_at=timezone.now()
                )
            except Exception as e:
                logger.error(f"[Thread] Extraction failed for {doc_id}: {str(e)}", exc_info=True)
                try:
                    doc_obj = UploadedDocument.objects.get(id=doc_id)
                    if not doc_obj.extraction_errors:
                        doc_obj.extraction_errors = []
                    doc_obj.extraction_errors.append({
                        'step': 'extraction',
                        'error': str(e)
                    })
                    doc_obj.status = 'failed'
                    doc_obj.save(update_fields=['status', 'extraction_errors', 'updated_at'])
                except Exception:
                    UploadedDocument.objects.filter(id=doc_id).update(
                        status='failed',
                        updated_at=timezone.now()
                    )
            finally:
                django.db.connections.close_all()

        doc.status = 'extracting'
        doc.save(update_fields=['status', 'updated_at'])

        thread = threading.Thread(
            target=_run_extraction_background,
            args=(str(doc.id), target_style_id),
            daemon=True
        )
        thread.start()

        logger.info(f"[Thread] Extraction thread started for {doc.id}")
        return Response({
            'status': 'extracting',
            'document_id': str(doc.id),
            'message': 'Extraction started in background'
        }, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=['post'], url_path='batch-upload')
    def batch_upload(self, request):
        """
        批量上傳 Tech Pack（ZIP 文件）

        POST /api/v2/uploaded-documents/batch-upload/

        Request:
        - file: ZIP file containing PDFs

        File naming conventions:
        - Case A: {style_number}.pdf - 單個 PDF 包含所有內容
        - Case B: {style_number}_techpack.pdf, {style_number}_bom.pdf - 多個 PDF 按款式分組

        Response:
        {
            "total_files": 10,
            "styles_found": 5,
            "styles_created": 3,
            "documents_created": 10,
            "errors": [],
            "style_results": {
                "LW1FLWS": {
                    "style_id": "uuid",
                    "revision_id": "uuid",
                    "documents": [...],
                    "status": "created"
                }
            }
        }
        """
        if 'file' not in request.FILES:
            return Response(
                {'error': 'No file provided. Please upload a ZIP file.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        uploaded_file = request.FILES['file']

        # Validate file type
        if not uploaded_file.name.lower().endswith('.zip'):
            return Response(
                {'error': 'Invalid file type. Please upload a ZIP file.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            from apps.parsing.services.batch_upload_service import BatchUploadService

            service = BatchUploadService(user=request.user if request.user.is_authenticated else None)
            result = service.process_zip(uploaded_file)

            return Response({
                'total_files': result.total_files,
                'styles_found': result.styles_found,
                'styles_created': result.styles_created,
                'documents_created': result.documents_created,
                'errors': result.errors,
                'style_results': result.style_results,
            }, status=status.HTTP_200_OK if not result.errors else status.HTTP_207_MULTI_STATUS)

        except Exception as e:
            logger.error(f"Batch upload failed: {str(e)}", exc_info=True)
            return Response(
                {'error': f'Batch upload failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], url_path='batch-process')
    def batch_process(self, request):
        """
        批量處理已上傳的文檔（分類 + 提取）

        POST /api/v2/uploaded-documents/batch-process/

        Request:
        {
            "document_ids": ["uuid1", "uuid2", ...],
            "async": false  // 是否異步處理
        }

        Response:
        {
            "total": 10,
            "processed": 8,
            "failed": 2,
            "results": {
                "uuid1": {"status": "completed", "blocks_count": 50},
                "uuid2": {"status": "error", "error": "..."}
            }
        }
        """
        document_ids = request.data.get('document_ids', [])

        if not document_ids:
            return Response(
                {'error': 'No document_ids provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate document IDs
        existing_docs = UploadedDocument.objects.filter(id__in=document_ids)
        if existing_docs.count() != len(document_ids):
            found_ids = set(str(d.id) for d in existing_docs)
            missing_ids = [did for did in document_ids if did not in found_ids]
            return Response(
                {'error': f'Documents not found: {missing_ids}'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if async processing is requested
        run_async = request.data.get('async', False)

        if run_async:
            # TODO: Implement Celery task for async processing
            return Response(
                {'error': 'Async processing not yet implemented'},
                status=status.HTTP_501_NOT_IMPLEMENTED
            )

        try:
            from apps.parsing.services.batch_upload_service import BatchProcessingService

            service = BatchProcessingService()
            results = service.process_documents(document_ids)

            # Calculate summary
            completed = sum(1 for r in results.values() if r.get('status') == 'completed')
            failed = sum(1 for r in results.values() if r.get('status') == 'error')

            return Response({
                'total': len(document_ids),
                'processed': completed,
                'failed': failed,
                'results': results,
            }, status=status.HTTP_200_OK if failed == 0 else status.HTTP_207_MULTI_STATUS)

        except Exception as e:
            logger.error(f"Batch process failed: {str(e)}", exc_info=True)
            return Response(
                {'error': f'Batch process failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
