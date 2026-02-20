"""
CostingService
Handles creation, cloning, submission, and updating of CostSheetVersions
"""

from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from apps.costing.models import (
    CostSheetGroup,
    CostSheetVersion,
    CostLineV2,
    UsageScenario
)
from apps.styles.models import Style


# Custom Exception for BOM verification gate
class BOMNotReadyError(PermissionError):
    """Raised when BOM verified_ratio < threshold on submit"""
    def __init__(self, message, bom_data):
        super().__init__(message)
        self.bom_data = bom_data


# Custom Exception for missing unit_price
class MissingUnitPriceError(ValueError):
    """Raised when BOM items are missing unit_price"""
    def __init__(self, message, missing_items):
        super().__init__(message)
        self.missing_items = missing_items


class CostingService:
    """
    Service layer for CostSheetVersion operations
    Enforces R1-R3 rules and business logic
    """

    @staticmethod
    @transaction.atomic
    def create_cost_sheet(style_id, costing_type, usage_scenario_id, payload, user=None):
        """
        Create a new CostSheetVersion (with snapshot from UsageScenario)

        Args:
            style_id: UUID of Style
            costing_type: str ('sample' or 'bulk')
            usage_scenario_id: UUID of UsageScenario to snapshot
            payload: dict with fields:
                - labor_cost: Decimal
                - overhead_cost: Decimal
                - freight_cost: Decimal
                - packing_cost: Decimal
                - margin_pct: Decimal
                - change_reason: str (optional)
            user: User instance

        Returns:
            CostSheetVersion instance
        """
        style = Style.objects.get(id=style_id)
        usage_scenario = UsageScenario.objects.prefetch_related(
            'usage_lines',
            'usage_lines__bom_item'
        ).get(id=usage_scenario_id)

        # Get or create CostSheetGroup
        group, _ = CostSheetGroup.objects.get_or_create(style=style)

        # R2: Lock to prevent version number collision
        versions = CostSheetVersion.objects.filter(
            cost_sheet_group=group,
            costing_type=costing_type
        ).select_for_update()

        max_version = versions.aggregate(Max('version_no'))['version_no__max'] or 0
        version_no = max_version + 1

        # Create CostSheetVersion
        cost_sheet = CostSheetVersion.objects.create(
            cost_sheet_group=group,
            version_no=version_no,
            costing_type=costing_type,

            # Evidence binding
            techpack_revision=usage_scenario.revision,
            usage_scenario=usage_scenario,

            # Costing parameters
            labor_cost=Decimal(str(payload.get('labor_cost', '0.00'))),
            overhead_cost=Decimal(str(payload.get('overhead_cost', '0.00'))),
            freight_cost=Decimal(str(payload.get('freight_cost', '0.00'))),
            packing_cost=Decimal(str(payload.get('packing_cost', '0.00'))),
            margin_pct=Decimal(str(payload.get('margin_pct', '30.00'))),

            # Metadata
            change_reason=payload.get('change_reason', f'Created {costing_type} costing v{version_no}'),
            created_by=user,
            status='draft'
        )

        # Snapshot UsageLines → CostLineV2
        # First pass: check for missing unit_price
        missing_price_items = []
        for usage_line in usage_scenario.usage_lines.all():
            bom_item = usage_line.bom_item
            if bom_item.unit_price is None or bom_item.unit_price == 0:
                missing_price_items.append({
                    'item_number': bom_item.item_number,
                    'material_name': bom_item.material_name,
                    'supplier': bom_item.supplier or '-',
                })

        if missing_price_items:
            raise MissingUnitPriceError(
                f"無法建立報價：{len(missing_price_items)} 個物料缺少單價",
                missing_price_items
            )

        # Second pass: create cost lines
        cost_lines = []
        for usage_line in usage_scenario.usage_lines.all():
            bom_item = usage_line.bom_item

            # Calculate line_cost (adjusted_consumption × unit_price)
            adjusted_consumption = usage_line.adjusted_consumption
            unit_price = bom_item.unit_price  # Already validated above
            line_cost = CostLineV2.calculate_line_cost(adjusted_consumption, unit_price)

            cost_line = CostLineV2(
                cost_sheet_version=cost_sheet,

                # Source tracking
                source_revision_id=usage_scenario.revision.id,
                source_usage_scenario_id=usage_scenario.id,
                source_usage_scenario_version_no=usage_scenario.version_no,
                source_bom_item_id=bom_item.id,
                source_usage_line_id=usage_line.id,

                # Material identification
                material_name=bom_item.material_name,
                material_name_zh='',  # TODO: Phase 2 不填
                category=bom_item.category,
                supplier=bom_item.supplier or '',
                supplier_article_no=bom_item.supplier_article_no or '',
                unit=usage_line.consumption_unit,

                # Snapshot consumption and price
                consumption_snapshot=adjusted_consumption,
                consumption_adjusted=adjusted_consumption,
                unit_price_snapshot=unit_price,
                unit_price_adjusted=unit_price,

                # Adjustment flags (初始无调整)
                is_consumption_adjusted=False,
                is_price_adjusted=False,
                adjustment_reason='',

                # Calculated result
                line_cost=line_cost,
                sort_order=usage_line.sort_order
            )
            cost_lines.append(cost_line)

        CostLineV2.objects.bulk_create(cost_lines)

        # Calculate totals
        cost_sheet.calculate_totals()
        cost_sheet.save()

        return cost_sheet

    @staticmethod
    @transaction.atomic
    def clone_cost_sheet(cost_sheet_id, overrides=None, user=None):
        """
        Clone an existing CostSheetVersion

        Args:
            cost_sheet_id: UUID of source CostSheetVersion
            overrides: dict with optional fields:
                - usage_scenario_id: UUID (可选，切换 usage scenario)
                - labor_cost: Decimal
                - overhead_cost: Decimal
                - margin_pct: Decimal
                - change_reason: str
            user: User instance

        Returns:
            CostSheetVersion instance (new clone)
        """
        source = CostSheetVersion.objects.prefetch_related(
            'cost_lines'
        ).select_related(
            'cost_sheet_group',
            'usage_scenario'
        ).get(id=cost_sheet_id)

        overrides = overrides or {}

        # Determine usage_scenario (可能切换)
        if 'usage_scenario_id' in overrides:
            usage_scenario = UsageScenario.objects.get(id=overrides['usage_scenario_id'])
        else:
            usage_scenario = source.usage_scenario

        # R2: Lock to prevent version number collision
        versions = CostSheetVersion.objects.filter(
            cost_sheet_group=source.cost_sheet_group,
            costing_type=source.costing_type
        ).select_for_update()

        max_version = versions.aggregate(Max('version_no'))['version_no__max'] or 0
        version_no = max_version + 1

        # Create cloned CostSheetVersion
        cloned_sheet = CostSheetVersion.objects.create(
            cost_sheet_group=source.cost_sheet_group,
            version_no=version_no,
            costing_type=source.costing_type,

            # Evidence binding (可能更新 usage_scenario)
            techpack_revision=usage_scenario.revision,
            usage_scenario=usage_scenario,

            # Costing parameters (可覆寫)
            labor_cost=overrides.get('labor_cost', source.labor_cost),
            overhead_cost=overrides.get('overhead_cost', source.overhead_cost),
            freight_cost=overrides.get('freight_cost', source.freight_cost),
            packing_cost=overrides.get('packing_cost', source.packing_cost),
            margin_pct=overrides.get('margin_pct', source.margin_pct),

            # Metadata
            change_reason=overrides.get('change_reason', f'Cloned from v{source.version_no}'),
            cloned_from=source,
            created_by=user,
            status='draft'
        )

        # Clone CostLineV2
        cost_lines = []
        for source_line in source.cost_lines.all():
            cost_line = CostLineV2(
                cost_sheet_version=cloned_sheet,

                # Source tracking (保留原始來源)
                source_revision_id=source_line.source_revision_id,
                source_usage_scenario_id=source_line.source_usage_scenario_id,
                source_usage_scenario_version_no=source_line.source_usage_scenario_version_no,
                source_bom_item_id=source_line.source_bom_item_id,
                source_usage_line_id=source_line.source_usage_line_id,

                # Material identification
                material_name=source_line.material_name,
                material_name_zh=source_line.material_name_zh,
                category=source_line.category,
                supplier=source_line.supplier,
                supplier_article_no=source_line.supplier_article_no,
                unit=source_line.unit,

                # Copy adjusted values (保留調整)
                consumption_snapshot=source_line.consumption_snapshot,
                consumption_adjusted=source_line.consumption_adjusted,
                unit_price_snapshot=source_line.unit_price_snapshot,
                unit_price_adjusted=source_line.unit_price_adjusted,

                # Copy adjustment flags
                is_consumption_adjusted=source_line.is_consumption_adjusted,
                is_price_adjusted=source_line.is_price_adjusted,
                adjustment_reason=source_line.adjustment_reason,

                # Calculated result
                line_cost=source_line.line_cost,
                sort_order=source_line.sort_order
            )
            cost_lines.append(cost_line)

        CostLineV2.objects.bulk_create(cost_lines)

        # Calculate totals
        cloned_sheet.calculate_totals()
        cloned_sheet.save()

        return cloned_sheet

    @staticmethod
    @transaction.atomic
    def refresh_snapshot(cost_sheet_id, user=None):
        """
        Refresh CostSheetVersion snapshot from current BOM data.
        Only allowed for draft status.

        This re-reads consumption and unit_price from BOMItem,
        preserving any manual adjustments already made.

        Args:
            cost_sheet_id: UUID of CostSheetVersion
            user: User instance

        Returns:
            CostSheetVersion instance (updated)

        Raises:
            ValueError: if not in draft status
            MissingUnitPriceError: if any BOM items missing unit_price
        """
        from apps.styles.models import BOMItem

        cost_sheet = CostSheetVersion.objects.prefetch_related(
            'cost_lines'
        ).select_related(
            'usage_scenario'
        ).get(id=cost_sheet_id)

        # Validate state
        if cost_sheet.status != 'draft':
            raise ValueError(f"Cannot refresh: CostSheetVersion is not in draft status (current: {cost_sheet.status})")

        # Check for missing unit prices
        missing_price_items = []
        for cost_line in cost_sheet.cost_lines.all():
            if cost_line.source_bom_item_id:
                try:
                    bom_item = BOMItem.objects.get(id=cost_line.source_bom_item_id)
                    if bom_item.unit_price is None or bom_item.unit_price == 0:
                        missing_price_items.append({
                            'item_number': bom_item.item_number,
                            'material_name': bom_item.material_name,
                            'supplier': bom_item.supplier or '-',
                        })
                except BOMItem.DoesNotExist:
                    pass

        if missing_price_items:
            raise MissingUnitPriceError(
                f"無法刷新報價：{len(missing_price_items)} 個物料缺少單價",
                missing_price_items
            )

        # Refresh each cost line from BOM
        refreshed_count = 0
        for cost_line in cost_sheet.cost_lines.all():
            if cost_line.source_bom_item_id:
                try:
                    bom_item = BOMItem.objects.get(id=cost_line.source_bom_item_id)

                    # Update snapshot values from BOM
                    new_consumption = bom_item.current_consumption or cost_line.consumption_snapshot
                    new_unit_price = bom_item.unit_price or cost_line.unit_price_snapshot

                    # Only update if not manually adjusted
                    if not cost_line.is_consumption_adjusted:
                        cost_line.consumption_snapshot = new_consumption
                        cost_line.consumption_adjusted = new_consumption

                    if not cost_line.is_price_adjusted:
                        cost_line.unit_price_snapshot = new_unit_price
                        cost_line.unit_price_adjusted = new_unit_price

                    # Recalculate line_cost
                    cost_line.line_cost = CostLineV2.calculate_line_cost(
                        cost_line.consumption_adjusted,
                        cost_line.unit_price_adjusted
                    )
                    cost_line.save()
                    refreshed_count += 1

                except BOMItem.DoesNotExist:
                    # BOM item was deleted, keep old values
                    pass

        # Recalculate totals
        cost_sheet.change_reason = f'Refreshed from BOM ({refreshed_count} lines updated)'
        cost_sheet.calculate_totals()
        cost_sheet.save()

        return cost_sheet

    @staticmethod
    @transaction.atomic
    def submit_cost_sheet(cost_sheet_id, user=None):
        """
        Submit a CostSheetVersion (状态机: Draft → Submitted)

        Side effects:
        - Lock usage_scenario (R1 推导)
        - Mark as submitted (cannot edit anymore)

        Args:
            cost_sheet_id: UUID of CostSheetVersion
            user: User instance

        Returns:
            CostSheetVersion instance (updated)

        Raises:
            ValueError: if already submitted or not in draft
            BOMNotReadyError: if BOM verified_ratio < threshold (Decision 2: Submit Gate)
        """
        cost_sheet = CostSheetVersion.objects.select_related(
            'usage_scenario',
            'cost_sheet_group__style'
        ).get(id=cost_sheet_id)

        # Validate state
        if cost_sheet.status != 'draft':
            raise ValueError(f"Cannot submit: CostSheetVersion is not in draft status (current: {cost_sheet.status})")

        # Decision 2 Gate: BOM verified_ratio >= 0.9
        style = cost_sheet.cost_sheet_group.style
        if style:
            from apps.styles.portfolio import bom_counts, BOM_VERIFIED_THRESHOLD

            total, verified, ratio = bom_counts(style)

            if ratio < BOM_VERIFIED_THRESHOLD:
                raise BOMNotReadyError(
                    'BOM verified ratio is below required threshold',
                    bom_data={
                        'bom_items_count': total,
                        'bom_verified_count': verified,
                        'bom_verified_ratio': round(ratio, 4),
                        'required_threshold': BOM_VERIFIED_THRESHOLD,
                    }
                )

        # Change status
        cost_sheet.status = 'submitted'
        cost_sheet.submitted_at = timezone.now()
        # Handle AnonymousUser case
        if user and hasattr(user, 'is_authenticated') and user.is_authenticated:
            cost_sheet.submitted_by = user

        # R1: Update usage_scenario lock audit (第一次鎖定)
        usage_scenario = cost_sheet.usage_scenario
        if not usage_scenario.locked_at:
            usage_scenario.locked_at = timezone.now()
            usage_scenario.locked_first_by_cost_sheet = cost_sheet
            usage_scenario.save()

        cost_sheet.save()
        return cost_sheet

    @staticmethod
    def update_cost_sheet_summary(cost_sheet_id, patch, user=None):
        """
        Update CostSheetVersion summary fields (Draft only)

        Args:
            cost_sheet_id: UUID of CostSheetVersion
            patch: dict with fields to update:
                - labor_cost: Decimal
                - overhead_cost: Decimal
                - freight_cost: Decimal
                - packing_cost: Decimal
                - margin_pct: Decimal
            user: User instance

        Returns:
            CostSheetVersion instance (updated)

        Raises:
            PermissionError: if not in draft
        """
        cost_sheet = CostSheetVersion.objects.get(id=cost_sheet_id)

        # 403 Guard
        if not cost_sheet.can_edit():
            raise PermissionError(
                f"Cannot edit: CostSheetVersion is {cost_sheet.status} (only draft can be edited)"
            )

        # Update fields
        if 'labor_cost' in patch:
            cost_sheet.labor_cost = Decimal(str(patch['labor_cost']))
        if 'overhead_cost' in patch:
            cost_sheet.overhead_cost = Decimal(str(patch['overhead_cost']))
        if 'freight_cost' in patch:
            cost_sheet.freight_cost = Decimal(str(patch['freight_cost']))
        if 'packing_cost' in patch:
            cost_sheet.packing_cost = Decimal(str(patch['packing_cost']))
        if 'margin_pct' in patch:
            cost_sheet.margin_pct = Decimal(str(patch['margin_pct']))

        # Recalculate totals
        cost_sheet.calculate_totals()
        cost_sheet.save()

        return cost_sheet

    @staticmethod
    def update_cost_line(line_id, patch, user=None):
        """
        Update CostLineV2 (Draft only, adjusts consumption/price)

        Args:
            line_id: UUID of CostLineV2
            patch: dict with fields to update:
                - consumption_adjusted: Decimal
                - unit_price_adjusted: Decimal
                - adjustment_reason: str
            user: User instance

        Returns:
            CostLineV2 instance (updated)

        Raises:
            PermissionError: if cost_sheet is not draft
        """
        cost_line = CostLineV2.objects.select_related(
            'cost_sheet_version'
        ).get(id=line_id)

        # 403 Guard
        if not cost_line.cost_sheet_version.can_edit():
            raise PermissionError(
                f"Cannot edit: CostSheetVersion is {cost_line.cost_sheet_version.status}"
            )

        # Update consumption
        if 'consumption_adjusted' in patch:
            new_consumption = Decimal(str(patch['consumption_adjusted']))
            if new_consumption != cost_line.consumption_snapshot:
                cost_line.consumption_adjusted = new_consumption
                cost_line.is_consumption_adjusted = True
            else:
                cost_line.consumption_adjusted = new_consumption
                cost_line.is_consumption_adjusted = False

        # Update price
        if 'unit_price_adjusted' in patch:
            new_price = Decimal(str(patch['unit_price_adjusted']))
            if new_price != cost_line.unit_price_snapshot:
                cost_line.unit_price_adjusted = new_price
                cost_line.is_price_adjusted = True
            else:
                cost_line.unit_price_adjusted = new_price
                cost_line.is_price_adjusted = False

        # Update reason
        if 'adjustment_reason' in patch:
            cost_line.adjustment_reason = patch['adjustment_reason']

        # Recalculate line_cost
        cost_line.line_cost = CostLineV2.calculate_line_cost(
            cost_line.consumption_adjusted,
            cost_line.unit_price_adjusted
        )

        # Mark adjustment metadata
        if user and user.is_authenticated and (cost_line.is_consumption_adjusted or cost_line.is_price_adjusted):
            cost_line.adjusted_by = user
            cost_line.adjusted_at = timezone.now()

        cost_line.save()

        # Recalculate parent totals
        cost_sheet = cost_line.cost_sheet_version
        cost_sheet.calculate_totals()
        cost_sheet.save()

        return cost_line

    @staticmethod
    def get_cost_sheet_with_lines(cost_sheet_id):
        """
        Get CostSheetVersion with prefetched lines (for API responses)

        Args:
            cost_sheet_id: UUID of CostSheetVersion

        Returns:
            CostSheetVersion instance with cost_lines prefetched
        """
        return CostSheetVersion.objects.prefetch_related(
            'cost_lines'
        ).select_related(
            'cost_sheet_group__style',
            'techpack_revision',
            'usage_scenario',
            'created_by',
            'submitted_by'
        ).get(id=cost_sheet_id)
