"""
Phase 3 Refactor: Snapshot & Generation Services
樣衣先做 → 回填實際用量/工時 → 才報價

Service 函數實作：
- ensure_guidance_usage(run_id) - 確保 guidance usage scenario
- generate_t2po_from_guidance(run_id) - 從 guidance 生成 T2PO
- generate_mwo_snapshot(run_id) - 生成 MWO 快照
- ensure_actual_usage(run_id) - 確保 actual usage scenario
- generate_sample_costing_from_actuals(run_id) - 從 actuals 生成報價
"""

from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from django.core.exceptions import ValidationError
from typing import Optional
import hashlib
import json

from ..models import (
    SampleRun,
    SampleActuals,
    T2POForSample,
    T2POLineForSample,
    SampleMWO,
)
from apps.costing.models import (
    UsageScenario,
    UsageLine,
    CostSheetGroup,
    CostSheetVersion,
    CostLineV2,
)
from apps.styles.models import BOMItem, ConstructionStep


# ==================== D1: ensure_guidance_usage ====================

@transaction.atomic
def ensure_guidance_usage(run_id: str) -> UsageScenario:
    """
    確保 SampleRun 有 guidance usage scenario
    - 若已有，直接返回
    - 若沒有，從 BOMItem 建立新的 UsageScenario + UsageLines
    - consumption 預設值用 1（不從 BOMItem 取）
    - purpose = 'sample_guidance'

    Args:
        run_id: SampleRun UUID

    Returns:
        UsageScenario instance

    Raises:
        ValidationError: If run not found or no BOM items exist
    """
    try:
        run = SampleRun.objects.select_related('sample_request', 'revision').get(id=run_id)
    except SampleRun.DoesNotExist:
        raise ValidationError(f"SampleRun with id {run_id} not found")

    # 若已有 guidance_usage，直接返回
    if run.guidance_usage_id:
        return run.guidance_usage

    # 取得有效的 revision
    revision = run.revision or run.sample_request.revision

    # 檢查是否有 confirmed BOM items
    bom_items = BOMItem.objects.filter(
        revision=revision,
        is_verified=True,
        translation_status='confirmed'
    ).order_by('category', 'id')

    # Fallback: 若無已驗證項目，使用已翻譯確認的 BOM
    if not bom_items.exists():
        bom_items = BOMItem.objects.filter(
            revision=revision,
            translation_status='confirmed'
        ).order_by('category', 'id')

    if not bom_items.exists():
        raise ValidationError(
            f"No BOM items found for revision {revision.revision_label}. "
            "Please add or translate BOM items before generating guidance usage."
        )

    # 計算 version_no（檢查是否已有同 purpose 的 scenario）
    existing_scenario = UsageScenario.objects.filter(
        revision=revision,
        purpose='sample_guidance'
    ).order_by('-version_no').first()
    version_no = (existing_scenario.version_no + 1) if existing_scenario else 1

    # 建立 UsageScenario
    scenario = UsageScenario.objects.create(
        revision=revision,
        purpose='sample_guidance',
        version_no=version_no,
        wastage_pct=Decimal('5.00'),  # 預設 5% 損耗
        status='draft',
    )

    # 建立 UsageLines（consumption 預設 1，不從 BOMItem 取）
    for idx, bom in enumerate(bom_items, start=1):
        UsageLine.objects.create(
            usage_scenario=scenario,
            bom_item=bom,
            consumption=Decimal('1.0000'),  # ✅ 預設值，不是從 BOM 取
            consumption_unit=bom.unit,
            consumption_status='estimated',
            sort_order=idx,
        )

    # 關聯到 run
    run.guidance_usage = scenario
    run.save(update_fields=['guidance_usage'])

    return scenario


# ==================== D2: generate_t2po_from_guidance ====================

