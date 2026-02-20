"""
UsageScenarioService
Handles creation, cloning, and updating of UsageScenarios and UsageLines
"""

from decimal import Decimal
from django.db import transaction
from django.db.models import Max
from apps.costing.models import UsageScenario, UsageLine
from apps.styles.models import BOMItem


class UsageScenarioService:
    """
    Service layer for UsageScenario operations
    Enforces R1-R3 rules and business logic
    """

    @staticmethod
    @transaction.atomic
    def create_scenario(revision, purpose, payload, user=None):
        """
        R2: Concurrent Version Number Protection

        使用 select_for_update() 锁定防止版本号冲突

        Args:
            revision: StyleRevision instance
            purpose: str ('sample_quote', 'bulk_quote', etc.)
            payload: dict with optional fields:
                - wastage_pct: Decimal
                - rounding_rule: str
                - notes: str
                - bom_items: list of dicts [{bom_item_id, consumption, ...}]
            user: User instance

        Returns:
            UsageScenario instance
        """
        # R2: Lock to prevent version number collision
        scenarios = UsageScenario.objects.filter(
            revision=revision,
            purpose=purpose
        ).select_for_update()

        max_version = scenarios.aggregate(Max('version_no'))['version_no__max'] or 0
        version_no = max_version + 1

        # Create scenario
        scenario = UsageScenario.objects.create(
            revision=revision,
            purpose=purpose,
            version_no=version_no,
            wastage_pct=payload.get('wastage_pct', Decimal('5.00')),
            rounding_rule=payload.get('rounding_rule', 'round_up'),
            status='draft',
            notes=payload.get('notes', ''),
            created_by=user
        )

        # Create UsageLines from BOM items
        bom_items_data = payload.get('bom_items', [])

        if not bom_items_data:
            # Default: create UsageLines for all BOM items in revision
            bom_items = BOMItem.objects.filter(revision=revision).order_by('item_number')
            usage_lines = []

            for idx, bom_item in enumerate(bom_items, start=1):
                # 使用三階段用量優先級：locked > confirmed > pre_estimate > consumption
                consumption = bom_item.current_consumption if bom_item.current_consumption else Decimal('0.0000')
                usage_line = UsageLine(
                    usage_scenario=scenario,
                    bom_item=bom_item,
                    consumption=consumption,
                    consumption_unit=bom_item.unit,
                    consumption_status='confirmed' if consumption > 0 else 'estimated',
                    sort_order=idx * 10
                )
                usage_lines.append(usage_line)

            UsageLine.objects.bulk_create(usage_lines)
        else:
            # Custom: create UsageLines from payload
            usage_lines = []
            for idx, item_data in enumerate(bom_items_data, start=1):
                bom_item = BOMItem.objects.get(id=item_data['bom_item_id'])
                usage_line = UsageLine(
                    usage_scenario=scenario,
                    bom_item=bom_item,
                    consumption=Decimal(str(item_data.get('consumption', '0.0000'))),
                    consumption_unit=item_data.get('consumption_unit', bom_item.unit),
                    consumption_status=item_data.get('consumption_status', 'estimated'),
                    wastage_pct_override=item_data.get('wastage_pct_override'),
                    sort_order=idx * 10
                )
                usage_lines.append(usage_line)

            UsageLine.objects.bulk_create(usage_lines)

        return scenario

    @staticmethod
    @transaction.atomic
    def clone_scenario(scenario_id, overrides=None, user=None):
        """
        Clone an existing UsageScenario with optional overrides

        Args:
            scenario_id: UUID of source scenario
            overrides: dict with optional fields to override:
                - purpose: str
                - wastage_pct: Decimal
                - notes: str
            user: User instance

        Returns:
            UsageScenario instance (new clone)
        """
        source = UsageScenario.objects.get(id=scenario_id)
        overrides = overrides or {}

        # Determine target purpose and version_no
        target_purpose = overrides.get('purpose', source.purpose)

        # R2: Lock to prevent version number collision
        scenarios = UsageScenario.objects.filter(
            revision=source.revision,
            purpose=target_purpose
        ).select_for_update()

        max_version = scenarios.aggregate(Max('version_no'))['version_no__max'] or 0
        version_no = max_version + 1

        # Create cloned scenario
        cloned_scenario = UsageScenario.objects.create(
            revision=source.revision,
            purpose=target_purpose,
            version_no=version_no,
            wastage_pct=overrides.get('wastage_pct', source.wastage_pct),
            rounding_rule=overrides.get('rounding_rule', source.rounding_rule),
            status='draft',
            notes=overrides.get('notes', f'Cloned from {source.purpose} v{source.version_no}'),
            created_by=user
        )

        # Clone UsageLines
        usage_lines = []
        for source_line in source.usage_lines.all():
            usage_line = UsageLine(
                usage_scenario=cloned_scenario,
                bom_item=source_line.bom_item,
                consumption=source_line.consumption,
                consumption_unit=source_line.consumption_unit,
                consumption_status=source_line.consumption_status,
                wastage_pct_override=source_line.wastage_pct_override,
                sort_order=source_line.sort_order
            )
            usage_lines.append(usage_line)

        UsageLine.objects.bulk_create(usage_lines)

        return cloned_scenario

    @staticmethod
    def update_usage_line(line_id, patch, user=None):
        """
        Update a UsageLine (with can_edit check)

        Args:
            line_id: UUID of UsageLine
            patch: dict with fields to update:
                - consumption: Decimal
                - consumption_status: str
                - wastage_pct_override: Decimal
            user: User instance

        Returns:
            UsageLine instance (updated)

        Raises:
            PermissionError: if scenario is locked
        """
        usage_line = UsageLine.objects.select_related('usage_scenario').get(id=line_id)

        # R1: Check if scenario is locked
        if not usage_line.usage_scenario.can_edit():
            raise PermissionError(
                f"Cannot edit UsageLine: UsageScenario is locked "
                f"(purpose={usage_line.usage_scenario.purpose}, "
                f"version={usage_line.usage_scenario.version_no})"
            )

        # Update fields
        if 'consumption' in patch:
            usage_line.consumption = Decimal(str(patch['consumption']))

        if 'consumption_status' in patch:
            usage_line.consumption_status = patch['consumption_status']

        if 'wastage_pct_override' in patch:
            value = patch['wastage_pct_override']
            usage_line.wastage_pct_override = Decimal(str(value)) if value is not None else None

        # Mark as confirmed
        if user and patch.get('consumption_status') == 'confirmed':
            usage_line.confirmed_by = user
            from django.utils import timezone
            usage_line.confirmed_at = timezone.now()

        usage_line.save()
        return usage_line

    @staticmethod
    def get_scenario_with_lines(scenario_id):
        """
        Get UsageScenario with prefetched lines (for API responses)

        Args:
            scenario_id: UUID of UsageScenario

        Returns:
            UsageScenario instance with usage_lines prefetched
        """
        return UsageScenario.objects.prefetch_related(
            'usage_lines',
            'usage_lines__bom_item'
        ).get(id=scenario_id)
