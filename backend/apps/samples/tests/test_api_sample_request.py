"""
Phase 3: Sample Request System - MVP API Tests
Day 3 - Boundary Protection Tests
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status as http_status

from apps.styles.models import Style, StyleRevision
from apps.core.models import Organization
from apps.samples.models import (
    SampleRequest,
    SampleRequestStatus,
    SampleCostEstimate,
    Sample,
)

User = get_user_model()

pytestmark = pytest.mark.django_db


# ==================== Fixtures ====================

@pytest.fixture
def organization():
    """Create test organization"""
    return Organization.objects.create(
        name="Test Org"
    )


@pytest.fixture
def user(organization):
    """Create test user"""
    return User.objects.create_user(
        username="testuser",
        password="testpass123",
        email="test@example.com",
        organization=organization
    )


@pytest.fixture
def auth_client(user):
    """Create authenticated API client"""
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def style(organization):
    """Create test style"""
    return Style.objects.create(
        organization=organization,
        style_number="TEST001",
        style_name="Test Style"
    )


@pytest.fixture
def revision(style):
    """Create test revision"""
    return StyleRevision.objects.create(
        style=style,
        revision_label="A"
    )


# ==================== Test Cases ====================

def test_create_sample_request_ok(auth_client, revision):
    """
    Test 1: SampleRequest creation succeeds with valid data
    """
    payload = {
        "revision": str(revision.id),
        "brand_name": "Test Brand",
        "request_type": "proto",
        "quantity_requested": 2,
        "need_quote_first": False,
        "priority": "normal",
        "purpose": "Testing proto sample",
    }

    response = auth_client.post("/api/v2/sample-requests/", payload, format="json")

    assert response.status_code in (http_status.HTTP_200_OK, http_status.HTTP_201_CREATED), \
        f"Expected 200/201, got {response.status_code}: {response.content}"

    data = response.json()
    assert data["brand_name"] == "Test Brand"
    assert data["status"] == SampleRequestStatus.DRAFT


def test_submit_transition_ok(auth_client, revision):
    """
    Test 2: Submit transition succeeds for draft request (without quote)
    """
    sr = SampleRequest.objects.create(
        revision=revision,
        brand_name="Test Brand",
        request_type="proto",
        quantity_requested=2,
        need_quote_first=False,
        status=SampleRequestStatus.DRAFT,
    )

    response = auth_client.post(
        f"/api/v2/sample-requests/{sr.id}/submit/",
        {},
        format="json"
    )

    assert response.status_code == http_status.HTTP_200_OK, response.content

    data = response.json()
    assert data["transition"]["old_status"] == "draft"
    assert data["transition"]["new_status"] == "approved"  # Direct approval (no quote needed)

    sr.refresh_from_db()
    assert sr.status == SampleRequestStatus.APPROVED


def test_submit_forbidden_after_submission(auth_client, revision):
    """
    Test 3: Prohibit modifying sensitive fields after submission
    Phase 2/3 boundary rule enforcement
    """
    sr = SampleRequest.objects.create(
        revision=revision,
        brand_name="Original Brand",
        request_type="proto",
        quantity_requested=2,
        need_quote_first=False,
        status=SampleRequestStatus.DRAFT,
    )

    # Submit first
    auth_client.post(f"/api/v2/sample-requests/{sr.id}/submit/", {}, format="json")
    sr.refresh_from_db()

    # Try to modify forbidden fields
    payload = {
        "brand_name": "Changed Brand",  # Should be forbidden
        "quantity_requested": 5,  # Should be forbidden
        "notes_internal": "This should be allowed",  # Should be allowed
    }

    response = auth_client.patch(
        f"/api/v2/sample-requests/{sr.id}/",
        payload,
        format="json"
    )

    assert response.status_code == http_status.HTTP_400_BAD_REQUEST, \
        "Expected 400 when modifying forbidden fields after submission"

    error_data = response.json()
    assert "brand_name" in error_data or "quantity_requested" in error_data, \
        "Expected validation errors for forbidden fields"


def test_quote_requires_estimate(auth_client, revision):
    """
    Test 4: Cannot mark as quoted without at least one estimate
    Business rule enforcement
    """
    sr = SampleRequest.objects.create(
        revision=revision,
        brand_name="Test Brand",
        request_type="proto",
        quantity_requested=2,
        need_quote_first=True,
        status=SampleRequestStatus.QUOTE_REQUESTED,  # Already in quote_requested
    )

    # Try to transition to quoted without any estimate
    response = auth_client.post(
        f"/api/v2/sample-requests/{sr.id}/quote/",
        {},
        format="json"
    )

    assert response.status_code == http_status.HTTP_400_BAD_REQUEST, \
        "Expected 400 when quoting without estimate"

    error_data = response.json()
    assert "estimate" in error_data["detail"].lower(), \
        "Error message should mention estimate requirement"


def test_attachment_creation_ok(auth_client, revision):
    """
    Test 5: Attachment creation succeeds and links to SampleRequest
    """
    sr = SampleRequest.objects.create(
        revision=revision,
        brand_name="Test Brand",
        request_type="proto",
        quantity_requested=2,
        status=SampleRequestStatus.DRAFT,
    )

    payload = {
        "sample_request": str(sr.id),
        "file_type": "photo",
        "file_url": "https://example.com/photo.jpg",
        "caption": "Proto sample front view",
    }

    response = auth_client.post(
        "/api/v2/sample-attachments/",
        payload,
        format="json"
    )

    assert response.status_code in (http_status.HTTP_200_OK, http_status.HTTP_201_CREATED), \
        f"Expected 200/201, got {response.status_code}: {response.content}"

    data = response.json()
    assert data["sample_request"] == str(sr.id)
    assert data["file_type"] == "photo"


def test_phase23_boundary_no_bom_fk(revision):
    """
    Test 6: Phase 2/3 boundary - Verify no FK to BOMItem exists
    Critical architectural constraint
    """
    # This test verifies the model design
    # T2POLineForSample should NOT have a FK to BOMItem

    from apps.samples.models import T2POLineForSample
    import inspect

    # Get all fields
    fields = T2POLineForSample._meta.get_fields()
    foreign_keys = [f for f in fields if f.get_internal_type() == 'ForeignKey']

    # Check no FK points to BOMItem
    for fk in foreign_keys:
        related_model_name = fk.related_model.__name__
        assert related_model_name != "BOMItem", \
            f"CRITICAL: T2POLineForSample has FK to BOMItem - violates Phase 2/3 boundary!"

    # T2POLineForSample should only have FK to T2POForSample
    fk_names = [f.related_model.__name__ for f in foreign_keys]
    assert "T2POForSample" in fk_names, "T2POLineForSample should have FK to T2POForSample"
    assert len(fk_names) == 1, f"Expected only 1 FK (to T2POForSample), found: {fk_names}"


def test_approve_requires_accepted_estimate_when_quote_needed(auth_client, revision):
    """
    Test 7: Cannot approve without accepted estimate when need_quote_first=True
    Business rule enforcement
    """
    sr = SampleRequest.objects.create(
        revision=revision,
        brand_name="Test Brand",
        request_type="proto",
        quantity_requested=2,
        need_quote_first=True,
        status=SampleRequestStatus.QUOTED,
    )

    # Create estimate but don't mark as accepted
    SampleCostEstimate.objects.create(
        sample_request=sr,
        estimate_version=1,
        status="draft",  # Not accepted!
        estimated_total=100.00,
    )

    # Try to approve
    response = auth_client.post(
        f"/api/v2/sample-requests/{sr.id}/approve/",
        {},
        format="json"
    )

    assert response.status_code == http_status.HTTP_400_BAD_REQUEST, \
        "Expected 400 when approving without accepted estimate"

    error_data = response.json()
    assert "accepted estimate" in error_data["detail"].lower(), \
        "Error message should mention accepted estimate requirement"


def test_complete_requires_delivered_sample(auth_client, revision):
    """
    Test 8: Cannot complete without at least one delivered sample
    Business rule enforcement
    """
    sr = SampleRequest.objects.create(
        revision=revision,
        brand_name="Test Brand",
        request_type="proto",
        quantity_requested=2,
        need_quote_first=False,
        status=SampleRequestStatus.IN_EXECUTION,
    )

    # Try to complete without any delivered samples
    response = auth_client.post(
        f"/api/v2/sample-requests/{sr.id}/complete/",
        {},
        format="json"
    )

    assert response.status_code == http_status.HTTP_400_BAD_REQUEST, \
        "Expected 400 when completing without delivered samples"

    error_data = response.json()
    assert "delivered" in error_data["detail"].lower(), \
        "Error message should mention delivered sample requirement"


def test_allowed_actions_endpoint(auth_client, revision):
    """
    Test 9: Allowed actions endpoint returns correct actions
    """
    sr = SampleRequest.objects.create(
        revision=revision,
        brand_name="Test Brand",
        request_type="proto",
        quantity_requested=2,
        need_quote_first=False,
        status=SampleRequestStatus.DRAFT,
    )

    response = auth_client.get(
        f"/api/v2/sample-requests/{sr.id}/allowed-actions/",
        format="json"
    )

    assert response.status_code == http_status.HTTP_200_OK, response.content

    data = response.json()
    assert data["current_status"] == "draft"
    assert "submit" in data["allowed_actions"]
    assert data["can_submit"] is True