@transaction.atomic
def generate_t2po_from_guidance(run_id: str) -> T2POForSample:
    """
    從 guidance usage 生成 T2PO draft（版本化 + 可重入）
    - 若已有 latest draft，直接返回（可重入）
    - 新版本號 = 上一版 + 1
    - 舊 latest 全部設為 is_latest=False
    - 計算 quantity_requested = consumption × run.quantity × 1.05（5% 損耗）

    Args:
        run_id: SampleRun UUID

    Returns:
        T2POForSample instance

    Raises:
        ValidationError: If guidance usage missing or empty
    """
    try:
        run = SampleRun.objects.select_related('sample_request', 'revision', 'guidance_usage').get(id=run_id)
    except SampleRun.DoesNotExist:
        raise ValidationError(f"SampleRun with id {run_id} not found")

    guidance = run.guidance_usage
    if not guidance:
        raise ValidationError("Guidance usage not found. Call ensure_guidance_usage first.")

    if not guidance.usage_lines.exists():
        raise ValidationError("Guidance usage has no lines. Cannot generate T2PO.")

    # 若已有 latest draft，直接回傳（可重入）
    existing = run.t2pos.filter(is_latest=True, status='draft').first()
    if existing:
        return existing

    # 計算新版本號
    last = run.t2pos.order_by('-version_no').first()
    version_no = (last.version_no + 1) if last else 1

    # 把舊 latest 全部關掉
    run.t2pos.filter(is_latest=True).update(is_latest=False)

    # 取得有效 revision
    revision = run.revision or run.sample_request.revision

    # 計算 snapshot_hash
    bom_data = [{
        'material_name': line.bom_item.material_name,
        'consumption': str(line.consumption),
        'unit': line.consumption_unit,
    } for line in guidance.usage_lines.all()]
    canonical = json.dumps(bom_data, sort_keys=True)
    snapshot_hash = hashlib.sha256(canonical.encode()).hexdigest()

    # 建立 T2PO
    t2po = T2POForSample.objects.create(
        sample_run=run,
        version_no=version_no,
        is_latest=True,
        supplier_name="TBD",  # 待填
        status='draft',
        source_revision_id=revision.id,
        snapshot_hash=snapshot_hash,
        currency='USD',
        total_amount=Decimal('0.00'),
    )

    # 建立 T2PO Lines
    total_amount = Decimal('0.00')
    for idx, line in enumerate(guidance.usage_lines.select_related('bom_item').all(), start=1):
        # 計算總需求量：consumption × qty × 1.05（5% 損耗）
        qty_total = (line.consumption * Decimal(str(run.quantity))) * Decimal('1.05')
        qty_total = qty_total.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)

        # 單價與小計
        unit_price = line.bom_item.unit_price or Decimal('0.00')
        line_total = (qty_total * unit_price).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        total_amount += line_total

        T2POLineForSample.objects.create(
            t2po=t2po,
            line_no=idx,
            material_name=line.bom_item.material_name,
            supplier_article_no=line.bom_item.supplier_article_no or '',
            uom=line.consumption_unit,
            consumption_per_piece=line.consumption,
            wastage_pct=Decimal('5.00'),  # 固定 5%
            quantity_requested=qty_total,
            unit_price=unit_price,
            line_total=line_total,
        )

    # 更新 T2PO 總金額
    t2po.total_amount = total_amount
    t2po.save(update_fields=['total_amount'])

    return t2po


# ==================== D3: generate_mwo_snapshot ====================

