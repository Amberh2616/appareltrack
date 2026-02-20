"""
Phase 3 Refactor: SampleRun State Machine
狀態轉換邏輯（樣衣先做 → 回填實際用量/工時 → 才報價）
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Dict, Any
from django.core.exceptions import ValidationError
from django.utils import timezone

from ..models import SampleRun, SampleRunStatus, SampleRunTransitionLog


@dataclass
class TransitionResult:
    """Transition result data class"""
    old_status: str
    new_status: str
    action: str
    changed_at: datetime
    meta: Dict[str, Any]


# ==================== State Transition Map ====================

STATE_TRANSITIONS = {
    # draft → materials_planning
    SampleRunStatus.DRAFT: {
        'start_materials_planning': SampleRunStatus.MATERIALS_PLANNING,
    },

    # materials_planning → po_drafted
    SampleRunStatus.MATERIALS_PLANNING: {
        'generate_t2po': SampleRunStatus.PO_DRAFTED,
    },

    # po_drafted → po_issued
    SampleRunStatus.PO_DRAFTED: {
        'issue_t2po': SampleRunStatus.PO_ISSUED,
    },

    # po_issued → mwo_drafted
    SampleRunStatus.PO_ISSUED: {
        'generate_mwo': SampleRunStatus.MWO_DRAFTED,
    },

    # mwo_drafted → mwo_issued
    SampleRunStatus.MWO_DRAFTED: {
        'issue_mwo': SampleRunStatus.MWO_ISSUED,
    },

    # mwo_issued → in_progress
    SampleRunStatus.MWO_ISSUED: {
        'start_production': SampleRunStatus.IN_PROGRESS,
    },

    # in_progress → sample_done
    SampleRunStatus.IN_PROGRESS: {
        'mark_sample_done': SampleRunStatus.SAMPLE_DONE,
    },

    # sample_done → actuals_recorded
    SampleRunStatus.SAMPLE_DONE: {
        'record_actuals': SampleRunStatus.ACTUALS_RECORDED,
    },

    # actuals_recorded → costing_generated
    SampleRunStatus.ACTUALS_RECORDED: {
        'generate_sample_costing': SampleRunStatus.COSTING_GENERATED,
    },

    # costing_generated → quoted
    SampleRunStatus.COSTING_GENERATED: {
        'mark_quoted': SampleRunStatus.QUOTED,
    },

    # quoted → accepted / revise_needed
    SampleRunStatus.QUOTED: {
        'mark_accepted': SampleRunStatus.ACCEPTED,
        'mark_revise_needed': SampleRunStatus.REVISE_NEEDED,
    },
}

# Cancel is allowed from any state
CANCEL_ALLOWED_FROM = [
    SampleRunStatus.DRAFT,
    SampleRunStatus.MATERIALS_PLANNING,
    SampleRunStatus.PO_DRAFTED,
    SampleRunStatus.PO_ISSUED,
    SampleRunStatus.MWO_DRAFTED,
    SampleRunStatus.MWO_ISSUED,
    SampleRunStatus.IN_PROGRESS,
    SampleRunStatus.SAMPLE_DONE,
    SampleRunStatus.ACTUALS_RECORDED,
    SampleRunStatus.COSTING_GENERATED,
    SampleRunStatus.QUOTED,
]


# ==================== Prerequisite Validators ====================

def validate_materials_planning(run: SampleRun) -> None:
    """Prerequisite: materials_planning → po_drafted"""
    if not run.guidance_usage:
        raise ValidationError("guidance_usage must exist before generating T2PO")

    if not run.guidance_usage.usage_lines.exists():
        raise ValidationError("guidance_usage must have usage lines")


def validate_po_drafted(run: SampleRun) -> None:
    """Prerequisite: po_drafted → po_issued"""
    latest_po = run.t2pos.filter(is_latest=True).first()
    if not latest_po:
        raise ValidationError("No T2PO found")

    if latest_po.status != 'draft':
        raise ValidationError(f"Latest T2PO must be 'draft' to issue, got '{latest_po.status}'")


def validate_po_issued(run: SampleRun) -> None:
    """Prerequisite: po_issued → mwo_drafted"""
    latest_mwo = run.mwos.filter(is_latest=True).first()
    if not latest_mwo:
        raise ValidationError("MWO must be generated before transition")


def validate_mwo_drafted(run: SampleRun) -> None:
    """Prerequisite: mwo_drafted → mwo_issued"""
    latest_mwo = run.mwos.filter(is_latest=True).first()
    if not latest_mwo:
        raise ValidationError("No MWO found")

    if latest_mwo.status != 'draft':
        raise ValidationError(f"Latest MWO must be 'draft' to issue, got '{latest_mwo.status}'")


def validate_sample_done(run: SampleRun) -> None:
    """Prerequisite: sample_done → actuals_recorded"""
    if not hasattr(run, 'actuals'):
        raise ValidationError("SampleActuals must exist")

    # actual_usage will be created by ensure_actual_usage side effect
    # Just ensure we have guidance_usage to copy from
    if not run.guidance_usage:
        raise ValidationError("guidance_usage must exist to create actual_usage")


def validate_actuals_recorded(run: SampleRun) -> None:
    """Prerequisite: actuals_recorded → costing_generated"""
    # costing_version will be created by generate_sample_costing_from_actuals side effect
    # Check that we have the data needed to generate costing
    if not run.actual_usage:
        raise ValidationError("actual_usage must exist")

    if not run.actual_usage.usage_lines.exists():
        raise ValidationError("actual_usage must have usage lines")

    if not hasattr(run, 'actuals'):
        raise ValidationError("SampleActuals must exist with cost data")


# Map prerequisites to transitions
PREREQUISITES = {
    'generate_t2po': validate_materials_planning,
    'issue_t2po': validate_po_drafted,
    'generate_mwo': validate_po_issued,
    'issue_mwo': validate_mwo_drafted,
    'record_actuals': validate_sample_done,
    'generate_sample_costing': validate_actuals_recorded,
}


# ==================== Action Handlers (Side Effects) ====================

def execute_action_side_effects(run: SampleRun, action: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute side effects for specific actions (generate resources, update related objects)

    這些函數會實際呼叫 snapshot_services 中的函數來生成資源

    Returns:
        Dict with metadata about what was created/updated
    """
    # Import here to avoid circular dependency
    from . import snapshot_services

    meta = {}

    if action == 'start_materials_planning':
        # Ensure guidance usage exists
        scenario = snapshot_services.ensure_guidance_usage(str(run.id))
        meta['guidance_usage_id'] = str(scenario.id)
        meta['guidance_usage_lines_count'] = scenario.usage_lines.count()

    elif action == 'generate_t2po':
        # Generate T2PO from guidance usage
        t2po = snapshot_services.generate_t2po_from_guidance(str(run.id))
        meta['t2po_id'] = str(t2po.id)
        meta['t2po_version'] = t2po.version_no
        meta['t2po_lines_count'] = t2po.lines.count()

    elif action == 'issue_t2po':
        # Update latest T2PO status to 'issued'
        latest_po = run.t2pos.filter(is_latest=True).first()
        if latest_po and latest_po.status == 'draft':
            latest_po.status = 'issued'
            latest_po.issued_at = timezone.now()
            latest_po.save(update_fields=['status', 'issued_at'])
            meta['t2po_issued_id'] = str(latest_po.id)

    elif action == 'generate_mwo':
        # Generate MWO snapshot
        mwo = snapshot_services.generate_mwo_snapshot(str(run.id))
        meta['mwo_id'] = str(mwo.id)
        meta['mwo_version'] = mwo.version_no
        meta['bom_snapshot_count'] = len(mwo.bom_snapshot_json)
        meta['construction_snapshot_count'] = len(mwo.construction_snapshot_json)

    elif action == 'issue_mwo':
        # Update latest MWO status to 'issued'
        latest_mwo = run.mwos.filter(is_latest=True).first()
        if latest_mwo and latest_mwo.status == 'draft':
            latest_mwo.status = 'issued'
            latest_mwo.save(update_fields=['status'])
            meta['mwo_issued_id'] = str(latest_mwo.id)

    elif action == 'record_actuals':
        # Ensure actual usage exists (copied from guidance)
        actual_scenario = snapshot_services.ensure_actual_usage(str(run.id))
        meta['actual_usage_id'] = str(actual_scenario.id)
        meta['actual_usage_lines_count'] = actual_scenario.usage_lines.count()

    elif action == 'generate_sample_costing':
        # Generate costing from actuals
        costing = snapshot_services.generate_sample_costing_from_actuals(str(run.id))
        meta['costing_version_id'] = str(costing.id)
        meta['costing_version_no'] = costing.version_no
        meta['unit_price'] = str(costing.unit_price)

    return meta


