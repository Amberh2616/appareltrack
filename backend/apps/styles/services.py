"""
Styles Services - v2.2.1
Business logic for styles, revisions, and intake
"""

from dataclasses import dataclass
from typing import Any, Dict, List
from django.db import transaction
from django.db.models import Count, Q, Exists, OuterRef
from .models import Style, StyleRevision


# ========== Intake Bulk Create ==========

@dataclass
class BulkCreateResultItem:
    """Result of a single item in bulk create"""
    index: int
    style_id: str
    style_number: str
    revision_id: str
    revision_label: str
    created: bool
    status: str  # success | skipped | error
    errors: List[Dict[str, Any]]


def bulk_create_styles_and_revisions(
    organization,
    items: List[Dict[str, Any]],
    options: Dict[str, Any] = None,
) -> Dict[str, Any]:
    """
    Upsert: (org, style_number) → Style
            (style, revision_label) → StyleRevision

    Partial success: single item failure doesn't affect batch
    Idempotent: existing items return success with created=False
    """
    if options is None:
        options = {}

    allow_update_style_fields = options.get('allow_update_style_fields', False)

    results: List[BulkCreateResultItem] = []
    created_count = 0
    skipped_count = 0
    error_count = 0

    for idx, item_data in enumerate(items):
        try:
            style_number = (item_data.get("style_number") or "").strip()
            style_name = item_data.get("style_name", "").strip()
            revision_label = (item_data.get("revision_label") or "Rev A").strip()

            if not style_number:
                raise ValueError("style_number is required")
            if not revision_label:
                raise ValueError("revision_label is required")

            # Style defaults
            style_defaults = {
                "style_name": style_name or f"Style {style_number}",
                "season": item_data.get("season", "").strip(),
                "customer": item_data.get("customer", "").strip(),
            }

            # Get or create Style
            with transaction.atomic():
                style_obj, style_created = Style.objects.get_or_create(
                    organization=organization,
                    style_number=style_number,
                    defaults=style_defaults,
                )

                # Update style fields if allowed and not created
                if not style_created and allow_update_style_fields:
                    dirty = False
                    for field, value in style_defaults.items():
                        if value and not getattr(style_obj, field, ""):
                            setattr(style_obj, field, value)
                            dirty = True
                    if dirty:
                        style_obj.save(update_fields=list(style_defaults.keys()))

                # Get or create StyleRevision
                rev_obj, rev_created = StyleRevision.objects.get_or_create(
                    style=style_obj,
                    revision_label=revision_label,
                    defaults={
                        "status": "draft",
                        "notes": item_data.get("notes", ""),
                    }
                )

                # Update current_revision if this is first revision
                if style_created and rev_created:
                    style_obj.current_revision = rev_obj
                    style_obj.save(update_fields=['current_revision'])

                created = style_created or rev_created
                if created:
                    created_count += 1
                else:
                    skipped_count += 1

                results.append(
                    BulkCreateResultItem(
                        index=idx,
                        style_id=str(style_obj.id),
                        style_number=style_obj.style_number,
                        revision_id=str(rev_obj.id),
                        revision_label=rev_obj.revision_label,
                        created=created,
                        status="success",
                        errors=[],
                    )
                )

        except Exception as e:
            error_count += 1
            results.append(
                BulkCreateResultItem(
                    index=idx,
                    style_id="",
                    style_number=item_data.get("style_number", ""),
                    revision_id="",
                    revision_label=item_data.get("revision_label", ""),
                    created=False,
                    status="error",
                    errors=[{
                        "code": "CREATION_ERROR",
                        "message": str(e),
                    }],
                )
            )

    return {
        "items": [
            {
                "index": r.index,
                "style_id": r.style_id,
                "style_number": r.style_number,
                "revision_id": r.revision_id,
                "revision_label": r.revision_label,
                "created": r.created,
                "status": r.status,
                "errors": r.errors,
            }
            for r in results
        ],
        "meta": {
            "total": len(items),
            "created": created_count,
            "skipped": skipped_count,
            "errors": error_count,
        },
    }


# ========== Styles List with Risk ==========

RISK_MISSING = "missing"
RISK_LOW_CONFLICT = "low_conflict"
RISK_GATING_BLOCK = "gating_block"


def build_styles_queryset_with_risk(organization, params):
    """
    Build styles queryset with counts and risk flags
    Optimized to avoid N+1 queries
    """
    qs = Style.objects.filter(organization=organization)

    # Filters
    season = params.get("season")
    customer = params.get("customer")
    search = params.get("search")

    if season:
        qs = qs.filter(season=season)

    if customer:
        qs = qs.filter(customer=customer)

    if search:
        qs = qs.filter(
            Q(style_number__icontains=search) |
            Q(style_name__icontains=search) |
            Q(customer__icontains=search)
        )

    # Annotate counts
    qs = qs.annotate(
        revision_count=Count('revisions', distinct=True),
        document_count=Count('revisions__documents', distinct=True),
    )

    # Risk: missing - no documents at all
    qs = qs.annotate(
        missing_flag=Q(document_count=0)
    )

    # Risk: low_conflict - has draft data pending review (TODO: integrate with DraftReviewItem)
    # For now, check if any revision has draft data
    qs = qs.annotate(
        has_draft_data=Exists(
            StyleRevision.objects.filter(
                style=OuterRef('pk'),
            ).exclude(
                draft_bom_data__isnull=True,
                draft_measurement_data__isnull=True,
                draft_construction_data__isnull=True,
            )
        )
    )

    # Risk: gating_block - TODO: implement after consumption module
    # For now, always False
    qs = qs.annotate(
        gating_block_flag=Q(pk__isnull=True)  # Always False
    )

    # Select related for efficiency
    qs = qs.select_related('current_revision')

    return qs


def compute_risk_badges(style_obj) -> List[str]:
    """
    Compute risk badges for a style
    Called from serializer
    """
    risks = []

    # Missing: no documents
    if getattr(style_obj, "document_count", 0) == 0:
        risks.append(RISK_MISSING)

    # Low conflict: has draft data
    if getattr(style_obj, "has_draft_data", False):
        risks.append(RISK_LOW_CONFLICT)

    # Gating block: TODO
    if getattr(style_obj, "gating_block_flag", False):
        risks.append(RISK_GATING_BLOCK)

    return risks
