"""
Phase 3: Sample Request State Machine
Centralized transition logic - DO NOT scatter in views/serializers
"""

from dataclasses import dataclass
from typing import Any, Dict, Optional
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError

from ..models import (
    SampleRequest,
    SampleRequestStatus,
    ApprovalStatus,
)


@dataclass
class TransitionResult:
    """Result of a state transition"""
    old_status: str
    new_status: str
    changed_at: Any
    action: str
    meta: Dict[str, Any]


# State transition rules
# Format: {current_status: {action: next_status}}
ALLOWED_TRANSITIONS = {
    SampleRequestStatus.DRAFT: {
        "submit": None,  # Dynamic: depends on need_quote_first
        "cancel": SampleRequestStatus.CANCELLED,
    },
    SampleRequestStatus.QUOTE_REQUESTED: {
        "quote": SampleRequestStatus.QUOTED,
        "cancel": SampleRequestStatus.CANCELLED,
    },
    SampleRequestStatus.QUOTED: {
        "approve": SampleRequestStatus.APPROVED,
        "reject": SampleRequestStatus.REJECTED,
        "cancel": SampleRequestStatus.CANCELLED,
    },
    SampleRequestStatus.APPROVED: {
        "start_execution": SampleRequestStatus.IN_EXECUTION,
        "reject": SampleRequestStatus.REJECTED,
        "cancel": SampleRequestStatus.CANCELLED,
    },
    SampleRequestStatus.IN_EXECUTION: {
        "complete": SampleRequestStatus.COMPLETED,
        "cancel": SampleRequestStatus.CANCELLED,
    },
}


def _validate_transition(sample_request: SampleRequest, action: str) -> str:
    """
    Validate if transition is allowed and return next status

    Raises ValueError if transition is not allowed
    """
    current = sample_request.status
    action = action.lower().strip()

    if current not in ALLOWED_TRANSITIONS:
        raise ValueError(f"Invalid current status: {current}")

    allowed_actions = ALLOWED_TRANSITIONS[current]

    # Special handling for 'submit' action (depends on need_quote_first)
    if action == "submit" and current == SampleRequestStatus.DRAFT:
        if sample_request.need_quote_first:
            return SampleRequestStatus.QUOTE_REQUESTED
        else:
            # Direct to approved if no quote needed
            return SampleRequestStatus.APPROVED

    if action not in allowed_actions:
        raise ValueError(
            f"Transition not allowed: {current} -> {action}. "
            f"Allowed actions: {list(allowed_actions.keys())}"
        )

    next_status = allowed_actions[action]
    if next_status is None:
        raise ValueError(f"Next status not defined for {current} -> {action}")

    return next_status


def _update_approval_status(sample_request: SampleRequest, action: str) -> None:
    """Update approval_status field based on action"""
    if action == "approve":
        sample_request.approval_status = ApprovalStatus.APPROVED
    elif action == "reject":
        sample_request.approval_status = ApprovalStatus.REJECTED
    # For other actions, keep as is (usually NA)


def _validate_prerequisites(sample_request: SampleRequest, action: str, payload: Dict) -> None:
    """
    Validate prerequisites before transition

    Raises ValidationError if prerequisites not met
    """
    # Submit validation
    if action == "submit":
        # Basic validation - can add more as needed
        if not sample_request.revision_id:
            raise ValidationError("revision is required before submission")

        if not sample_request.quantity_requested or sample_request.quantity_requested < 1:
            raise ValidationError("quantity_requested must be at least 1")

    # Quote validation
    if action == "quote":
        # Must have at least one estimate
        if not sample_request.estimates.exists():
            raise ValidationError(
                "Cannot mark as quoted without at least one cost estimate"
            )

    # Approve validation
    if action == "approve":
        # If need_quote_first, must have accepted estimate
        if sample_request.need_quote_first:
            accepted_estimates = sample_request.estimates.filter(status='accepted')
            if not accepted_estimates.exists():
                raise ValidationError(
                    "Cannot approve: need_quote_first is True but no accepted estimate found"
                )

    # Complete validation
    if action == "complete":
        # Must have at least one delivered sample
        delivered_samples = sample_request.samples.filter(status='delivered')
        if not delivered_samples.exists():
            raise ValidationError(
                "Cannot complete: no samples marked as delivered"
            )


@transaction.atomic
def transition_sample_request(
    *,
    sample_request: SampleRequest,
    action: str,
    actor: Optional[Any] = None,
    payload: Optional[Dict[str, Any]] = None,
) -> TransitionResult:
    """
    Single entry point for SampleRequest state transitions

    Args:
        sample_request: The SampleRequest instance to transition
        action: The action to perform (submit, approve, reject, etc.)
        actor: The user performing the action (optional)
        payload: Additional data for the transition (optional)

    Returns:
        TransitionResult with old_status, new_status, and metadata

    Raises:
        ValueError: If transition is not allowed
        ValidationError: If prerequisites are not met

    Phase 2/3 Boundary Rule:
    - This service does NOT modify Phase 2 data (BOM/Measurement/Construction)
    - It only reads confirmed Phase 2 data when creating snapshots
    """
    payload = payload or {}
    old_status = sample_request.status

    # Validate transition is allowed
    next_status = _validate_transition(sample_request, action)

    # Validate prerequisites
    _validate_prerequisites(sample_request, action, payload)

    # Update status
    sample_request.status = next_status
    sample_request.status_updated_at = timezone.now()

    # Update approval_status if needed
    _update_approval_status(sample_request, action)

    # Action-specific side effects
    if action == "reject":
        # Store rejection reason if provided
        reason = payload.get("reason")
        if reason:
            sample_request.notes_internal = (
                f"{sample_request.notes_internal}\n\n"
                f"[REJECTED at {timezone.now()}]: {reason}"
            ).strip()

    if action == "cancel":
        # Store cancellation reason if provided
        reason = payload.get("reason")
        if reason:
            sample_request.notes_internal = (
                f"{sample_request.notes_internal}\n\n"
                f"[CANCELLED at {timezone.now()}]: {reason}"
            ).strip()

    # Save changes
    sample_request.save()

    return TransitionResult(
        old_status=old_status,
        new_status=next_status,
        changed_at=timezone.now(),
        action=action,
        meta={
            "actor": str(actor) if actor else None,
            "payload": payload,
        },
    )


def can_transition(sample_request: SampleRequest, action: str) -> bool:
    """
    Check if a transition is allowed without actually performing it

    Returns:
        True if transition is allowed, False otherwise
    """
    try:
        _validate_transition(sample_request, action)
        return True
    except (ValueError, ValidationError):
        return False


def get_allowed_actions(sample_request: SampleRequest) -> list:
    """
    Get list of allowed actions for current status

    Returns:
        List of action names (strings)
    """
    current = sample_request.status
    if current not in ALLOWED_TRANSITIONS:
        return []

    actions = list(ALLOWED_TRANSITIONS[current].keys())

    # Handle dynamic 'submit' action
    if current == SampleRequestStatus.DRAFT and "submit" in actions:
        # Submit is always allowed from draft
        pass

    return actions
