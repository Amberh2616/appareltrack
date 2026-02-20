"""
Styles Views - v2.4.0
Added: Style readiness API, BOM/Spec batch-verify
"""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from django.conf import settings
from django.utils import timezone

from django.db import models
from apps.core.api_utils import api_success, api_error, paginated_response, ErrorCodes
from .models import Style, StyleRevision, BOMItem, Measurement, Brand
from .serializers import (
    StyleSerializer,
    StyleListSerializer,
    StyleRevisionSerializer,
    BOMItemSerializer,
    MeasurementSerializer,
    IntakeBulkCreateRequestSerializer,
    BrandSerializer,
)
from .services import bulk_create_styles_and_revisions, build_styles_queryset_with_risk


class BrandViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Brand CRUD operations
    Brands contain BOM format configuration for consistent extraction
    """
    serializer_class = BrandSerializer
    permission_classes = []  # TODO: Enable authentication in production

    def _get_organization(self, request):
        """Get organization from request user (SaaS-Ready)."""
        from apps.core.models import Organization
        # Check if user is authenticated and has organization
        if hasattr(request, 'user') and hasattr(request.user, 'organization'):
            org = request.user.organization
            if org is not None:
                return org
        # Fallback for DEBUG mode or anonymous users
        if settings.DEBUG:
            return Organization.objects.first()
        return None

    def get_queryset(self):
        """Filter brands by organization"""
        org = self._get_organization(self.request)
        queryset = Brand.objects.all()
        if org is not None:
            queryset = queryset.filter(organization=org)
        return queryset.order_by('name')

    def perform_create(self, serializer):
        """Set organization when creating"""
        org = self._get_organization(self.request)
        serializer.save(organization=org)


class BOMItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet for BOM Item CRUD operations
    Nested under StyleRevision: /api/v2/revisions/{revision_id}/bom/
    """
    serializer_class = BOMItemSerializer
    permission_classes = []  # TODO: Enable authentication in production

    def _get_organization(self, request):
        """Get organization from request user (SaaS-Ready)."""
        org = getattr(request.user, 'organization', None)
        if org is None and settings.DEBUG:
            from apps.core.models import Organization
            org = Organization.objects.first()
        return org

    def get_queryset(self):
        """Filter BOM items by revision with tenant awareness"""
        revision_id = self.kwargs.get('revision_pk')
        org = self._get_organization(self.request)

        queryset = BOMItem.objects.filter(revision_id=revision_id).order_by('item_number')

        # SaaS-Ready: Ensure revision belongs to user's organization
        if org is not None:
            queryset = queryset.filter(revision__organization=org)

        return queryset

    def perform_create(self, serializer):
        """Set revision and item_number when creating with tenant check"""
        revision_id = self.kwargs.get('revision_pk')
        org = self._get_organization(self.request)

        # SaaS-Ready: Ensure revision belongs to user's organization
        if org is not None:
            revision = get_object_or_404(StyleRevision, pk=revision_id, organization=org)
        else:
            revision = get_object_or_404(StyleRevision, pk=revision_id)

        # Auto-generate item_number
        max_item = BOMItem.objects.filter(revision=revision).aggregate(
            max_num=models.Max('item_number')
        )['max_num']
        next_item_number = (max_item or 0) + 1

        serializer.save(revision=revision, item_number=next_item_number)

    @action(detail=True, methods=['post'])
    def translate(self, request, revision_pk=None, pk=None):
        """
        POST /api/v2/style-revisions/{revision_pk}/bom/{id}/translate/
        Translate a single BOM item's material name to Chinese
        """
        from apps.parsing.services.bom_translator import translate_single_bom_item

        item = self.get_object()
        result = translate_single_bom_item(item.id)

        if result.get('success'):
            item.refresh_from_db()
            serializer = self.get_serializer(item)
            return Response(serializer.data)
        else:
            return Response(
                {'error': result.get('error', 'Translation failed')},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['post'], url_path='translate-batch')
    def translate_batch(self, request, revision_pk=None):
        """
        POST /api/v2/style-revisions/{revision_pk}/bom/translate-batch/
        Batch translate all BOM items for a revision
        """
        from apps.parsing.services.bom_translator import translate_bom_items

        force = request.data.get('force', False)
        result = translate_bom_items(revision_id=revision_pk, force=force)
        return Response(result)

    # ====== 用量四階段管理 API ======

    @action(detail=True, methods=['post'], url_path='set-pre-estimate')
    def set_pre_estimate(self, request, revision_pk=None, pk=None):
        """
        POST /api/v2/style-revisions/{revision_pk}/bom/{id}/set-pre-estimate/
        設置預估用量（工廠經驗值）
        Body: { "value": "0.82" }
        """
        from decimal import Decimal, InvalidOperation

        item = self.get_object()

        if not item.can_edit_consumption():
            return Response(
                {'error': '用量已鎖定，無法修改'},
                status=status.HTTP_400_BAD_REQUEST
            )

        value = request.data.get('value')
        if value is None:
            return Response(
                {'error': '必須提供 value 參數'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            decimal_value = Decimal(str(value))
        except InvalidOperation:
            return Response(
                {'error': '無效的數值格式'},
                status=status.HTTP_400_BAD_REQUEST
            )

        item.set_pre_estimate(decimal_value, user=request.user)
        self._sync_usage_lines(item)

        serializer = self.get_serializer(item)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='set-sample')
    def set_sample(self, request, revision_pk=None, pk=None):
        """
        POST /api/v2/style-revisions/{revision_pk}/bom/{id}/set-sample/
        設置樣衣用量（打樣實際消耗）
        Body: { "value": "0.85" }
        """
        from decimal import Decimal, InvalidOperation

        item = self.get_object()

        if not item.can_edit_consumption():
            return Response(
                {'error': '用量已鎖定，無法修改'},
                status=status.HTTP_400_BAD_REQUEST
            )

        value = request.data.get('value')
        if value is None:
            return Response(
                {'error': '必須提供 value 參數'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            decimal_value = Decimal(str(value))
        except InvalidOperation:
            return Response(
                {'error': '無效的數值格式'},
                status=status.HTTP_400_BAD_REQUEST
            )

        item.set_sample(decimal_value, user=request.user)
        self._sync_usage_lines(item)

        serializer = self.get_serializer(item)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='confirm-consumption')
    def confirm_consumption(self, request, revision_pk=None, pk=None):
        """
        POST /api/v2/style-revisions/{revision_pk}/bom/{id}/confirm-consumption/
        確認用量（Marker Report 調整後）
        Body: { "value": "0.78", "source": "marker_report" }
        """
        from decimal import Decimal, InvalidOperation

        item = self.get_object()

        if not item.can_edit_consumption():
            return Response(
                {'error': '用量已鎖定，無法修改'},
                status=status.HTTP_400_BAD_REQUEST
            )

        value = request.data.get('value')
        source = request.data.get('source', 'manual')

        if value is None:
            return Response(
                {'error': '必須提供 value 參數'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            decimal_value = Decimal(str(value))
        except InvalidOperation:
            return Response(
                {'error': '無效的數值格式'},
                status=status.HTTP_400_BAD_REQUEST
            )

        item.confirm_consumption(decimal_value, source=source, user=request.user)
        self._sync_usage_lines(item)

        serializer = self.get_serializer(item)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='lock-consumption')
    def lock_consumption(self, request, revision_pk=None, pk=None):
        """
        POST /api/v2/style-revisions/{revision_pk}/bom/{id}/lock-consumption/
        鎖定用量（大貨報價確認後調用）
        Body: { "value": "0.85" }  // 可選，若不提供則使用 confirmed_value
        """
        from decimal import Decimal, InvalidOperation

        item = self.get_object()

        if item.consumption_maturity == 'locked':
            return Response(
                {'error': '用量已經鎖定'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 解析可選的 value 參數
        value_str = request.data.get('value')
        decimal_value = None

        if value_str:
            try:
                decimal_value = Decimal(str(value_str))
                if decimal_value < 0:
                    return Response(
                        {'error': '用量不能為負數'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except (InvalidOperation, ValueError):
                return Response(
                    {'error': '無效的數值格式'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        elif item.confirmed_value is None:
            return Response(
                {'error': '必須提供鎖定值或先確認用量'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            item.lock_consumption(value=decimal_value, user=request.user)
            self._sync_usage_lines(item)
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = self.get_serializer(item)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='batch-confirm')
    def batch_confirm(self, request, revision_pk=None):
        """
        POST /api/v2/style-revisions/{revision_pk}/bom/batch-confirm/
        批量確認用量
        Body: { "items": [{"id": "uuid", "value": "0.78"}], "source": "marker_report" }
        """
        from decimal import Decimal, InvalidOperation

        items_data = request.data.get('items', [])
        source = request.data.get('source', 'manual')
        results = []
        errors = []

        for item_data in items_data:
            item_id = item_data.get('id')
            value = item_data.get('value')

            try:
                item = BOMItem.objects.get(pk=item_id, revision_id=revision_pk)
                if not item.can_edit_consumption():
                    errors.append({'id': item_id, 'error': '用量已鎖定'})
                    continue

                decimal_value = Decimal(str(value))
                item.confirm_consumption(decimal_value, source=source, user=request.user)
                self._sync_usage_lines(item)
                results.append({'id': item_id, 'success': True})
            except BOMItem.DoesNotExist:
                errors.append({'id': item_id, 'error': '物料不存在'})
            except InvalidOperation:
                errors.append({'id': item_id, 'error': '無效的數值格式'})
            except Exception as e:
                errors.append({'id': item_id, 'error': str(e)})

        return Response({
            'confirmed': len(results),
            'errors': errors,
            'results': results
        })

    @action(detail=False, methods=['post'], url_path='batch-verify')
    def batch_verify(self, request, revision_pk=None):
        """
        POST /api/v2/style-revisions/{revision_pk}/bom/batch-verify/
        Batch verify BOM items.
        Body: {} (verify all) or {"ids": ["uuid1", "uuid2"]} (selective)
        """
        ids = request.data.get('ids')

        queryset = BOMItem.objects.filter(revision_id=revision_pk, is_verified=False)
        if ids:
            queryset = queryset.filter(id__in=ids)

        already_verified = BOMItem.objects.filter(
            revision_id=revision_pk, is_verified=True
        ).count()

        updated = queryset.update(
            is_verified=True,
            verified_at=timezone.now(),
            verified_by=request.user if request.user.is_authenticated else None,
        )

        return Response({
            'verified_count': updated,
            'already_verified': already_verified,
        })

    @action(detail=False, methods=['post'], url_path='batch-lock')
    def batch_lock(self, request, revision_pk=None):
        """
        POST /api/v2/style-revisions/{revision_pk}/bom/batch-lock/
        批量鎖定用量（所有已確認的物料）
        """
        items = BOMItem.objects.filter(
            revision_id=revision_pk,
            consumption_maturity='confirmed'
        )

        locked_count = 0
        errors = []

        for item in items:
            try:
                item.lock_consumption(user=request.user)
                self._sync_usage_lines(item)
                locked_count += 1
            except ValueError as e:
                errors.append({'id': str(item.id), 'error': str(e)})

        return Response({
            'locked': locked_count,
            'errors': errors
        })

    def _sync_usage_lines(self, bom_item):
        """同步 BOMItem 用量到關聯的 UsageLine"""
        try:
            from apps.costing.models import UsageLine

            # 取得當前最佳用量
            consumption = bom_item.current_consumption
            if consumption is None:
                return

            # 更新所有關聯的 UsageLine
            usage_lines = UsageLine.objects.filter(bom_item=bom_item)
            updated_count = usage_lines.update(consumption=consumption)

            # 如果是 locked，同步到 MaterialRequirement
            if bom_item.consumption_maturity == 'locked':
                from apps.orders.models import MaterialRequirement
                MaterialRequirement.objects.filter(bom_item=bom_item).update(
                    consumption_per_piece=consumption
                )

        except Exception as e:
            # Log error but don't fail the main operation
            import logging
            logging.error(f"Failed to sync usage lines for BOMItem {bom_item.id}: {e}")


class MeasurementViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Measurement CRUD operations
    Nested under StyleRevision: /api/v2/style-revisions/{revision_pk}/measurements/
    """
    serializer_class = MeasurementSerializer
    permission_classes = []  # TODO: Enable authentication in production

    def _get_organization(self, request):
        """Get organization from request user (SaaS-Ready)."""
        org = getattr(request.user, 'organization', None)
        if org is None and settings.DEBUG:
            from apps.core.models import Organization
            org = Organization.objects.first()
        return org

    def get_queryset(self):
        """Filter Measurements by revision with tenant awareness"""
        revision_id = self.kwargs.get('revision_pk')
        org = self._get_organization(self.request)

        queryset = Measurement.objects.filter(revision_id=revision_id).order_by('point_name')

        # SaaS-Ready: Ensure revision belongs to user's organization
        if org is not None:
            queryset = queryset.filter(revision__organization=org)

        return queryset

    def perform_create(self, serializer):
        """Set revision when creating with tenant check"""
        revision_id = self.kwargs.get('revision_pk')
        org = self._get_organization(self.request)

        # SaaS-Ready: Ensure revision belongs to user's organization
        if org is not None:
            revision = get_object_or_404(StyleRevision, pk=revision_id, organization=org)
        else:
            revision = get_object_or_404(StyleRevision, pk=revision_id)

        serializer.save(revision=revision)

    @action(detail=True, methods=['post'])
    def translate(self, request, revision_pk=None, pk=None):
        """
        POST /api/v2/style-revisions/{revision_pk}/measurements/{id}/translate/
        Translate a single Measurement's point_name to Chinese
        """
        from apps.parsing.services.measurement_translator import translate_single_measurement

        item = self.get_object()
        result = translate_single_measurement(item.id)

        if result.get('success'):
            item.refresh_from_db()
            serializer = self.get_serializer(item)
            return Response(serializer.data)
        else:
            return Response(
                {'error': result.get('error', 'Translation failed')},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['post'], url_path='translate-batch')
    def translate_batch(self, request, revision_pk=None):
        """
        POST /api/v2/style-revisions/{revision_pk}/measurements/translate-batch/
        Batch translate all Measurements for a revision
        """
        from apps.parsing.services.measurement_translator import translate_measurements

        force = request.data.get('force', False)
        result = translate_measurements(revision_id=revision_pk, force=force)
        return Response(result)

    @action(detail=False, methods=['post'], url_path='batch-verify')
    def batch_verify(self, request, revision_pk=None):
        """
        POST /api/v2/style-revisions/{revision_pk}/measurements/batch-verify/
        Batch verify measurements.
        Body: {} (verify all) or {"ids": ["uuid1", "uuid2"]} (selective)
        """
        ids = request.data.get('ids')

        queryset = Measurement.objects.filter(revision_id=revision_pk, is_verified=False)
        if ids:
            queryset = queryset.filter(id__in=ids)

        already_verified = Measurement.objects.filter(
            revision_id=revision_pk, is_verified=True
        ).count()

        updated = queryset.update(
            is_verified=True,
            verified_at=timezone.now(),
            verified_by=request.user if request.user.is_authenticated else None,
        )

        return Response({
            'verified_count': updated,
            'already_verified': already_verified,
        })


class StyleViewSet(viewsets.ViewSet):
    """
    ViewSet for Style CRUD and Intake operations
    """
    # TODO: Enable authentication in production
    # permission_classes = [IsAuthenticated]
    permission_classes = []

    def _get_organization(self, request):
        """
        Get organization from request user.
        Superusers get or create a default organization automatically.
        """
        org = getattr(request.user, 'organization', None)
        if org is None:
            if request.user.is_superuser or settings.DEBUG:
                from apps.core.models import Organization
                org = Organization.objects.first()
                if org is None:
                    org = Organization.objects.create(name="Default Organization")
                if request.user.is_superuser and request.user.organization is None:
                    request.user.organization = org
                    request.user.save(update_fields=['organization'])
        return org

    def list(self, request):
        """
        GET /api/v2/styles
        List all styles with risk badges
        """
        org = self._get_organization(request)
        if org is None:
            return api_error(
                code=ErrorCodes.UNAUTHORIZED,
                message="Organization not found",
                status_code=status.HTTP_403_FORBIDDEN
            )

        # Build queryset with risk annotations
        qs = build_styles_queryset_with_risk(org, request.query_params)

        # Pagination
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 50))

        # Calculate pagination
        total = qs.count()
        start = (page - 1) * page_size
        end = start + page_size

        # Get page data
        items = list(qs[start:end])

        # Serialize
        serializer = StyleListSerializer(items, many=True)

        return paginated_response(
            data=serializer.data,
            page=page,
            page_size=page_size,
            total=total
        )

    def retrieve(self, request, pk=None):
        """
        GET /api/v2/styles/{id}
        Get single style with all revisions
        """
        org = self._get_organization(request)
        if org is None:
            return api_error(
                code=ErrorCodes.UNAUTHORIZED,
                message="Organization not found",
                status_code=status.HTTP_403_FORBIDDEN
            )

        style = get_object_or_404(Style, pk=pk, organization=org)
        serializer = StyleSerializer(style)

        return api_success(data=serializer.data)

    @action(detail=True, methods=['get'], url_path='readiness')
    def readiness(self, request, pk=None):
        """
        GET /api/v2/styles/{id}/readiness/
        Returns aggregated readiness status for this style.
        """
        org = self._get_organization(request)
        if org is None:
            return api_error(
                code=ErrorCodes.UNAUTHORIZED,
                message="Organization not found",
                status_code=status.HTTP_403_FORBIDDEN
            )

        style = get_object_or_404(Style, pk=pk, organization=org)
        data = _compute_style_readiness(style)
        return api_success(data=data)

    def destroy(self, request, pk=None):
        """
        DELETE /api/v2/styles/{id}/
        Delete a style and all its related data.
        """
        org = self._get_organization(request)
        if org is None:
            return api_error(
                code=ErrorCodes.UNAUTHORIZED,
                message="Organization not found",
                status_code=status.HTTP_403_FORBIDDEN
            )

        style = get_object_or_404(Style, pk=pk, organization=org)
        style.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'], url_path='bulk-create')
    def bulk_create(self, request):
        """
        POST /api/v2/styles/bulk-create
        Bulk create styles and revisions (Intake)
        """
        org = self._get_organization(request)
        if org is None:
            return api_error(
                code=ErrorCodes.UNAUTHORIZED,
                message="Organization not found",
                status_code=status.HTTP_403_FORBIDDEN
            )

        serializer = IntakeBulkCreateRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return api_error(
                code=ErrorCodes.VALIDATION_ERROR,
                message="Invalid payload",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        result = bulk_create_styles_and_revisions(
            organization=org,
            items=serializer.validated_data['items'],
            options=serializer.validated_data.get('options', {})
        )

        return api_success(
            data=result['items'],
            meta=result['meta'],
            status_code=status.HTTP_200_OK
        )


class StyleRevisionViewSet(viewsets.ViewSet):
    """
    ViewSet for StyleRevision operations
    """
    # TODO: Enable authentication in production
    # permission_classes = [IsAuthenticated]
    permission_classes = []

    def _get_organization(self, request):
        """
        Get organization from request user.

        SaaS-Ready: No fallback to first organization in production.
        """
        org = getattr(request.user, 'organization', None)
        if org is None:
            if settings.DEBUG:
                from apps.core.models import Organization
                org = Organization.objects.first()
        return org

    def list(self, request):
        """
        GET /api/v2/style-revisions/
        List all style revisions (for dropdown selection)
        """
        revisions = StyleRevision.objects.select_related('style').order_by('-created_at')
        data = [
            {
                'id': str(rev.id),
                'revision_label': rev.revision_label,
                'style_number': rev.style.style_number if rev.style else None,
                'style_name': rev.style.style_name if rev.style else None,
                'status': rev.status,
                'created_at': rev.created_at.isoformat(),
            }
            for rev in revisions
        ]
        return Response({'results': data})

    def retrieve(self, request, pk=None):
        """
        GET /api/v2/style-revisions/{id}/
        Get single revision with style info
        """
        # Development mode: skip organization filter
        from django.conf import settings

        if settings.DEBUG:
            revision = get_object_or_404(
                StyleRevision.objects.select_related('style'),
                pk=pk
            )
        else:
            org = self._get_organization(request)
            if org is None:
                return api_error(
                    code=ErrorCodes.UNAUTHORIZED,
                    message="Organization not found",
                    status_code=status.HTTP_403_FORBIDDEN
                )
            revision = get_object_or_404(
                StyleRevision.objects.select_related('style'),
                pk=pk,
                style__organization=org
            )

        serializer = StyleRevisionSerializer(revision)
        return api_success(data=serializer.data)

    @action(detail=True, methods=['post'], url_path='parse')
    def parse(self, request, pk=None):
        """
        POST /api/v2/revisions/{id}/parse/
        Trigger AI parsing for this revision
        """
        from apps.parsing.tasks import parse_techpack_task
        from apps.parsing.models import ExtractionRun
        from apps.documents.models import Document

        org = self._get_organization(request)
        if org is None:
            return api_error(
                code=ErrorCodes.UNAUTHORIZED,
                message="Organization not found",
                status_code=status.HTTP_403_FORBIDDEN
            )

        revision = get_object_or_404(
            StyleRevision.objects.select_related('style'),
            pk=pk,
            style__organization=org
        )

        # Get targets from request (default: all)
        targets = request.data.get('targets', ['bom', 'measurement', 'construction'])

        # Get document (preferably tech pack)
        document = revision.documents.filter(
            doc_type='techpack'
        ).order_by('-uploaded_at').first()

        if not document:
            # Fall back to any document
            document = revision.documents.order_by('-uploaded_at').first()

        if not document:
            return api_error(
                code=ErrorCodes.VALIDATION_ERROR,
                message="No documents attached to this revision",
                status_code=status.HTTP_400_BAD_REQUEST
            )

        # Create extraction run
        extraction_run = ExtractionRun.objects.create(
            document=document,
            style_revision=revision,
            status='pending'
        )

        # Trigger Celery task
        task = parse_techpack_task.delay(
            extraction_run_id=str(extraction_run.id),
            targets=targets
        )

        return api_success(
            data={
                'extraction_run_id': str(extraction_run.id),
                'job_id': str(task.id),
                'status': 'queued',
                'message': f'Parsing started for {len(targets)} targets',
                'targets': targets
            },
            status_code=status.HTTP_202_ACCEPTED
        )

    @action(detail=True, methods=['get'], url_path='draft')
    def get_draft(self, request, pk=None):
        """
        GET /api/v2/revisions/{id}/draft/
        Get AI-extracted draft data (not yet verified)
        """
        org = self._get_organization(request)
        if org is None:
            return api_error(
                code=ErrorCodes.UNAUTHORIZED,
                message="Organization not found",
                status_code=status.HTTP_403_FORBIDDEN
            )

        revision = get_object_or_404(
            StyleRevision.objects.select_related('style'),
            pk=pk,
            style__organization=org
        )

        # Collect all issues from draft data
        all_issues = []
        if revision.draft_bom_data:
            all_issues.extend(revision.draft_bom_data.get('issues', []))
        if revision.draft_measurement_data:
            all_issues.extend(revision.draft_measurement_data.get('issues', []))
        if revision.draft_construction_data:
            all_issues.extend(revision.draft_construction_data.get('issues', []))

        return api_success(data={
            'bom': revision.draft_bom_data,
            'measurement': revision.draft_measurement_data,
            'construction': revision.draft_construction_data,
            'issues': all_issues
        })

    @action(detail=True, methods=['patch'], url_path='draft')
    def update_draft(self, request, pk=None):
        """
        PATCH /api/v2/revisions/{id}/draft/
        Update draft data (human corrections)
        """
        org = self._get_organization(request)
        if org is None:
            return api_error(
                code=ErrorCodes.UNAUTHORIZED,
                message="Organization not found",
                status_code=status.HTTP_403_FORBIDDEN
            )

        revision = get_object_or_404(
            StyleRevision.objects.select_related('style'),
            pk=pk,
            style__organization=org
        )

        # Update draft data
        if 'bom' in request.data:
            revision.draft_bom_data = request.data['bom']
        if 'measurement' in request.data:
            revision.draft_measurement_data = request.data['measurement']
        if 'construction' in request.data:
            revision.draft_construction_data = request.data['construction']

        revision.save()

        return api_success(
            data={
                'message': 'Draft data updated',
                'revision_id': str(revision.id)
            }
        )

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        """
        POST /api/v2/revisions/{id}/approve/
        Approve revision: write draft data to verified tables (BOMItem/Measurement/ConstructionStep)
        """
        from apps.styles.models import BOMItem, Measurement, ConstructionStep
        from django.utils import timezone

        org = self._get_organization(request)
        if org is None:
            return api_error(
                code=ErrorCodes.UNAUTHORIZED,
                message="Organization not found",
                status_code=status.HTTP_403_FORBIDDEN
            )

        revision = get_object_or_404(
            StyleRevision.objects.select_related('style'),
            pk=pk,
            style__organization=org
        )

        # Check for blocking issues (severity=error)
        all_issues = []
        if revision.draft_bom_data:
            all_issues.extend(revision.draft_bom_data.get('issues', []))
        if revision.draft_measurement_data:
            all_issues.extend(revision.draft_measurement_data.get('issues', []))
        if revision.draft_construction_data:
            all_issues.extend(revision.draft_construction_data.get('issues', []))

        blocking_issues = [i for i in all_issues if i.get('severity') == 'error']

        if blocking_issues:
            return api_error(
                code=ErrorCodes.VALIDATION_ERROR,
                message=f"Cannot approve: {len(blocking_issues)} blocking issues found",
                details={'blocking_issues': blocking_issues},
                status_code=status.HTTP_400_BAD_REQUEST
            )

        # Write draft data to verified tables
        created_counts = {
            'bom_items': 0,
            'measurements': 0,
            'construction_steps': 0
        }

        # Create BOM items
        if revision.draft_bom_data and revision.draft_bom_data.get('items'):
            for item_data in revision.draft_bom_data['items']:
                BOMItem.objects.create(
                    style_revision=revision,
                    item_number=item_data.get('item_number'),
                    category=item_data.get('category'),
                    description=item_data.get('description', ''),
                    material_code=item_data.get('material_code', ''),
                    color=item_data.get('color', ''),
                    supplier_id=item_data.get('supplier_id'),  # FK if available
                    consumption=item_data.get('consumption'),
                    uom=item_data.get('uom', ''),
                    placement=item_data.get('placement', ''),
                    notes=item_data.get('notes', ''),
                    ai_extracted=True,
                    ai_confidence=item_data.get('field_confidence', {}).get('description', 0.0)
                )
                created_counts['bom_items'] += 1

        # Create Measurements
        if revision.draft_measurement_data and revision.draft_measurement_data.get('points'):
            for point_data in revision.draft_measurement_data['points']:
                Measurement.objects.create(
                    style_revision=revision,
                    point_code=point_data.get('point_code', ''),
                    point_name=point_data.get('point_name', ''),
                    measurement_method=point_data.get('measurement_method', ''),
                    tolerance=point_data.get('tolerance', ''),
                    size_values=point_data.get('sizes', {}),
                    ai_extracted=True
                )
                created_counts['measurements'] += 1

        # Create Construction Steps
        if revision.draft_construction_data and revision.draft_construction_data.get('steps'):
            for step_data in revision.draft_construction_data['steps']:
                ConstructionStep.objects.create(
                    style_revision=revision,
                    step_number=step_data.get('step_number'),
                    step_name=step_data.get('step_name', ''),
                    description=step_data.get('description', ''),
                    machine_type=step_data.get('machine_type', ''),
                    special_requirements=step_data.get('special_requirements', ''),
                    qc_checkpoints=step_data.get('qc_checkpoints', []),
                    ai_extracted=True
                )
                created_counts['construction_steps'] += 1

        # Update revision status
        revision.status = 'approved'
        revision.approved_at = timezone.now()
        revision.approved_by = request.user if request.user.is_authenticated else None
        revision.save()

        return api_success(
            data={
                'message': 'Revision approved successfully',
                'revision_id': str(revision.id),
                'created': created_counts
            }
        )


def _compute_style_readiness(style):
    """
    Compute aggregated readiness data for a Style.
    Used by both the detail readiness endpoint and the list serializer.
    """
    from apps.parsing.models import UploadedDocument
    from apps.parsing.models_blocks import Revision as TechPackRevision, DraftBlock
    from apps.samples.models import SampleRequest, SampleRun, SampleMWO

    revision = style.current_revision
    revision_id = str(revision.id) if revision else None

    # --- Documents ---
    docs_qs = UploadedDocument.objects.filter(
        style_revision__style=style
    ).values('id', 'filename', 'status', 'classification_result', 'tech_pack_revision_id')
    documents = []
    for doc in docs_qs:
        cr = doc.get('classification_result') or {}
        documents.append({
            'id': str(doc['id']),
            'filename': doc['filename'],
            'file_type': cr.get('file_type', 'unknown'),
            'status': doc['status'],
        })

    # --- Translation progress ---
    # Find tech_pack_revision(s) linked to this style's uploaded documents
    tp_rev_ids = UploadedDocument.objects.filter(
        style_revision__style=style,
        tech_pack_revision__isnull=False,
    ).values_list('tech_pack_revision_id', flat=True)

    translation = {'total': 0, 'done': 0, 'pending': 0, 'failed': 0, 'skipped': 0, 'progress': 0}
    tech_pack_revision_id = None
    if tp_rev_ids:
        tech_pack_revision_id = str(tp_rev_ids[0])
        # Aggregate across all related tech pack revisions
        from django.db.models import Count, Q
        stats = DraftBlock.objects.filter(
            page__revision_id__in=list(tp_rev_ids)
        ).aggregate(
            total=Count('id'),
            done=Count('id', filter=Q(translation_status='done')),
            pending=Count('id', filter=Q(translation_status='pending')),
            failed=Count('id', filter=Q(translation_status='failed')),
            skipped=Count('id', filter=Q(translation_status='skipped')),
        )
        total = stats['total'] or 0
        done = stats['done'] or 0
        skipped = stats['skipped'] or 0
        completed = done + skipped
        translation = {
            'total': total,
            'done': done,
            'pending': stats['pending'] or 0,
            'failed': stats['failed'] or 0,
            'skipped': skipped,
            'progress': round(completed / total * 100) if total > 0 else 0,
        }

    # --- BOM ---
    bom_total = 0
    bom_verified = 0
    bom_translated = 0
    if revision:
        bom_items = revision.bom_items.all()
        bom_total = bom_items.count()
        bom_verified = bom_items.filter(is_verified=True).count()
        bom_translated = bom_items.filter(translation_status='confirmed').count()

    # --- Spec ---
    spec_total = 0
    spec_verified = 0
    spec_translated = 0
    if revision:
        measurements = revision.measurements.all()
        spec_total = measurements.count()
        spec_verified = measurements.filter(is_verified=True).count()
        spec_translated = measurements.filter(translation_status='confirmed').count()

    # --- Sample Request & Run ---
    sample_request_data = None
    sample_run_data = None
    if revision:
        sr = SampleRequest.objects.filter(revision=revision).order_by('-created_at').first()
        if sr:
            sample_request_data = {
                'id': str(sr.id),
                'status': sr.status,
                'request_type': sr.request_type,
            }
            run = SampleRun.objects.filter(sample_request=sr).order_by('-run_no').first()
            if run:
                mwo = SampleMWO.objects.filter(sample_run=run, is_latest=True).first()
                sample_run_data = {
                    'id': str(run.id),
                    'run_no': run.run_no,
                    'status': run.status,
                    'mwo_status': mwo.status if mwo else None,
                    'mwo_id': str(mwo.id) if mwo else None,
                }

    # --- Overall readiness ---
    score_parts = []
    if documents:
        score_parts.append(1.0)  # has documents
    else:
        score_parts.append(0.0)
    if translation['total'] > 0:
        score_parts.append(translation['progress'] / 100.0)
    if bom_total > 0:
        score_parts.append(bom_verified / bom_total)
    if spec_total > 0:
        score_parts.append(spec_verified / spec_total)

    overall = round(sum(score_parts) / max(len(score_parts), 1) * 100)

    return {
        'style_id': str(style.id),
        'style_number': style.style_number,
        'style_name': style.style_name,
        'brand_name': style.brand.name if style.brand else style.customer,
        'season': style.season,
        'revision_id': revision_id,
        'revision_label': revision.revision_label if revision else None,
        'revision_status': revision.status if revision else None,
        'tech_pack_revision_id': tech_pack_revision_id,
        'documents': documents,
        'translation': translation,
        'bom': {'total': bom_total, 'verified': bom_verified, 'translated': bom_translated},
        'spec': {'total': spec_total, 'verified': spec_verified, 'translated': spec_translated},
        'sample_request': sample_request_data,
        'sample_run': sample_run_data,
        'overall_readiness': overall,
    }


class PortfolioViewSet(viewsets.ViewSet):
    """
    Portfolio Kanban API
    Phase 2-3: Stage 推導 + Risk 計算
    """
    permission_classes = []  # TODO: Enable authentication in production

    @action(detail=False, methods=['get'], url_path='kanban')
    def kanban(self, request):
        """
        GET /api/v2/portfolio/kanban/?organization_id={id}
        返回 5 欄 Kanban 數據（columns + cards）
        """
        from apps.core.models import Organization
        from .portfolio import build_kanban_data

        # ✅ 安全的 Organization 取得方式
        org_id = request.query_params.get('organization_id')

        if org_id:
            try:
                organization = Organization.objects.get(id=org_id)
                # TODO: 檢查 request.user 是否有權限存取此 org
            except Organization.DoesNotExist:
                return api_error(
                    message='Organization not found',
                    code=ErrorCodes.NOT_FOUND,
                    status_code=status.HTTP_404_NOT_FOUND
                )
        else:
            # ✅ Fallback: 若你有 user.organization，改用這個
            organization = getattr(request.user, 'organization', None)
            if not organization:
                # 開發階段：取第一個 org（⚠️ 生產環境必須移除）
                organization = Organization.objects.first()

        if not organization:
            return api_error(
                message='organization_id is required',
                code=ErrorCodes.VALIDATION_ERROR,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        try:
            data = build_kanban_data(organization)
            return api_success(data=data)
        except Exception as e:
            return api_error(
                message=f'Failed to build kanban data: {str(e)}',
                code=ErrorCodes.INTERNAL_ERROR,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