@transaction.atomic
def generate_mwo_snapshot(run_id: str) -> SampleMWO:
    """
    從 guidance usage 生成 MWO draft（版本化 + 可重入）
    - 若已有 latest draft，回傳
    - bom_snapshot = guidance usage lines 的快照
    - construction_snapshot = ConstructionStep 的快照
    - qc_points_snapshot = []（Phase 1 不做）

    Args:
        run_id: SampleRun UUID

    Returns:
        SampleMWO instance

    Raises:
        ValidationError: If guidance usage not found
    """
    try:
        run = SampleRun.objects.select_related('sample_request', 'revision', 'guidance_usage').get(id=run_id)
    except SampleRun.DoesNotExist:
        raise ValidationError(f"SampleRun with id {run_id} not found")

    revision = run.revision or run.sample_request.revision
    guidance = run.guidance_usage

    if not guidance:
        raise ValidationError("No guidance usage found. Call ensure_guidance_usage first.")

    # 若已有 latest draft，回傳
    existing = run.mwos.filter(is_latest=True, status='draft').first()
    if existing:
        return existing

    # 計算新版本號
    last = run.mwos.order_by('-version_no').first()
    version_no = (last.version_no + 1) if last else 1

    # 把舊 latest 全部關掉
    run.mwos.filter(is_latest=True).update(is_latest=False)

    # 建立增強 BOM 快照 (Enhanced with material code, color, total consumption, Chinese translation)
    bom_snapshot = [{
        'line_no': idx,
        'material_code': ul.bom_item.supplier_article_no or '',  # Material/Article code
        'material_name': ul.bom_item.material_name,
        'material_name_zh': getattr(ul.bom_item, 'material_name_zh', '') or '',  # Chinese translation
        'category': ul.bom_item.category,
        'color': ul.bom_item.color or '',  # Color
        'supplier_name': ul.bom_item.supplier or '',
        'consumption': str(ul.consumption),
        'total_consumption': str(ul.consumption * run.quantity),  # Total = unit × qty
        'uom': ul.consumption_unit,
        'unit_price': str(getattr(ul.bom_item, 'unit_price', 0) or 0),
        'leadtime_days': getattr(ul.bom_item, 'leadtime_days', 0) or 0,
    } for idx, ul in enumerate(guidance.usage_lines.select_related('bom_item').all(), 1)]

    # 建立增強 Construction 快照 (Enhanced with stitch type, machine details)
    construction_steps = ConstructionStep.objects.filter(
        revision=revision,
        is_verified=True,
        translation_status='confirmed'
    ).order_by('step_number')

    # Fallback: 若尚未驗證工序，允許已翻譯確認的工序
    if not construction_steps.exists():
        construction_steps = ConstructionStep.objects.filter(
            revision=revision,
            translation_status='confirmed'
        ).order_by('step_number')

    construction_snapshot = [{
        'step_no': s.step_number,
        'description': s.description,
        'description_zh': getattr(s, 'description_zh', '') or '',  # Chinese translation
        'machine_type': s.machine_type or '',
        'machine_type_zh': getattr(s, 'machine_type_zh', '') or '',  # Chinese translation
        'stitch_type': s.stitch_type or '',  # Stitch type (e.g., 四針六線併縫)
        'stitch_type_zh': getattr(s, 'stitch_type_zh', '') or '',  # Chinese translation
        'special_requirements': '',  # Special notes (to be added later)
    } for s in construction_steps]

    # 建立增強 QC 快照 (Enhanced with labels, packaging requirements)
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

    # 計算 snapshot_hash
    canonical = json.dumps({
        'bom': bom_snapshot,
        'construction': construction_snapshot,
        'qc': qc_snapshot
    }, sort_keys=True)
    snapshot_hash = hashlib.sha256(canonical.encode()).hexdigest()

    # 建立 MWO
    mwo = SampleMWO.objects.create(
        sample_run=run,
        version_no=version_no,
        is_latest=True,
        status='draft',
        factory_name='TBD',  # 待填
        source_revision_id=revision.id,
        snapshot_hash=snapshot_hash,
        bom_snapshot_json=bom_snapshot,
        construction_snapshot_json=construction_snapshot,
        qc_snapshot_json=qc_snapshot,  # NEW: Populated QC snapshot
    )

    return mwo


# ==================== D4: ensure_actual_usage ====================

@transaction.atomic
def ensure_actual_usage(run_id: str) -> UsageScenario:
    """
    確保 SampleRun 有 actual usage scenario
    - 若已有，直接返回
    - 從 guidance_usage 複製，purpose = 'sample_actual'

    Args:
        run_id: SampleRun UUID

    Returns:
        UsageScenario instance

    Raises:
        ValidationError: If run not found or no guidance usage
    """
    try:
        run = SampleRun.objects.select_related('sample_request', 'revision', 'guidance_usage').get(id=run_id)
    except SampleRun.DoesNotExist:
        raise ValidationError(f"SampleRun with id {run_id} not found")

    # 若已有 actual_usage，直接返回
    if run.actual_usage_id:
        return run.actual_usage

    guidance = run.guidance_usage
    if not guidance:
        raise ValidationError("No guidance usage found. Cannot create actual usage without guidance.")

    revision = run.revision or run.sample_request.revision

    # 計算 version_no
    existing_scenario = UsageScenario.objects.filter(
        revision=revision,
        purpose='sample_actual'
    ).order_by('-version_no').first()
    version_no = (existing_scenario.version_no + 1) if existing_scenario else 1

    # 建立 actual usage scenario（複製 guidance）
    actual_scenario = UsageScenario.objects.create(
        revision=revision,
        purpose='sample_actual',
        version_no=version_no,
        wastage_pct=guidance.wastage_pct,
        status='draft',
    )

    # 複製 usage lines
    for idx, guidance_line in enumerate(guidance.usage_lines.select_related('bom_item').all(), start=1):
        UsageLine.objects.create(
            usage_scenario=actual_scenario,
            bom_item=guidance_line.bom_item,
            consumption=guidance_line.consumption,  # 初始值同 guidance，可後續修改
            consumption_unit=guidance_line.consumption_unit,
            consumption_status='actual',
            wastage_pct_override=guidance_line.wastage_pct_override,
            sort_order=idx,
        )

    # 關聯到 run
    run.actual_usage = actual_scenario
    run.save(update_fields=['actual_usage'])

    return actual_scenario