# ==================== Core Transition Functions ====================

def can_transition(run: SampleRun, action: str) -> bool:
    """
    Check if a transition is allowed from current status

    Args:
        run: SampleRun instance
        action: Action name (e.g., 'start_materials_planning')

    Returns:
        bool: True if transition is allowed
    """
    if action == 'cancel':
        return run.status in CANCEL_ALLOWED_FROM

    allowed_actions = STATE_TRANSITIONS.get(run.status, {})
    return action in allowed_actions


def get_allowed_actions(run: SampleRun) -> list[str]:
    """
    Get list of allowed actions for current status

    Args:
        run: SampleRun instance

    Returns:
        List of action names
    """
    actions = list(STATE_TRANSITIONS.get(run.status, {}).keys())

    # Cancel is always allowed (except if already cancelled/completed)
    if run.status in CANCEL_ALLOWED_FROM:
        actions.append('cancel')

    return actions


def transition_sample_run(
    sample_run: SampleRun,
    action: str,
    actor: Optional[Any] = None,
    payload: Optional[Dict[str, Any]] = None,
) -> TransitionResult:
    """
    Execute a state transition

    Args:
        sample_run: SampleRun instance
        action: Action name
        actor: User performing the action
        payload: Additional data (reason, notes, etc.)

    Returns:
        TransitionResult

    Raises:
        ValidationError: If transition is not allowed or prerequisites not met
    """
    if payload is None:
        payload = {}

    old_status = sample_run.status

    # Handle cancel action
    if action == 'cancel':
        if old_status not in CANCEL_ALLOWED_FROM:
            raise ValidationError(
                f"Cannot cancel from status '{old_status}'"
            )
        new_status = SampleRunStatus.CANCELLED
        action_meta = {}  # No side effects for cancel
    else:
        # Check if transition is allowed
        if not can_transition(sample_run, action):
            allowed = get_allowed_actions(sample_run)
            raise ValidationError(
                f"Action '{action}' not allowed from status '{old_status}'. "
                f"Allowed actions: {allowed}"
            )

        # Check prerequisites
        validator = PREREQUISITES.get(action)
        if validator:
            validator(sample_run)

        # Get new status
        new_status = STATE_TRANSITIONS[old_status][action]

        # Execute action side effects (generate resources, etc.)
        action_meta = execute_action_side_effects(sample_run, action, payload)

    # Execute transition
    now = timezone.now()
    sample_run.status = new_status
    sample_run.status_updated_at = now

    # TRACK-PROGRESS: 更新 status_timestamps
    timestamps = sample_run.status_timestamps or {}
    timestamps[new_status] = now.isoformat()
    sample_run.status_timestamps = timestamps

    # Append notes if provided
    if payload.get('notes'):
        notes_entry = f"\n[{now.isoformat()}] {action}: {payload['notes']}"
        sample_run.notes = (sample_run.notes or '') + notes_entry

    sample_run.save(update_fields=['status', 'status_updated_at', 'status_timestamps', 'notes'])

    # TRACK-PROGRESS: 寫入操作歷史
    SampleRunTransitionLog.objects.create(
        sample_run=sample_run,
        from_status=old_status,
        to_status=new_status,
        action=action,
        actor=actor if actor and hasattr(actor, 'pk') else None,
        note=payload.get('notes', '') or payload.get('reason', ''),
    )

    return TransitionResult(
        old_status=old_status,
        new_status=new_status,
        action=action,
        changed_at=now,
        meta={
            'actor': str(actor) if actor else None,
            'reason': payload.get('reason', ''),
            **action_meta,  # Include metadata from action side effects
        }
    )


