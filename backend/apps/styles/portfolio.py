"""
Portfolio Kanban Service
Phase 2-3 決策實現：stage 推導 + risk 計算

改良版：修復 8 個實際踩雷問題
- 跨所有 cost_sheet_groups 查詢（不再 .first()）
- 使用 prefetched 數據在 Python 計算（避免 N+1）
- 處理 parse_status None/null（修正 A）
- BOM Ready 只在 parse completed 後判斷（修正 B）
- verified_ratio 防止除以 0（修正 C）
"""

from datetime import date
from django.db.models import Count, Q
from django.utils import timezone
from typing import Tuple, Dict, Optional

# Constants
BOM_VERIFIED_THRESHOLD = 0.9
RISK_DUE_DAYS_YELLOW = 7
SUBMITTED_LIKE = ("submitted", "accepted", "rejected")  # accepted/rejected 也算 submitted stage


def safe_parse_status(style) -> str:
    """
    修正 A：parse_status None/null
    從 ExtractionRun 推導（吃 prefetch，不再 order_by 觸發 N+1）
    """
    rev = getattr(style, "current_revision", None)
    if not rev:
        return "not_started"

    runs = list(rev.extraction_runs.all())  # ✅ 會使用 prefetch
    if not runs:
        return "not_started"

    # ✅ 用 Python max 取代 .order_by('-started_at').first()
    latest = max(runs, key=lambda r: (r.started_at or timezone.make_aware(timezone.datetime.min)))
    return latest.status or "not_started"  # pending/processing/completed/failed


def bom_counts(style) -> Tuple[int, int, float]:
    """
    修正 C：防止除以 0
    返回：(total_count, verified_count, verified_ratio)
    """
    total = getattr(style, "bom_items_count", None)
    verified = getattr(style, "bom_verified_count", None)

    if total is None or verified is None:
        rev = getattr(style, "current_revision", None)
        if not rev:
            return 0, 0, 0.0
        total = rev.bom_items.count()
        verified = rev.bom_items.filter(is_verified=True).count()

    # 修正 C：防止除以 0
    ratio = (verified / total) if total else 0.0
    return total, verified, ratio


def has_any_costing_with_status(style, statuses) -> bool:
    """
    ✅ 不再用 first()，跨所有 cost_sheet_groups 查詢
    避免多 group 情況下判斷錯誤
    """
    return style.cost_sheet_groups.filter(versions__status__in=statuses).exists()


def derive_stage(style) -> str:
    """
    Portfolio Kanban Stage 推導
    優先級：Costing Submitted > Costing Draft > BOM Ready > Parsing > Intake

    修正 B：BOM Ready 只在 parse completed 後才判斷
    決策 2：Costing Draft 寬鬆准入（允許 BOM 不完整）
    """
    # 1. Costing Submitted（最高優先級）
    if has_any_costing_with_status(style, SUBMITTED_LIKE):
        return "costing_submitted"

    # 2. Costing Draft（決策 2：寬鬆，允許 BOM 未達標）
    if has_any_costing_with_status(style, ("draft",)):
        return "costing_draft"

    # 3. Parsing（有 revision 但 parse 未完成）
    rev = getattr(style, "current_revision", None)
    if rev:
        parse_status = safe_parse_status(style)
        if parse_status != "completed":
            return "parsing"
    else:
        # 沒有 revision 直接是 intake
        return "intake"

    # 4. BOM Ready（修正 B：parse completed 後才評估）
    total, verified, ratio = bom_counts(style)
    if total > 0 and ratio >= BOM_VERIFIED_THRESHOLD:
        return "bom_ready"

    # 5. Intake（默認）
    return "intake"


def calculate_risk(style, today: Optional[date] = None) -> str:
    """
    Risk 推導（Red/Yellow/Green）
    決策 4：Phase 2 用 due_date + 7天閾值

    優先級：
    1. style.target_due_date（若有）
    2. 未來可擴展：latest submitted costing 的 due
    3. 否則 green
    """
    today = today or timezone.localdate()
    due_date = getattr(style, "target_due_date", None)

    if not due_date:
        return "green"

    days_to_due = (due_date - today).days

    if days_to_due < 0:
        return "red"  # 已逾期
    if days_to_due <= RISK_DUE_DAYS_YELLOW:
        return "yellow"  # 7 天內到期
    return "green"


