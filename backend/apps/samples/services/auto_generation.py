"""
P0-1: Create Request Auto-Generation Service
自動生成樣衣相關文件的核心服務

When a SampleRequest is created, this service atomically generates:
1. SampleRequest
2. SampleRun #1 (idempotent)
3. RunBOMLine snapshots (from verified BOM)
4. RunOperation snapshots (from verified Construction)
5. SampleMWO (draft)
6. SampleCostEstimate (draft)

設計原則：
- SampleRun 是唯一的「執行真相來源」
- 使用快照模式，不回寫 Phase 2 資料
- 冪等設計，防止重複生成
"""

from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from typing import Dict, Any, Optional, Tuple
import hashlib
import json

from apps.styles.models import StyleRevision, BOMItem, ConstructionStep
from apps.costing.models import (
    UsageScenario,
    UsageLine,
    CostSheetGroup,
    CostSheetVersion,
    CostLineV2,
)
from ..models import (
    SampleRequest,
    SampleRun,
    RunBOMLine,
    RunOperation,
    RunTechPackPage,
    RunTechPackBlock,
    SampleMWO,
    SampleCostEstimate,
    SampleRequestType,
    SampleRunType,
    SampleRunStatus,
)


# ==================== Source Hash Generation ====================

def generate_source_hash(revision: StyleRevision) -> str:
    """
    生成來源資料 hash，用於追溯

    Args:
        revision: StyleRevision instance

    Returns:
        SHA256 hash string (64 chars)
    """
    # Get verified BOM items
    bom_items = BOMItem.objects.filter(
        revision=revision,
        is_verified=True
    ).order_by('item_number')

    # Get verified construction steps
    construction_steps = ConstructionStep.objects.filter(
        revision=revision,
        is_verified=True
    ).order_by('step_number')

    payload = {
        'revision_id': str(revision.id),
        'bom': [
            {
                'material': item.material_name,
                'consumption': str(item.consumption or 0),
                'uom': item.unit or '',
                'supplier': item.supplier or '',
                'unit_price': str(item.unit_price or 0),
            }
            for item in bom_items
        ],
        'ops': [
            {
                'step_no': step.step_number,
                'desc': step.description or '',
            }
            for step in construction_steps
        ],
    }

    json_str = json.dumps(payload, sort_keys=True)
    return hashlib.sha256(json_str.encode()).hexdigest()


# ==================== Document Number Generation ====================

def get_next_sequence(prefix: str) -> int:
    """
    Get next sequence number for document numbering.
    Simple implementation - in production, use Redis or DB sequence.
    """
    from django.db.models import Max

    if prefix == 'mwo':
        last = SampleMWO.objects.filter(
            mwo_no__startswith=f"MWO-{timezone.now().strftime('%y%m')}"
        ).aggregate(Max('mwo_no'))['mwo_no__max']
    elif prefix == 'estimate':
        last = SampleCostEstimate.objects.filter(
            snapshot_hash__startswith=f"EST-{timezone.now().strftime('%y%m')}"
        ).count()
        return last + 1
    elif prefix == 'ORD':
        # Production Order sequence
        from apps.orders.models import ProductionOrder
        last = ProductionOrder.objects.filter(
            order_number__startswith=f"ORD-{timezone.now().strftime('%y%m')}"
        ).aggregate(Max('order_number'))['order_number__max']
    else:
        return 1

    if last:
        try:
            # Extract number from format: PREFIX-YYMM-XXXXXX
            seq = int(last.split('-')[-1])
            return seq + 1
        except (ValueError, IndexError):
            pass
    return 1


def generate_mwo_no() -> str:
    """Generate MWO number: MWO-YYMM-XXXXXX"""
    prefix = timezone.now().strftime('MWO-%y%m-')
    seq = get_next_sequence('mwo')
    return f"{prefix}{seq:06d}"


def generate_estimate_no() -> str:
    """Generate Estimate number: EST-YYMM-XXXXXX-v1"""
    prefix = timezone.now().strftime('EST-%y%m-')
    seq = get_next_sequence('estimate')
    return f"{prefix}{seq:06d}-v1"


# ==================== Validation ====================

def validate_revision_for_request(revision: StyleRevision, threshold: float = 0.8) -> None:
    """
    Gating Rule: BOM verified ratio must be >= threshold (default 80%)
    before creating Sample Request.

    Args:
        revision: StyleRevision to validate
        threshold: Minimum verified ratio (default 0.8 = 80%)

    Raises:
        ValidationError: If BOM verified ratio is below threshold
    """
    total_count = BOMItem.objects.filter(revision=revision).count()
    verified_count = BOMItem.objects.filter(
        revision=revision,
        is_verified=True
    ).count()

    if total_count == 0:
        raise ValidationError(
            "Revision has no BOM items. "
            "Please add BOM items before creating a sample request."
        )

    # 親合度不足時改為警告模式：允許流程繼續，但提示需補驗證
    verified_ratio = verified_count / total_count if total_count else 0
    if verified_ratio < threshold:
        # Allow fallback: keep going (MWO 會使用已翻譯資料)
        return