# ==================== P1: Batch Transition ====================

@dataclass
class BatchTransitionResult:
    """Result of batch transition operation"""
    total: int
    succeeded: int
    failed: int
    results: list  # List of individual results
    errors: list   # List of error details


def batch_transition_sample_runs(
    run_ids: list[str],
    action: str,
    actor: Optional[Any] = None,
    payload: Optional[Dict[str, Any]] = None,
    organization=None,
) -> BatchTransitionResult:
    """
    Execute state transition on multiple SampleRuns.

    Args:
        run_ids: List of SampleRun UUIDs
        action: Action name (e.g., 'start_materials_planning')
        actor: User performing the action
        payload: Additional data (reason, notes, etc.)
        organization: Organization for tenant filtering (SaaS)

    Returns:
        BatchTransitionResult with success/failure details

    Notes:
        - Processes each run independently (partial success allowed)
        - All runs must be in the same status for consistency
        - Returns detailed results for each run
    """
    if payload is None:
        payload = {}

    results = []
    errors = []
    succeeded = 0
    failed = 0

    # Fetch all runs with tenant filter
    queryset = SampleRun.objects.filter(id__in=run_ids)
    if organization is not None:
        queryset = queryset.filter(organization=organization)

    runs = list(queryset)

    # Check if all runs were found
    found_ids = {str(run.id) for run in runs}
    missing_ids = set(run_ids) - found_ids
    for missing_id in missing_ids:
        failed += 1
        errors.append({
            'run_id': missing_id,
            'error': 'Run not found or access denied',
        })

    # Validate: all runs should be in the same status for batch operation
    if runs:
        statuses = set(run.status for run in runs)
        if len(statuses) > 1:
            return BatchTransitionResult(
                total=len(run_ids),
                succeeded=0,
                failed=len(run_ids),
                results=[],
                errors=[{
                    'error': f'All runs must be in the same status for batch operation. Found: {list(statuses)}'
                }],
            )

    # Process each run
    for run in runs:
        try:
            result = transition_sample_run(
                sample_run=run,
                action=action,
                actor=actor,
                payload=payload,
            )
            succeeded += 1
            results.append({
                'run_id': str(run.id),
                'old_status': result.old_status,
                'new_status': result.new_status,
                'action': result.action,
                'success': True,
            })
        except (ValidationError, ValueError) as e:
            failed += 1
            errors.append({
                'run_id': str(run.id),
                'error': str(e),
            })
            results.append({
                'run_id': str(run.id),
                'success': False,
                'error': str(e),
            })

    return BatchTransitionResult(
        total=len(run_ids),
        succeeded=succeeded,
        failed=failed,
        results=results,
        errors=errors,
    )


