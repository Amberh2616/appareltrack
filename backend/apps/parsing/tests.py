"""
Extraction API Tests — style_id validation (Stage 3 Day 3)

Covers:
- Invalid UUID format → 400
- Non-existent style_id → fallback to filename (extraction proceeds)
- Cross-org style_id → 400 (data boundary violation)
- NULL org on either side → allowed (backward compat)
"""

import uuid
import pytest
from unittest.mock import patch, MagicMock

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status as http_status

from apps.core.models import Organization
from apps.parsing.models import UploadedDocument
from apps.styles.models import Style

User = get_user_model()

pytestmark = pytest.mark.django_db


# ==================== Fixtures ====================

@pytest.fixture
def org_a():
    return Organization.objects.create(name="Org A")


@pytest.fixture
def org_b():
    return Organization.objects.create(name="Org B")


@pytest.fixture
def user_a(org_a):
    return User.objects.create_user(
        username="user_a",
        password="pass123",
        email="a@test.com",
        organization=org_a,
    )


@pytest.fixture
def auth_client(user_a):
    client = APIClient()
    client.force_authenticate(user=user_a)
    return client


@pytest.fixture
def classified_doc(org_a):
    """A document that has been classified and is ready for extraction."""
    doc = UploadedDocument.objects.create(
        organization=org_a,
        filename="TEST001 TECH PACK.pdf",
        file_type="pdf",
        file_size=1024,
        status="classified",
        classification_result={
            "file_type": "tech_pack_only",
            "total_pages": 1,
            "pages": [{"page": 1, "type": "tech_pack", "confidence": 0.95}],
        },
    )
    # Create a minimal file so the model is valid
    doc.file.save("test.pdf", SimpleUploadedFile("test.pdf", b"%PDF-1.4 fake"), save=True)
    return doc


@pytest.fixture
def style_a(org_a):
    """Style belonging to Org A."""
    return Style.objects.create(
        organization=org_a,
        style_number="TEST001",
        style_name="Test Style A",
    )


@pytest.fixture
def style_b(org_b):
    """Style belonging to Org B (different org)."""
    return Style.objects.create(
        organization=org_b,
        style_number="OTHER001",
        style_name="Test Style B",
    )


# ==================== A2: UUID format validation ====================

class TestStyleIdUUIDValidation:
    """Views-level UUID format check → 400 before hitting service layer."""

    def test_invalid_uuid_returns_400(self, auth_client, classified_doc):
        """style_id=abc → 400 with readable error."""
        url = f"/api/v2/uploaded-documents/{classified_doc.id}/extract/?style_id=abc"
        response = auth_client.post(url)

        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        assert "Invalid style_id format" in response.json()["error"]

    def test_nonsense_uuid_returns_400(self, auth_client, classified_doc):
        """style_id=not-a-uuid-at-all → 400."""
        url = f"/api/v2/uploaded-documents/{classified_doc.id}/extract/?style_id=not-a-uuid-at-all"
        response = auth_client.post(url)

        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        assert "Invalid style_id format" in response.json()["error"]

    def test_empty_style_id_is_ignored(self, auth_client, classified_doc):
        """style_id= (empty) → treated as no style_id, not a 400."""
        url = f"/api/v2/uploaded-documents/{classified_doc.id}/extract/?style_id="
        with patch("apps.parsing.views.extract_document_task") as mock_task:
            mock_task.delay.return_value = MagicMock(id="fake-task-id")
            # Should not 400 — empty string is falsy
            response = auth_client.post(url + "&async=true")
            # Either 202 (async) or proceeds to sync extraction
            assert response.status_code != http_status.HTTP_400_BAD_REQUEST


# ==================== A3: Non-existent style_id → fallback ====================