# ==================== Snapshot Functions ====================

def snapshot_bom_to_run(revision: StyleRevision, run: SampleRun) -> int:
    """
    Snapshot verified BOM items to RunBOMLine.

    Args:
        revision: Source revision
        run: Target SampleRun

    Returns:
        Number of lines created
    """
    bom_items = BOMItem.objects.filter(
        revision=revision,
        is_verified=True
    ).order_by('item_number')

    # Fallback: 若尚未驗證，改用已確認翻譯的項目
    if not bom_items.exists():
        bom_items = BOMItem.objects.filter(
            revision=revision,
            translation_status='confirmed'
        ).order_by('item_number')

    created = 0
    for idx, item in enumerate(bom_items, start=1):
        RunBOMLine.objects.create(
            run=run,
            line_no=idx,
            material_name=item.material_name or '',
            material_name_zh=getattr(item, 'material_name_zh', '') or '',  # Copy Chinese translation
            material_code=item.supplier_article_no or '',
            category=item.category or '',
            color=item.color or '',
            uom=item.unit or 'pcs',
            consumption=item.consumption or Decimal('0'),
            wastage_pct=Decimal('0.05'),  # Default 5%
            unit_price=item.unit_price,
            supplier_name=item.supplier or '',
            supplier_id=None,  # TODO: Add supplier FK if available
            leadtime_days=item.leadtime_days or 0,
            source_bom_item_id=item.id,
        )
        created += 1

    return created


def snapshot_operations_to_run(revision: StyleRevision, run: SampleRun) -> int:
    """
    Snapshot verified construction steps to RunOperation.

    Args:
        revision: Source revision
        run: Target SampleRun

    Returns:
        Number of operations created
    """
    steps = ConstructionStep.objects.filter(
        revision=revision,
        is_verified=True,
        translation_status='confirmed'
    ).order_by('step_number')

    # Fallback: 無驗證工序時，允許使用已確認翻譯的工序
    if not steps.exists():
        steps = ConstructionStep.objects.filter(
            revision=revision,
            translation_status='confirmed'
        ).order_by('step_number')

    created = 0
    for step in steps:
        RunOperation.objects.create(
            run=run,
            step_no=step.step_number,
            step_name='',  # ConstructionStep doesn't have step_name field
            description=step.description or '',
            description_zh=getattr(step, 'description_zh', '') or '',
            machine_type=step.machine_type or '',
            machine_type_zh=getattr(step, 'machine_type_zh', '') or '',
            stitch_type_zh=getattr(step, 'stitch_type_zh', '') or '',
            std_minutes=0,  # TODO: Add from step if available
            special_requirements='',  # ConstructionStep doesn't have special_requirements field
            source_construction_id=step.id,
        )
        created += 1

    return created


def snapshot_techpack_to_run(revision: StyleRevision, run: SampleRun) -> Dict[str, int]:
    """
    Snapshot Tech Pack translations to Run.

    複製 TechPackRevision 的 DraftBlocks 到 RunTechPackPage/Block。
    這樣每個 Run 有自己的翻譯快照，MWO 導出時使用。

    Args:
        revision: StyleRevision (用於找到對應的 TechPackRevision)
        run: Target SampleRun

    Returns:
        Dict with pages_created, blocks_created counts
    """
    from apps.parsing.models_blocks import Revision as TechPackRevision, RevisionPage, DraftBlock
    from apps.parsing.models import UploadedDocument

    result = {
        'pages_created': 0,
        'blocks_created': 0,
    }

    # 1. 找到對應的 TechPackRevision
    # 通過 UploadedDocument 關聯：style_revision → uploaded_document → tech_pack_revision
    try:
        uploaded_doc = UploadedDocument.objects.filter(
            style_revision=revision
        ).first()

        if not uploaded_doc or not uploaded_doc.tech_pack_revision:
            # 沒有 Tech Pack，跳過
            return result

        tech_pack_revision = uploaded_doc.tech_pack_revision
    except Exception:
        return result

    # 2. 複製頁面和 Blocks
    pages = RevisionPage.objects.filter(
        revision=tech_pack_revision
    ).prefetch_related('blocks').order_by('page_number')

    for page in pages:
        # 創建 RunTechPackPage
        run_page = RunTechPackPage.objects.create(
            run=run,
            page_number=page.page_number,
            width=page.width,
            height=page.height,
            source_page_id=page.id,
        )
        result['pages_created'] += 1

        # 複製該頁的所有 Blocks
        for block in page.blocks.all():
            RunTechPackBlock.objects.create(
                run_page=run_page,
                block_type=block.block_type,
                source_text=block.source_text,
                translated_text=block.edited_text or block.translated_text or '',
                bbox_x=block.bbox_x,
                bbox_y=block.bbox_y,
                bbox_width=block.bbox_width,
                bbox_height=block.bbox_height,
                overlay_x=block.overlay_x,
                overlay_y=block.overlay_y,
                overlay_visible=block.overlay_visible,
                source_block_id=block.id,
            )
            result['blocks_created'] += 1

    return result