# ==================== P2: Smart Batch Transition (Mixed Status) ====================

def get_default_action_for_status(status: str) -> Optional[str]:
    """獲取狀態的預設下一步動作"""
    transitions = STATE_TRANSITIONS.get(status, {})
    if transitions:
        # 取第一個可用動作（通常只有一個）
        return list(transitions.keys())[0]
    return None


def batch_transition_smart(
    run_ids: list[str],
    organization=None,
    actor: Optional[Any] = None,
) -> BatchTransitionResult:
    """
    智能批量轉換：自動按狀態分組，每組執行對應的下一步動作。

    與 batch_transition_sample_runs 的區別：
    - 不要求所有 Run 在同一狀態
    - 自動推斷每個狀態的下一步動作
    - 適合批量處理混合狀態的卡片

    Args:
        run_ids: List of SampleRun UUIDs
        organization: Organization for tenant filtering (SaaS)
        actor: User performing the action

    Returns:
        BatchTransitionResult with grouped results
    """
    from collections import defaultdict

    results = []
    errors = []
    succeeded = 0
    failed = 0

    # Fetch all runs with tenant filter
    queryset = SampleRun.objects.filter(id__in=run_ids)
    if organization is not None:
        queryset = queryset.filter(organization=organization)

    runs = list(queryset)

    # Check missing runs
    found_ids = {str(run.id) for run in runs}
    missing_ids = set(run_ids) - found_ids
    for missing_id in missing_ids:
        failed += 1
        errors.append({
            'run_id': missing_id,
            'error': 'Run not found or access denied',
        })

    # Group runs by status
    grouped: Dict[str, list] = defaultdict(list)
    for run in runs:
        grouped[run.status].append(run)

    # Process each status group
    for status, status_runs in grouped.items():
        action = get_default_action_for_status(status)

        if not action:
            # 終態，無法轉換
            for run in status_runs:
                failed += 1
                error_msg = f'No available action for status "{status}" (terminal state)'
                errors.append({
                    'run_id': str(run.id),
                    'status': status,
                    'error': error_msg,
                })
                results.append({
                    'run_id': str(run.id),
                    'status': status,
                    'action': None,
                    'success': False,
                    'error': error_msg,
                })
            continue

        # 執行該組的轉換
        for run in status_runs:
            try:
                result = transition_sample_run(
                    sample_run=run,
                    action=action,
                    actor=actor,
                    payload={},
                )
                succeeded += 1
                results.append({
                    'run_id': str(run.id),
                    'old_status': result.old_status,
                    'new_status': result.new_status,
                    'action': result.action,
                    'success': True,
                })
            except (ValidationError, ValueError) as e:
                failed += 1
                errors.append({
                    'run_id': str(run.id),
                    'status': status,
                    'action': action,
                    'error': str(e),
                })
                results.append({
                    'run_id': str(run.id),
                    'status': status,
                    'action': action,
                    'success': False,
                    'error': str(e),
                })

    return BatchTransitionResult(
        total=len(run_ids),
        succeeded=succeeded,
        failed=failed,
        results=results,
        errors=errors,
    )


# ==================== P3: Status Rollback ====================

