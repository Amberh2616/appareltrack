"""
Phase 2-3 API Views
ViewSets for Three-Layer Separation Architecture
P18: 統一報價架構 (Sample → Bulk)
"""

from decimal import Decimal, ROUND_HALF_UP
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone

from .models import (
    UsageScenario,
    UsageLine,
    CostSheetGroup,
    CostSheetVersion,
    CostLineV2
)
from .serializers_phase23 import (
    UsageScenarioListSerializer,
    UsageScenarioDetailSerializer,
    UsageLineSerializer,
    CostSheetGroupSerializer,
    CostSheetVersionListSerializer,
    CostSheetVersionDetailSerializer,
    CostLineV2Serializer,
)
from .services import UsageScenarioService, CostingService
from .services.costing_service import MissingUnitPriceError


class UsageScenarioViewSet(viewsets.ModelViewSet):
    """
    UsageScenario CRUD + Clone action

    Endpoints:
    - GET /api/v2/usage-scenarios/ - List scenarios
    - POST /api/v2/usage-scenarios/ - Create scenario
    - GET /api/v2/usage-scenarios/{id}/ - Retrieve scenario
    - PATCH /api/v2/usage-scenarios/{id}/ - Update scenario summary
    - POST /api/v2/usage-scenarios/{id}/clone/ - Clone scenario
    """

    queryset = UsageScenario.objects.select_related(
        'revision',
        'created_by'
    ).prefetch_related('usage_lines')
    permission_classes = [AllowAny]  # TODO: Change to IsAuthenticated in production

    def get_serializer_class(self):
        if self.action == 'list':
            return UsageScenarioListSerializer
        return UsageScenarioDetailSerializer

    def get_queryset(self):
        """Filter by query params"""
        queryset = self.queryset

        # Filter by revision
        revision_id = self.request.query_params.get('revision_id')
        if revision_id:
            queryset = queryset.filter(revision_id=revision_id)

        # Filter by purpose
        purpose = self.request.query_params.get('purpose')
        if purpose:
            queryset = queryset.filter(purpose=purpose)

        return queryset

    def create(self, request, *args, **kwargs):
        """
        Create UsageScenario via Service

        Payload:
        {
            "revision_id": "uuid",
            "purpose": "sample_quote|bulk_quote|...",
            "wastage_pct": 5.0,
            "rounding_rule": "round_up",
            "notes": "",
            "bom_items": [  // optional, if not provided, use all BOM items
                {
                    "bom_item_id": "uuid",
                    "consumption": 1.5,
                    "consumption_unit": "yards",
                    "consumption_status": "confirmed"
                }
            ]
        }
        """
        from apps.styles.models import StyleRevision

        revision_id = request.data.get('revision_id')
        purpose = request.data.get('purpose')

        if not revision_id or not purpose:
            return Response(
                {'error': 'revision_id and purpose are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        revision = get_object_or_404(StyleRevision, id=revision_id)

        try:
            scenario = UsageScenarioService.create_scenario(
                revision=revision,
                purpose=purpose,
                payload=request.data,
                user=request.user
            )

            serializer = UsageScenarioDetailSerializer(scenario)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def clone(self, request, pk=None):
        """
        Clone UsageScenario

        Payload:
        {
            "purpose": "bulk_quote",  // optional, can switch purpose
            "wastage_pct": 5.0,       // optional
            "notes": ""               // optional
        }
        """
        scenario = self.get_object()

        try:
            cloned = UsageScenarioService.clone_scenario(
                scenario_id=scenario.id,
                overrides=request.data,
                user=request.user
            )

            serializer = UsageScenarioDetailSerializer(cloned)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class UsageLineViewSet(viewsets.ModelViewSet):
    """
    UsageLine CRUD (mainly for updating consumption)

    Endpoints:
    - GET /api/v2/usage-lines/ - List lines (filter by scenario)
    - PATCH /api/v2/usage-lines/{id}/ - Update line
    """

    queryset = UsageLine.objects.select_related(
        'usage_scenario',
        'bom_item',
        'confirmed_by'
    )
    serializer_class = UsageLineSerializer
    permission_classes = [AllowAny]  # TODO: Change to IsAuthenticated in production
    http_method_names = ['get', 'patch']  # Only GET and PATCH

    def get_queryset(self):
        """Filter by usage_scenario_id"""
        queryset = self.queryset

        scenario_id = self.request.query_params.get('usage_scenario_id')
        if scenario_id:
            queryset = queryset.filter(usage_scenario_id=scenario_id)

        return queryset

    def partial_update(self, request, *args, **kwargs):
        """
        Update UsageLine via Service (with can_edit check)

        Payload:
        {
            "consumption": 1.8,
            "consumption_status": "confirmed",
            "wastage_pct_override": 10.0
        }
        """
        line = self.get_object()

        try:
            updated_line = UsageScenarioService.update_usage_line(
                line_id=line.id,
                patch=request.data,
                user=request.user
            )

            serializer = self.get_serializer(updated_line)
            return Response(serializer.data)

        except PermissionError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_403_FORBIDDEN
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class CostSheetVersionViewSet(viewsets.ModelViewSet):
    """
    CostSheetVersion CRUD + Clone/Submit actions

    Endpoints:
    - GET /api/v2/cost-sheet-versions/ - List versions
    - POST /api/v2/cost-sheet-versions/ - Create version
    - GET /api/v2/cost-sheet-versions/{id}/ - Retrieve version
    - PATCH /api/v2/cost-sheet-versions/{id}/ - Update summary
    - POST /api/v2/cost-sheet-versions/{id}/clone/ - Clone version
    - POST /api/v2/cost-sheet-versions/{id}/submit/ - Submit version
    """

    queryset = CostSheetVersion.objects.select_related(
        'cost_sheet_group__style',
        'techpack_revision',
        'usage_scenario',
        'created_by',
        'submitted_by'
    ).prefetch_related('cost_lines')
    permission_classes = [AllowAny]  # TODO: Change to IsAuthenticated in production

    def get_serializer_class(self):
        if self.action == 'list':
            return CostSheetVersionListSerializer
        return CostSheetVersionDetailSerializer

    def get_queryset(self):
        """Filter by query params"""
        queryset = self.queryset

        # Filter by cost_sheet_group
        group_id = self.request.query_params.get('cost_sheet_group_id')
        if group_id:
            queryset = queryset.filter(cost_sheet_group_id=group_id)

        # Filter by costing_type
        costing_type = self.request.query_params.get('costing_type')
        if costing_type:
            queryset = queryset.filter(costing_type=costing_type)

        # Filter by style_id (join through cost_sheet_group)
        style_id = self.request.query_params.get('style_id')
        if style_id:
            queryset = queryset.filter(cost_sheet_group__style_id=style_id)

        return queryset

    def create(self, request, *args, **kwargs):
        """
        Create CostSheetVersion via Service

        Payload:
        {
            "style_id": "uuid",
            "costing_type": "sample|bulk",
            "usage_scenario_id": "uuid",
            "labor_cost": 10.0,
            "overhead_cost": 5.0,
            "freight_cost": 3.0,
            "packing_cost": 2.0,
            "margin_pct": 30.0,
            "change_reason": "Initial costing"
        }
        """
        style_id = request.data.get('style_id')
        costing_type = request.data.get('costing_type')
        usage_scenario_id = request.data.get('usage_scenario_id')

        if not all([style_id, costing_type, usage_scenario_id]):
            return Response(
                {'error': 'style_id, costing_type, and usage_scenario_id are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            cost_sheet = CostingService.create_cost_sheet(
                style_id=style_id,
                costing_type=costing_type,
                usage_scenario_id=usage_scenario_id,
                payload=request.data,
                user=request.user
            )

            serializer = CostSheetVersionDetailSerializer(cost_sheet)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except MissingUnitPriceError as e:
            return Response({
                'error': str(e),
                'error_code': 'MISSING_UNIT_PRICE',
                'missing_items': e.missing_items
            }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    def partial_update(self, request, *args, **kwargs):
        """
        Update CostSheetVersion summary via Service (Draft only)

        Payload:
        {
            "labor_cost": 12.0,
            "overhead_cost": 6.0,
            "margin_pct": 35.0
        }
        """
        cost_sheet = self.get_object()

        try:
            updated = CostingService.update_cost_sheet_summary(
                cost_sheet_id=cost_sheet.id,
                patch=request.data,
                user=request.user
            )

            serializer = self.get_serializer(updated)
            return Response(serializer.data)

        except PermissionError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_403_FORBIDDEN
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def clone(self, request, pk=None):
        """
        Clone CostSheetVersion

        Payload:
        {
            "usage_scenario_id": "uuid",  // optional, can switch scenario
            "labor_cost": 12.0,           // optional
            "margin_pct": 35.0,           // optional
            "change_reason": "Client requested adjustment"
        }
        """
        cost_sheet = self.get_object()

        try:
            cloned = CostingService.clone_cost_sheet(
                cost_sheet_id=cost_sheet.id,
                overrides=request.data,
                user=request.user
            )

            serializer = CostSheetVersionDetailSerializer(cloned)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'], url_path='refresh-snapshot')
    def refresh_snapshot(self, request, pk=None):
        """
        Refresh CostSheetVersion from current BOM data.
        Only allowed for draft status.

        POST /api/v2/cost-sheet-versions/{id}/refresh-snapshot/

        Returns:
            Updated CostSheetVersion with refreshed cost lines

        Errors:
            400: Not in draft status or missing unit_price
        """
        cost_sheet = self.get_object()

        try:
            refreshed = CostingService.refresh_snapshot(
                cost_sheet_id=cost_sheet.id,
                user=request.user
            )

            serializer = CostSheetVersionDetailSerializer(refreshed)
            return Response(serializer.data)

        except MissingUnitPriceError as e:
            return Response({
                'error': str(e),
                'error_code': 'MISSING_UNIT_PRICE',
                'missing_items': e.missing_items
            }, status=status.HTTP_400_BAD_REQUEST)

        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['get'], url_path='allowed-actions')
    def allowed_actions(self, request, pk=None):
        """
        GET /api/v2/cost-sheet-versions/{id}/allowed-actions/

        Returns what actions are allowed on this cost sheet version

        Returns:
            {
                "success": true,
                "data": {
                    "can_submit": bool,
                    "can_edit": bool,
                    "reasons": ["NOT_DRAFT" | "BOM_NOT_READY"],
                    "bom": {
                        "items_count": int,
                        "verified_count": int,
                        "verified_ratio": float,
                        "required_threshold": float
                    }
                }
            }
        """
        from apps.styles.portfolio import bom_counts, BOM_VERIFIED_THRESHOLD

        cost_sheet = self.get_object()
        style = cost_sheet.cost_sheet_group.style if cost_sheet.cost_sheet_group else None

        # Get BOM counts
        total, verified, ratio = bom_counts(style) if style else (0, 0, 0.0)

        # Determine can_submit
        can_submit = (
            cost_sheet.status == 'draft' and
            ratio >= BOM_VERIFIED_THRESHOLD
        )

        # Determine can_edit
        can_edit = cost_sheet.status == 'draft'

        # Reasons why cannot submit
        reasons = []
        if cost_sheet.status != 'draft':
            reasons.append('NOT_DRAFT')
        if ratio < BOM_VERIFIED_THRESHOLD:
            reasons.append('BOM_NOT_READY')

        return Response({
            'success': True,
            'data': {
                'can_submit': can_submit,
                'can_edit': can_edit,
                'reasons': reasons,
                'bom': {
                    'items_count': total,
                    'verified_count': verified,
                    'verified_ratio': round(ratio, 4),
                    'required_threshold': BOM_VERIFIED_THRESHOLD,
                }
            }
        })

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """
        Submit CostSheetVersion (Draft → Submitted, locks UsageScenario)

        Decision 2 Gate: BOM verified_ratio >= 0.9

        No payload required

        Returns:
            200: Success with serialized cost_sheet
            400: Invalid state (not draft)
            403: BOM not ready (verified_ratio < 0.9)
            500: Internal error
        """
        cost_sheet = self.get_object()

        try:
            from .services.costing_service import BOMNotReadyError

            submitted = CostingService.submit_cost_sheet(
                cost_sheet_id=cost_sheet.id,
                user=request.user
            )

            serializer = CostSheetVersionDetailSerializer(submitted)
            return Response({
                'success': True,
                'data': serializer.data
            })

        except BOMNotReadyError as e:
            # Decision 2: Return 403 with BOM details
            return Response(
                {
                    'success': False,
                    'error': 'BOM_NOT_READY',
                    'detail': str(e),
                    **e.bom_data
                },
                status=status.HTTP_403_FORBIDDEN
            )
        except ValueError as e:
            return Response(
                {
                    'success': False,
                    'error': 'INVALID_STATE',
                    'detail': str(e)
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {
                    'success': False,
                    'error': 'INTERNAL_ERROR',
                    'detail': str(e)
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'], url_path='create-bulk-quote')
    @transaction.atomic
    def create_bulk_quote(self, request, pk=None):
        """
        P18: T6 核心 - 從樣衣報價創建大貨報價

        POST /api/v2/cost-sheet-versions/{id}/create-bulk-quote/

        Payload:
        {
            "expected_quantity": 10000,
            "copy_labor_overhead": true,
            "change_reason": "Customer inquiry for bulk order"
        }

        Returns: 創建的 Bulk CostSheetVersion

        業務規則：
        - 只能從 Sample CostSheetVersion 克隆
        - 來源必須是 draft/submitted/accepted 狀態
        - 創建新的 bulk_quote UsageScenario
        - 複製 UsageLines（consumption_status = 'confirmed'）
        - 創建 Bulk CostSheetVersion（cloned_from 指向來源）
        - 複製 CostLineV2
        """
        sample_cs = self.get_object()

        # 1. 驗證：必須是 Sample 類型
        if sample_cs.costing_type != 'sample':
            return Response(
                {
                    'success': False,
                    'error': 'INVALID_COSTING_TYPE',
                    'detail': f'Can only create bulk quote from sample costing, got: {sample_cs.costing_type}'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. 驗證：狀態必須是 draft/submitted/accepted
        if sample_cs.status not in ['draft', 'submitted', 'accepted']:
            return Response(
                {
                    'success': False,
                    'error': 'INVALID_STATUS',
                    'detail': f'Can only clone from draft/submitted/accepted quotes, current status: {sample_cs.status}'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3. 解析請求參數
        copy_labor_overhead = request.data.get('copy_labor_overhead', True)
        change_reason = request.data.get('change_reason', '')

        revision = sample_cs.techpack_revision

        # 4. 創建新的 bulk_quote UsageScenario
        existing_bulk_scenario = UsageScenario.objects.filter(
            revision=revision,
            purpose='bulk_quote'
        ).order_by('-version_no').first()
        bulk_scenario_version = (existing_bulk_scenario.version_no + 1) if existing_bulk_scenario else 1

        bulk_usage = UsageScenario.objects.create(
            revision=revision,
            purpose='bulk_quote',
            version_no=bulk_scenario_version,
            wastage_pct=sample_cs.usage_scenario.wastage_pct if sample_cs.usage_scenario else Decimal('5.00'),
            status='draft',
            created_by=request.user if request.user.is_authenticated else None,
        )

        # 5. 複製 UsageLines
        if sample_cs.usage_scenario:
            for sample_line in sample_cs.usage_scenario.usage_lines.select_related('bom_item').all():
                UsageLine.objects.create(
                    usage_scenario=bulk_usage,
                    bom_item=sample_line.bom_item,
                    consumption=sample_line.consumption,
                    consumption_unit=sample_line.consumption_unit,
                    consumption_status='confirmed',  # 大貨用量標記為已確認
                    wastage_pct_override=sample_line.wastage_pct_override,
                    sort_order=sample_line.sort_order,
                )

        # 6. 計算 Bulk 版本號
        last_bulk_version = CostSheetVersion.objects.filter(
            cost_sheet_group=sample_cs.cost_sheet_group,
            costing_type='bulk'
        ).order_by('-version_no').first()
        bulk_version_no = (last_bulk_version.version_no + 1) if last_bulk_version else 1

        # 7. 創建 Bulk CostSheetVersion
        user = request.user if request.user.is_authenticated else None

        bulk_cs = CostSheetVersion.objects.create(
            cost_sheet_group=sample_cs.cost_sheet_group,
            techpack_revision=revision,
            usage_scenario=bulk_usage,
            version_no=bulk_version_no,
            costing_type='bulk',
            status='draft',
            # 成本參數
            labor_cost=sample_cs.labor_cost if copy_labor_overhead else Decimal('0.00'),
            overhead_cost=sample_cs.overhead_cost if copy_labor_overhead else Decimal('0.00'),
            freight_cost=Decimal('0.00'),
            packing_cost=Decimal('0.00'),
            margin_pct=sample_cs.margin_pct,
            currency=sample_cs.currency,
            exchange_rate=sample_cs.exchange_rate,
            # 版本追溯（⭐ P18 核心連結）
            cloned_from=sample_cs,
            change_reason=change_reason or f"Created bulk quote from Sample v{sample_cs.version_no}",
            # 計算結果
            material_cost=Decimal('0.00'),
            total_cost=Decimal('0.00'),
            unit_price=Decimal('0.00'),
            created_by=user,
        )

        # 8. 複製 CostLineV2
        material_cost = Decimal('0.00')
        for sample_line in sample_cs.cost_lines.all().order_by('sort_order'):
            line_cost = (sample_line.consumption_adjusted * sample_line.unit_price_adjusted).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            )
            material_cost += line_cost

            CostLineV2.objects.create(
                cost_sheet_version=bulk_cs,
                source_revision_id=sample_line.source_revision_id,
                source_usage_scenario_id=bulk_usage.id,
                source_usage_scenario_version_no=bulk_usage.version_no,
                source_bom_item_id=sample_line.source_bom_item_id,
                source_usage_line_id=sample_line.source_usage_line_id,
                material_name=sample_line.material_name,
                material_name_zh=sample_line.material_name_zh,
                category=sample_line.category,
                supplier=sample_line.supplier,
                supplier_article_no=sample_line.supplier_article_no,
                unit=sample_line.unit,
                consumption_snapshot=sample_line.consumption_adjusted,
                consumption_adjusted=sample_line.consumption_adjusted,
                unit_price_snapshot=sample_line.unit_price_adjusted,
                unit_price_adjusted=sample_line.unit_price_adjusted,
                line_cost=line_cost,
                sort_order=sample_line.sort_order,
            )

        # 9. 計算總成本與單價
        total_cost = material_cost + bulk_cs.labor_cost + bulk_cs.overhead_cost + bulk_cs.freight_cost + bulk_cs.packing_cost
        total_cost = total_cost.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        margin_pct = bulk_cs.margin_pct
        divisor = Decimal('1.00') - (margin_pct / Decimal('100.00'))
        if divisor > 0:
            unit_price = (total_cost / divisor).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        else:
            unit_price = total_cost

        bulk_cs.material_cost = material_cost
        bulk_cs.total_cost = total_cost
        bulk_cs.unit_price = unit_price
        bulk_cs.save()

        # 10. 返回結果
        serializer = CostSheetVersionDetailSerializer(bulk_cs)
        return Response({
            'success': True,
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def accept(self, request, pk=None):
        """
        P18: 確認報價（Submitted → Accepted）

        POST /api/v2/cost-sheet-versions/{id}/accept/
        """
        cost_sheet = self.get_object()

        if cost_sheet.status != 'submitted':
            return Response(
                {
                    'success': False,
                    'error': 'INVALID_STATUS',
                    'detail': f'Can only accept submitted versions, current status: {cost_sheet.status}'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        cost_sheet.status = 'accepted'
        cost_sheet.save(update_fields=['status'])

        serializer = CostSheetVersionDetailSerializer(cost_sheet)
        return Response({
            'success': True,
            'data': serializer.data
        })

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def reject(self, request, pk=None):
        """
        P18: 拒絕報價（Submitted → Rejected）

        POST /api/v2/cost-sheet-versions/{id}/reject/

        Payload:
        {
            "reject_reason": "價格太高"  // optional
        }
        """
        cost_sheet = self.get_object()

        if cost_sheet.status != 'submitted':
            return Response(
                {
                    'success': False,
                    'error': 'INVALID_STATUS',
                    'detail': f'Can only reject submitted versions, current status: {cost_sheet.status}'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        reject_reason = request.data.get('reject_reason', '')

        cost_sheet.status = 'rejected'
        if reject_reason:
            cost_sheet.change_reason = f"Rejected: {reject_reason}"
        cost_sheet.save(update_fields=['status', 'change_reason'])

        serializer = CostSheetVersionDetailSerializer(cost_sheet)
        return Response({
            'success': True,
            'data': serializer.data
        })

    @action(detail=True, methods=['post'], url_path='create-production-order')
    @transaction.atomic
    def create_production_order(self, request, pk=None):
        """
        P18: T8 核心 - 從 Accepted Bulk 報價創建 ProductionOrder

        POST /api/v2/cost-sheet-versions/{id}/create-production-order/

        Payload:
        {
            "po_number": "PO-2601-001",          // Required: Customer PO number
            "customer": "ABC Brand",             // Required: Customer name
            "total_quantity": 10000,             // Required: Total order quantity
            "size_breakdown": {"S": 2000, "M": 4000, "L": 3000, "XL": 1000},  // Required
            "order_date": "2026-01-15",          // Required
            "delivery_date": "2026-03-15",       // Required
            "notes": "",                         // Optional
            "calculate_mrp": true                // Optional: Auto-calculate MRP (default true)
        }

        Returns: 創建的 ProductionOrder with material_requirements

        業務規則：
        - 只能從 Accepted Bulk CostSheetVersion 創建
        - 自動帶入 style_revision 和 unit_price
        - 可選：自動計算 MRP
        - 連結 approved_sample_run（如果有 cloned_from 追溯鏈）
        """
        from apps.orders.models import ProductionOrder, MaterialRequirement
        from apps.orders.services.mrp_service import MRPService
        from apps.core.models import Organization
        from datetime import datetime

        cost_sheet = self.get_object()

        # 1. 驗證：必須是 Bulk 類型
        if cost_sheet.costing_type != 'bulk':
            return Response(
                {
                    'success': False,
                    'error': 'INVALID_COSTING_TYPE',
                    'detail': f'Can only create production order from bulk costing, got: {cost_sheet.costing_type}'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. 驗證：狀態必須是 accepted
        if cost_sheet.status != 'accepted':
            return Response(
                {
                    'success': False,
                    'error': 'INVALID_STATUS',
                    'detail': f'Can only create production order from accepted bulk quote, current status: {cost_sheet.status}'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3. 解析必填參數
        po_number = request.data.get('po_number')
        customer = request.data.get('customer')
        total_quantity = request.data.get('total_quantity')
        size_breakdown = request.data.get('size_breakdown', {})
        order_date = request.data.get('order_date')
        delivery_date = request.data.get('delivery_date')

        if not all([po_number, customer, total_quantity, order_date, delivery_date]):
            return Response(
                {
                    'success': False,
                    'error': 'MISSING_REQUIRED_FIELDS',
                    'detail': 'po_number, customer, total_quantity, order_date, delivery_date are required'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 4. 獲取 organization（從 style）
        style = cost_sheet.cost_sheet_group.style if cost_sheet.cost_sheet_group else None
        if not style:
            return Response(
                {
                    'success': False,
                    'error': 'STYLE_NOT_FOUND',
                    'detail': 'Cost sheet group has no associated style'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        organization = style.organization

        # 5. 嘗試找到 approved_sample_run（從 cloned_from 追溯）
        approved_sample_run = None
        if cost_sheet.cloned_from:
            # 找 Sample CostSheetVersion 關聯的 SampleRun
            sample_cs = cost_sheet.cloned_from
            # 通過 related_name 'sample_runs' 查找
            run = sample_cs.sample_runs.filter(
                run_type__in=['size_set', 'fit_sample', 'proto_sample']
            ).order_by('-created_at').first()
            if run:
                approved_sample_run = run

        # 6. 生成內部訂單號
        from django.db.models import Max
        last_po = ProductionOrder.objects.filter(
            organization=organization,
            order_number__startswith='PO-'
        ).aggregate(Max('order_number'))
        if last_po['order_number__max']:
            try:
                last_num = int(last_po['order_number__max'].split('-')[-1])
                order_number = f"PO-{timezone.now().strftime('%y%m')}-{str(last_num + 1).zfill(4)}"
            except ValueError:
                order_number = f"PO-{timezone.now().strftime('%y%m')}-0001"
        else:
            order_number = f"PO-{timezone.now().strftime('%y%m')}-0001"

        # 7. 計算總金額
        total_amount = cost_sheet.unit_price * total_quantity

        # 8. 創建 ProductionOrder
        production_order = ProductionOrder.objects.create(
            organization=organization,
            po_number=po_number,
            order_number=order_number,
            customer=customer,
            style_revision=cost_sheet.techpack_revision,
            bulk_costing=cost_sheet,
            approved_sample_run=approved_sample_run,
            total_quantity=total_quantity,
            size_breakdown=size_breakdown,
            unit_price=cost_sheet.unit_price,
            total_amount=total_amount,
            currency=cost_sheet.currency or 'USD',
            status='draft',
            order_date=order_date,
            delivery_date=delivery_date,
            notes=request.data.get('notes', ''),
            created_by=request.user if request.user.is_authenticated else None,
        )

        # 9. 可選：自動計算 MRP
        calculate_mrp = request.data.get('calculate_mrp', True)
        if calculate_mrp:
            try:
                MRPService.calculate_requirements(production_order)
            except Exception as e:
                # MRP 計算失敗不應該阻止訂單創建
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"MRP calculation failed for PO {production_order.order_number}: {e}")

        # 10. 返回結果（包含 material_requirements）
        from apps.orders.serializers import ProductionOrderDetailSerializer
        serializer = ProductionOrderDetailSerializer(production_order)
        return Response({
            'success': True,
            'data': serializer.data,
            'message': f'Production order {order_number} created successfully'
        }, status=status.HTTP_201_CREATED)


class CostLineV2ViewSet(viewsets.ModelViewSet):
    """
    CostLineV2 CRUD (mainly for adjusting consumption/price in Draft)

    Endpoints:
    - GET /api/v2/cost-lines-v2/ - List lines (filter by cost_sheet)
    - PATCH /api/v2/cost-lines-v2/{id}/ - Update line (adjust consumption/price)
    """

    queryset = CostLineV2.objects.select_related(
        'cost_sheet_version',
        'adjusted_by'
    )
    serializer_class = CostLineV2Serializer
    permission_classes = [AllowAny]  # TODO: Change to IsAuthenticated in production
    http_method_names = ['get', 'patch']  # Only GET and PATCH

    def get_queryset(self):
        """Filter by cost_sheet_version_id"""
        queryset = self.queryset

        cost_sheet_id = self.request.query_params.get('cost_sheet_version_id')
        if cost_sheet_id:
            queryset = queryset.filter(cost_sheet_version_id=cost_sheet_id)

        return queryset.order_by('sort_order', 'category', 'material_name')

    def partial_update(self, request, *args, **kwargs):
        """
        Update CostLineV2 via Service (Draft only, with 403 Guard)

        Payload:
        {
            "consumption_adjusted": 1.8,
            "unit_price_adjusted": 12.5,
            "adjustment_reason": "Client negotiation"
        }
        """
        line = self.get_object()

        try:
            updated_line = CostingService.update_cost_line(
                line_id=line.id,
                patch=request.data,
                user=request.user
            )

            serializer = self.get_serializer(updated_line)
            return Response(serializer.data)

        except PermissionError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_403_FORBIDDEN
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class CostSheetGroupViewSet(viewsets.ReadOnlyModelViewSet):
    """
    CostSheetGroup Read-only (auto-created when first CostSheetVersion is created)

    Endpoints:
    - GET /api/v2/cost-sheet-groups/ - List groups
    - GET /api/v2/cost-sheet-groups/{id}/ - Retrieve group
    """

    queryset = CostSheetGroup.objects.select_related('style')
    serializer_class = CostSheetGroupSerializer
    permission_classes = [AllowAny]  # TODO: Change to IsAuthenticated in production

    def get_queryset(self):
        """Filter by style_id"""
        queryset = self.queryset

        style_id = self.request.query_params.get('style_id')
        if style_id:
            queryset = queryset.filter(style_id=style_id)

        return queryset