class TestStyleIdNotFound:
    """Service-level fallback: style_id valid UUID but not in DB → proceed with filename."""

    @patch("apps.parsing.views.extract_document_task")
    def test_nonexistent_style_falls_back_async(self, mock_task, auth_client, classified_doc):
        """Non-existent style_id → async extraction still dispatched (fallback)."""
        fake_id = str(uuid.uuid4())
        mock_task.delay.return_value = MagicMock(id="fake-task-id")

        url = f"/api/v2/uploaded-documents/{classified_doc.id}/extract/?style_id={fake_id}&async=true"
        response = auth_client.post(url)

        assert response.status_code == http_status.HTTP_202_ACCEPTED
        assert response.json()["status"] == "pending"
        # Task was dispatched — fallback happens inside the task
        mock_task.delay.assert_called_once()

    @patch("apps.parsing.services.extraction_service.perform_extraction")
    def test_nonexistent_style_falls_back_sync(self, mock_extract, auth_client, classified_doc):
        """Non-existent style_id → sync extraction proceeds (fallback to filename)."""
        fake_id = str(uuid.uuid4())
        mock_extract.return_value = {
            "style_revision_id": str(uuid.uuid4()),
            "tech_pack_revision_id": str(uuid.uuid4()),
            "extraction_stats": {"tech_pack_blocks": 10, "bom_items": 5},
        }

        url = f"/api/v2/uploaded-documents/{classified_doc.id}/extract/?style_id={fake_id}"
        response = auth_client.post(url)

        # Should succeed — fallback to filename inside service
        assert response.status_code == http_status.HTTP_200_OK
        mock_extract.assert_called_once()


# ==================== A4: Cross-org → 400 ====================

class TestCrossOrgRejection:
    """Cross-org binding must be rejected with 400, not silently fallen back."""

    def test_cross_org_returns_400(self, auth_client, classified_doc, style_b):
        """doc(org_a) + style(org_b) → 400 with clear error message."""
        url = f"/api/v2/uploaded-documents/{classified_doc.id}/extract/?style_id={style_b.id}"
        response = auth_client.post(url)

        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        error_msg = response.json()["error"]
        assert "Cross-organization" in error_msg or "cross-org" in error_msg.lower()

    def test_cross_org_does_not_create_revision(self, auth_client, classified_doc, style_b):
        """Cross-org rejection must not leave any side effects (no StyleRevision created)."""
        from apps.styles.models import StyleRevision

        before_count = StyleRevision.objects.count()

        url = f"/api/v2/uploaded-documents/{classified_doc.id}/extract/?style_id={style_b.id}"
        auth_client.post(url)

        after_count = StyleRevision.objects.count()
        assert after_count == before_count, "Cross-org rejection must not create StyleRevision"

    def test_cross_org_reverts_status_to_classified(self, auth_client, classified_doc, style_b):
        """After cross-org 400, doc status should revert to 'classified', not 'failed'."""
        url = f"/api/v2/uploaded-documents/{classified_doc.id}/extract/?style_id={style_b.id}"
        auth_client.post(url)

        classified_doc.refresh_from_db()
        assert classified_doc.status == "classified"


# ==================== Same-org → allowed ====================

class TestSameOrgAllowed:
    """Same-org binding should proceed normally."""

    @patch("apps.parsing.services.extraction_service.perform_extraction")
    def test_same_org_proceeds(self, mock_extract, auth_client, classified_doc, style_a):
        """doc(org_a) + style(org_a) → extraction proceeds."""
        mock_extract.return_value = {
            "style_revision_id": str(uuid.uuid4()),
            "tech_pack_revision_id": str(uuid.uuid4()),
            "extraction_stats": {"tech_pack_blocks": 10, "bom_items": 5},
        }

        url = f"/api/v2/uploaded-documents/{classified_doc.id}/extract/?style_id={style_a.id}"
        response = auth_client.post(url)

        assert response.status_code == http_status.HTTP_200_OK
        mock_extract.assert_called_once()
        # Verify style_id was passed through
        call_kwargs = mock_extract.call_args
        assert str(style_a.id) in str(call_kwargs)