# ==================== Main Service Function ====================

@transaction.atomic
def create_with_initial_run(
    revision_id: str,
    payload: Dict[str, Any],
    user=None,
    skip_validation: bool = False
) -> Tuple[SampleRequest, SampleRun, Dict[str, Any]]:
    """
    P0-1 核心服務：建立 SampleRequest 並自動生成所有相關文件

    原子交易內自動生成：
    1. SampleRequest
    2. SampleRun #1
    3. Run Snapshots (BOM + Operations)
    4. MWO (draft)
    5. Estimate (draft)

    Args:
        revision_id: StyleRevision UUID
        payload: Request data containing:
            - request_type: proto/fit/sales/photo/etc.
            - quantity_requested: Number of samples
            - priority: low/normal/urgent
            - due_date: Optional due date
            - brand_name: Optional brand name
            - need_quote_first: Boolean
        user: Optional User instance
        skip_validation: Skip BOM verification check (for development)

    Returns:
        Tuple of (SampleRequest, SampleRun, documents_info)

    Raises:
        ValidationError: If revision not found or no verified BOM
    """
    # 1. Get revision
    try:
        revision = StyleRevision.objects.select_related('style').get(id=revision_id)
    except StyleRevision.DoesNotExist:
        raise ValidationError(f"StyleRevision with id {revision_id} not found")

    # 2. Validate revision has verified BOM (Gating Rule)
    if not skip_validation:
        validate_revision_for_request(revision)

    # 3. Generate source hash
    source_hash = generate_source_hash(revision)

    # 4. Map request_type to run_type
    request_type = payload.get('request_type', SampleRequestType.PROTO)
    run_type_map = {
        SampleRequestType.PROTO: SampleRunType.PROTO,
        SampleRequestType.FIT: SampleRunType.FIT,
        SampleRequestType.SALES: SampleRunType.SALES,
        SampleRequestType.PHOTO: SampleRunType.PHOTO,
    }
    run_type = run_type_map.get(request_type, SampleRunType.OTHER)

    # 5. Create SampleRequest
    request = SampleRequest.objects.create(
        revision=revision,
        request_type=request_type,
        request_type_custom=payload.get('request_type_custom', ''),
        quantity_requested=payload.get('quantity_requested', 1),
        priority=payload.get('priority', 'normal'),
        due_date=payload.get('due_date'),
        brand_name=payload.get('brand_name', ''),
        need_quote_first=payload.get('need_quote_first', False),
        notes_internal=payload.get('notes_internal', ''),
        notes_customer=payload.get('notes_customer', ''),
        created_by=user,
    )

    # 6. Create SampleRun #1 (idempotent with get_or_create)
    run, run_created = SampleRun.objects.get_or_create(
        sample_request=request,
        run_no=1,
        defaults={
            'run_type': run_type,
            'status': SampleRunStatus.DRAFT,
            'quantity': payload.get('quantity_requested', 1),
            'target_due_date': payload.get('due_date'),
            'source_revision_id': revision.id,
            'source_revision_label': revision.revision_label,
            'source_hash': source_hash,
            'snapshotted_at': timezone.now(),
            'created_by': user,
        }
    )

    documents = {
        'run_created': run_created,
        'mwo_id': None,
        'mwo_no': None,
        'estimate_id': None,
        'estimate_no': None,
        'bom_line_count': 0,
        'operation_count': 0,
    }

    if run_created:
        # 7. Snapshot BOM to RunBOMLine
        documents['bom_line_count'] = snapshot_bom_to_run(revision, run)

        # 8. Snapshot Operations to RunOperation
        documents['operation_count'] = snapshot_operations_to_run(revision, run)

        # 8.5 Snapshot Tech Pack translations to Run
        techpack_result = snapshot_techpack_to_run(revision, run)
        documents['techpack_pages_count'] = techpack_result['pages_created']
        documents['techpack_blocks_count'] = techpack_result['blocks_created']

        # 9. Build enhanced MWO snapshots from RunBOMLine and RunOperation
        # Enhanced BOM snapshot with material code, color, total consumption, Chinese translation
        bom_snapshot = [{
            'line_no': line.line_no,
            'material_code': line.material_code or '',  # Article #
            'material_name': line.material_name,
            'material_name_zh': line.material_name_zh or '',  # NEW: Chinese translation
            'category': line.category,
            'color': line.color or '',
            'supplier_name': line.supplier_name,
            'consumption': str(line.consumption),
            'total_consumption': str(line.consumption * run.quantity),  # Total = unit × qty
            'uom': line.uom,
            'unit_price': str(line.unit_price or 0),
            'leadtime_days': line.leadtime_days or 0,
        } for line in run.bom_lines.all()]

        # Enhanced construction snapshot with stitch type, special notes, Chinese translation
        construction_snapshot = [{
            'step_no': op.step_no,
            'description': op.description,
            'description_zh': getattr(op, 'description_zh', '') or '',  # NEW: Chinese translation
            'machine_type': op.machine_type,
            'machine_type_zh': getattr(op, 'machine_type_zh', '') or '',  # NEW: Chinese translation
            'std_minutes': op.std_minutes or 0,
            'special_requirements': op.special_requirements or '',
        } for op in run.operations.all()]

        # Enhanced QC snapshot with label positions and packaging requirements
        qc_snapshot = {
            'labels': [
                {
                    'type': 'logo',
                    'position': 'TBD - To be defined based on style requirements',
                    'method': 'Heat transfer / Sewn-in'
                },
                {
                    'type': 'care_label',
                    'position': 'TBD - To be defined based on style requirements',
                    'method': 'Sewn-in'
                }
            ],
            'packaging': {
                'polybag': 'Standard polybag (size TBD)',
                'carton': 'Standard carton box',
                'special_requirements': []
            },
            'inspections': {
                'measurement_tolerance': 'Per spec sheet',
                'visual_inspection': 'Per AQL standard',
                'functional_tests': []
            }
        }

        # 10. Create MWO (draft) with populated snapshots
        mwo = SampleMWO.objects.create(
            sample_run=run,
            version_no=1,
            is_latest=True,
            mwo_no=generate_mwo_no(),
            factory_name='TBD',
            status='draft',
            source_revision_id=revision.id,
            snapshot_hash=source_hash,
            bom_snapshot_json=bom_snapshot,
            construction_snapshot_json=construction_snapshot,
            qc_snapshot_json=qc_snapshot,  # NEW: Populated QC snapshot
        )
        documents['mwo_id'] = str(mwo.id)
        documents['mwo_no'] = mwo.mwo_no

        # 10. Create Estimate (draft) - Legacy, kept for backward compatibility
        # Calculate material cost from BOM
        material_cost = Decimal('0.00')
        for bom_line in run.bom_lines.all():
            if bom_line.unit_price and bom_line.consumption:
                line_cost = (bom_line.consumption * bom_line.unit_price).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                )
                material_cost += line_cost

        estimate = SampleCostEstimate.objects.create(
            sample_request=request,
            estimate_version=1,
            status='draft',
            currency='USD',
            estimated_total=material_cost,
            breakdown_snapshot_json={
                'materials': [
                    {
                        'material_name': line.material_name,
                        'consumption': str(line.consumption),
                        'unit_price': str(line.unit_price or 0),
                        'line_cost': str(
                            (line.consumption * (line.unit_price or Decimal('0'))).quantize(
                                Decimal('0.01'), rounding=ROUND_HALF_UP
                            )
                        ),
                    }
                    for line in run.bom_lines.all()
                ],
                'labor': [],
                'overhead': [],
            },
            source='manual',
            source_revision_id=revision.id,
            created_by=user,
        )
        documents['estimate_id'] = str(estimate.id)
        documents['estimate_no'] = generate_estimate_no()

        # ============================================================
        # P18: Create Sample Quote (UsageScenario + CostSheetVersion)
        # 統一報價架構 - 樣衣報價使用 Phase 2-3 三層架構
        # ============================================================
        sample_quote_result = create_sample_quote_from_run(
            run=run,
            revision=revision,
            user=user,
        )
        documents['sample_quote_usage_id'] = str(sample_quote_result['usage_scenario_id'])
        documents['sample_quote_cost_sheet_id'] = str(sample_quote_result['cost_sheet_version_id'])

    return request, run, documents


