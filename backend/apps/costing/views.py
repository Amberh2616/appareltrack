"""
Costing Views
Phase 2-2I: 版本策略 API
P18: 統一報價架構 (Sample → Bulk)
"""

from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.styles.models import StyleRevision, BOMItem
from .models import (
    CostSheet,
    CostLine,
    # P18: 三層架構模型
    UsageScenario,
    UsageLine,
    CostSheetGroup,
    CostSheetVersion,
    CostLineV2,
)
from .serializers import (
    CostSheetDetailSerializer,
    CostSheetListSerializer,
    CostSheetCreateSerializer,
    CostSheetPatchSerializer,
    CostSheetDuplicateSerializer,
    # P18: 新增序列化器
    CostSheetVersionSerializer,
    CostSheetVersionListSerializer,
    CreateBulkQuoteSerializer,
)
from .utils import calc_line_cost, calc_totals


@api_view(['GET', 'POST'])
def cost_sheets_list_create(request, revision_id):
    """
    List or Create CostSheets for a revision

    GET /api/v2/revisions/{revision_id}/cost-sheets/
    - Query params: costing_type, is_current
    - Returns: List of CostSheets

    POST /api/v2/revisions/{revision_id}/cost-sheets/
    - Generate new CostSheet version from current BOM
    - Returns: Created CostSheet with nested lines
    """
    # Validate revision exists
    try:
        revision = StyleRevision.objects.get(id=revision_id)
    except StyleRevision.DoesNotExist:
        return Response(
            {'error': 'Style Revision not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    if request.method == 'GET':
        # LIST operation
        queryset = CostSheet.objects.filter(revision=revision)

        # Filter by costing_type if provided
        costing_type = request.query_params.get('costing_type')
        if costing_type in ['sample', 'bulk']:
            queryset = queryset.filter(costing_type=costing_type)

        # Filter by is_current if provided
        is_current = request.query_params.get('is_current')
        if is_current is not None:
            is_current_bool = is_current.lower() == 'true'
            queryset = queryset.filter(is_current=is_current_bool)

        serializer = CostSheetListSerializer(queryset, many=True)
        return Response({
            'count': queryset.count(),
            'results': serializer.data
        })

    # POST operation - CREATE
    # Validate input
    serializer = CostSheetCreateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    validated_data = serializer.validated_data
    costing_type = validated_data['costing_type']

    # Get BOM items
    bom_items = BOMItem.objects.filter(revision=revision).order_by('item_number')

    if not bom_items.exists():
        return Response(
            {'error': 'No BOM items found for this revision. Please create BOM first.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Micro-adjustment #3: Use transaction to prevent multiple is_current=true
    with transaction.atomic():
        # 1. Get next version number
        next_version = CostSheet.get_next_version_no(revision, costing_type)

        # 2. Set old versions to is_current=false
        CostSheet.objects.filter(
            revision=revision,
            costing_type=costing_type,
            is_current=True
        ).update(is_current=False)

        # 3. Create new CostSheet (Phase 2-2I: 加入 created_by, status)
        user = request.user if request.user.is_authenticated else None
        cost_sheet = CostSheet.objects.create(
            revision=revision,
            costing_type=costing_type,
            version_no=next_version,
            is_current=True,
            labor_cost=validated_data.get('labor_cost', Decimal('0.00')),
            overhead_cost=validated_data.get('overhead_cost', Decimal('0.00')),
            freight_cost=validated_data.get('freight_cost', Decimal('0.00')),
            packaging_cost=validated_data.get('packaging_cost', Decimal('0.00')),
            testing_cost=validated_data.get('testing_cost', Decimal('0.00')),
            margin_pct=validated_data.get('margin_pct', Decimal('30.00')),
            wastage_pct=validated_data.get('wastage_pct', Decimal('5.00')),
            notes=validated_data.get('notes', ''),
            # Phase 2-2I: 狀態與審計
            status='draft',
            created_by=user,
            updated_by=user,
            # Calculated fields will be set by calculate_totals()
            material_cost=Decimal('0.0000'),
            total_cost=Decimal('0.0000'),
            unit_price=Decimal('0.0000'),
        )

        # 4. Create CostLine snapshots for each BOMItem (Phase 2-2I: 使用 services.py)
        for idx, bom_item in enumerate(bom_items):
            # Snapshot current BOM values
            consumption = bom_item.consumption or Decimal('0.0000')
            unit_price_val = bom_item.unit_price or Decimal('0.0000')

            # Calculate line_cost with wastage (統一計算邏輯)
            line_cost = calc_line_cost(
                consumption=consumption,
                unit_price=unit_price_val,
                wastage_pct=cost_sheet.wastage_pct
            )

            # Create snapshot
            CostLine.objects.create(
                cost_sheet=cost_sheet,
                bom_item=bom_item,
                # Snapshot values
                material_name=bom_item.material_name or '',
                supplier=bom_item.supplier or '',
                category=bom_item.category or 'trim',
                unit=bom_item.unit or 'PCS',
                consumption=consumption,
                unit_price=unit_price_val,
                line_cost=line_cost,
                # Micro-adjustment #2: Independent sort_order
                sort_order=idx,
            )

        # 5. Calculate totals (Phase 2-2I: 使用 services.py 統一計算)
        line_costs = [line.line_cost for line in CostLine.objects.filter(cost_sheet=cost_sheet)]
        material_cost, total_cost, unit_price_calc = calc_totals(
            line_costs=line_costs,
            labor=Decimal(cost_sheet.labor_cost),
            overhead=Decimal(cost_sheet.overhead_cost),
            freight=Decimal(cost_sheet.freight_cost),
            packaging=Decimal(cost_sheet.packaging_cost),
            testing=Decimal(cost_sheet.testing_cost),
            margin_pct=Decimal(cost_sheet.margin_pct),
        )
        cost_sheet.material_cost = material_cost
        cost_sheet.total_cost = total_cost
        cost_sheet.unit_price = unit_price_calc
        cost_sheet.save()

    # 6. Return serialized response with nested lines
    response_serializer = CostSheetDetailSerializer(cost_sheet)
    return Response(response_serializer.data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH'])
def cost_sheet_detail_update(request, cost_sheet_id):
    """
    Get or Update a CostSheet

    GET /api/v2/cost-sheets/{cost_sheet_id}/
    - Returns: CostSheet with nested lines

    PATCH /api/v2/cost-sheets/{cost_sheet_id}/
    - Updates summary fields (labor, overhead, etc.)
    - Phase 1: Only allows updating summary fields, not lines
    - After update, automatically recalculates totals
    """
    try:
        cost_sheet = CostSheet.objects.prefetch_related('lines').get(id=cost_sheet_id)
    except CostSheet.DoesNotExist:
        return Response(
            {'error': 'CostSheet not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    if request.method == 'GET':
        # DETAIL operation
        serializer = CostSheetDetailSerializer(cost_sheet)
        return Response(serializer.data)

    # PATCH operation - UPDATE (Phase 2-2I: Guard Rules + services.py)
    serializer = CostSheetPatchSerializer(cost_sheet, data=request.data, partial=True)
    if not serializer.is_valid():
        # Check for version policy violation (409 Conflict)
        if "version_policy" in serializer.errors:
            return Response(
                {
                    "error": "VERSION_POLICY_VIOLATION",
                    "message": serializer.errors["version_policy"][0],
                    "details": serializer.errors,
                },
                status=status.HTTP_409_CONFLICT
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # Save changes (只有 A-fields)
    user = request.user if request.user.is_authenticated else None
    cost_sheet = serializer.save(updated_by=user)

    # Recalculate totals using existing snapshot lines (Phase 2-2I: services.py)
    line_qs = CostLine.objects.filter(cost_sheet=cost_sheet).order_by('sort_order')
    line_costs = [Decimal(line.line_cost) for line in line_qs]

    material_cost, total_cost, unit_price_calc = calc_totals(
        line_costs=line_costs,
        labor=Decimal(cost_sheet.labor_cost),
        overhead=Decimal(cost_sheet.overhead_cost),
        freight=Decimal(cost_sheet.freight_cost),
        packaging=Decimal(cost_sheet.packaging_cost),
        testing=Decimal(cost_sheet.testing_cost),
        margin_pct=Decimal(cost_sheet.margin_pct),
    )

    cost_sheet.material_cost = material_cost
    cost_sheet.total_cost = total_cost
    cost_sheet.unit_price = unit_price_calc
    cost_sheet.save(update_fields=['material_cost', 'total_cost', 'unit_price', 'updated_at', 'updated_by'])

    # Return full detail
    response_serializer = CostSheetDetailSerializer(cost_sheet)
    return Response(response_serializer.data)


@api_view(['POST'])
def cost_sheet_duplicate(request, cost_sheet_id):
    """
    Duplicate CostSheet with new margin/wastage (Version Policy B-fields)

    POST /api/v2/cost-sheets/{cost_sheet_id}/duplicate/
    - Creates new version with same CostLines (not rebuilding from BOM)
    - Applies new margin_pct and wastage_pct
    - Recalculates line_cost for each line with new wastage
    - Recalculates totals with new margin
    - Sets is_current=true for new version, false for old

    Use case: Pure negotiation (same BOM snapshot, different pricing stance)
    """
    # Get source CostSheet
    try:
        source_sheet = CostSheet.objects.prefetch_related('lines').get(id=cost_sheet_id)
    except CostSheet.DoesNotExist:
        return Response(
            {'error': 'CostSheet not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Validate input
    serializer = CostSheetDuplicateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    validated_data = serializer.validated_data
    new_margin = Decimal(validated_data['margin_pct'])
    new_wastage = Decimal(validated_data['wastage_pct'])
    new_notes = validated_data.get('notes', '')

    # Use transaction to prevent multiple is_current=true
    with transaction.atomic():
        # 1. Get next version number
        next_version = CostSheet.get_next_version_no(
            source_sheet.revision,
            source_sheet.costing_type
        )

        # 2. Set old versions to is_current=false
        CostSheet.objects.filter(
            revision=source_sheet.revision,
            costing_type=source_sheet.costing_type,
            is_current=True
        ).update(is_current=False)

        # 3. Create new CostSheet (copy A-fields from source, use new B-fields)
        user = request.user if request.user.is_authenticated else None
        new_sheet = CostSheet.objects.create(
            revision=source_sheet.revision,
            costing_type=source_sheet.costing_type,
            version_no=next_version,
            is_current=True,
            # Copy A-fields from source
            labor_cost=source_sheet.labor_cost,
            overhead_cost=source_sheet.overhead_cost,
            freight_cost=source_sheet.freight_cost,
            packaging_cost=source_sheet.packaging_cost,
            testing_cost=source_sheet.testing_cost,
            # Use new B-fields
            margin_pct=new_margin,
            wastage_pct=new_wastage,
            notes=new_notes,
            # Status & audit
            status='draft',
            created_by=user,
            updated_by=user,
            # Calculated fields (will be set below)
            material_cost=Decimal('0.0000'),
            total_cost=Decimal('0.0000'),
            unit_price=Decimal('0.0000'),
        )

        # 4. Copy CostLines from source (keep same snapshot, recalculate line_cost with new wastage)
        source_lines = source_sheet.lines.all().order_by('sort_order')
        for line in source_lines:
            # Recalculate line_cost with new wastage
            new_line_cost = calc_line_cost(
                consumption=line.consumption,
                unit_price=line.unit_price,
                wastage_pct=new_wastage
            )

            # Create new line
            CostLine.objects.create(
                cost_sheet=new_sheet,
                bom_item=line.bom_item,
                # Copy snapshot values
                material_name=line.material_name,
                supplier=line.supplier,
                category=line.category,
                unit=line.unit,
                consumption=line.consumption,
                unit_price=line.unit_price,
                # New calculated value
                line_cost=new_line_cost,
                sort_order=line.sort_order,
            )

        # 5. Calculate totals with new margin
        new_lines = CostLine.objects.filter(cost_sheet=new_sheet).order_by('sort_order')
        line_costs = [Decimal(line.line_cost) for line in new_lines]

        material_cost, total_cost, unit_price_calc = calc_totals(
            line_costs=line_costs,
            labor=Decimal(new_sheet.labor_cost),
            overhead=Decimal(new_sheet.overhead_cost),
            freight=Decimal(new_sheet.freight_cost),
            packaging=Decimal(new_sheet.packaging_cost),
            testing=Decimal(new_sheet.testing_cost),
            margin_pct=new_margin,
        )

        new_sheet.material_cost = material_cost
        new_sheet.total_cost = total_cost
        new_sheet.unit_price = unit_price_calc
        new_sheet.save()

    # 6. Return serialized response
    response_serializer = CostSheetDetailSerializer(new_sheet)
    return Response(response_serializer.data, status=status.HTTP_201_CREATED)


# ============================================================================
# P18: 統一報價架構 API
# ============================================================================

@api_view(['GET'])
def cost_sheet_versions_list(request):
    """
    P18: 列出所有 CostSheetVersion

    GET /api/v2/cost-sheet-versions/
    - Query params: costing_type, status, style_id
    """
    queryset = CostSheetVersion.objects.select_related(
        'cost_sheet_group__style',
        'techpack_revision',
        'usage_scenario',
    ).order_by('-created_at')

    # 篩選
    costing_type = request.query_params.get('costing_type')
    if costing_type in ['sample', 'bulk']:
        queryset = queryset.filter(costing_type=costing_type)

    status_filter = request.query_params.get('status')
    if status_filter:
        queryset = queryset.filter(status=status_filter)

    style_id = request.query_params.get('style_id')
    if style_id:
        queryset = queryset.filter(cost_sheet_group__style_id=style_id)

    serializer = CostSheetVersionListSerializer(queryset, many=True)
    return Response({
        'count': queryset.count(),
        'results': serializer.data
    })


@api_view(['GET'])
def cost_sheet_version_detail(request, version_id):
    """
    P18: 獲取單個 CostSheetVersion 詳情

    GET /api/v2/cost-sheet-versions/{version_id}/
    """
    try:
        version = CostSheetVersion.objects.select_related(
            'cost_sheet_group__style',
            'techpack_revision',
            'usage_scenario',
            'cloned_from',
        ).prefetch_related(
            'cost_lines',
        ).get(id=version_id)
    except CostSheetVersion.DoesNotExist:
        return Response(
            {'error': 'CostSheetVersion not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    serializer = CostSheetVersionSerializer(version)
    return Response(serializer.data)


@api_view(['POST'])
@transaction.atomic
def create_bulk_quote(request, sample_version_id):
    """
    P18: T6 核心 - 從樣衣報價創建大貨報價

    POST /api/v2/cost-sheet-versions/{sample_version_id}/create-bulk-quote/

    Request Body:
    {
        "expected_quantity": 10000,
        "copy_labor_overhead": true,
        "change_reason": "Customer inquiry for bulk order"
    }

    Response: 創建的 Bulk CostSheetVersion

    業務規則：
    - 只能從 Sample CostSheetVersion 克隆
    - 來源必須是 submitted 或 accepted 狀態
    - 創建新的 bulk_quote UsageScenario
    - 複製 UsageLines（consumption_status = 'confirmed'）
    - 創建 Bulk CostSheetVersion（cloned_from 指向來源）
    - 複製 CostLineV2
    """
    # 1. 獲取來源 Sample CostSheetVersion
    try:
        sample_cs = CostSheetVersion.objects.select_related(
            'cost_sheet_group__style',
            'techpack_revision',
            'usage_scenario',
        ).prefetch_related(
            'usage_scenario__usage_lines__bom_item',
            'cost_lines',
        ).get(id=sample_version_id)
    except CostSheetVersion.DoesNotExist:
        return Response(
            {'error': 'Sample cost sheet version not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    # 2. 驗證：必須是 Sample 類型
    if sample_cs.costing_type != 'sample':
        return Response(
            {'error': f'Can only create bulk quote from sample costing, got: {sample_cs.costing_type}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 3. 驗證：狀態必須是 submitted 或 accepted（已報價或已確認）
    # 注意：draft 狀態也允許，方便開發測試
    if sample_cs.status not in ['draft', 'submitted', 'accepted']:
        return Response(
            {'error': f'Can only clone from draft/submitted/accepted quotes, current status: {sample_cs.status}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 4. 驗證請求體
    serializer = CreateBulkQuoteSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    validated_data = serializer.validated_data
    copy_labor_overhead = validated_data.get('copy_labor_overhead', True)
    change_reason = validated_data.get('change_reason', '')

    # 5. 創建新的 bulk_quote UsageScenario
    revision = sample_cs.techpack_revision

    # 計算 bulk_quote 版本號
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

    # 6. 複製 UsageLines（consumption_status = 'confirmed'）
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

    # 7. 計算 Bulk 版本號
    last_bulk_version = CostSheetVersion.objects.filter(
        cost_sheet_group=sample_cs.cost_sheet_group,
        costing_type='bulk'
    ).order_by('-version_no').first()
    bulk_version_no = (last_bulk_version.version_no + 1) if last_bulk_version else 1

    # 8. 創建 Bulk CostSheetVersion
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
        freight_cost=Decimal('0.00'),  # 大貨運費可能不同，初始為 0
        packing_cost=Decimal('0.00'),
        margin_pct=sample_cs.margin_pct,
        currency=sample_cs.currency,
        exchange_rate=sample_cs.exchange_rate,
        # 版本追溯（⭐ 核心連結）
        cloned_from=sample_cs,
        change_reason=change_reason or f"Created bulk quote from Sample v{sample_cs.version_no}",
        # 計算結果（稍後計算）
        material_cost=Decimal('0.00'),
        total_cost=Decimal('0.00'),
        unit_price=Decimal('0.00'),
        created_by=user,
    )

    # 9. 複製 CostLineV2（從 Sample 的 cost_lines）
    material_cost = Decimal('0.00')
    for sample_line in sample_cs.cost_lines.all().order_by('sort_order'):
        line_cost = (sample_line.consumption_adjusted * sample_line.unit_price_adjusted).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        material_cost += line_cost

        CostLineV2.objects.create(
            cost_sheet_version=bulk_cs,
            # Source tracking（更新為 bulk 的 scenario）
            source_revision_id=sample_line.source_revision_id,
            source_usage_scenario_id=bulk_usage.id,
            source_usage_scenario_version_no=bulk_usage.version_no,
            source_bom_item_id=sample_line.source_bom_item_id,
            source_usage_line_id=sample_line.source_usage_line_id,  # 保留原始 line ID
            # Material info
            material_name=sample_line.material_name,
            material_name_zh=sample_line.material_name_zh,
            category=sample_line.category,
            supplier=sample_line.supplier,
            supplier_article_no=sample_line.supplier_article_no,
            unit=sample_line.unit,
            # Consumption & Price（從 Sample 複製）
            consumption_snapshot=sample_line.consumption_adjusted,
            consumption_adjusted=sample_line.consumption_adjusted,
            unit_price_snapshot=sample_line.unit_price_adjusted,
            unit_price_adjusted=sample_line.unit_price_adjusted,
            line_cost=line_cost,
            sort_order=sample_line.sort_order,
        )

    # 10. 計算總成本與單價
    labor = bulk_cs.labor_cost
    overhead = bulk_cs.overhead_cost
    freight = bulk_cs.freight_cost
    packing = bulk_cs.packing_cost

    total_cost = material_cost + labor + overhead + freight + packing
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

    # 11. 返回序列化結果
    response_serializer = CostSheetVersionSerializer(bulk_cs)
    return Response(response_serializer.data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@transaction.atomic
def submit_cost_sheet_version(request, version_id):
    """
    P18: 提交報價（Draft → Submitted）

    POST /api/v2/cost-sheet-versions/{version_id}/submit/
    """
    try:
        version = CostSheetVersion.objects.get(id=version_id)
    except CostSheetVersion.DoesNotExist:
        return Response(
            {'error': 'CostSheetVersion not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    if version.status != 'draft':
        return Response(
            {'error': f'Can only submit draft versions, current status: {version.status}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    version.status = 'submitted'
    version.submitted_at = timezone.now()
    version.submitted_by = request.user if request.user.is_authenticated else None
    version.save(update_fields=['status', 'submitted_at', 'submitted_by'])

    # 鎖定 UsageScenario（記錄首次鎖定）
    if version.usage_scenario and not version.usage_scenario.locked_at:
        version.usage_scenario.locked_at = timezone.now()
        version.usage_scenario.locked_first_by_cost_sheet = version
        version.usage_scenario.save(update_fields=['locked_at', 'locked_first_by_cost_sheet'])

    serializer = CostSheetVersionSerializer(version)
    return Response(serializer.data)


@api_view(['POST'])
@transaction.atomic
def accept_cost_sheet_version(request, version_id):
    """
    P18: 確認報價（Submitted → Accepted）

    POST /api/v2/cost-sheet-versions/{version_id}/accept/
    """
    try:
        version = CostSheetVersion.objects.get(id=version_id)
    except CostSheetVersion.DoesNotExist:
        return Response(
            {'error': 'CostSheetVersion not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    if version.status != 'submitted':
        return Response(
            {'error': f'Can only accept submitted versions, current status: {version.status}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    version.status = 'accepted'
    version.save(update_fields=['status'])

    serializer = CostSheetVersionSerializer(version)
    return Response(serializer.data)
