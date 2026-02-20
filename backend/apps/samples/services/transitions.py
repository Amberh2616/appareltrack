from dataclasses import dataclass
from datetime import datetime
from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.samples.models import SampleRequestStatus, SampleCostEstimate, Sample


@dataclass
class TransitionResult:
    old_status: str
    new_status: str
    action: str
    changed_at: datetime
    meta: dict


def _has_accepted_estimate(sample_request) -> bool:
    return SampleCostEstimate.objects.filter(
        sample_request=sample_request,
        status__iexact='accepted',
    ).exists()


def _has_delivered_sample(sample_request) -> bool:
    return Sample.objects.filter(
        sample_request=sample_request,
        status__iexact='delivered',
    ).exists()


def transition_sample_request(sample_request, action: str, actor=None, payload=None) -> TransitionResult:
    """
    Minimal state machine to satisfy legacy submit/quote/approve/complete flows.
    """
    payload = payload or {}
    old_status = sample_request.status
    meta = {}

    if action == 'submit':
        if old_status != SampleRequestStatus.DRAFT:
            raise ValidationError("Only draft requests can be submitted")
        new_status = SampleRequestStatus.QUOTE_REQUESTED if sample_request.need_quote_first else SampleRequestStatus.APPROVED
    elif action == 'quote':
        if old_status != SampleRequestStatus.QUOTE_REQUESTED:
            raise ValidationError("Current status must be quote_requested to quote")
        if not _has_accepted_estimate(sample_request):
            raise ValidationError("An accepted estimate is required before marking as quoted")
        new_status = SampleRequestStatus.QUOTED
    elif action == 'approve':
        if old_status not in [SampleRequestStatus.QUOTED, SampleRequestStatus.DRAFT, SampleRequestStatus.QUOTE_REQUESTED]:
            raise ValidationError("Only draft/quote_requested/quoted requests can be approved")
        if sample_request.need_quote_first and not _has_accepted_estimate(sample_request):
            raise ValidationError("An accepted estimate is required before approval")
        new_status = SampleRequestStatus.APPROVED
    elif action == 'start_execution':
        if old_status != SampleRequestStatus.APPROVED:
            raise ValidationError("Must be approved before start_execution")
        new_status = SampleRequestStatus.IN_EXECUTION
    elif action == 'complete':
        if old_status != SampleRequestStatus.IN_EXECUTION:
            raise ValidationError("Must be in_execution to complete")
        if not _has_delivered_sample(sample_request):
            raise ValidationError("At least one delivered sample is required before completion")
        new_status = SampleRequestStatus.COMPLETED
    elif action == 'reject':
        new_status = SampleRequestStatus.REJECTED
    elif action == 'cancel':
        new_status = SampleRequestStatus.CANCELLED
    else:
        raise ValueError(f"Unsupported action: {action}")

    sample_request.status = new_status
    sample_request.status_updated_at = timezone.now()
    sample_request.save(update_fields=['status', 'status_updated_at'])

    return TransitionResult(
        old_status=old_status,
        new_status=new_status,
        action=action,
        changed_at=sample_request.status_updated_at,
        meta=meta,
    )


def get_allowed_actions(sample_request):
    """Return simple allowed actions based on current status."""
    status = sample_request.status
    actions = []
    if status == SampleRequestStatus.DRAFT:
        actions.append('submit')
    if status == SampleRequestStatus.QUOTE_REQUESTED:
        actions.append('quote')
    if status in [SampleRequestStatus.DRAFT, SampleRequestStatus.QUOTE_REQUESTED, SampleRequestStatus.QUOTED]:
        actions.append('approve')
    if status == SampleRequestStatus.APPROVED:
        actions.append('start_execution')
    if status == SampleRequestStatus.IN_EXECUTION:
        actions.append('complete')
    actions.append('cancel')
    return actions


def can_transition(sample_request, action: str) -> bool:
    return action in get_allowed_actions(sample_request)
