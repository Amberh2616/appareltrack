"""
Phase 2-3 Services Tests
Tests for UsageScenarioService and CostingService
"""

import pytest
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.db import transaction

from apps.styles.models import Style, StyleRevision, BOMItem
from apps.costing.models import (
    UsageScenario,
    UsageLine,
    CostSheetGroup,
    CostSheetVersion,
    CostLineV2
)
from apps.costing.services import UsageScenarioService, CostingService

User = get_user_model()


@pytest.fixture
def user(db):
    """Create test user"""
    return User.objects.create_user(
        username='testuser',
        email='test@test.com',
        password='testpass123'
    )


@pytest.fixture
def style(db):
    """Create test style"""
    from apps.core.models import Organization
    org = Organization.objects.create(name='Test Org')
    return Style.objects.create(
        organization=org,
        style_number='TEST001',
        style_name='Test Style'
    )


@pytest.fixture
def revision(db, style):
    """Create test revision"""
    return StyleRevision.objects.create(
        style=style,
        revision_label='Rev A',
        status='draft'
    )


@pytest.fixture
def bom_items(db, revision):
    """Create test BOM items"""
    items = []
    items.append(BOMItem.objects.create(
        revision=revision,
        item_number=1,
        category='fabric',
        material_name='Nulu Fabric',
        supplier='Fabric Co',
        unit='yards',
        consumption=Decimal('1.5'),
        unit_price=Decimal('10.00')
    ))
    items.append(BOMItem.objects.create(
        revision=revision,
        item_number=2,
        category='trim',
        material_name='Zipper',
        supplier='Trim Co',
        unit='pcs',
        consumption=Decimal('1.0'),
        unit_price=Decimal('2.00')
    ))
    return items


class TestUsageScenarioService:
    """Test UsageScenarioService"""

    def test_create_scenario_basic(self, revision, bom_items, user):
        """Test basic scenario creation"""
        scenario = UsageScenarioService.create_scenario(
            revision=revision,
            purpose='bulk_quote',
            payload={
                'wastage_pct': Decimal('5.00'),
                'notes': 'Test scenario'
            },
            user=user
        )

        assert scenario.revision == revision
        assert scenario.purpose == 'bulk_quote'
        assert scenario.version_no == 1
        assert scenario.wastage_pct == Decimal('5.00')
        assert scenario.usage_lines.count() == 2

    def test_create_scenario_r2_version_protection(self, revision, bom_items, user):
        """Test R2: Concurrent version number protection"""
        # Create first scenario
        scenario1 = UsageScenarioService.create_scenario(
            revision=revision,
            purpose='bulk_quote',
            payload={},
            user=user
        )
        assert scenario1.version_no == 1

        # Create second scenario (should be v2)
        scenario2 = UsageScenarioService.create_scenario(
            revision=revision,
            purpose='bulk_quote',
            payload={},
            user=user
        )
        assert scenario2.version_no == 2

    def test_clone_scenario(self, revision, bom_items, user):
        """Test scenario cloning"""
        # Create original
        original = UsageScenarioService.create_scenario(
            revision=revision,
            purpose='bulk_quote',
            payload={},
            user=user
        )

        # Clone
        cloned = UsageScenarioService.clone_scenario(
            scenario_id=original.id,
            overrides={'purpose': 'sample_quote'},
            user=user
        )

        assert cloned.purpose == 'sample_quote'
        assert cloned.version_no == 1  # Different purpose, reset to v1
        assert cloned.usage_lines.count() == original.usage_lines.count()

    def test_update_usage_line_r1_locked_check(self, revision, bom_items, user):
        """Test R1: Cannot edit locked scenario"""
        # Create scenario
        scenario = UsageScenarioService.create_scenario(
            revision=revision,
            purpose='bulk_quote',
            payload={},
            user=user
        )
        usage_line = scenario.usage_lines.first()

        # Update should work (not locked)
        updated = UsageScenarioService.update_usage_line(
            line_id=usage_line.id,
            patch={'consumption': Decimal('2.0')},
            user=user
        )
        assert updated.consumption == Decimal('2.0')

        # Create and submit cost sheet (locks scenario)
        style = revision.style
        cost_sheet = CostingService.create_cost_sheet(
            style_id=style.id,
            costing_type='bulk',
            usage_scenario_id=scenario.id,
            payload={},
            user=user
        )
        CostingService.submit_cost_sheet(cost_sheet.id, user)

        # Now scenario should be locked
        scenario.refresh_from_db()
        assert scenario.is_locked() is True

        # Update should fail
        with pytest.raises(PermissionError, match="Cannot edit.*locked"):
            UsageScenarioService.update_usage_line(
                line_id=usage_line.id,
                patch={'consumption': Decimal('3.0')},
                user=user
            )