# ==================== P18: Sample Quote Generation ====================

def create_sample_quote_from_run(
    run: SampleRun,
    revision: StyleRevision,
    user=None,
) -> Dict[str, Any]:
    """
    P18: 從 SampleRun 創建樣衣報價

    創建：
    1. UsageScenario (purpose='sample_quote') - 樣衣報價用量
    2. UsageLine（從 RunBOMLine 複製）
    3. CostSheetGroup（按 Style）
    4. CostSheetVersion (costing_type='sample') - 樣衣報價 v1
    5. CostLineV2（從 UsageLine 快照）

    Args:
        run: SampleRun instance
        revision: StyleRevision instance
        user: Optional User instance

    Returns:
        Dict with usage_scenario_id, cost_sheet_version_id
    """
    style = revision.style

    # 1. 計算 version_no（檢查是否已有同 purpose 的 scenario）
    existing_scenario = UsageScenario.objects.filter(
        revision=revision,
        purpose='sample_quote'
    ).order_by('-version_no').first()
    scenario_version = (existing_scenario.version_no + 1) if existing_scenario else 1

    # 2. 建立 UsageScenario (purpose='sample_quote')
    usage_scenario = UsageScenario.objects.create(
        revision=revision,
        purpose='sample_quote',
        version_no=scenario_version,
        wastage_pct=Decimal('5.00'),  # 預設 5% 損耗
        status='draft',
        created_by=user,
    )

    # 3. 從 RunBOMLine 建立 UsageLines
    bom_items_map = {}  # material_name -> BOMItem (for FK reference)
    verified_bom_items = BOMItem.objects.filter(
        revision=revision,
        is_verified=True
    )
    for item in verified_bom_items:
        bom_items_map[item.material_name] = item

    created_bom_item_ids = set()  # 追蹤已創建的 bom_item，避免重複
    sort_order = 0

    for bom_line in run.bom_lines.all().order_by('line_no'):
        # 找到對應的 BOMItem（用於 FK）
        bom_item = bom_items_map.get(bom_line.material_name)
        if not bom_item:
            # 如果找不到，嘗試用 source_bom_item_id
            if bom_line.source_bom_item_id:
                try:
                    bom_item = BOMItem.objects.get(id=bom_line.source_bom_item_id)
                except BOMItem.DoesNotExist:
                    continue
            else:
                continue

        # 避免重複創建（同一 bom_item 只創建一個 UsageLine）
        if bom_item.id in created_bom_item_ids:
            continue
        created_bom_item_ids.add(bom_item.id)
        sort_order += 1

        UsageLine.objects.create(
            usage_scenario=usage_scenario,
            bom_item=bom_item,
            consumption=bom_line.consumption or Decimal('0.0000'),
            consumption_unit=bom_line.uom or 'pcs',
            consumption_status='estimated',
            sort_order=sort_order,
        )

    # 4. 找或建 CostSheetGroup（按 Style）
    cost_sheet_group, _ = CostSheetGroup.objects.get_or_create(
        style=style,
    )

    # 5. 計算 Sample CostSheetVersion 版本號
    last_sample_version = CostSheetVersion.objects.filter(
        cost_sheet_group=cost_sheet_group,
        costing_type='sample'
    ).order_by('-version_no').first()
    csv_version = (last_sample_version.version_no + 1) if last_sample_version else 1

    # 6. 計算 material_cost
    material_cost = Decimal('0.00')
    for usage_line in usage_scenario.usage_lines.select_related('bom_item').all():
        unit_price = usage_line.bom_item.unit_price or Decimal('0.00')
        line_cost = (usage_line.consumption * unit_price).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        material_cost += line_cost

    # 7. 計算總成本與單價（初始 labor/overhead 為 0，可後續編輯）
    labor_cost = Decimal('0.00')
    overhead_cost = Decimal('0.00')
    freight_cost = Decimal('0.00')
    packing_cost = Decimal('0.00')
    margin_pct = Decimal('30.00')  # 預設 30%

    total_cost = material_cost + labor_cost + overhead_cost + freight_cost + packing_cost
    divisor = Decimal('1.00') - (margin_pct / Decimal('100.00'))
    if divisor > 0:
        unit_price = (total_cost / divisor).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    else:
        unit_price = total_cost

    # 8. 建立 CostSheetVersion (costing_type='sample')
    cost_sheet_version = CostSheetVersion.objects.create(
        cost_sheet_group=cost_sheet_group,
        techpack_revision=revision,
        usage_scenario=usage_scenario,
        version_no=csv_version,
        costing_type='sample',
        status='draft',
        material_cost=material_cost,
        labor_cost=labor_cost,
        overhead_cost=overhead_cost,
        freight_cost=freight_cost,
        packing_cost=packing_cost,
        margin_pct=margin_pct,
        total_cost=total_cost,
        unit_price=unit_price,
        change_reason=f"Auto-generated from Sample Run #{run.run_no}",
        created_by=user,
    )

    # 9. 建立 CostLineV2（從 UsageLine 快照）
    for usage_line in usage_scenario.usage_lines.select_related('bom_item').all():
        bom_item = usage_line.bom_item
        unit_price_val = bom_item.unit_price or Decimal('0.00')
        line_cost = (usage_line.consumption * unit_price_val).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )

        CostLineV2.objects.create(
            cost_sheet_version=cost_sheet_version,
            # Source tracking
            source_revision_id=revision.id,
            source_usage_scenario_id=usage_scenario.id,
            source_usage_scenario_version_no=usage_scenario.version_no,
            source_bom_item_id=bom_item.id,
            source_usage_line_id=usage_line.id,
            # Material info
            material_name=bom_item.material_name or '',
            material_name_zh=getattr(bom_item, 'material_name_zh', '') or '',
            category=bom_item.category or '',
            supplier=bom_item.supplier or '',
            supplier_article_no=bom_item.supplier_article_no or '',
            unit=usage_line.consumption_unit or 'pcs',
            # Consumption & Price
            consumption_snapshot=usage_line.consumption,
            consumption_adjusted=usage_line.consumption,
            unit_price_snapshot=unit_price_val,
            unit_price_adjusted=unit_price_val,
            line_cost=line_cost,
            sort_order=usage_line.sort_order,
        )

    # 10. 關聯 guidance_usage 到 Run（使用同一個 UsageScenario）
    # 注意：這裡我們把 sample_quote 場景同時當作 guidance_usage
    run.guidance_usage = usage_scenario
    run.save(update_fields=['guidance_usage'])

    return {
        'usage_scenario_id': usage_scenario.id,
        'cost_sheet_version_id': cost_sheet_version.id,
    }


