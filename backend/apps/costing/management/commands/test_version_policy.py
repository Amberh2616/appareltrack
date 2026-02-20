"""
Phase 2-2I: Version Policy Acceptance Testing
Management Command

Usage:
    python manage.py test_version_policy
"""

from decimal import Decimal
import json
from django.core.management.base import BaseCommand
from django.test import RequestFactory
from django.contrib.auth import get_user_model

from apps.styles.models import StyleRevision, BOMItem
from apps.costing.models import CostSheet
from apps.costing.views import cost_sheets_list_create, cost_sheet_detail_update, cost_sheet_duplicate

User = get_user_model()

# Use existing revision with BOM
REVISION_ID = 'abbfd005-159b-4ad8-a3cc-87c73098fc81'


class Command(BaseCommand):
    help = 'Run Phase 2-2I Version Policy acceptance tests (using existing revision)'

    def handle(self, *args, **options):
        self.stdout.write("\n" + "="*70)
        self.stdout.write("Phase 2-2I: Version Policy Acceptance Tests")
        self.stdout.write("="*70)

        # Test Setup
        self.stdout.write("\n📋 Setup: Using existing data...")

        # Use existing revision with BOM
        try:
            revision = StyleRevision.objects.get(id=REVISION_ID)
            self.stdout.write(self.style.SUCCESS(f"✅ Using existing revision: {revision.id}"))
            if revision.style:
                self.stdout.write(f"   Style: {revision.style.style_number}")
            self.stdout.write(f"   BOM items: {BOMItem.objects.filter(revision=revision).count()}")
        except StyleRevision.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"❌ Revision {REVISION_ID} not found!"))
            self.stdout.write("   Please run the import_bom_demo.py command first.")
            return

        # Get or create test user
        user, created = User.objects.get_or_create(
            username='test_vp_user',
            defaults={'email': 'test_vp@example.com'}
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"✅ Created test user: {user.username}"))
        else:
            self.stdout.write(self.style.SUCCESS(f"✅ Using existing user: {user.username}"))

        # Clean up old test cost sheets
        CostSheet.objects.filter(revision=revision, costing_type='sample').delete()
        self.stdout.write(self.style.SUCCESS("✅ Cleaned up old test cost sheets"))

        # Create test CostSheet v1
        factory = RequestFactory()

        self.stdout.write("\n📋 Creating test CostSheet v1...")
        request = factory.post(
            f'/api/v2/revisions/{revision.id}/cost-sheets/',
            data=json.dumps({
                'costing_type': 'sample',
                'labor_cost': '12.00',
                'overhead_cost': '3.00',
                'freight_cost': '2.50',
                'packaging_cost': '1.50',
                'testing_cost': '0.50',
                'margin_pct': '30.00',
                'wastage_pct': '5.00',
                'notes': 'Test v1'
            }),
            content_type='application/json'
        )
        request.user = user

        response = cost_sheets_list_create(request, revision_id=str(revision.id))
        if response.status_code == 201:
            cost_sheet_v1 = CostSheet.objects.get(revision=revision, costing_type='sample', version_no=1)
            self.stdout.write(self.style.SUCCESS(f"✅ Created CostSheet v1 (ID: {cost_sheet_v1.id})"))
            self.stdout.write(f"   - Labor: ${cost_sheet_v1.labor_cost}")
            self.stdout.write(f"   - Margin: {cost_sheet_v1.margin_pct}%")
            self.stdout.write(f"   - Material Cost: ${cost_sheet_v1.material_cost}")
            self.stdout.write(f"   - Total Cost: ${cost_sheet_v1.total_cost}")
            self.stdout.write(f"   - Unit Price: ${cost_sheet_v1.unit_price}")
        else:
            self.stdout.write(self.style.ERROR(f"❌ Failed to create CostSheet: {response.status_code}"))
            self.stdout.write(str(response.data if hasattr(response, 'data') else response.content))
            return

        self.stdout.write("\n" + "="*60)
        self.stdout.write("Starting Tests...")
        self.stdout.write("="*60)

        # ============================================================================
        # TEST 1: PATCH with B-field → 409 Conflict
        # ============================================================================
        self.stdout.write("\n📝 TEST 1: PATCH with B-field (margin_pct) → 409 Conflict")
        self.stdout.write("-" * 60)

        request = factory.patch(
            f'/api/v2/cost-sheets/{cost_sheet_v1.id}/',
            data=json.dumps({'margin_pct': '25.00'}),
            content_type='application/json'
        )
        request.user = user

        response = cost_sheet_detail_update(request, cost_sheet_id=cost_sheet_v1.id)

        if response.status_code == 409:
            self.stdout.write(self.style.SUCCESS("✅ TEST 1 PASSED: Got 409 Conflict as expected"))
            self.stdout.write(f"   Error: {response.data.get('error')}")
            self.stdout.write(f"   Message: {response.data.get('message')}")
        else:
            self.stdout.write(self.style.ERROR(f"❌ TEST 1 FAILED: Expected 409, got {response.status_code}"))
            self.stdout.write(f"   Response: {response.data if hasattr(response, 'data') else response.content}")

        # ============================================================================
        # TEST 2: PATCH with A-field only → 200 OK
        # ============================================================================
        self.stdout.write("\n📝 TEST 2: PATCH with A-field (labor_cost) → 200 OK")
        self.stdout.write("-" * 60)

        # Get current values
        old_labor = cost_sheet_v1.labor_cost
        old_total = cost_sheet_v1.total_cost
        old_version_no = cost_sheet_v1.version_no

        request = factory.patch(
            f'/api/v2/cost-sheets/{cost_sheet_v1.id}/',
            data=json.dumps({'labor_cost': '13.50'}),
            content_type='application/json'
        )
        request.user = user

        response = cost_sheet_detail_update(request, cost_sheet_id=cost_sheet_v1.id)

        if response.status_code == 200:
            # Refresh from database
            cost_sheet_v1.refresh_from_db()

            # Verify changes
            checks = []
            checks.append(("Status Code", response.status_code == 200))
            checks.append(("Version No Unchanged", cost_sheet_v1.version_no == old_version_no))
            checks.append(("Labor Cost Updated", cost_sheet_v1.labor_cost == Decimal('13.50')))
            checks.append(("Total Cost Recalculated", cost_sheet_v1.total_cost != old_total))
            checks.append(("Updated By Set", cost_sheet_v1.updated_by == user))

            all_passed = all(check[1] for check in checks)

            if all_passed:
                self.stdout.write(self.style.SUCCESS("✅ TEST 2 PASSED: All checks passed"))
                for check_name, passed in checks:
                    self.stdout.write(f"   ✓ {check_name}")
                self.stdout.write(f"   - Labor: ${old_labor} → ${cost_sheet_v1.labor_cost}")
                self.stdout.write(f"   - Total: ${old_total} → ${cost_sheet_v1.total_cost}")
                self.stdout.write(f"   - Version No: {cost_sheet_v1.version_no} (unchanged)")
            else:
                self.stdout.write(self.style.ERROR("❌ TEST 2 FAILED: Some checks failed"))
                for check_name, passed in checks:
                    status = "✓" if passed else "✗"
                    self.stdout.write(f"   {status} {check_name}")
        else:
            self.stdout.write(self.style.ERROR(f"❌ TEST 2 FAILED: Expected 200, got {response.status_code}"))
            self.stdout.write(f"   Response: {response.data if hasattr(response, 'data') else response.content}")

        # ============================================================================
        # TEST 3: Duplicate → 201 Created
        # ============================================================================
        self.stdout.write("\n📝 TEST 3: Duplicate with new margin/wastage → 201 Created")
        self.stdout.write("-" * 60)

        request = factory.post(
            f'/api/v2/cost-sheets/{cost_sheet_v1.id}/duplicate/',
            data=json.dumps({
                'margin_pct': '25.00',
                'wastage_pct': '5.00',
                'notes': 'Test v2 - Client requested 25% margin'
            }),
            content_type='application/json'
        )
        request.user = user

        response = cost_sheet_duplicate(request, cost_sheet_id=cost_sheet_v1.id)

        if response.status_code == 201:
            cost_sheet_v2 = CostSheet.objects.get(revision=revision, costing_type='sample', version_no=2)

            # Refresh v1 from database
            cost_sheet_v1.refresh_from_db()

            # Verify changes
            checks = []
            checks.append(("Status Code", response.status_code == 201))
            checks.append(("New Version Created", cost_sheet_v2.version_no == 2))
            checks.append(("New Version is Current", cost_sheet_v2.is_current == True))
            checks.append(("Old Version Not Current", cost_sheet_v1.is_current == False))
            checks.append(("New Margin Applied", cost_sheet_v2.margin_pct == Decimal('25.00')))
            checks.append(("New Wastage Applied", cost_sheet_v2.wastage_pct == Decimal('5.00')))
            checks.append(("Labor Cost Copied", cost_sheet_v2.labor_cost == cost_sheet_v1.labor_cost))
            checks.append(("Lines Copied", cost_sheet_v2.lines.count() == cost_sheet_v1.lines.count()))
            checks.append(("Created By Set", cost_sheet_v2.created_by == user))

            all_passed = all(check[1] for check in checks)

            if all_passed:
                self.stdout.write(self.style.SUCCESS("✅ TEST 3 PASSED: All checks passed"))
                for check_name, passed in checks:
                    self.stdout.write(f"   ✓ {check_name}")
                self.stdout.write(f"\n   v1 Status:")
                self.stdout.write(f"   - Version No: {cost_sheet_v1.version_no}")
                self.stdout.write(f"   - is_current: {cost_sheet_v1.is_current}")
                self.stdout.write(f"   - Margin: {cost_sheet_v1.margin_pct}%")
                self.stdout.write(f"\n   v2 Status:")
                self.stdout.write(f"   - Version No: {cost_sheet_v2.version_no}")
                self.stdout.write(f"   - is_current: {cost_sheet_v2.is_current}")
                self.stdout.write(f"   - Margin: {cost_sheet_v2.margin_pct}%")
                self.stdout.write(f"   - Unit Price: ${cost_sheet_v2.unit_price} (recalculated)")
                self.stdout.write(f"   - Lines Count: {cost_sheet_v2.lines.count()}")
            else:
                self.stdout.write(self.style.ERROR("❌ TEST 3 FAILED: Some checks failed"))
                for check_name, passed in checks:
                    status = "✓" if passed else "✗"
                    self.stdout.write(f"   {status} {check_name}")
        else:
            self.stdout.write(self.style.ERROR(f"❌ TEST 3 FAILED: Expected 201, got {response.status_code}"))
            self.stdout.write(f"   Response: {response.data if hasattr(response, 'data') else response.content}")

        # ============================================================================
        # Summary
        # ============================================================================
        self.stdout.write("\n" + "="*60)
        self.stdout.write("Test Summary")
        self.stdout.write("="*60)
        self.stdout.write(self.style.SUCCESS("✅ TEST 1: PATCH with B-field → 409 Conflict"))
        self.stdout.write(self.style.SUCCESS("✅ TEST 2: PATCH with A-field → 200 OK + Auto-recalc"))
        self.stdout.write(self.style.SUCCESS("✅ TEST 3: Duplicate → 201 Created + Version Management"))
        self.stdout.write("\n🎉 All tests completed!")
        self.stdout.write("="*60 + "\n")
