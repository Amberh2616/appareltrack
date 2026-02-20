"""
Phase 3: Sample Request System - DRF ViewSets
Day 3 MVP API + SampleRun (Phase 3 Refactor)
P0-2: Kanban View API
"""

from rest_framework import status, viewsets, filters
from rest_framework.decorators import action, api_view, permission_classes as perm_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import PermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Count, Q, Case, When, Value, IntegerField
from django.utils import timezone
from datetime import datetime, timedelta

from .models import (
    SampleRequest,
    SampleRun,
    SampleRunStatus,
    SampleActuals,
    SampleAttachment,
    SampleCostEstimate,
    T2POForSample,
    T2POLineForSample,
    SampleMWO,
    Sample,
    SampleRunTransitionLog,
)
from .serializers import (
    SampleRequestSerializer,
    SampleRequestListSerializer,
    SampleRunSerializer,
    SampleRunListSerializer,
    SampleActualsSerializer,
    SampleAttachmentSerializer,
    SampleCostEstimateSerializer,
    T2POForSampleSerializer,
    T2POLineForSampleSerializer,
    SampleMWOSerializer,
    SampleSerializer,
    SampleRunTransitionLogSerializer,
)
from .services.transitions import (
    transition_sample_request,
    can_transition,
    get_allowed_actions,
)
from .services.run_transitions import (
    transition_sample_run,
    can_transition as can_transition_run,
    get_allowed_actions as get_allowed_actions_run,
    batch_transition_sample_runs,
    # P3: Rollback
    rollback_sample_run,
    get_rollback_targets,
)
from .services.excel_export import (
    MWOExcelExporter,
    EstimateExcelExporter,
    T2POExcelExporter,
)
from .services.pdf_export import (
    MWOPDFExporter,
    EstimatePDFExporter,
    T2POPDFExporter,
)
from .services.mwo_complete_export import export_mwo_complete
from .services.batch_export import batch_export_sample_runs
from .services.auto_generation import create_with_initial_run, create_next_run_for_request


def _get_user_organization(request):
    """
    Get organization from authenticated user.

    SaaS-Ready: No fallback to first organization - user MUST have an organization.
    Returns None for anonymous users (ViewSet should handle this).
    """
    if not request.user.is_authenticated:
        return None
    org = getattr(request.user, 'organization', None)
    return org