# ==================== 方案 B: 確認樣衣服務 ====================

@transaction.atomic
def generate_documents_for_request(
    sample_request: SampleRequest,
    payload: Dict[str, Any],
    user=None,
) -> Tuple[SampleRun, Dict[str, Any]]:
    """
    方案 B：為已存在的 SampleRequest 生成文件

    當用戶按「確認樣衣」時調用此函數：
    1. 創建 SampleRun #1
    2. 快照 BOM 資料到 RunBOMLine
    3. 快照 Spec 資料到 RunOperation
    4. 生成 MWO (draft)
    5. 生成報價單 (draft)

    Args:
        sample_request: 已創建的 SampleRequest instance
        payload: Request data
        user: Optional User instance

    Returns:
        Tuple of (SampleRun, documents_info)

    Raises:
        ValidationError: If revision has no verified BOM
    """
    revision = sample_request.revision

    # 1. Generate source hash
    source_hash = generate_source_hash(revision)

    # 2. Map request_type to run_type
    request_type = sample_request.request_type
    run_type_map = {
        SampleRequestType.PROTO: SampleRunType.PROTO,
        SampleRequestType.FIT: SampleRunType.FIT,
        SampleRequestType.SALES: SampleRunType.SALES,
        SampleRequestType.PHOTO: SampleRunType.PHOTO,
    }
    run_type = run_type_map.get(request_type, SampleRunType.OTHER)

    # 3. Create SampleRun #1
    run = SampleRun.objects.create(
        sample_request=sample_request,
        run_no=1,
        run_type=run_type,
        status=SampleRunStatus.DRAFT,
        quantity=sample_request.quantity_requested,
        target_due_date=sample_request.due_date,
        source_revision_id=revision.id,
        source_revision_label=revision.revision_label,
        source_hash=source_hash,
        snapshotted_at=timezone.now(),
        created_by=user,
    )

    documents = {
        'run_created': True,
        'mwo_id': None,
        'mwo_no': None,
        'estimate_id': None,
        'estimate_no': None,
        'bom_line_count': 0,
        'operation_count': 0,
    }

    # 4. Snapshot BOM to RunBOMLine
    documents['bom_line_count'] = snapshot_bom_to_run(revision, run)

    # 5. Snapshot Operations to RunOperation
    documents['operation_count'] = snapshot_operations_to_run(revision, run)

    # 5.5 Snapshot Tech Pack translations to Run
    techpack_result = snapshot_techpack_to_run(revision, run)
    documents['techpack_pages_count'] = techpack_result['pages_created']
    documents['techpack_blocks_count'] = techpack_result['blocks_created']

    # 6. Build MWO snapshots
    bom_snapshot = [{
        'line_no': line.line_no,
        'material_code': line.material_code or '',
        'material_name': line.material_name,
        'material_name_zh': line.material_name_zh or '',
        'category': line.category,
        'color': line.color or '',
        'supplier_name': line.supplier_name,
        'consumption': str(line.consumption),
        'total_consumption': str(line.consumption * run.quantity),
        'uom': line.uom,
        'unit_price': str(line.unit_price or 0),
        'leadtime_days': line.leadtime_days or 0,
    } for line in run.bom_lines.all()]

    construction_snapshot = [{
        'step_no': op.step_no,
        'description': op.description,
        'description_zh': getattr(op, 'description_zh', '') or '',
        'machine_type': op.machine_type,
        'machine_type_zh': getattr(op, 'machine_type_zh', '') or '',
        'std_minutes': op.std_minutes or 0,
        'special_requirements': op.special_requirements or '',
    } for op in run.operations.all()]

    qc_snapshot = {
        'labels': [
            {'type': 'logo', 'position': 'TBD', 'method': 'Heat transfer / Sewn-in'},
            {'type': 'care_label', 'position': 'TBD', 'method': 'Sewn-in'}
        ],
        'packaging': {
            'polybag': 'Standard polybag (size TBD)',
            'carton': 'Standard carton box',
            'special_requirements': []
        },
        'inspections': {
            'measurement_tolerance': 'Per spec sheet',
            'visual_inspection': 'Per AQL standard',
            'functional_tests': []
        }
    }

    # 7. Create MWO (draft)
    mwo = SampleMWO.objects.create(
        sample_run=run,
        version_no=1,
        is_latest=True,
        mwo_no=generate_mwo_no(),
        factory_name='TBD',
        status='draft',
        source_revision_id=revision.id,
        snapshot_hash=source_hash,
        bom_snapshot_json=bom_snapshot,
        construction_snapshot_json=construction_snapshot,
        qc_snapshot_json=qc_snapshot,
    )
    documents['mwo_id'] = str(mwo.id)
    documents['mwo_no'] = mwo.mwo_no

    # 8. Create Estimate (draft)
    material_cost = Decimal('0.00')
    for bom_line in run.bom_lines.all():
        if bom_line.unit_price and bom_line.consumption:
            line_cost = (bom_line.consumption * bom_line.unit_price).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            )
            material_cost += line_cost

    estimate = SampleCostEstimate.objects.create(
        sample_request=sample_request,
        estimate_version=1,
        status='draft',
        currency='USD',
        estimated_total=material_cost,
        breakdown_snapshot_json={
            'materials': [
                {
                    'material_name': line.material_name,
                    'consumption': str(line.consumption),
                    'unit_price': str(line.unit_price or 0),
                    'line_cost': str(
                        (line.consumption * (line.unit_price or Decimal('0'))).quantize(
                            Decimal('0.01'), rounding=ROUND_HALF_UP
                        )
                    ),
                }
                for line in run.bom_lines.all()
            ],
            'labor': [],
            'overhead': [],
        },
        source='manual',
        source_revision_id=revision.id,
        created_by=user,
    )
    documents['estimate_id'] = str(estimate.id)
    documents['estimate_no'] = generate_estimate_no()

    # 9. Create Sample Quote (UsageScenario + CostSheetVersion)
    sample_quote_result = create_sample_quote_from_run(
        run=run,
        revision=revision,
        user=user,
    )
    documents['sample_quote_usage_id'] = str(sample_quote_result['usage_scenario_id'])
    documents['sample_quote_cost_sheet_id'] = str(sample_quote_result['cost_sheet_version_id'])

    return run, documents


