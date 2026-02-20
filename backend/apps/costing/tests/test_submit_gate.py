"""
Test Submit Gate - Decision 2 Implementation
Tests BOM verification gate on CostSheetVersion submit
"""

import pytest
from django.utils import timezone
from decimal import Decimal
from apps.core.models import Organization, User
from apps.styles.models import Style, StyleRevision, BOMItem
from apps.costing.models import CostSheetGroup, CostSheetVersion, UsageScenario, UsageLine
from apps.costing.services.costing_service import CostingService, BOMNotReadyError


@pytest.fixture
def organization(db):
    """Create test organization"""
    return Organization.objects.create(name="Test Org")


@pytest.fixture
def user(db, organization):
    """Create test user"""
    return User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="test123",
        organization=organization
    )


@pytest.fixture
def style_with_bom(db, organization, user):
    """Create style with BOM items"""
    style = Style.objects.create(
        organization=organization,
        style_number="TEST001",
        style_name="Test Style",
        created_by=user
    )

    revision = StyleRevision.objects.create(
        style=style,
        revision_label="Rev A",
        status="draft"
    )

    style.current_revision = revision
    style.save()

    return style, revision


@pytest.fixture
def bom_items_low_verification(db, style_with_bom):
    """Create BOM with low verification ratio (< 90%)"""
    style, revision = style_with_bom

    # Create 10 BOM items, only 5 verified (50%)
    for i in range(10):
        BOMItem.objects.create(
            revision=revision,
            item_number=i + 1,
            category="fabric",
            material_name=f"Material {i+1}",
            unit="yards",
            consumption=Decimal("1.0"),
            unit_price=Decimal("10.00"),
            is_verified=(i < 5)  # Only first 5 verified
        )

    return style, revision


@pytest.fixture
def bom_items_high_verification(db, style_with_bom):
    """Create BOM with high verification ratio (>= 90%)"""
    style, revision = style_with_bom

    # Create 10 BOM items, 9 verified (90%)
    for i in range(10):
        BOMItem.objects.create(
            revision=revision,
            item_number=i + 1,
            category="fabric",
            material_name=f"Material {i+1}",
            unit="yards",
            consumption=Decimal("1.0"),
            unit_price=Decimal("10.00"),
            is_verified=(i < 9)  # First 9 verified
        )

    return style, revision


@pytest.fixture
def draft_cost_sheet_version(db, user):
    """Create draft CostSheetVersion with UsageScenario"""
    def _create(style, revision):
        # Create CostSheetGroup
        group, _ = CostSheetGroup.objects.get_or_create(style=style)

        # Create UsageScenario
        scenario = UsageScenario.objects.create(
            revision=revision,
            purpose="sample_quote",
            version_no=1,
            wastage_pct=Decimal("5.0"),
            created_by=user
        )

        # Create UsageLines from BOM
        for idx, bom_item in enumerate(revision.bom_items.all()):
            UsageLine.objects.create(
                usage_scenario=scenario,
                bom_item=bom_item,
                consumption=bom_item.consumption or Decimal("1.0"),
                consumption_unit=bom_item.unit,
                consumption_status="confirmed",
                sort_order=idx
            )

        # Create CostSheetVersion
        version = CostingService.create_cost_sheet(
            style_id=style.id,
            costing_type="sample",
            usage_scenario_id=scenario.id,
            payload={
                "labor_cost": 10.0,
                "overhead_cost": 5.0,
                "freight_cost": 3.0,
                "packing_cost": 2.0,
                "margin_pct": 30.0,
            },
            user=user
        )

        return version

    return _create