# 回退允許的狀態映射（目標狀態列表）
ROLLBACK_TRANSITIONS = {
    # materials_planning 可以退回 draft
    SampleRunStatus.MATERIALS_PLANNING: [SampleRunStatus.DRAFT],

    # po_drafted 可以退回 materials_planning
    SampleRunStatus.PO_DRAFTED: [SampleRunStatus.MATERIALS_PLANNING],

    # po_issued 可以退回 po_drafted（取消發出）
    SampleRunStatus.PO_ISSUED: [SampleRunStatus.PO_DRAFTED],

    # mwo_drafted 可以退回 po_issued
    SampleRunStatus.MWO_DRAFTED: [SampleRunStatus.PO_ISSUED],

    # mwo_issued 可以退回 mwo_drafted（取消發出）
    SampleRunStatus.MWO_ISSUED: [SampleRunStatus.MWO_DRAFTED],

    # in_progress 可以退回 mwo_issued（尚未完成樣衣）
    SampleRunStatus.IN_PROGRESS: [SampleRunStatus.MWO_ISSUED],

    # sample_done 可以退回 in_progress（樣衣需重做）
    SampleRunStatus.SAMPLE_DONE: [SampleRunStatus.IN_PROGRESS],

    # actuals_recorded 可以退回 sample_done（重新記錄實際值）
    SampleRunStatus.ACTUALS_RECORDED: [SampleRunStatus.SAMPLE_DONE],

    # costing_generated 可以退回 actuals_recorded（重算報價）
    SampleRunStatus.COSTING_GENERATED: [SampleRunStatus.ACTUALS_RECORDED],

    # quoted 可以退回 costing_generated（修改報價）
    SampleRunStatus.QUOTED: [SampleRunStatus.COSTING_GENERATED],

    # revise_needed 可以退回多個狀態
    SampleRunStatus.REVISE_NEEDED: [
        SampleRunStatus.DRAFT,  # 重新開始
        SampleRunStatus.ACTUALS_RECORDED,  # 重做報價
    ],
}


def can_rollback(run: SampleRun, target_status: str) -> bool:
    """
    Check if rollback to target status is allowed.

    Args:
        run: SampleRun instance
        target_status: Target status to roll back to

    Returns:
        bool: True if rollback is allowed
    """
    allowed_targets = ROLLBACK_TRANSITIONS.get(run.status, [])
    return target_status in allowed_targets


def get_rollback_targets(run: SampleRun) -> list[str]:
    """
    Get list of allowed rollback targets for current status.

    Args:
        run: SampleRun instance

    Returns:
        List of status names that can be rolled back to
    """
    return list(ROLLBACK_TRANSITIONS.get(run.status, []))


def rollback_sample_run(
    sample_run: SampleRun,
    target_status: str,
    actor: Optional[Any] = None,
    reason: str = '',
) -> TransitionResult:
    """
    Roll back a SampleRun to a previous status.

    Args:
        sample_run: SampleRun instance
        target_status: Target status to roll back to
        actor: User performing the rollback
        reason: Reason for rollback (required for audit trail)

    Returns:
        TransitionResult

    Raises:
        ValidationError: If rollback is not allowed
    """
    old_status = sample_run.status

    # Check if rollback is allowed
    if not can_rollback(sample_run, target_status):
        allowed = get_rollback_targets(sample_run)
        raise ValidationError(
            f"Cannot rollback from '{old_status}' to '{target_status}'. "
            f"Allowed targets: {allowed if allowed else 'none (terminal state)'}"
        )

    # Execute rollback
    now = timezone.now()
    sample_run.status = target_status
    sample_run.status_updated_at = now

    # TRACK-PROGRESS: 更新 status_timestamps（回退時覆蓋目標狀態的時間）
    timestamps = sample_run.status_timestamps or {}
    timestamps[target_status] = now.isoformat()
    sample_run.status_timestamps = timestamps

    # Append rollback note
    notes_entry = f"\n[{now.isoformat()}] ROLLBACK: {old_status} → {target_status}"
    if reason:
        notes_entry += f" | Reason: {reason}"
    sample_run.notes = (sample_run.notes or '') + notes_entry

    sample_run.save(update_fields=['status', 'status_updated_at', 'status_timestamps', 'notes'])

    # TRACK-PROGRESS: 寫入操作歷史
    SampleRunTransitionLog.objects.create(
        sample_run=sample_run,
        from_status=old_status,
        to_status=target_status,
        action='rollback',
        actor=actor if actor and hasattr(actor, 'pk') else None,
        note=reason,
    )

    return TransitionResult(
        old_status=old_status,
        new_status=target_status,
        action='rollback',
        changed_at=now,
        meta={
            'actor': str(actor) if actor else None,
            'reason': reason,
            'rollback': True,
        }
    )