# ==================== 多輪 Fit Sample 支援 ====================

@transaction.atomic
def create_next_run_for_request(
    sample_request: SampleRequest,
    run_type: str = None,
    quantity: int = None,
    target_due_date=None,
    notes: str = '',
    user=None,
) -> Tuple[SampleRun, Dict[str, Any]]:
    """
    為已存在的 SampleRequest 創建下一輪 SampleRun

    用於 Fit Sample 多輪調整場景：
    - Fit 1st → 客戶評論 → 調整 → Fit 2nd → ...

    功能：
    1. 自動計算 run_no = max(現有 run_no) + 1
    2. 複製上一輪的 run_type（如果未指定）
    3. 快照最新的 BOM/Operations/TechPack
    4. 生成新的 MWO 和報價單

    Args:
        sample_request: SampleRequest instance
        run_type: 可選，覆蓋 run_type（預設繼承上一輪）
        quantity: 可選，樣衣數量（預設繼承上一輪）
        target_due_date: 可選，目標交期
        notes: 可選，備註
        user: Optional User instance

    Returns:
        Tuple of (SampleRun, documents_info)
    """
    from django.db.models import Max

    revision = sample_request.revision

    # 1. 計算下一個 run_no
    max_run_no = sample_request.runs.aggregate(Max('run_no'))['run_no__max'] or 0
    next_run_no = max_run_no + 1

    # 2. 獲取上一輪的設定（如果存在）
    last_run = sample_request.runs.order_by('-run_no').first()

    # 3. 決定 run_type（優先使用傳入值，否則繼承上一輪，最後使用 request_type）
    if not run_type:
        if last_run:
            run_type = last_run.run_type
        else:
            run_type_map = {
                SampleRequestType.PROTO: SampleRunType.PROTO,
                SampleRequestType.FIT: SampleRunType.FIT,
                SampleRequestType.SALES: SampleRunType.SALES,
                SampleRequestType.PHOTO: SampleRunType.PHOTO,
            }
            run_type = run_type_map.get(sample_request.request_type, SampleRunType.OTHER)

    # 4. 決定數量
    if quantity is None:
        quantity = last_run.quantity if last_run else sample_request.quantity_requested

    # 5. 決定目標交期
    if target_due_date is None:
        target_due_date = sample_request.due_date

    # 6. 生成 source hash
    source_hash = generate_source_hash(revision)

    # 7. 創建新的 SampleRun
    run = SampleRun.objects.create(
        sample_request=sample_request,
        run_no=next_run_no,
        run_type=run_type,
        status=SampleRunStatus.DRAFT,
        quantity=quantity,
        target_due_date=target_due_date,
        source_revision_id=revision.id,
        source_revision_label=revision.revision_label,
        source_hash=source_hash,
        snapshotted_at=timezone.now(),
        notes=notes,
        created_by=user,
    )

    documents = {
        'run_created': True,
        'run_no': next_run_no,
        'previous_run_no': max_run_no,
        'mwo_id': None,
        'mwo_no': None,
        'estimate_id': None,
        'bom_line_count': 0,
        'operation_count': 0,
    }

    # 8. 快照 BOM
    documents['bom_line_count'] = snapshot_bom_to_run(revision, run)

    # 9. 快照 Operations
    documents['operation_count'] = snapshot_operations_to_run(revision, run)

    # 10. 快照 Tech Pack
    techpack_result = snapshot_techpack_to_run(revision, run)
    documents['techpack_pages_count'] = techpack_result['pages_created']
    documents['techpack_blocks_count'] = techpack_result['blocks_created']

    # 11. 構建 MWO 快照
    bom_snapshot = [{
        'line_no': line.line_no,
        'material_code': line.material_code or '',
        'material_name': line.material_name,
        'material_name_zh': line.material_name_zh or '',
        'category': line.category,
        'color': line.color or '',
        'supplier_name': line.supplier_name,
        'consumption': str(line.consumption),
        'total_consumption': str(line.consumption * run.quantity),
        'uom': line.uom,
        'unit_price': str(line.unit_price or 0),
        'leadtime_days': line.leadtime_days or 0,
    } for line in run.bom_lines.all()]

    construction_snapshot = [{
        'step_no': op.step_no,
        'description': op.description,
        'description_zh': getattr(op, 'description_zh', '') or '',
        'machine_type': op.machine_type,
        'machine_type_zh': getattr(op, 'machine_type_zh', '') or '',
        'std_minutes': op.std_minutes or 0,
        'special_requirements': op.special_requirements or '',
    } for op in run.operations.all()]

    qc_snapshot = {
        'labels': [
            {'type': 'logo', 'position': 'TBD', 'method': 'Heat transfer / Sewn-in'},
            {'type': 'care_label', 'position': 'TBD', 'method': 'Sewn-in'}
        ],
        'packaging': {
            'polybag': 'Standard polybag (size TBD)',
            'carton': 'Standard carton box',
            'special_requirements': []
        },
        'inspections': {
            'measurement_tolerance': 'Per spec sheet',
            'visual_inspection': 'Per AQL standard',
            'functional_tests': []
        }
    }

    # 12. 創建 MWO (draft)
    mwo = SampleMWO.objects.create(
        sample_run=run,
        version_no=1,
        is_latest=True,
        mwo_no=generate_mwo_no(),
        factory_name='TBD',
        status='draft',
        source_revision_id=revision.id,
        snapshot_hash=source_hash,
        bom_snapshot_json=bom_snapshot,
        construction_snapshot_json=construction_snapshot,
        qc_snapshot_json=qc_snapshot,
    )
    documents['mwo_id'] = str(mwo.id)
    documents['mwo_no'] = mwo.mwo_no

    # 13. 創建 Sample Quote
    sample_quote_result = create_sample_quote_from_run(
        run=run,
        revision=revision,
        user=user,
    )
    documents['sample_quote_usage_id'] = str(sample_quote_result['usage_scenario_id'])
    documents['sample_quote_cost_sheet_id'] = str(sample_quote_result['cost_sheet_version_id'])

    return run, documents