@pytest.mark.django_db
class TestSubmitGate:
    """Test Submit Gate - BOM Verification"""

    def test_submit_blocks_when_bom_ratio_low(self, draft_cost_sheet_version, bom_items_low_verification, user):
        """
        Test: Submit should raise BOMNotReadyError when BOM verified_ratio < 0.9
        """
        style, revision = bom_items_low_verification
        version = draft_cost_sheet_version(style, revision)

        # Attempt submit
        with pytest.raises(BOMNotReadyError) as exc_info:
            CostingService.submit_cost_sheet(
                cost_sheet_id=version.id,
                user=user
            )

        # Check exception details
        error = exc_info.value
        assert error.bom_data['bom_items_count'] == 10
        assert error.bom_data['bom_verified_count'] == 5
        assert error.bom_data['bom_verified_ratio'] == 0.5
        assert error.bom_data['required_threshold'] == 0.9

        # Check version status unchanged
        version.refresh_from_db()
        assert version.status == 'draft'
        assert version.submitted_at is None


    def test_submit_ok_when_bom_ratio_high(self, draft_cost_sheet_version, bom_items_high_verification, user):
        """
        Test: Submit should succeed when BOM verified_ratio >= 0.9
        """
        style, revision = bom_items_high_verification
        version = draft_cost_sheet_version(style, revision)

        # Submit should succeed
        submitted = CostingService.submit_cost_sheet(
            cost_sheet_id=version.id,
            user=user
        )

        assert submitted.status == 'submitted'
        assert submitted.submitted_at is not None
        assert submitted.submitted_by == user

        # Check UsageScenario locked
        scenario = submitted.usage_scenario
        scenario.refresh_from_db()
        assert scenario.locked_at is not None
        assert scenario.locked_first_by_cost_sheet == submitted


    def test_submit_blocks_when_not_draft(self, draft_cost_sheet_version, bom_items_high_verification, user):
        """
        Test: Submit should raise ValueError when status != draft
        """
        style, revision = bom_items_high_verification
        version = draft_cost_sheet_version(style, revision)

        # First submit
        version = CostingService.submit_cost_sheet(
            cost_sheet_id=version.id,
            user=user
        )

        # Second submit should fail
        with pytest.raises(ValueError) as exc_info:
            CostingService.submit_cost_sheet(
                cost_sheet_id=version.id,
                user=user
            )

        assert "not in draft status" in str(exc_info.value)


    def test_submit_with_no_bom_items(self, draft_cost_sheet_version, style_with_bom, user):
        """
        Test: Submit should block when BOM items_count = 0
        """
        style, revision = style_with_bom
        # No BOM items created, ratio = 0.0

        version = draft_cost_sheet_version(style, revision)

        with pytest.raises(BOMNotReadyError) as exc_info:
            CostingService.submit_cost_sheet(
                cost_sheet_id=version.id,
                user=user
            )

        error = exc_info.value
        assert error.bom_data['bom_items_count'] == 0
        assert error.bom_data['bom_verified_ratio'] == 0.0


    def test_submit_locks_usage_scenario_only_once(self, draft_cost_sheet_version, bom_items_high_verification, user):
        """
        Test: Submit should lock UsageScenario only on first submit
        """
        style, revision = bom_items_high_verification
        scenario = UsageScenario.objects.create(
            revision=revision,
            purpose="sample_quote",
            version_no=1,
            wastage_pct=Decimal("5.0"),
            created_by=user
        )

        # Create UsageLines
        for idx, bom_item in enumerate(revision.bom_items.all()):
            UsageLine.objects.create(
                usage_scenario=scenario,
                bom_item=bom_item,
                consumption=bom_item.consumption or Decimal("1.0"),
                consumption_unit=bom_item.unit,
                consumption_status="confirmed",
                sort_order=idx
            )

        # Create two versions using same scenario
        version1 = draft_cost_sheet_version(style, revision)
        version1.usage_scenario = scenario
        version1.save()

        version2 = CostingService.clone_cost_sheet(
            cost_sheet_id=version1.id,
            overrides={},
            user=user
        )
        version2.usage_scenario = scenario
        version2.save()

        # Submit version1
        submitted1 = CostingService.submit_cost_sheet(
            cost_sheet_id=version1.id,
            user=user
        )

        scenario.refresh_from_db()
        first_locked_at = scenario.locked_at
        first_locked_by = scenario.locked_first_by_cost_sheet

        assert first_locked_at is not None
        assert first_locked_by == submitted1

        # Submit version2 (should not change locked_at/locked_first_by)
        submitted2 = CostingService.submit_cost_sheet(
            cost_sheet_id=version2.id,
            user=user
        )

        scenario.refresh_from_db()
        assert scenario.locked_at == first_locked_at  # Unchanged
        assert scenario.locked_first_by_cost_sheet == submitted1  # Still version1
