"""
Styles app tests
"""

from django.test import TestCase
from apps.core.models import Organization, User
from .models import Style, StyleRevision, BOMItem


class StyleModelTest(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Test Org")
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
            organization=self.org
        )

    def test_create_style(self):
        style = Style.objects.create(
            organization=self.org,
            style_number="LW1TEST",
            style_name="Test Cami Tank",
            season="SS25",
            created_by=self.user
        )
        self.assertEqual(style.style_number, "LW1TEST")
        self.assertEqual(style.organization, self.org)

    def test_create_revision(self):
        style = Style.objects.create(
            organization=self.org,
            style_number="LW1TEST",
            style_name="Test Cami Tank"
        )
        revision = StyleRevision.objects.create(
            style=style,
            revision_label="Rev A",
            status="draft"
        )
        self.assertEqual(revision.revision_label, "Rev A")
        self.assertEqual(revision.style, style)

    def test_create_bom_item(self):
        style = Style.objects.create(
            organization=self.org,
            style_number="LW1TEST",
            style_name="Test Cami Tank"
        )
        revision = StyleRevision.objects.create(
            style=style,
            revision_label="Rev A"
        )
        bom_item = BOMItem.objects.create(
            revision=revision,
            item_number=1,
            category="fabric",
            material_name="Nulu Fabric",
            consumption=2.5,
            consumption_maturity="confirmed",
            unit="yards"
        )
        self.assertEqual(bom_item.material_name, "Nulu Fabric")
        self.assertEqual(bom_item.consumption_maturity, "confirmed")