# ==================== D5: generate_sample_costing_from_actuals ====================

@transaction.atomic
def generate_sample_costing_from_actuals(run_id: str) -> CostSheetVersion:
    """
    從 actual usage + SampleActuals 生成 Sample Costing
    - 找或建 CostSheetGroup（by Style）
    - 計算 material_cost（從 actual_usage lines）
    - labor_cost/overhead_cost 從 SampleActuals 取
    - 建立 CostSheetVersion + CostLineV2

    Args:
        run_id: SampleRun UUID

    Returns:
        CostSheetVersion instance

    Raises:
        ValidationError: If actual usage or actuals not found
    """
    try:
        run = SampleRun.objects.select_related(
            'sample_request',
            'revision',
            'actual_usage',
            'actuals'
        ).get(id=run_id)
    except SampleRun.DoesNotExist:
        raise ValidationError(f"SampleRun with id {run_id} not found")

    actual_usage = run.actual_usage
    if not actual_usage:
        raise ValidationError("No actual usage recorded. Call ensure_actual_usage first.")

    if not hasattr(run, 'actuals'):
        raise ValidationError("SampleActuals not found. Cannot generate costing without actuals.")

    actuals = run.actuals

    revision = run.revision or run.sample_request.revision
    style = revision.style

    # 找或建 CostSheetGroup
    group, _ = CostSheetGroup.objects.get_or_create(
        style=style,
    )

    # 計算 version_no（Sample 獨立計數）
    last_version = CostSheetVersion.objects.filter(
        cost_sheet_group=group,
        costing_type='sample'
    ).order_by('-version_no').first()
    version_no = (last_version.version_no + 1) if last_version else 1

    # 計算 material cost
    material_cost = Decimal('0.00')
    for line in actual_usage.usage_lines.select_related('bom_item').all():
        unit_price = line.bom_item.unit_price or Decimal('0.00')
        line_cost = (line.consumption * unit_price).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        material_cost += line_cost

    # 取得成本參數
    labor_cost = actuals.labor_cost or Decimal('0.00')
    overhead_cost = actuals.overhead_cost or Decimal('0.00')
    shipping_cost = actuals.shipping_cost or Decimal('0.00')
    rework_cost = actuals.rework_cost or Decimal('0.00')

    # 計算總成本與單價
    total_cost = material_cost + labor_cost + overhead_cost + shipping_cost + rework_cost
    margin_pct = Decimal('30.00')  # 預設 30%
    divisor = Decimal('1.00') - (margin_pct / Decimal('100.00'))
    if divisor > 0:
        unit_price = (total_cost / divisor).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    else:
        unit_price = total_cost

    # 建立 CostSheetVersion
    csv = CostSheetVersion.objects.create(
        cost_sheet_group=group,
        techpack_revision=revision,
        usage_scenario=actual_usage,
        version_no=version_no,
        costing_type='sample',
        status='draft',
        material_cost=material_cost,
        labor_cost=labor_cost,
        overhead_cost=overhead_cost,
        freight_cost=shipping_cost,
        packing_cost=rework_cost,  # 臨時用 packing_cost 存 rework
        margin_pct=margin_pct,
        total_cost=total_cost,
        unit_price=unit_price,
        change_reason=f"Generated from Sample Run #{run.run_no} actuals",
    )

    # 建立 CostLineV2
    for line in actual_usage.usage_lines.select_related('bom_item').all():
        unit_price_val = line.bom_item.unit_price or Decimal('0.00')
        line_cost = (line.consumption * unit_price_val).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        CostLineV2.objects.create(
            cost_sheet_version=csv,
            # Source tracking
            source_revision_id=revision.id,
            source_usage_scenario_id=actual_usage.id,
            source_usage_scenario_version_no=actual_usage.version_no,
            source_bom_item_id=line.bom_item.id,
            source_usage_line_id=line.id,
            # Material info
            material_name=line.bom_item.material_name,
            material_name_zh='',  # BOMItem doesn't have Chinese name field
            category=line.bom_item.category,
            supplier=line.bom_item.supplier or '',
            supplier_article_no=line.bom_item.supplier_article_no or '',
            unit=line.consumption_unit,
            # Consumption & Price
            consumption_snapshot=line.consumption,
            consumption_adjusted=line.consumption,
            unit_price_snapshot=unit_price_val,
            unit_price_adjusted=unit_price_val,
            line_cost=line_cost,
        )

    # 關聯回 run
    run.costing_version = csv
    run.save(update_fields=['costing_version'])

    return csv