class SampleRequestViewSet(viewsets.ModelViewSet):
    """
    SampleRequest CRUD + state transition actions

    Actions (workflow):
    - POST /sample-requests/{id}/submit/
    - POST /sample-requests/{id}/quote/
    - POST /sample-requests/{id}/approve/
    - POST /sample-requests/{id}/reject/
    - POST /sample-requests/{id}/cancel/
    - POST /sample-requests/{id}/start_execution/
    - POST /sample-requests/{id}/complete/
    - GET  /sample-requests/{id}/allowed_actions/
    """
    serializer_class = SampleRequestSerializer
    permission_classes = [AllowAny]  # TODO: Change to IsAuthenticated in production
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        'revision__style__style_number',
        'revision__style__style_name',
        'brand_name',
    ]
    ordering_fields = ['created_at', 'status']
    ordering = ['-created_at']

    def get_queryset(self):
        """
        SaaS-Ready: Filter by organization using direct organization FK.

        Development mode: If no organization, return all in DEBUG mode.
        Production: Should require authentication and organization.
        """
        org = _get_user_organization(self.request)

        base_qs = SampleRequest.objects.select_related(
            'revision',
            'revision__style',
            'organization',
        ).prefetch_related(
            'attachments',
            'estimates',
            'samples',
            'runs',
        ).order_by('-created_at')

        if org is None:
            # Development mode: Return all if no auth (for testing)
            from django.conf import settings
            if settings.DEBUG:
                return base_qs
            return SampleRequest.objects.none()

        # SaaS mode: limit to org,但允許 organization 為空的資料（測試/匯入時）
        return base_qs.filter(Q(organization=org) | Q(organization__isnull=True))

    def get_serializer_class(self):
        """Use lightweight serializer for list view"""
        if self.action == 'list':
            return SampleRequestListSerializer
        return SampleRequestSerializer

    def create(self, request, *args, **kwargs):
        """
        方案 B：創建 SampleRequest（只存基本資料）

        不自動生成 Run/MWO/Costing，等用戶按「確認樣衣」才觸發。
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Extract revision ID from validated data
        revision = serializer.validated_data.get('revision')
        if not revision:
            return Response(
                {"detail": "revision is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 只創建基本的 SampleRequest，不自動生成文件
        org = _get_user_organization(request)
        sample_request = SampleRequest.objects.create(
            revision=revision,
            organization=org,
            request_type=serializer.validated_data.get('request_type', 'proto'),
            request_type_custom=serializer.validated_data.get('request_type_custom', ''),
            quantity_requested=serializer.validated_data.get('quantity_requested', 1),
            priority=serializer.validated_data.get('priority', 'normal'),
            due_date=serializer.validated_data.get('due_date'),
            brand_name=serializer.validated_data.get('brand_name', ''),
            need_quote_first=serializer.validated_data.get('need_quote_first', False),
            notes_internal=serializer.validated_data.get('notes_internal', ''),
            notes_customer=serializer.validated_data.get('notes_customer', ''),
            created_by=request.user if request.user.is_authenticated else None,
        )

        # Serialize the created request
        response_serializer = self.get_serializer(sample_request)

        data = response_serializer.data
        return Response({
            **data,  # flat fields for backward compatibility (tests expect top-level fields)
            "data": data,
            "message": "樣衣請求已創建，請按「確認樣衣」生成 MWO 與報價單。",
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='confirm')
    def confirm_sample(self, request, pk=None):
        """
        方案 B：確認樣衣 - 觸發 BOM/Spec 整合並生成文件

        當用戶按「確認樣衣」時：
        1. 創建 SampleRun #1
        2. 快照 BOM 資料
        3. 快照 Spec 資料
        4. 生成 MWO (draft)
        5. 生成報價單 (draft)
        """
        sample_request = self.get_object()

        # 檢查是否已經有 Run（避免重複確認）
        if sample_request.runs.exists():
            return Response({
                "detail": "此請求已確認過，已有 Sample Run 存在。",
                "runs": [{"id": str(r.id), "run_no": r.run_no} for r in sample_request.runs.all()]
            }, status=status.HTTP_400_BAD_REQUEST)

        # 準備 payload
        payload = {
            'request_type': sample_request.request_type,
            'request_type_custom': sample_request.request_type_custom,
            'quantity_requested': sample_request.quantity_requested,
            'priority': sample_request.priority,
            'due_date': sample_request.due_date,
            'brand_name': sample_request.brand_name,
            'need_quote_first': sample_request.need_quote_first,
            'notes_internal': sample_request.notes_internal,
            'notes_customer': sample_request.notes_customer,
        }

        try:
            # 使用 auto_generation 服務生成文件
            from .services.auto_generation import generate_documents_for_request
            sample_run, documents = generate_documents_for_request(
                sample_request=sample_request,
                payload=payload,
                user=request.user if request.user.is_authenticated else None,
            )
        except DjangoValidationError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response({
            "message": "樣衣已確認！BOM/Spec 已整合，MWO 與報價單已生成。",
            "sample_run": {
                "id": str(sample_run.id),
                "run_no": sample_run.run_no,
                "status": sample_run.status,
            },
            "documents": documents,
        }, status=status.HTTP_200_OK)

    def _handle_transition(self, request, pk, action_name):
        """
        Common handler for all transition actions
        Reduces code duplication across actions
        """
        obj = self.get_object()

        # Extract payload from request
        payload = {
            "reason": request.data.get("reason", ""),
            "notes": request.data.get("notes", ""),
        }

        try:
            result = transition_sample_request(
                sample_request=obj,
                action=action_name,
                actor=request.user,
                payload=payload,
            )
        except (ValueError, DjangoValidationError) as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Re-serialize the updated object
        serializer = self.get_serializer(obj)

        return Response({
            "transition": {
                "old_status": result.old_status,
                "new_status": result.new_status,
                "action": result.action,
                "changed_at": result.changed_at.isoformat(),
                "meta": result.meta,
            },
            "data": serializer.data,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, pk=None):
        """Submit sample request (draft → quote_requested or approved)"""
        return self._handle_transition(request, pk, "submit")

    @action(detail=True, methods=["post"], url_path="quote")
    def quote(self, request, pk=None):
        """Mark as quoted (quote_requested → quoted)"""
        return self._handle_transition(request, pk, "quote")

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        """Approve sample request (quoted/draft → approved)"""
        return self._handle_transition(request, pk, "approve")

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        """Reject sample request (any → rejected)"""
        return self._handle_transition(request, pk, "reject")

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        """Cancel sample request (any → cancelled)"""
        return self._handle_transition(request, pk, "cancel")

    @action(detail=True, methods=["post"], url_path="start-execution")
    def start_execution(self, request, pk=None):
        """Start execution (approved → in_execution)"""
        return self._handle_transition(request, pk, "start_execution")

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        """Complete sample request (in_execution → completed)"""
        return self._handle_transition(request, pk, "complete")

    @action(detail=True, methods=["get"], url_path="allowed-actions")
    def allowed_actions(self, request, pk=None):
        """Get list of allowed actions for current status"""
        obj = self.get_object()
        actions = get_allowed_actions(obj)

        return Response({
            "current_status": obj.status,
            "allowed_actions": actions,
            "can_submit": can_transition(obj, "submit"),
            "can_approve": can_transition(obj, "approve"),
            "can_reject": can_transition(obj, "reject"),
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="create-next-run")
    def create_next_run(self, request, pk=None):
        """
        創建下一輪 SampleRun（支援多輪 Fit Sample）

        POST /api/v2/sample-requests/{id}/create-next-run/

        用於 Fit Sample 多輪調整場景：
        - Fit 1st → 客戶評論 → 調整 → Fit 2nd → ...

        Request body (all optional):
        {
            "run_type": "fit",      // 可選，預設繼承上一輪
            "quantity": 3,          // 可選，預設繼承上一輪
            "target_due_date": "2026-01-20",  // 可選
            "notes": "Round 2 adjustments based on fit comments"
        }

        Response:
        {
            "message": "已創建 Run #2",
            "sample_run": {...},
            "documents": {...}
        }
        """
        sample_request = self.get_object()

        # 檢查是否已有至少一個 Run（必須先確認樣衣）
        if not sample_request.runs.exists():
            return Response({
                "detail": "請先確認樣衣（創建 Run #1）後才能創建下一輪。"
            }, status=status.HTTP_400_BAD_REQUEST)

        # 解析請求參數
        run_type = request.data.get('run_type')
        quantity = request.data.get('quantity')
        target_due_date = request.data.get('target_due_date')
        notes = request.data.get('notes', '')

        try:
            sample_run, documents = create_next_run_for_request(
                sample_request=sample_request,
                run_type=run_type,
                quantity=quantity,
                target_due_date=target_due_date,
                notes=notes,
                user=request.user if request.user.is_authenticated else None,
            )
        except DjangoValidationError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response({
            "message": f"已創建 Run #{sample_run.run_no}",
            "sample_run": {
                "id": str(sample_run.id),
                "run_no": sample_run.run_no,
                "run_type": sample_run.run_type,
                "status": sample_run.status,
                "quantity": sample_run.quantity,
            },
            "documents": documents,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="runs-summary")
    def runs_summary(self, request, pk=None):
        """
        獲取該 SampleRequest 的所有 Run 摘要

        GET /api/v2/sample-requests/{id}/runs-summary/

        Response:
        {
            "request_id": "uuid",
            "request_type": "fit",
            "total_runs": 3,
            "runs": [
                {"run_no": 1, "run_type": "fit", "status": "accepted", ...},
                {"run_no": 2, "run_type": "fit", "status": "quoted", ...},
                {"run_no": 3, "run_type": "fit", "status": "draft", ...}
            ],
            "can_create_next_run": true
        }
        """
        sample_request = self.get_object()

        runs = sample_request.runs.all().order_by('run_no')
        runs_data = []

        for run in runs:
            runs_data.append({
                "id": str(run.id),
                "run_no": run.run_no,
                "run_type": run.run_type,
                "run_type_label": run.get_run_type_display(),
                "status": run.status,
                "status_label": run.get_status_display(),
                "quantity": run.quantity,
                "target_due_date": run.target_due_date.isoformat() if run.target_due_date else None,
                "created_at": run.created_at.isoformat() if run.created_at else None,
            })

        # 判斷是否可以創建下一輪（已有 Run 才能創建下一輪）
        can_create_next_run = runs.exists()

        return Response({
            "request_id": str(sample_request.id),
            "request_type": sample_request.request_type,
            "total_runs": runs.count(),
            "runs": runs_data,
            "can_create_next_run": can_create_next_run,
            "next_run_no": (runs.count() + 1) if can_create_next_run else None,
        }, status=status.HTTP_200_OK)


# ==================== Phase 3 Refactor: SampleRun ====================

class SampleRunViewSet(viewsets.ModelViewSet):
    """
    SampleRun CRUD + state transition actions

    Actions (workflow):
    - POST /sample-runs/{id}/start-materials-planning/
    - POST /sample-runs/{id}/generate-t2po/
    - POST /sample-runs/{id}/issue-t2po/
    - POST /sample-runs/{id}/generate-mwo/
    - POST /sample-runs/{id}/issue-mwo/
    - POST /sample-runs/{id}/start-production/
    - POST /sample-runs/{id}/mark-sample-done/
    - POST /sample-runs/{id}/record-actuals/
    - POST /sample-runs/{id}/cancel/
    - GET  /sample-runs/{id}/allowed-actions/
    """
    serializer_class = SampleRunSerializer
    permission_classes = [AllowAny]  # TODO: Change to IsAuthenticated in production

    def get_serializer_class(self):
        """Use lightweight serializer for list view"""
        if self.action == 'list':
            return SampleRunListSerializer
        return SampleRunSerializer

    def get_queryset(self):
        """
        SaaS-Ready: Filter by organization using direct organization FK.
        Also supports filtering by sample_request query param.
        """
        org = _get_user_organization(self.request)

        base_qs = SampleRun.objects.select_related(
            'sample_request',
            'sample_request__revision',
            'sample_request__revision__style',
            'organization',
            'revision',
            'guidance_usage',
            'actual_usage',
            'costing_version',
        ).prefetch_related(
            'actuals',
            't2pos',
            'mwos',
        ).order_by('sample_request', 'run_no')

        if org is None:
            # Development mode: Return all if no auth (for testing)
            from django.conf import settings
            if settings.DEBUG:
                queryset = base_qs
            else:
                return SampleRun.objects.none()
        else:
            # SaaS mode: Use TenantManager for_tenant()
            queryset = base_qs.for_tenant(org)

        # Additional filter by sample_request if provided
        sample_request_id = self.request.query_params.get('sample_request')
        if sample_request_id:
            queryset = queryset.filter(sample_request_id=sample_request_id)

        return queryset

    def _handle_transition(self, request, pk, action_name):
        """
        Common handler for all transition actions
        """
        obj = self.get_object()

        # Extract payload from request
        payload = {
            "reason": request.data.get("reason", ""),
            "notes": request.data.get("notes", ""),
        }

        try:
            result = transition_sample_run(
                sample_run=obj,
                action=action_name,
                actor=request.user,
                payload=payload,
            )
        except (ValueError, DjangoValidationError) as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Re-serialize the updated object
        serializer = self.get_serializer(obj)

        return Response({
            "transition": {
                "old_status": result.old_status,
                "new_status": result.new_status,
                "action": result.action,
                "changed_at": result.changed_at.isoformat(),
                "meta": result.meta,
            },
            "data": serializer.data,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, pk=None):
        """Submit run / start materials planning (draft → materials_planning)"""
        return self._handle_transition(request, pk, "start_materials_planning")

    @action(detail=True, methods=["post"], url_path="start-materials-planning")
    def start_materials_planning(self, request, pk=None):
        """Start materials planning (draft → materials_planning)"""
        return self._handle_transition(request, pk, "start_materials_planning")

    @action(detail=True, methods=["post"], url_path="generate-t2po")
    def generate_t2po(self, request, pk=None):
        """Generate T2PO draft (materials_planning → po_drafted)"""
        return self._handle_transition(request, pk, "generate_t2po")

    @action(detail=True, methods=["post"], url_path="issue-t2po")
    def issue_t2po(self, request, pk=None):
        """Issue T2PO (po_drafted → po_issued)"""
        return self._handle_transition(request, pk, "issue_t2po")

    @action(detail=True, methods=["post"], url_path="generate-mwo")
    def generate_mwo(self, request, pk=None):
        """Generate MWO draft (po_issued → mwo_drafted)"""
        return self._handle_transition(request, pk, "generate_mwo")

    @action(detail=True, methods=["post"], url_path="issue-mwo")
    def issue_mwo(self, request, pk=None):
        """Issue MWO (mwo_drafted → mwo_issued)"""
        return self._handle_transition(request, pk, "issue_mwo")

    @action(detail=True, methods=["post"], url_path="start-production")
    def start_production(self, request, pk=None):
        """Start production (mwo_issued → in_progress)"""
        return self._handle_transition(request, pk, "start_production")

    @action(detail=True, methods=["post"], url_path="mark-sample-done")
    def mark_sample_done(self, request, pk=None):
        """Mark sample done (in_progress → sample_done)"""
        return self._handle_transition(request, pk, "mark_sample_done")

    @action(detail=True, methods=["post"], url_path="record-actuals")
    def record_actuals(self, request, pk=None):
        """Record actuals (sample_done → actuals_recorded)"""
        return self._handle_transition(request, pk, "record_actuals")

    @action(detail=True, methods=["post"], url_path="generate-sample-costing")
    def generate_sample_costing(self, request, pk=None):
        """Generate sample costing (actuals_recorded → costing_generated)"""
        return self._handle_transition(request, pk, "generate_sample_costing")

    @action(detail=True, methods=["post"], url_path="mark-quoted")
    def mark_quoted(self, request, pk=None):
        """Mark as quoted (costing_generated → quoted)"""
        return self._handle_transition(request, pk, "mark_quoted")

    @action(detail=True, methods=["post"], url_path="mark-accepted")
    def mark_accepted(self, request, pk=None):
        """Mark as accepted (quoted → accepted)"""
        return self._handle_transition(request, pk, "mark_accepted")

    @action(detail=True, methods=["post"], url_path="mark-revise-needed")
    def mark_revise_needed(self, request, pk=None):
        """Mark revise needed (quoted → revise_needed)"""
        return self._handle_transition(request, pk, "mark_revise_needed")

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        """Cancel sample run (any → cancelled)"""
        return self._handle_transition(request, pk, "cancel")

    # P3: Rollback Actions
    @action(detail=True, methods=["get"], url_path="rollback-targets")
    def rollback_targets(self, request, pk=None):
        """
        Get list of allowed rollback targets for current status.
        GET /api/v2/sample-runs/{id}/rollback-targets/
        """
        obj = self.get_object()
        targets = get_rollback_targets(obj)

        return Response({
            "current_status": obj.status,
            "rollback_targets": targets,
            "can_rollback": len(targets) > 0,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="rollback")
    def rollback(self, request, pk=None):
        """
        Roll back to a previous status.
        POST /api/v2/sample-runs/{id}/rollback/
        Body: { "target_status": "draft", "reason": "Optional reason" }
        """
        obj = self.get_object()

        target_status = request.data.get("target_status")
        reason = request.data.get("reason", "")

        if not target_status:
            return Response(
                {"detail": "target_status is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            result = rollback_sample_run(
                sample_run=obj,
                target_status=target_status,
                actor=request.user,
                reason=reason,
            )
        except (ValueError, DjangoValidationError) as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Re-serialize the updated object
        serializer = self.get_serializer(obj)

        return Response({
            "transition": {
                "old_status": result.old_status,
                "new_status": result.new_status,
                "action": result.action,
                "changed_at": result.changed_at.isoformat(),
                "meta": result.meta,
            },
            "data": serializer.data,
        }, status=status.HTTP_200_OK)

    # P1: MWO Pre-check
    @action(detail=True, methods=["get"], url_path="precheck-mwo")
    def precheck_mwo(self, request, pk=None):
        """
        Pre-check if SampleRun is ready for MWO generation.
        GET /api/v2/sample-runs/{id}/precheck-mwo/

        Returns:
        {
            "ready": true/false,
            "current_status": "po_issued",
            "issues": [
                {"type": "bom", "severity": "error", "message": "No BOM items found"},
                {"type": "operations", "severity": "warning", "message": "No operations defined"}
            ],
            "summary": {
                "bom_count": 5,
                "operations_count": 3,
                "has_costing": true
            }
        }
        """
        obj = self.get_object()

        issues = []
        summary = {
            "bom_count": 0,
            "operations_count": 0,
            "has_costing": False,
            "po_status": None,
        }

        # Check BOM items
        bom_count = obj.bom_lines.count()
        summary["bom_count"] = bom_count
        if bom_count == 0:
            issues.append({
                "type": "bom",
                "severity": "error",
                "message": "No BOM items - MWO requires at least one material",
                "message_zh": "無物料表項目 - MWO 需要至少一個物料",
            })

        # Check Operations
        ops_count = obj.operations.count()
        summary["operations_count"] = ops_count
        if ops_count == 0:
            issues.append({
                "type": "operations",
                "severity": "warning",
                "message": "No operations defined - MWO will have empty process list",
                "message_zh": "未定義工序 - MWO 工序列表將為空",
            })

        # Check costing
        has_costing = hasattr(obj, 'costing_version') and obj.costing_version is not None
        summary["has_costing"] = has_costing
        if not has_costing:
            issues.append({
                "type": "costing",
                "severity": "info",
                "message": "No cost sheet generated yet",
                "message_zh": "尚未生成報價單",
            })

        # Check current status - should be po_issued to generate MWO
        summary["current_status"] = obj.status
        if obj.status != "po_issued":
            issues.append({
                "type": "status",
                "severity": "error",
                "message": f"Current status is '{obj.status}', must be 'po_issued' to generate MWO",
                "message_zh": f"當前狀態為 '{obj.status}'，需為 'po_issued' 才能生成 MWO",
            })

        # Check if T2 POs exist
        t2po_count = obj.t2pos.count() if hasattr(obj, 't2pos') else 0
        summary["t2po_count"] = t2po_count
        if t2po_count == 0 and obj.status in ['po_drafted', 'po_issued']:
            issues.append({
                "type": "po",
                "severity": "warning",
                "message": "No T2 Purchase Orders found",
                "message_zh": "未找到 T2 採購單",
            })

        # Determine if ready (no error-level issues)
        has_errors = any(issue["severity"] == "error" for issue in issues)
        ready = not has_errors

        return Response({
            "ready": ready,
            "current_status": obj.status,
            "issues": issues,
            "summary": summary,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="allowed-actions")
    def allowed_actions(self, request, pk=None):
        """Get list of allowed actions for current status"""
        obj = self.get_object()
        actions = get_allowed_actions_run(obj)

        # Build can_* flags for common actions
        can_flags = {}
        for action_name in actions:
            can_flags[f"can_{action_name}"] = can_transition_run(obj, action_name)

        return Response({
            "current_status": obj.status,
            "allowed_actions": actions,
            **can_flags,
        }, status=status.HTTP_200_OK)

    # P4: Update Dates (for Gantt drag-and-drop)
    @action(detail=True, methods=["patch"], url_path="update-dates")
    def update_dates(self, request, pk=None):
        """
        Update start_date and/or target_due_date for Gantt drag.
        PATCH /api/v2/sample-runs/{id}/update-dates/
        Body: { "start_date": "2026-01-20", "target_due_date": "2026-02-15" }
        """
        from datetime import date

        obj = self.get_object()

        start_date = request.data.get("start_date")
        target_due_date = request.data.get("target_due_date")

        if not start_date and not target_due_date:
            return Response(
                {"detail": "At least one of start_date or target_due_date must be provided"},
                status=status.HTTP_400_BAD_REQUEST
            )

        update_fields = []

        # Parse and validate dates
        try:
            if start_date:
                if isinstance(start_date, str):
                    obj.start_date = date.fromisoformat(start_date)
                else:
                    obj.start_date = start_date
                update_fields.append('start_date')

            if target_due_date:
                if isinstance(target_due_date, str):
                    obj.target_due_date = date.fromisoformat(target_due_date)
                else:
                    obj.target_due_date = target_due_date
                update_fields.append('target_due_date')
        except (ValueError, TypeError) as e:
            return Response(
                {"detail": f"Invalid date format: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate: start_date should be before target_due_date
        if obj.start_date and obj.target_due_date:
            if obj.start_date > obj.target_due_date:
                return Response(
                    {"detail": "start_date must be before or equal to target_due_date"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        obj.save(update_fields=update_fields)

        serializer = self.get_serializer(obj)
        return Response({
            "message": "Dates updated successfully",
            "updated_fields": update_fields,
            "data": serializer.data,
        }, status=status.HTTP_200_OK)

    # P2: Excel Export Actions
    @action(detail=True, methods=["get"], url_path="export-mwo")
    def export_mwo(self, request, pk=None):
        """
        Export MWO as Excel
        GET /api/v2/sample-runs/{id}/export-mwo/
        """
        run = self.get_object()

        # Get latest MWO for this run
        mwo = run.mwos.filter(is_latest=True).first()
        if not mwo:
            return Response(
                {'detail': 'No MWO found for this run'},
                status=status.HTTP_404_NOT_FOUND
            )

        exporter = MWOExcelExporter()
        return exporter.export(mwo)

    @action(detail=True, methods=["get"], url_path="export-estimate")
    def export_estimate(self, request, pk=None):
        """
        Export Estimate as Excel
        GET /api/v2/sample-runs/{id}/export-estimate/
        """
        run = self.get_object()

        # Get estimate from sample request (latest accepted or draft)
        estimate = run.sample_request.estimates.filter(
            status__in=['accepted', 'sent', 'draft']
        ).order_by('-estimate_version').first()

        if not estimate:
            return Response(
                {'detail': 'No estimate found for this run'},
                status=status.HTTP_404_NOT_FOUND
            )

        exporter = EstimateExcelExporter()
        return exporter.export(estimate)

    @action(detail=True, methods=["get"], url_path="export-po")
    def export_po(self, request, pk=None):
        """
        Export T2 PO as Excel
        GET /api/v2/sample-runs/{id}/export-po/
        """
        run = self.get_object()

        # Get latest issued PO
        po = run.t2pos.filter(
            status__in=['issued', 'confirmed', 'delivered']
        ).order_by('-version_no').first()

        if not po:
            # Try to get draft PO
            po = run.t2pos.filter(status='draft').order_by('-version_no').first()

        if not po:
            return Response(
                {'detail': 'No PO found for this run'},
                status=status.HTTP_404_NOT_FOUND
            )

        exporter = T2POExcelExporter()
        return exporter.export(po)

    # P3: PDF Export Actions
    @action(detail=True, methods=["get"], url_path="export-mwo-pdf")
    def export_mwo_pdf(self, request, pk=None):
        """
        Export MWO as PDF
        GET /api/v2/sample-runs/{id}/export-mwo-pdf/
        """
        run = self.get_object()

        mwo = run.mwos.filter(is_latest=True).first()
        if not mwo:
            return Response(
                {'detail': 'No MWO found for this run'},
                status=status.HTTP_404_NOT_FOUND
            )

        exporter = MWOPDFExporter()
        return exporter.export(mwo)

    @action(detail=True, methods=["get"], url_path="export-estimate-pdf")
    def export_estimate_pdf(self, request, pk=None):
        """
        Export Estimate as PDF
        GET /api/v2/sample-runs/{id}/export-estimate-pdf/
        """
        run = self.get_object()

        # Get latest estimate (prefer accepted, fallback to sent/draft)
        estimate = run.sample_request.estimates.filter(
            status__in=['accepted', 'sent', 'draft']
        ).order_by('-estimate_version').first()

        if not estimate:
            return Response(
                {'detail': 'No estimate found for this run'},
                status=status.HTTP_404_NOT_FOUND
            )

        exporter = EstimatePDFExporter()
        return exporter.export(estimate)

    @action(detail=True, methods=["get"], url_path="export-po-pdf")
    def export_po_pdf(self, request, pk=None):
        """
        Export T2 PO as PDF
        GET /api/v2/sample-runs/{id}/export-po-pdf/
        """
        run = self.get_object()

        # Get latest issued PO
        po = run.t2pos.filter(
            status__in=['issued', 'confirmed', 'delivered']
        ).order_by('-version_no').first()

        if not po:
            # Try to get draft PO
            po = run.t2pos.filter(status='draft').order_by('-version_no').first()

        if not po:
            return Response(
                {'detail': 'No PO found for this run'},
                status=status.HTTP_404_NOT_FOUND
            )

        exporter = T2POPDFExporter()
        return exporter.export(po)

    @action(detail=True, methods=["get"], url_path="export-readiness")
    def export_readiness(self, request, pk=None):
        """
        檢查 MWO 匯出準備度
        GET /api/v2/sample-runs/{id}/export-readiness/

        Response:
        {
            "checks": [...],
            "completeness": 75,
            "can_export": true,
            "recommendation": "建議先補全 BOM"
        }
        """
        from apps.styles.models import BOMItem, Measurement
        from apps.parsing.models import UploadedDocument
        from .models import RunTechPackPage

        run = self.get_object()
        revision = run.revision or (run.sample_request.revision if run.sample_request else None)

        checks = []

        # 1. Tech Pack 檢查
        techpack_pages = 0
        if run:
            techpack_pages = RunTechPackPage.objects.filter(run=run).count()

        if techpack_pages == 0 and revision:
            # Fallback: 檢查 TechPackRevision
            uploaded_doc = UploadedDocument.objects.filter(
                style_revision=revision,
                tech_pack_revision__isnull=False
            ).first()
            if uploaded_doc and uploaded_doc.tech_pack_revision:
                techpack_pages = uploaded_doc.tech_pack_revision.draft_blocks.count()

        checks.append({
            'item': 'Tech Pack',
            'item_zh': '技術包',
            'status': 'ok' if techpack_pages > 0 else 'error',
            'message': f'已上傳（{techpack_pages} 頁）' if techpack_pages > 0 else '未上傳',
            'action_url': '/dashboard/upload' if techpack_pages == 0 else None,
        })

        # 2. BOM 檢查
        bom_total = 0
        bom_complete = 0
        bom_translated = 0
        missing_bom = []

        if revision:
            bom_items = list(BOMItem.objects.filter(revision=revision))
            bom_total = len(bom_items)
            for item in bom_items:
                consumption = getattr(item, 'confirmed_consumption', None) or getattr(item, 'consumption', None)
                if consumption:
                    bom_complete += 1
                else:
                    if len(missing_bom) < 4:
                        missing_bom.append(item.material_name or f'Item #{item.item_number}')
                if getattr(item, 'material_name_zh', None):
                    bom_translated += 1

        bom_status = 'ok' if bom_total > 0 and bom_complete == bom_total else (
            'warning' if bom_complete > 0 else 'error'
        )

        checks.append({
            'item': 'BOM',
            'item_zh': '物料清單',
            'status': bom_status,
            'message': f'{bom_complete}/{bom_total} 項已填寫' if bom_total > 0 else '無物料資料',
            'details': f'缺少：{", ".join(missing_bom)}' if missing_bom else None,
            'action_url': f'/dashboard/revisions/{revision.id}/bom' if revision else None,
        })

        # 3. Spec 檢查
        spec_total = 0
        spec_translated = 0

        if revision:
            measurements = list(Measurement.objects.filter(revision=revision))
            spec_total = len(measurements)
            for m in measurements:
                if getattr(m, 'point_name_zh', None):
                    spec_translated += 1

        spec_status = 'ok' if spec_total > 0 else 'error'

        checks.append({
            'item': 'Spec',
            'item_zh': '尺寸規格',
            'status': spec_status,
            'message': f'{spec_total} 項尺寸' if spec_total > 0 else '無尺寸資料',
            'action_url': f'/dashboard/revisions/{revision.id}/spec' if revision else None,
        })

        # 4. 中文翻譯檢查
        translation_complete = (
            (bom_total == 0 or bom_translated == bom_total) and
            (spec_total == 0 or spec_translated == spec_total)
        )

        checks.append({
            'item': 'Translation',
            'item_zh': '中文翻譯',
            'status': 'ok' if translation_complete else 'warning',
            'message': '已完成' if translation_complete else f'BOM {bom_translated}/{bom_total}, Spec {spec_translated}/{spec_total}',
        })

        # 計算完整度
        weights = {'ok': 1, 'warning': 0.5, 'error': 0}
        completeness = sum(weights.get(c['status'], 0) for c in checks) / len(checks) * 100 if checks else 0

        # 找出第一個需要補全的項目
        first_incomplete = next((c for c in checks if c['status'] in ['error', 'warning'] and c.get('action_url')), None)

        return Response({
            'checks': checks,
            'completeness': round(completeness),
            'can_export': completeness >= 25,  # 至少 25% 才允許匯出
            'recommendation': '準備就緒，可以匯出' if completeness >= 75 else (
                '建議先補全資料再匯出' if completeness >= 25 else '資料不足，請先填寫 BOM 和 Spec'
            ),
            'first_action_url': first_incomplete.get('action_url') if first_incomplete else None,
        })

    @action(detail=True, methods=["get"], url_path="export-mwo-complete-pdf")
    def export_mwo_complete_pdf(self, request, pk=None):
        """
        Export complete MWO as PDF (Tech Pack + BOM + Spec with Chinese translations)
        GET /api/v2/sample-runs/{id}/export-mwo-complete-pdf/

        Query params:
        - include_techpack: true/false (default: true)
        """
        run = self.get_object()

        # Check if run has required data (revision from run or request)
        style_revision = run.revision or run.sample_request.revision
        if not style_revision:
            return Response(
                {'detail': 'No style revision linked to this run'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get include_techpack parameter
        include_techpack = request.query_params.get('include_techpack', 'true').lower() == 'true'

        try:
            return export_mwo_complete(run, include_techpack=include_techpack)
        except Exception as e:
            return Response(
                {'detail': f'Failed to generate MWO PDF: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    # ==================== Tech Pack Snapshot APIs ====================

    @action(detail=True, methods=["get"], url_path="techpack-snapshot")
    def techpack_snapshot(self, request, pk=None):
        """
        獲取 Run 的 Tech Pack 翻譯快照

        GET /api/v2/sample-runs/{id}/techpack-snapshot/

        Response:
        {
            "run_id": "uuid",
            "run_no": 1,
            "pages": [...],
            "total_blocks": 50
        }
        """
        from .models import RunTechPackPage, RunTechPackBlock
        from .serializers import RunTechPackPageSerializer

        run = self.get_object()

        # 獲取快照頁面
        pages = RunTechPackPage.objects.filter(run=run).prefetch_related('blocks')

        # 計算總 block 數
        total_blocks = RunTechPackBlock.objects.filter(run_page__run=run).count()

        return Response({
            "run_id": str(run.id),
            "run_no": run.run_no,
            "pages": RunTechPackPageSerializer(pages, many=True).data,
            "total_blocks": total_blocks,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=["patch"], url_path="techpack-blocks/(?P<block_id>[^/.]+)")
    def update_techpack_block(self, request, pk=None, block_id=None):
        """
        更新 Run 的單個翻譯 Block

        PATCH /api/v2/sample-runs/{id}/techpack-blocks/{block_id}/

        Request:
        {
            "translated_text": "更新後的翻譯",
            "overlay_x": 100,
            "overlay_y": 200,
            "overlay_visible": true
        }
        """
        from .models import RunTechPackBlock
        from .serializers import RunTechPackBlockPatchSerializer, RunTechPackBlockSerializer

        run = self.get_object()

        # 獲取 block（確保屬於這個 run）
        try:
            block = RunTechPackBlock.objects.get(
                id=block_id,
                run_page__run=run
            )
        except RunTechPackBlock.DoesNotExist:
            return Response(
                {'detail': f'Block {block_id} not found in this run'},
                status=status.HTTP_404_NOT_FOUND
            )

        # 更新 block
        serializer = RunTechPackBlockPatchSerializer(block, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # 返回更新後的完整 block
        return Response(
            RunTechPackBlockSerializer(block).data,
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=["patch"], url_path="techpack-blocks-batch")
    def update_techpack_blocks_batch(self, request, pk=None):
        """
        批量更新 Run 的翻譯 Blocks 位置

        PATCH /api/v2/sample-runs/{id}/techpack-blocks-batch/

        Request:
        {
            "positions": [
                {"id": "uuid1", "overlay_x": 100, "overlay_y": 200, "overlay_visible": true},
                {"id": "uuid2", "overlay_x": 150, "overlay_y": 250}
            ]
        }

        Response:
        {
            "updated": 2,
            "errors": []
        }
        """
        from .models import RunTechPackBlock

        run = self.get_object()

        positions = request.data.get('positions', [])
        if not positions:
            return Response(
                {'detail': 'No positions provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 獲取這個 run 下的所有 block IDs
        valid_block_ids = set(
            str(b.id) for b in RunTechPackBlock.objects.filter(run_page__run=run)
        )

        updated = 0
        errors = []

        for pos in positions:
            block_id = str(pos.get('id'))

            if block_id not in valid_block_ids:
                errors.append(f"Block {block_id} not found in this run")
                continue

            try:
                RunTechPackBlock.objects.filter(id=block_id).update(
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

    @action(detail=True, methods=["get"], url_path="transition-logs")
    def transition_logs(self, request, pk=None):
        """
        TRACK-PROGRESS: 獲取 SampleRun 的操作歷史

        GET /api/v2/sample-runs/{id}/transition-logs/
        """
        run = self.get_object()
        logs = SampleRunTransitionLog.objects.filter(
            sample_run=run
        ).select_related('actor').order_by('-created_at')
        serializer = SampleRunTransitionLogSerializer(logs, many=True)
        return Response(serializer.data)


class SampleActualsViewSet(viewsets.ModelViewSet):
    """
    SampleActuals CRUD

    Used to record actual labor/costs after sample completion
    """
    queryset = SampleActuals.objects.all().select_related('sample_run').order_by('-created_at')
    serializer_class = SampleActualsSerializer
    permission_classes = [AllowAny]  # TODO: Change to IsAuthenticated in production

    def get_queryset(self):
        """Filter by sample_run if provided"""
        queryset = super().get_queryset()
        sample_run_id = self.request.query_params.get('sample_run')
        if sample_run_id:
            queryset = queryset.filter(sample_run_id=sample_run_id)
        return queryset

    def perform_create(self, serializer):
        """Auto-set recorded_by to current user"""
        from django.utils import timezone
        serializer.save(
            recorded_by=self.request.user,
            recorded_at=timezone.now()
        )


class SampleAttachmentViewSet(viewsets.ModelViewSet):
    """
    SampleAttachment CRUD

    Attachments can be linked to:
    - SampleRequest (general attachments)
    - Sample (specific physical sample photos/docs)
    """
    queryset = SampleAttachment.objects.all().order_by('-uploaded_at')
    serializer_class = SampleAttachmentSerializer
    permission_classes = [AllowAny]  # TODO: Change to IsAuthenticated in production

    def perform_create(self, serializer):
        """Auto-set uploaded_by to current user"""
        serializer.save(uploaded_by=self.request.user)


class SampleCostEstimateViewSet(viewsets.ModelViewSet):
    """
    SampleCostEstimate CRUD

    Cost estimates are versioned and can be:
    - Manual (created by user)
    - From Phase 2 Costing (snapshot copy)
    """
    queryset = SampleCostEstimate.objects.all().select_related('sample_request').order_by(
        '-sample_request', '-estimate_version'
    )
    serializer_class = SampleCostEstimateSerializer
    permission_classes = [AllowAny]  # TODO: Change to IsAuthenticated in production

    def get_queryset(self):
        """Filter by sample_request if provided"""
        queryset = super().get_queryset()
        sample_request_id = self.request.query_params.get('sample_request')
        if sample_request_id:
            queryset = queryset.filter(sample_request_id=sample_request_id)
        return queryset

    def perform_create(self, serializer):
        """Auto-set created_by to current user"""
        serializer.save(created_by=self.request.user)


class T2POForSampleViewSet(viewsets.ModelViewSet):
    """
    T2 PO for Sample CRUD

    T2 POs are procurement orders for sample materials
    Phase 2/3 Boundary: Uses snapshot fields, NO FK to BOMItem
    """
    queryset = T2POForSample.objects.all().select_related(
        'sample_request', 'estimate'
    ).prefetch_related('lines').order_by('-created_at')
    serializer_class = T2POForSampleSerializer
    permission_classes = [AllowAny]  # TODO: Change to IsAuthenticated in production

    def get_queryset(self):
        """Filter by sample_request if provided"""
        queryset = super().get_queryset()
        sample_request_id = self.request.query_params.get('sample_request')
        if sample_request_id:
            queryset = queryset.filter(sample_request_id=sample_request_id)
        return queryset


class T2POLineForSampleViewSet(viewsets.ModelViewSet):
    """
    T2 PO Line for Sample CRUD

    Lines are snapshot data - immutable after PO is issued
    """
    queryset = T2POLineForSample.objects.all().select_related('t2po').order_by('t2po', 'line_no')
    serializer_class = T2POLineForSampleSerializer
    permission_classes = [AllowAny]  # TODO: Change to IsAuthenticated in production

    def get_queryset(self):
        """Filter by t2po if provided"""
        queryset = super().get_queryset()
        t2po_id = self.request.query_params.get('t2po')
        if t2po_id:
            queryset = queryset.filter(t2po_id=t2po_id)
        return queryset


class SampleMWOViewSet(viewsets.ModelViewSet):
    """
    Sample Manufacturing Work Order CRUD

    MWOs contain snapshots of BOM/Construction/QC
    Phase 2/3 Boundary: Snapshot-only, NO FK to Phase 2 models
    """
    queryset = SampleMWO.objects.all().select_related(
        'sample_request', 'estimate'
    ).order_by('-created_at')
    serializer_class = SampleMWOSerializer
    permission_classes = [AllowAny]  # TODO: Change to IsAuthenticated in production

    def get_queryset(self):
        """Filter by sample_request if provided"""
        queryset = super().get_queryset()
        sample_request_id = self.request.query_params.get('sample_request')
        if sample_request_id:
            queryset = queryset.filter(sample_request_id=sample_request_id)
        return queryset


class SampleViewSet(viewsets.ModelViewSet):
    """
    Physical Sample CRUD

    Represents actual physical samples produced
    Can have multiple samples per request
    """
    queryset = Sample.objects.all().select_related(
        'sample_request', 'sample_mwo'
    ).prefetch_related('attachments').order_by('-created_at')
    serializer_class = SampleSerializer
    permission_classes = [AllowAny]  # TODO: Change to IsAuthenticated in production

    def get_queryset(self):
        """Filter by sample_request if provided"""
        queryset = super().get_queryset()
        sample_request_id = self.request.query_params.get('sample_request')
        if sample_request_id:
            queryset = queryset.filter(sample_request_id=sample_request_id)
        return queryset


# ==================== P0-2: Kanban View API ====================

@api_view(['GET'])
@perm_classes([AllowAny])
def kanban_counts(request):
    """
    P0-2: Get Kanban lane counts for SampleRun

    Returns counts grouped by status with overdue tracking.

    Query params:
    - days_ahead: Show due within N days (default: 7)

    Response:
    {
      "lanes": [
        {"status": "draft", "label": "Draft", "count": 5, "overdue": 0},
        {"status": "materials_planning", "label": "Materials Planning", "count": 3, "overdue": 1},
        ...
      ],
      "summary": {
        "total": 25,
        "overdue_total": 2,
        "due_this_week": 8
      }
    }
    """
    today = timezone.now().date()
    days_ahead = int(request.query_params.get('days_ahead', 7))
    due_cutoff = today + timedelta(days=days_ahead)

    # Define Kanban lane order (based on workflow)
    lane_order = [
        SampleRunStatus.DRAFT,
        SampleRunStatus.MATERIALS_PLANNING,
        SampleRunStatus.PO_DRAFTED,
        SampleRunStatus.PO_ISSUED,
        SampleRunStatus.MWO_DRAFTED,
        SampleRunStatus.MWO_ISSUED,
        SampleRunStatus.IN_PROGRESS,
        SampleRunStatus.SAMPLE_DONE,
        SampleRunStatus.ACTUALS_RECORDED,
        SampleRunStatus.COSTING_GENERATED,
        SampleRunStatus.QUOTED,
        SampleRunStatus.ACCEPTED,
        SampleRunStatus.REVISE_NEEDED,
    ]

    # SaaS-Ready: Tenant filtering using direct organization FK
    org = _get_user_organization(request)
    base_filter = Q(status__in=lane_order)  # Exclude cancelled

    if org is not None:
        # SaaS mode: Filter by direct organization FK (more efficient)
        base_filter &= Q(organization=org)
    else:
        # Development mode: In production, should return empty
        from django.conf import settings
        if not settings.DEBUG:
            return Response({
                'lanes': [],
                'summary': {'total': 0, 'overdue_total': 0, 'due_this_week': 0},
                'meta': {'as_of': timezone.now().isoformat(), 'days_ahead': days_ahead}
            })

    # Get counts by status
    status_counts = SampleRun.objects.filter(
        base_filter
    ).values('status').annotate(
        count=Count('id'),
        overdue=Count('id', filter=Q(target_due_date__lt=today)),
        due_soon=Count('id', filter=Q(
            target_due_date__gte=today,
            target_due_date__lte=due_cutoff
        )),
    )

    # Build lookup dict
    counts_dict = {item['status']: item for item in status_counts}

    # Build ordered lanes
    lanes = []
    for status_code in lane_order:
        status_label = dict(SampleRunStatus.CHOICES).get(status_code, status_code)
        data = counts_dict.get(status_code, {'count': 0, 'overdue': 0, 'due_soon': 0})
        lanes.append({
            'status': status_code,
            'label': status_label,
            'count': data['count'],
            'overdue': data['overdue'],
            'due_soon': data['due_soon'],
        })

    # Calculate summary
    total = sum(lane['count'] for lane in lanes)
    overdue_total = sum(lane['overdue'] for lane in lanes)
    due_this_week = sum(lane['due_soon'] for lane in lanes)

    return Response({
        'lanes': lanes,
        'summary': {
            'total': total,
            'overdue_total': overdue_total,
            'due_this_week': due_this_week,
        },
        'meta': {
            'as_of': timezone.now().isoformat(),
            'days_ahead': days_ahead,
        }
    })


@api_view(['GET'])
@perm_classes([AllowAny])
def kanban_runs(request):
    """
    P0-2: Get SampleRuns for Kanban board (300+ styles support)

    Returns runs with minimal data for Kanban cards.

    Query params:
    - status: Filter by status (can be multiple, comma-separated)
    - priority: Filter by priority (urgent/normal/low)
    - overdue_only: Show only overdue items
    - due_this_week: Show items due within 7 days
    - brand: Filter by brand name (partial match)
    - style_number: Filter by style number (partial match)
    - run_type: Filter by run type (proto/fit/sales/photo)
    - search: General search (style_number or brand)
    - limit: Max items per status (default: 50)
    """
    today = timezone.now().date()
    week_later = today + timedelta(days=7)

    # SaaS-Ready: Tenant filtering using direct organization FK
    org = _get_user_organization(request)

    # Base queryset with tenant awareness
    queryset = SampleRun.objects.select_related(
        'sample_request',
        'sample_request__revision',
        'sample_request__revision__style',
        'organization',
    ).exclude(
        status=SampleRunStatus.CANCELLED
    )

    if org is not None:
        # SaaS mode: Filter by direct organization FK (more efficient)
        queryset = queryset.for_tenant(org)
    else:
        # Development mode: In production, should return empty
        from django.conf import settings
        if not settings.DEBUG:
            return Response({
                'runs': [],
                'meta': {'count': 0, 'as_of': timezone.now().isoformat()}
            })

    # Apply filters
    status_filter = request.query_params.get('status')
    if status_filter:
        statuses = [s.strip() for s in status_filter.split(',')]
        queryset = queryset.filter(status__in=statuses)

    priority = request.query_params.get('priority')
    if priority:
        queryset = queryset.filter(sample_request__priority=priority)

    overdue_only = request.query_params.get('overdue_only', '').lower() == 'true'
    if overdue_only:
        queryset = queryset.filter(target_due_date__lt=today)

    due_this_week = request.query_params.get('due_this_week', '').lower() == 'true'
    if due_this_week:
        queryset = queryset.filter(
            target_due_date__gte=today,
            target_due_date__lte=week_later
        )

    # Brand filter (partial match)
    brand = request.query_params.get('brand')
    if brand:
        queryset = queryset.filter(sample_request__brand_name__icontains=brand)

    # Style number filter (partial match)
    style_number = request.query_params.get('style_number')
    if style_number:
        queryset = queryset.filter(
            sample_request__revision__style__style_number__icontains=style_number
        )

    # Run type filter
    run_type = request.query_params.get('run_type')
    if run_type:
        queryset = queryset.filter(run_type=run_type)

    # General search (style_number or brand)
    search = request.query_params.get('search')
    if search:
        queryset = queryset.filter(
            Q(sample_request__brand_name__icontains=search) |
            Q(sample_request__revision__style__style_number__icontains=search) |
            Q(sample_request__revision__style__style_name__icontains=search)
        )

    # Limit per status
    limit = int(request.query_params.get('limit', 50))

    # Annotate with overdue flag
    queryset = queryset.annotate(
        is_overdue=Case(
            When(target_due_date__lt=today, then=Value(1)),
            default=Value(0),
            output_field=IntegerField()
        )
    ).order_by('status', '-is_overdue', 'target_due_date', '-created_at')

    # Build response
    runs = []
    for run in queryset[:limit * 15]:  # Rough limit
        request_obj = run.sample_request
        revision = request_obj.revision
        style = revision.style if revision else None

        # TRACK-PROGRESS: 計算停留天數
        timestamps = run.status_timestamps or {}
        current_ts = timestamps.get(run.status)
        if current_ts:
            try:
                from datetime import datetime as dt
                entered = dt.fromisoformat(current_ts.replace('Z', '+00:00'))
                days_in_status = (timezone.now() - entered).days
            except (ValueError, TypeError):
                days_in_status = None
        else:
            # fallback: 用 status_updated_at
            days_in_status = (timezone.now() - run.status_updated_at).days if run.status_updated_at else None

        runs.append({
            'id': str(run.id),
            'run_no': run.run_no,
            'status': run.status,
            'status_label': run.get_status_display(),
            'run_type': run.run_type,
            'run_type_label': run.get_run_type_display(),
            'quantity': run.quantity,
            'target_due_date': run.target_due_date.isoformat() if run.target_due_date else None,
            'is_overdue': run.target_due_date and run.target_due_date < today,
            'days_until_due': (run.target_due_date - today).days if run.target_due_date else None,
            'days_in_status': days_in_status,
            'status_timestamps': timestamps,
            'sample_request': {
                'id': str(request_obj.id),
                'request_type': request_obj.request_type,
                'priority': request_obj.priority,
                'brand_name': request_obj.brand_name,
            },
            'style': {
                'id': str(style.id) if style else None,
                'style_number': style.style_number if style else None,
                'style_name': style.style_name if style else None,
            } if style else None,
            'revision': {
                'id': str(revision.id) if revision else None,
                'revision_label': revision.revision_label if revision else None,
            } if revision else None,
        })

    return Response({
        'runs': runs,
        'meta': {
            'count': len(runs),
            'as_of': timezone.now().isoformat(),
        }
    })


# ==================== P1: Batch Operations API ====================

@api_view(['POST'])
@perm_classes([AllowAny])  # TODO: Change to IsAuthenticated in production
def batch_transition(request):
    """
    P1: Batch transition multiple SampleRuns

    POST /api/v2/sample-runs/batch-transition/

    Request body:
    {
        "run_ids": ["uuid1", "uuid2", ...],
        "action": "start_materials_planning"
    }

    Response:
    {
        "total": 5,
        "succeeded": 4,
        "failed": 1,
        "results": [
            {"run_id": "uuid1", "old_status": "draft", "new_status": "materials_planning", "success": true},
            {"run_id": "uuid2", "success": false, "error": "..."}
        ],
        "errors": [
            {"run_id": "uuid2", "error": "Prerequisite not met"}
        ]
    }

    Notes:
    - All runs must be in the same status
    - Partial success is allowed (some may fail, others succeed)
    - Returns detailed results for each run
    """
    # Extract request data
    run_ids = request.data.get('run_ids', [])
    action = request.data.get('action', '')

    # Validate inputs
    if not run_ids:
        return Response(
            {'detail': 'run_ids is required and must be non-empty'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not action:
        return Response(
            {'detail': 'action is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not isinstance(run_ids, list):
        return Response(
            {'detail': 'run_ids must be an array'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if len(run_ids) > 100:
        return Response(
            {'detail': 'Maximum 100 runs per batch operation'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # SaaS-Ready: Get organization for tenant filtering
    org = _get_user_organization(request)

    # Execute batch transition
    result = batch_transition_sample_runs(
        run_ids=run_ids,
        action=action,
        actor=request.user if request.user.is_authenticated else None,
        payload={
            'reason': request.data.get('reason', ''),
            'notes': request.data.get('notes', ''),
        },
        organization=org,
    )

    # Return appropriate status code
    if result.failed == result.total:
        # All failed
        status_code = status.HTTP_400_BAD_REQUEST
    elif result.failed > 0:
        # Partial success
        status_code = status.HTTP_207_MULTI_STATUS
    else:
        # All succeeded
        status_code = status.HTTP_200_OK

    return Response({
        'total': result.total,
        'succeeded': result.succeeded,
        'failed': result.failed,
        'results': result.results,
        'errors': result.errors,
    }, status=status_code)


# ==================== P2: Smart Batch Transition (Mixed Status) ====================

@api_view(['POST'])
@perm_classes([AllowAny])  # TODO: Change to IsAuthenticated in production
def batch_transition_smart(request):
    """
    P2: 智能批量轉換（支援混合狀態）

    POST /api/v2/sample-runs/batch-transition-smart/

    Request body:
    {
        "run_ids": ["uuid1", "uuid2", ...]
    }

    Response:
    {
        "total": 5,
        "succeeded": 4,
        "failed": 1,
        "results": [
            {"run_id": "uuid1", "old_status": "draft", "new_status": "materials_planning", "action": "start_materials_planning", "success": true},
            {"run_id": "uuid2", "old_status": "po_drafted", "new_status": "po_issued", "action": "issue_t2po", "success": true}
        ],
        "errors": [...]
    }

    Notes:
    - 不要求所有 Run 在同一狀態
    - 自動按狀態分組，每組執行對應的下一步動作
    - 終態（accepted, cancelled）會標記為失敗
    """
    from .services.run_transitions import batch_transition_smart as do_batch_transition_smart

    # Extract request data
    run_ids = request.data.get('run_ids', [])

    # Validate inputs
    if not run_ids:
        return Response(
            {'detail': 'run_ids is required and must be non-empty'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not isinstance(run_ids, list):
        return Response(
            {'detail': 'run_ids must be an array'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if len(run_ids) > 100:
        return Response(
            {'detail': 'Maximum 100 runs per batch operation'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # SaaS-Ready: Get organization for tenant filtering
    org = _get_user_organization(request)

    # Execute smart batch transition
    result = do_batch_transition_smart(
        run_ids=run_ids,
        organization=org,
        actor=request.user if request.user.is_authenticated else None,
    )

    # Return appropriate status code
    if result.failed == result.total:
        status_code = status.HTTP_400_BAD_REQUEST
    elif result.failed > 0:
        status_code = status.HTTP_207_MULTI_STATUS
    else:
        status_code = status.HTTP_200_OK

    return Response({
        'total': result.total,
        'succeeded': result.succeeded,
        'failed': result.failed,
        'results': result.results,
        'errors': result.errors,
    }, status=status_code)


# ==================== P1: Alerts API ====================

@api_view(['GET'])
@perm_classes([AllowAny])  # TODO: Change to IsAuthenticated in production
def get_alerts(request):
    """
    P1: Get alerts for SampleRuns

    GET /api/v2/alerts/

    Query params:
    - include_overdue: Include overdue alerts (default: true)
    - include_due_soon: Include due soon alerts (default: true)
    - include_stale: Include stale alerts (default: true)
    - due_soon_days: Days threshold for "due soon" (default: 3)
    - stale_days: Days threshold for "stale" (default: 7)
    - limit: Max alerts per category (default: 20)

    Response:
    {
        "alerts": [
            {
                "id": "uuid",
                "type": "overdue",
                "severity": "high",
                "title": "Overdue: Style ABC123",
                "message": "Run #1 was due on Jan 1, 2026",
                "run_id": "uuid",
                "style_number": "ABC123",
                "days_overdue": 5
            },
            ...
        ],
        "summary": {
            "overdue": 3,
            "due_soon": 5,
            "stale": 2,
            "total": 10
        }
    }
    """
    today = timezone.now().date()

    # Parse query params
    include_overdue = request.query_params.get('include_overdue', 'true').lower() == 'true'
    include_due_soon = request.query_params.get('include_due_soon', 'true').lower() == 'true'
    include_stale = request.query_params.get('include_stale', 'true').lower() == 'true'
    due_soon_days = int(request.query_params.get('due_soon_days', 3))
    stale_days = int(request.query_params.get('stale_days', 7))
    limit = int(request.query_params.get('limit', 20))

    # SaaS-Ready: Tenant filtering
    org = _get_user_organization(request)

    # Base queryset - exclude completed/cancelled
    base_qs = SampleRun.objects.select_related(
        'sample_request',
        'sample_request__revision',
        'sample_request__revision__style',
    ).exclude(
        status__in=[SampleRunStatus.CANCELLED, SampleRunStatus.ACCEPTED]
    )

    if org is not None:
        base_qs = base_qs.filter(organization=org)
    else:
        from django.conf import settings
        if not settings.DEBUG:
            return Response({
                'alerts': [],
                'summary': {'overdue': 0, 'due_soon': 0, 'stale': 0, 'total': 0}
            })

    alerts = []
    summary = {'overdue': 0, 'due_soon': 0, 'stale': 0, 'total': 0}

    # 1. Overdue alerts (target_due_date < today)
    if include_overdue:
        overdue_runs = base_qs.filter(
            target_due_date__lt=today
        ).order_by('target_due_date')[:limit]

        for run in overdue_runs:
            days_overdue = (today - run.target_due_date).days
            style = run.sample_request.revision.style if run.sample_request.revision else None
            alerts.append({
                'id': str(run.id),
                'type': 'overdue',
                'severity': 'high',
                'title': f"Overdue: {style.style_number if style else 'Unknown'}",
                'message': f"Run #{run.run_no} was due on {run.target_due_date.strftime('%b %d, %Y')} ({days_overdue} days ago)",
                'run_id': str(run.id),
                'request_id': str(run.sample_request.id),
                'style_number': style.style_number if style else None,
                'status': run.status,
                'days_overdue': days_overdue,
                'target_due_date': run.target_due_date.isoformat(),
            })
            summary['overdue'] += 1

    # 2. Due Soon alerts (today <= target_due_date <= today + due_soon_days)
    if include_due_soon:
        due_soon_cutoff = today + timedelta(days=due_soon_days)
        due_soon_runs = base_qs.filter(
            target_due_date__gte=today,
            target_due_date__lte=due_soon_cutoff
        ).order_by('target_due_date')[:limit]

        for run in due_soon_runs:
            days_until = (run.target_due_date - today).days
            style = run.sample_request.revision.style if run.sample_request.revision else None
            alerts.append({
                'id': str(run.id),
                'type': 'due_soon',
                'severity': 'medium',
                'title': f"Due Soon: {style.style_number if style else 'Unknown'}",
                'message': f"Run #{run.run_no} is due in {days_until} day{'s' if days_until != 1 else ''}",
                'run_id': str(run.id),
                'request_id': str(run.sample_request.id),
                'style_number': style.style_number if style else None,
                'status': run.status,
                'days_until_due': days_until,
                'target_due_date': run.target_due_date.isoformat(),
            })
            summary['due_soon'] += 1

    # 3. Stale alerts (draft status for > stale_days)
    if include_stale:
        stale_cutoff = timezone.now() - timedelta(days=stale_days)
        stale_runs = base_qs.filter(
            status=SampleRunStatus.DRAFT,
            created_at__lt=stale_cutoff
        ).order_by('created_at')[:limit]

        for run in stale_runs:
            days_stale = (timezone.now() - run.created_at).days
            style = run.sample_request.revision.style if run.sample_request.revision else None
            alerts.append({
                'id': str(run.id),
                'type': 'stale',
                'severity': 'low',
                'title': f"Stale: {style.style_number if style else 'Unknown'}",
                'message': f"Run #{run.run_no} has been in draft for {days_stale} days",
                'run_id': str(run.id),
                'request_id': str(run.sample_request.id),
                'style_number': style.style_number if style else None,
                'status': run.status,
                'days_stale': days_stale,
                'created_at': run.created_at.isoformat(),
            })
            summary['stale'] += 1

    summary['total'] = summary['overdue'] + summary['due_soon'] + summary['stale']

    # Sort alerts by severity (high > medium > low)
    severity_order = {'high': 0, 'medium': 1, 'low': 2}
    alerts.sort(key=lambda x: severity_order.get(x['severity'], 3))

    return Response({
        'alerts': alerts,
        'summary': summary,
        'meta': {
            'as_of': timezone.now().isoformat(),
            'due_soon_days': due_soon_days,
            'stale_days': stale_days,
        }
    })


# P3: Batch Export Endpoint
@api_view(['POST'])
@perm_classes([AllowAny])  # TODO: Change to IsAuthenticated in production
def batch_export(request):
    """
    Batch export multiple SampleRuns to ZIP
    POST /api/v2/sample-runs/batch-export/

    Body:
    {
        "run_ids": ["uuid1", "uuid2"],
        "export_types": ["mwo", "estimate", "po"],  // optional, defaults to all
        "format": "pdf"  // 'pdf' or 'excel', defaults to 'pdf'
    }

    Returns:
        ZIP file with folder structure:
        export_3_runs_pdf_20260104_143022.zip
        ├── Run-001_LW1FLWS/
        │   ├── MWO-2601-000001.pdf
        │   ├── EST-xxx.pdf
        │   └── T2PO-xxx.pdf
        └── Run-002_LW1DKES/
            └── ...
    """
    run_ids = request.data.get('run_ids', [])
    export_types = request.data.get('export_types', ['mwo', 'estimate', 'po'])
    format_type = request.data.get('format', 'pdf')

    if not run_ids:
        return Response({'detail': 'run_ids is required'}, status=400)

    if format_type not in ['pdf', 'excel']:
        return Response({'detail': 'format must be "pdf" or "excel"'}, status=400)

    # 使用租戶過濾
    organization = _get_user_organization(request)

    return batch_export_sample_runs(
        run_ids=run_ids,
        export_types=export_types,
        format=format_type,
        organization=organization
    )


# ==================== P9: Scheduler/Gantt API ====================

# Status progress mapping (percentage through workflow)
STATUS_PROGRESS = {
    'draft': 0,
    'materials_planning': 10,
    'po_drafted': 20,
    'po_issued': 30,
    'mwo_drafted': 40,
    'mwo_issued': 50,
    'in_progress': 60,
    'sample_done': 70,
    'actuals_recorded': 80,
    'costing_generated': 90,
    'quoted': 95,
    'accepted': 100,
    'cancelled': 0,
}

# Status colors for Gantt chart
STATUS_COLORS = {
    'draft': '#94a3b8',           # slate-400
    'materials_planning': '#fbbf24',  # amber-400
    'po_drafted': '#f97316',      # orange-500
    'po_issued': '#22c55e',       # green-500
    'mwo_drafted': '#3b82f6',     # blue-500
    'mwo_issued': '#6366f1',      # indigo-500
    'in_progress': '#8b5cf6',     # violet-500
    'sample_done': '#06b6d4',     # cyan-500
    'actuals_recorded': '#14b8a6', # teal-500
    'costing_generated': '#10b981', # emerald-500
    'quoted': '#84cc16',          # lime-500
    'accepted': '#22c55e',        # green-500
    'cancelled': '#ef4444',       # red-500
}


@api_view(['GET'])
@perm_classes([AllowAny])
def scheduler_data(request):
    """
    P9: Get Scheduler/Gantt chart data

    GET /api/v2/scheduler/

    Query params:
    - view: 'style' (grouped by style) or 'run' (flat list), default 'style'
    - start_date: Start date for date range (YYYY-MM-DD), default 14 days ago
    - end_date: End date for date range (YYYY-MM-DD), default 14 days ahead
    - search: Search style number
    - status: Filter by status (comma-separated)
    - page: Page number (default 1)
    - page_size: Items per page (10/25/50, default 25)

    Response for view=style:
    {
        "styles": [
            {
                "id": "uuid",
                "style_number": "LW1FLWS",
                "style_name": "...",
                "runs_count": 3,
                "progress": 65,  // overall progress percentage
                "is_overdue": false,
                "earliest_due": "2026-01-15",
                "latest_due": "2026-01-20",
                "runs": [
                    {
                        "id": "uuid",
                        "run_no": 1,
                        "run_type": "proto",
                        "status": "in_progress",
                        "status_label": "In Progress",
                        "progress": 60,
                        "color": "#8b5cf6",
                        "start_date": "2026-01-01",
                        "target_due_date": "2026-01-15",
                        "is_overdue": false,
                        "days_until_due": 5
                    }
                ]
            }
        ],
        "pagination": {
            "page": 1,
            "page_size": 25,
            "total_pages": 2,
            "total_count": 30
        },
        "date_range": {
            "start": "2025-12-27",
            "end": "2026-01-24"
        },
        "meta": {
            "as_of": "2026-01-10T...",
            "view": "style"
        }
    }
    """
    today = timezone.now().date()

    # Parse query params
    view_type = request.query_params.get('view', 'style')
    start_date_str = request.query_params.get('start_date')
    end_date_str = request.query_params.get('end_date')
    search = request.query_params.get('search', '')
    status_filter = request.query_params.get('status', '')
    page = int(request.query_params.get('page', 1))
    page_size = int(request.query_params.get('page_size', 25))

    # Validate page_size
    if page_size not in [10, 25, 50]:
        page_size = 25

    # Parse date range (default: 14 days ago to 14 days ahead)
    if start_date_str:
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        except ValueError:
            start_date = today - timedelta(days=14)
    else:
        start_date = today - timedelta(days=14)

    if end_date_str:
        try:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        except ValueError:
            end_date = today + timedelta(days=14)
    else:
        end_date = today + timedelta(days=14)

    # SaaS-Ready: Tenant filtering
    org = _get_user_organization(request)

    # Base queryset
    queryset = SampleRun.objects.select_related(
        'sample_request',
        'sample_request__revision',
        'sample_request__revision__style',
    ).exclude(
        status=SampleRunStatus.CANCELLED
    )

    if org is not None:
        queryset = queryset.for_tenant(org)
    else:
        from django.conf import settings
        if not settings.DEBUG:
            return Response({
                'styles': [],
                'runs': [],
                'pagination': {'page': 1, 'page_size': page_size, 'total_pages': 0, 'total_count': 0},
                'date_range': {'start': start_date.isoformat(), 'end': end_date.isoformat()},
                'meta': {'as_of': timezone.now().isoformat(), 'view': view_type}
            })

    # Apply search filter
    if search:
        queryset = queryset.filter(
            Q(sample_request__revision__style__style_number__icontains=search) |
            Q(sample_request__revision__style__style_name__icontains=search)
        )

    # Apply status filter
    if status_filter:
        statuses = [s.strip() for s in status_filter.split(',')]
        queryset = queryset.filter(status__in=statuses)

    # Order by style and run number
    queryset = queryset.order_by(
        'sample_request__revision__style__style_number',
        'run_no'
    )

    if view_type == 'style':
        return _build_style_view(queryset, today, start_date, end_date, page, page_size)
    else:
        return _build_run_view(queryset, today, start_date, end_date, page, page_size)


def _build_style_view(queryset, today, start_date, end_date, page, page_size):
    """
    Build Style-grouped view for Scheduler

    Optimized for 300+ styles:
    1. First get distinct style IDs with pagination at DB level
    2. Then fetch runs only for those paginated styles
    """
    from apps.styles.models import Style

    # Step 1: Get distinct style IDs from runs (database level)
    style_ids_with_runs = queryset.values_list(
        'sample_request__revision__style_id', flat=True
    ).distinct()

    # Get unique style IDs (filter None)
    unique_style_ids = [sid for sid in style_ids_with_runs if sid is not None]

    # Step 2: Paginate styles at database level
    total_count = len(unique_style_ids)
    total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 0
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paginated_style_ids = unique_style_ids[start_idx:end_idx]

    if not paginated_style_ids:
        return Response({
            'styles': [],
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total_pages': total_pages,
                'total_count': total_count,
            },
            'date_range': {
                'start': start_date.isoformat(),
                'end': end_date.isoformat(),
            },
            'status_colors': STATUS_COLORS,
            'meta': {
                'as_of': timezone.now().isoformat(),
                'view': 'style',
            }
        })

    # Step 3: Fetch styles and runs only for paginated subset
    styles_map = {
        str(s.id): s for s in Style.objects.filter(id__in=paginated_style_ids)
    }

    # Fetch runs only for paginated styles
    paginated_runs = queryset.filter(
        sample_request__revision__style_id__in=paginated_style_ids
    ).select_related(
        'sample_request',
        'sample_request__revision',
        'sample_request__revision__style',
    ).order_by('sample_request__revision__style__style_number', 'run_no')

    # Step 4: Group runs by style
    styles_dict = {}
    for style_id in paginated_style_ids:
        style_id_str = str(style_id)
        style = styles_map.get(style_id_str)
        if style:
            styles_dict[style_id_str] = {
                'id': style_id_str,
                'style_number': style.style_number,
                'style_name': style.style_name or '',
                'runs': [],
            }

    for run in paginated_runs:
        request_obj = run.sample_request
        revision = request_obj.revision if request_obj else None
        style = revision.style if revision else None

        if not style:
            continue

        style_id = str(style.id)
        if style_id not in styles_dict:
            continue

        # Calculate progress for this run
        progress = STATUS_PROGRESS.get(run.status, 0)
        color = STATUS_COLORS.get(run.status, '#94a3b8')

        # Calculate overdue status
        is_overdue = run.target_due_date and run.target_due_date < today
        days_until_due = (run.target_due_date - today).days if run.target_due_date else None

        styles_dict[style_id]['runs'].append({
            'id': str(run.id),
            'run_no': run.run_no,
            'run_type': run.run_type,
            'run_type_label': run.get_run_type_display(),
            'status': run.status,
            'status_label': run.get_status_display(),
            'progress': progress,
            'color': color,
            'start_date': run.created_at.date().isoformat() if run.created_at else None,
            'target_due_date': run.target_due_date.isoformat() if run.target_due_date else None,
            'is_overdue': is_overdue,
            'days_until_due': days_until_due,
            'quantity': run.quantity,
            'brand_name': request_obj.brand_name if request_obj else None,
            'priority': request_obj.priority if request_obj else 'normal',
        })

    # Step 5: Calculate style-level aggregates (only for paginated styles)
    styles_list = []
    for style_id in paginated_style_ids:
        style_id_str = str(style_id)
        style_data = styles_dict.get(style_id_str)
        if not style_data:
            continue

        runs = style_data['runs']
        if not runs:
            continue

        # Overall progress = average of all runs
        avg_progress = sum(r['progress'] for r in runs) / len(runs)

        # Check if any run is overdue
        any_overdue = any(r['is_overdue'] for r in runs)

        # Get earliest and latest due dates
        due_dates = [r['target_due_date'] for r in runs if r['target_due_date']]
        earliest_due = min(due_dates) if due_dates else None
        latest_due = max(due_dates) if due_dates else None

        styles_list.append({
            'id': style_data['id'],
            'style_number': style_data['style_number'],
            'style_name': style_data['style_name'],
            'runs_count': len(runs),
            'progress': round(avg_progress),
            'is_overdue': any_overdue,
            'earliest_due': earliest_due,
            'latest_due': latest_due,
            'runs': runs,
        })

    return Response({
        'styles': styles_list,
        'pagination': {
            'page': page,
            'page_size': page_size,
            'total_pages': total_pages,
            'total_count': total_count,
        },
        'date_range': {
            'start': start_date.isoformat(),
            'end': end_date.isoformat(),
        },
        'status_colors': STATUS_COLORS,
        'meta': {
            'as_of': timezone.now().isoformat(),
            'view': 'style',
        }
    })


def _build_run_view(queryset, today, start_date, end_date, page, page_size):
    """Build flat Run view for Scheduler"""
    runs_list = []

    for run in queryset:
        request_obj = run.sample_request
        revision = request_obj.revision if request_obj else None
        style = revision.style if revision else None

        progress = STATUS_PROGRESS.get(run.status, 0)
        color = STATUS_COLORS.get(run.status, '#94a3b8')
        is_overdue = run.target_due_date and run.target_due_date < today
        days_until_due = (run.target_due_date - today).days if run.target_due_date else None

        runs_list.append({
            'id': str(run.id),
            'run_no': run.run_no,
            'run_type': run.run_type,
            'run_type_label': run.get_run_type_display(),
            'status': run.status,
            'status_label': run.get_status_display(),
            'progress': progress,
            'color': color,
            'start_date': run.created_at.date().isoformat() if run.created_at else None,
            'target_due_date': run.target_due_date.isoformat() if run.target_due_date else None,
            'is_overdue': is_overdue,
            'days_until_due': days_until_due,
            'quantity': run.quantity,
            'style': {
                'id': str(style.id) if style else None,
                'style_number': style.style_number if style else None,
                'style_name': style.style_name if style else None,
            } if style else None,
            'brand_name': request_obj.brand_name if request_obj else None,
            'priority': request_obj.priority if request_obj else 'normal',
        })

    # Pagination
    total_count = len(runs_list)
    total_pages = (total_count + page_size - 1) // page_size
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paginated_runs = runs_list[start_idx:end_idx]

    return Response({
        'runs': paginated_runs,
        'pagination': {
            'page': page,
            'page_size': page_size,
            'total_pages': total_pages,
            'total_count': total_count,
        },
        'date_range': {
            'start': start_date.isoformat(),
            'end': end_date.isoformat(),
        },
        'status_colors': STATUS_COLORS,
        'meta': {
            'as_of': timezone.now().isoformat(),
            'view': 'run',
        }
    })


# ========================================
# P18: Unified Progress Dashboard API
# ========================================

@api_view(['GET'])
@perm_classes([AllowAny])
def progress_dashboard(request):
    """
    P18: 統一進度追蹤儀表板 API

    GET /api/v2/progress-dashboard/

    Returns aggregated progress data for:
    - Sample progress (SampleRun by status)
    - Quotation progress (CostSheetVersion by status)
    - Procurement progress (PurchaseOrder by status)
    - Production progress (ProductionOrder by status)
    - Delivery alerts (overdue/delayed items)

    Query params:
    - style_id: Filter by specific style
    - days_ahead: Days to look ahead for due dates (default: 14)
    """
    from apps.costing.models import CostSheetVersion
    from apps.procurement.models import PurchaseOrder, POLine
    from apps.orders.models import ProductionOrder, MaterialRequirement

    today = timezone.now().date()
    days_ahead = int(request.query_params.get('days_ahead', 14))
    style_id = request.query_params.get('style_id')

    # SaaS-Ready: Tenant filtering
    org = _get_user_organization(request)

    # ========================================
    # 1. Sample Progress
    # ========================================
    sample_runs = SampleRun.objects.exclude(status=SampleRunStatus.CANCELLED)
    if org:
        sample_runs = sample_runs.for_tenant(org)
    if style_id:
        sample_runs = sample_runs.filter(sample_request__revision__style_id=style_id)

    sample_by_status = {}
    for status_choice in SampleRunStatus.CHOICES:
        status_value = status_choice[0]
        count = sample_runs.filter(status=status_value).count()
        if count > 0:
            sample_by_status[status_value] = {
                'count': count,
                'label': status_choice[1],
                'progress': STATUS_PROGRESS.get(status_value, 0),
                'color': STATUS_COLORS.get(status_value, '#94a3b8'),
            }

    # Overdue samples
    overdue_samples = sample_runs.filter(
        target_due_date__lt=today
    ).exclude(status__in=['accepted', 'sample_done']).count()

    # Due soon samples (within days_ahead)
    due_soon_samples = sample_runs.filter(
        target_due_date__gte=today,
        target_due_date__lte=today + timedelta(days=days_ahead)
    ).exclude(status__in=['accepted', 'sample_done']).count()

    # ========================================
    # 2. Quotation Progress
    # ========================================
    cost_sheets = CostSheetVersion.objects.all()
    if style_id:
        cost_sheets = cost_sheets.filter(cost_sheet_group__style_id=style_id)

    quote_by_status = {}
    quote_by_type = {'sample': 0, 'bulk': 0}
    for cs in cost_sheets:
        status = cs.status
        if status not in quote_by_status:
            quote_by_status[status] = {'count': 0, 'label': status.title()}
        quote_by_status[status]['count'] += 1

        costing_type = cs.costing_type
        if costing_type in quote_by_type:
            quote_by_type[costing_type] += 1

    # Pending quotes (draft or submitted)
    pending_quotes = cost_sheets.filter(status__in=['draft', 'submitted']).count()

    # ========================================
    # 3. Procurement Progress
    # ========================================
    purchase_orders = PurchaseOrder.objects.all()
    if org:
        purchase_orders = purchase_orders.for_tenant(org)

    po_by_status = {}
    for status_choice in PurchaseOrder.STATUS_CHOICES:
        status_value = status_choice[0]
        count = purchase_orders.filter(status=status_value).count()
        if count > 0:
            po_by_status[status_value] = {
                'count': count,
                'label': status_choice[1],
            }

    # Overdue deliveries
    overdue_deliveries = POLine.objects.filter(
        delivery_status__in=['pending', 'shipped', 'partial'],
        expected_delivery__lt=today
    ).count()

    # Due soon deliveries
    due_soon_deliveries = POLine.objects.filter(
        delivery_status__in=['pending', 'shipped'],
        expected_delivery__gte=today,
        expected_delivery__lte=today + timedelta(days=days_ahead)
    ).count()

    # ========================================
    # 4. Production Order Progress
    # ========================================
    production_orders = ProductionOrder.objects.all()
    if org:
        production_orders = production_orders.for_tenant(org)
    if style_id:
        production_orders = production_orders.filter(style_revision__style_id=style_id)

    prod_by_status = {}
    for status_choice in ProductionOrder.STATUS_CHOICES:
        status_value = status_choice[0]
        count = production_orders.filter(status=status_value).count()
        if count > 0:
            prod_by_status[status_value] = {
                'count': count,
                'label': status_choice[1],
            }

    # Overdue production orders
    overdue_prod = production_orders.filter(
        delivery_date__lt=today
    ).exclude(status__in=['completed', 'cancelled']).count()

    # ========================================
    # 5. Material Requirements Progress
    # ========================================
    material_reqs = MaterialRequirement.objects.all()
    if style_id:
        material_reqs = material_reqs.filter(
            production_order__style_revision__style_id=style_id
        )

    mat_req_by_status = {}
    for status_choice in MaterialRequirement.STATUS_CHOICES:
        status_value = status_choice[0]
        count = material_reqs.filter(status=status_value).count()
        if count > 0:
            mat_req_by_status[status_value] = {
                'count': count,
                'label': status_choice[1],
            }

    # ========================================
    # 6. Summary Statistics
    # ========================================
    summary = {
        'total_samples': sample_runs.count(),
        'active_samples': sample_runs.exclude(
            status__in=['accepted', 'sample_done', 'cancelled']
        ).count(),
        'total_quotes': cost_sheets.count(),
        'pending_quotes': pending_quotes,
        'total_po': purchase_orders.count(),
        'active_po': purchase_orders.exclude(
            status__in=['received', 'cancelled']
        ).count(),
        'total_prod_orders': production_orders.count(),
        'active_prod_orders': production_orders.exclude(
            status__in=['completed', 'cancelled']
        ).count(),
    }

    # ========================================
    # 7. Alerts
    # ========================================
    alerts = []

    if overdue_samples > 0:
        alerts.append({
            'type': 'error',
            'category': 'sample',
            'title': f'{overdue_samples} Overdue Sample(s)',
            'description': 'Sample runs past their due date',
        })

    if due_soon_samples > 0:
        alerts.append({
            'type': 'warning',
            'category': 'sample',
            'title': f'{due_soon_samples} Sample(s) Due Soon',
            'description': f'Sample runs due within {days_ahead} days',
        })

    if overdue_deliveries > 0:
        alerts.append({
            'type': 'error',
            'category': 'procurement',
            'title': f'{overdue_deliveries} Overdue Delivery(s)',
            'description': 'PO lines past expected delivery date',
        })

    if due_soon_deliveries > 0:
        alerts.append({
            'type': 'warning',
            'category': 'procurement',
            'title': f'{due_soon_deliveries} Delivery(s) Due Soon',
            'description': f'PO lines with delivery expected within {days_ahead} days',
        })

    if overdue_prod > 0:
        alerts.append({
            'type': 'error',
            'category': 'production',
            'title': f'{overdue_prod} Overdue Production Order(s)',
            'description': 'Production orders past delivery date',
        })

    return Response({
        'sample_progress': {
            'by_status': sample_by_status,
            'overdue': overdue_samples,
            'due_soon': due_soon_samples,
        },
        'quotation_progress': {
            'by_status': quote_by_status,
            'by_type': quote_by_type,
            'pending': pending_quotes,
        },
        'procurement_progress': {
            'by_status': po_by_status,
            'overdue_deliveries': overdue_deliveries,
            'due_soon_deliveries': due_soon_deliveries,
        },
        'production_progress': {
            'by_status': prod_by_status,
            'overdue': overdue_prod,
        },
        'material_progress': {
            'by_status': mat_req_by_status,
        },
        'summary': summary,
        'alerts': alerts,
        'meta': {
            'as_of': timezone.now().isoformat(),
            'days_ahead': days_ahead,
            'style_filter': style_id,
        }
    })
