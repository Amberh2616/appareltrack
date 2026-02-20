"""
Phase 3: Sample Request System - API URLs
Day 3 MVP API + SampleRun (Phase 3 Refactor)
P0-2: Kanban View API
"""

from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    SampleRequestViewSet,
    SampleRunViewSet,
    SampleActualsViewSet,
    SampleAttachmentViewSet,
    SampleCostEstimateViewSet,
    T2POForSampleViewSet,
    T2POLineForSampleViewSet,
    SampleMWOViewSet,
    SampleViewSet,
    # P0-2: Kanban
    kanban_counts,
    kanban_runs,
    # P1: Batch Operations
    batch_transition,
    # P2: Smart Batch (Mixed Status)
    batch_transition_smart,
    # P1: Alerts
    get_alerts,
    # P3: Batch Export
    batch_export,
    # P9: Scheduler/Gantt
    scheduler_data,
    # P18: Progress Dashboard
    progress_dashboard,
)

router = DefaultRouter()

# Sample Request (core)
router.register(
    r"sample-requests",
    SampleRequestViewSet,
    basename="sample-request"
)

# ==================== Phase 3 Refactor: SampleRun ====================

# Sample Run (Phase 3: 每一輪樣衣的核心中樞)
router.register(
    r"sample-runs",
    SampleRunViewSet,
    basename="sample-run"
)

# Sample Actuals
router.register(
    r"sample-actuals",
    SampleActualsViewSet,
    basename="sample-actuals"
)

# Sample Attachments
router.register(
    r"sample-attachments",
    SampleAttachmentViewSet,
    basename="sample-attachment"
)

# Sample Cost Estimates
router.register(
    r"sample-cost-estimates",
    SampleCostEstimateViewSet,
    basename="sample-cost-estimate"
)

# T2 PO for Sample
router.register(
    r"t2pos-for-sample",
    T2POForSampleViewSet,
    basename="t2po-for-sample"
)

router.register(
    r"t2po-lines-for-sample",
    T2POLineForSampleViewSet,
    basename="t2po-line-for-sample"
)

# Sample MWO
router.register(
    r"sample-mwos",
    SampleMWOViewSet,
    basename="sample-mwo"
)

# Physical Samples
router.register(
    r"samples",
    SampleViewSet,
    basename="sample"
)

# P0-2: Kanban API endpoints
# P1: Batch Operations & Alerts
# P3: Batch Export
# P9: Scheduler/Gantt
# P18: Progress Dashboard
urlpatterns = [
    path('kanban/counts/', kanban_counts, name='kanban-counts'),
    path('kanban/runs/', kanban_runs, name='kanban-runs'),
    path('sample-runs/batch-transition/', batch_transition, name='batch-transition'),
    path('sample-runs/batch-transition-smart/', batch_transition_smart, name='batch-transition-smart'),
    path('sample-runs/batch-export/', batch_export, name='batch-export'),
    path('alerts/', get_alerts, name='alerts'),
    path('scheduler/', scheduler_data, name='scheduler'),
    path('progress-dashboard/', progress_dashboard, name='progress-dashboard'),
] + router.urls