def build_kanban_queryset(organization):
    """
    構建 Portfolio Kanban 的優化查詢
    ✅ annotate counts；prefetch related；避免 N+1
    """
    from .models import Style  # Import here to avoid circular import

    qs = (
        Style.objects
        .filter(organization=organization)
        .select_related("current_revision", "created_by")
        .annotate(
            bom_items_count=Count("current_revision__bom_items", distinct=True),
            bom_verified_count=Count(
                "current_revision__bom_items",
                filter=Q(current_revision__bom_items__is_verified=True),
                distinct=True,
            ),
        )
        .prefetch_related(
            "cost_sheet_groups__versions",
            "current_revision__extraction_runs",
        )
    )
    return qs


def get_costing_info(style) -> Dict:
    """
    ✅ 用 prefetched versions 在 Python 算，不再 .filter().order_by() 觸發 N+1
    返回 Sample/Bulk 最新版本資訊
    """
    groups = list(style.cost_sheet_groups.all())
    versions = []
    for g in groups:
        versions.extend(list(g.versions.all()))

    def latest_by_type(costing_type: str):
        same = [v for v in versions if getattr(v, "costing_type", None) == costing_type]
        if not same:
            return None
        # version_no 最大視為最新
        return max(same, key=lambda v: (v.version_no or 0))

    def v_to_dict(v):
        if not v:
            return None
        return {
            "status": v.status,
            "version_no": v.version_no,
            "unit_price": float(v.unit_price) if v.unit_price is not None else None,
            "last_updated": v.created_at.isoformat() if v.created_at else None,
            "submitted_at": v.submitted_at.isoformat() if v.submitted_at else None,
        }

    return {
        "sample": v_to_dict(latest_by_type("sample")),
        "bulk": v_to_dict(latest_by_type("bulk")),
    }


def build_kanban_data(organization) -> Dict:
    """
    生成完整的 Kanban 數據（columns + cards）
    """
    from .models import Style  # Import here to avoid circular import

    styles = build_kanban_queryset(organization)

    cards = []
    for style in styles:
        stage_key = derive_stage(style)
        risk_level = calculate_risk(style)
        total, verified, ratio = bom_counts(style)

        # ✅ 處理 customer FK/物件序列化
        customer_name = None
        if getattr(style, "customer", None):
            customer_name = getattr(style.customer, "name", None) or str(style.customer)

        cards.append({
            "style_id": str(style.id),
            "style_code": style.style_number,
            "style_name": style.style_name,
            "brand": customer_name,
            "target_due_date": style.target_due_date.isoformat() if getattr(style, "target_due_date", None) else None,

            # 推導欄位
            "stage_key": stage_key,
            "risk_level": risk_level,

            # Revision 資訊
            "active_revision": {
                "id": str(style.current_revision.id) if style.current_revision else None,
                "label": getattr(style.current_revision, "revision_label", None) if style.current_revision else None,
                "parse_status": safe_parse_status(style) if style.current_revision else "not_started",
            },

            # BOM 資訊
            "bom": {
                "items_count": total,
                "verified_count": verified,
                "verified_ratio": round(ratio, 4),  # 保留 4 位小數，前端顯示再格式化
            },

            # Costing 資訊
            "costing": get_costing_info(style),

            # Owner
            "owner": {
                "id": str(style.created_by.id) if style.created_by else None,
                "name": getattr(style.created_by, "username", None) if style.created_by else None,
            },
        })

    # 統計各欄數量
    counts = {}
    for c in cards:
        counts[c["stage_key"]] = counts.get(c["stage_key"], 0) + 1

    columns = [
        {"key": "intake", "name": "Intake", "count": counts.get("intake", 0)},
        {"key": "parsing", "name": "Parsing", "count": counts.get("parsing", 0)},
        {"key": "bom_ready", "name": "BOM Ready", "count": counts.get("bom_ready", 0)},
        {"key": "costing_draft", "name": "Costing Draft", "count": counts.get("costing_draft", 0)},
        {"key": "costing_submitted", "name": "Costing Submitted", "count": counts.get("costing_submitted", 0)},
    ]

    return {"columns": columns, "cards": cards}
