"""
Core app tests
"""

from django.test import TestCase
from .models import Organization, User


class OrganizationModelTest(TestCase):
    def test_create_organization(self):
        org = Organization.objects.create(
            name="Test Company",
            ai_budget_monthly=300.00
        )
        self.assertEqual(org.name, "Test Company")
        self.assertEqual(org.ai_budget_monthly, 300.00)


class UserModelTest(TestCase):
    def test_create_user(self):
        org = Organization.objects.create(name="Test Org")
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123",
            organization=org,
            role="merchandiser"
        )
        self.assertEqual(user.username, "testuser")
        self.assertEqual(user.organization, org)
        self.assertEqual(user.role, "merchandiser")