class TestCostingService:
    """Test CostingService"""

    def test_create_cost_sheet_with_snapshot(self, style, revision, bom_items, user):
        """Test cost sheet creation with snapshot"""
        # Create usage scenario first
        scenario = UsageScenarioService.create_scenario(
            revision=revision,
            purpose='bulk_quote',
            payload={},
            user=user
        )

        # Create cost sheet
        cost_sheet = CostingService.create_cost_sheet(
            style_id=style.id,
            costing_type='sample',
            usage_scenario_id=scenario.id,
            payload={
                'labor_cost': Decimal('10.00'),
                'overhead_cost': Decimal('5.00'),
                'margin_pct': Decimal('30.00')
            },
            user=user
        )

        assert cost_sheet.version_no == 1
        assert cost_sheet.costing_type == 'sample'
        assert cost_sheet.status == 'draft'
        assert cost_sheet.cost_lines.count() == 2

        # Check snapshot
        line = cost_sheet.cost_lines.first()
        assert line.consumption_snapshot > 0
        assert line.consumption_adjusted == line.consumption_snapshot

    def test_submit_locks_usage_scenario(self, style, revision, bom_items, user):
        """Test submit locks usage scenario (R1)"""
        scenario = UsageScenarioService.create_scenario(
            revision=revision,
            purpose='bulk_quote',
            payload={},
            user=user
        )

        cost_sheet = CostingService.create_cost_sheet(
            style_id=style.id,
            costing_type='bulk',
            usage_scenario_id=scenario.id,
            payload={},
            user=user
        )

        # Before submit: not locked
        scenario.refresh_from_db()
        assert scenario.is_locked() is False
        assert scenario.locked_at is None

        # Submit
        submitted = CostingService.submit_cost_sheet(cost_sheet.id, user)
        assert submitted.status == 'submitted'

        # After submit: locked
        scenario.refresh_from_db()
        assert scenario.is_locked() is True
        assert scenario.locked_at is not None
        assert scenario.locked_first_by_cost_sheet == cost_sheet

    def test_update_403_guard(self, style, revision, bom_items, user):
        """Test 403 guard prevents editing submitted versions"""
        scenario = UsageScenarioService.create_scenario(
            revision=revision,
            purpose='bulk_quote',
            payload={},
            user=user
        )

        cost_sheet = CostingService.create_cost_sheet(
            style_id=style.id,
            costing_type='bulk',
            usage_scenario_id=scenario.id,
            payload={},
            user=user
        )

        # Can edit draft
        updated = CostingService.update_cost_sheet_summary(
            cost_sheet_id=cost_sheet.id,
            patch={'labor_cost': Decimal('15.00')},
            user=user
        )
        assert updated.labor_cost == Decimal('15.00')

        # Submit
        CostingService.submit_cost_sheet(cost_sheet.id, user)

        # Cannot edit submitted
        with pytest.raises(PermissionError, match="Cannot edit.*submitted"):
            CostingService.update_cost_sheet_summary(
                cost_sheet_id=cost_sheet.id,
                patch={'labor_cost': Decimal('20.00')},
                user=user
            )

    def test_update_cost_line_recalculates_totals(self, style, revision, bom_items, user):
        """Test cost line update recalculates parent totals"""
        scenario = UsageScenarioService.create_scenario(
            revision=revision,
            purpose='bulk_quote',
            payload={},
            user=user
        )

        cost_sheet = CostingService.create_cost_sheet(
            style_id=style.id,
            costing_type='bulk',
            usage_scenario_id=scenario.id,
            payload={
                'labor_cost': Decimal('10.00'),
                'margin_pct': Decimal('30.00')
            },
            user=user
        )

        original_total = cost_sheet.total_cost

        # Update a cost line
        line = cost_sheet.cost_lines.first()
        CostingService.update_cost_line(
            line_id=line.id,
            patch={
                'consumption_adjusted': line.consumption_snapshot * Decimal('1.5'),
                'adjustment_reason': 'Client requested'
            },
            user=user
        )

        # Check parent recalculated
        cost_sheet.refresh_from_db()
        assert cost_sheet.total_cost != original_total
        assert cost_sheet.material_cost > 0

    def test_clone_cost_sheet(self, style, revision, bom_items, user):
        """Test cost sheet cloning"""
        scenario = UsageScenarioService.create_scenario(
            revision=revision,
            purpose='bulk_quote',
            payload={},
            user=user
        )

        original = CostingService.create_cost_sheet(
            style_id=style.id,
            costing_type='bulk',
            usage_scenario_id=scenario.id,
            payload={'margin_pct': Decimal('30.00')},
            user=user
        )

        # Clone with override
        cloned = CostingService.clone_cost_sheet(
            cost_sheet_id=original.id,
            overrides={'margin_pct': Decimal('35.00')},
            user=user
        )

        assert cloned.version_no == 2
        assert cloned.margin_pct == Decimal('35.00')
        assert cloned.cloned_from == original
        assert cloned.status == 'draft'
        assert cloned.cost_lines.count() == original.cost_lines.count()
