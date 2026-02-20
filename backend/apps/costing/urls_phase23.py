"""
Costing URL Configuration - Phase 2-3
Three-Layer Separation Architecture API Routes
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views_phase23 import (
    UsageScenarioViewSet,
    UsageLineViewSet,
    CostSheetVersionViewSet,
    CostLineV2ViewSet,
    CostSheetGroupViewSet,
)

# DRF Router for Phase 2-3 ViewSets
router = DefaultRouter()

router.register(r'usage-scenarios', UsageScenarioViewSet, basename='usage-scenario')
router.register(r'usage-lines', UsageLineViewSet, basename='usage-line')
router.register(r'cost-sheet-versions', CostSheetVersionViewSet, basename='cost-sheet-version')
router.register(r'cost-lines-v2', CostLineV2ViewSet, basename='cost-line-v2')
router.register(r'cost-sheet-groups', CostSheetGroupViewSet, basename='cost-sheet-group')

urlpatterns = [
    path('', include(router.urls)),
]

"""
Available Endpoints (Phase 2-3):

UsageScenario:
  GET    /api/v2/usage-scenarios/                           - List scenarios
  POST   /api/v2/usage-scenarios/                           - Create scenario
  GET    /api/v2/usage-scenarios/{id}/                      - Retrieve scenario
  PATCH  /api/v2/usage-scenarios/{id}/                      - Update scenario
  POST   /api/v2/usage-scenarios/{id}/clone/                - Clone scenario

UsageLine:
  GET    /api/v2/usage-lines/                               - List lines
  PATCH  /api/v2/usage-lines/{id}/                          - Update line

CostSheetVersion:
  GET    /api/v2/cost-sheet-versions/                       - List versions
  POST   /api/v2/cost-sheet-versions/                       - Create version
  GET    /api/v2/cost-sheet-versions/{id}/                  - Retrieve version
  PATCH  /api/v2/cost-sheet-versions/{id}/                  - Update summary
  POST   /api/v2/cost-sheet-versions/{id}/clone/            - Clone version
  POST   /api/v2/cost-sheet-versions/{id}/submit/           - Submit version

CostLineV2:
  GET    /api/v2/cost-lines-v2/                             - List lines
  PATCH  /api/v2/cost-lines-v2/{id}/                        - Update line

CostSheetGroup:
  GET    /api/v2/cost-sheet-groups/                         - List groups
  GET    /api/v2/cost-sheet-groups/{id}/                    - Retrieve group

Query Parameters:
  - usage-scenarios: ?revision_id=uuid&purpose=sample_quote
  - usage-lines: ?usage_scenario_id=uuid
  - cost-sheet-versions: ?style_id=uuid&costing_type=sample&cost_sheet_group_id=uuid
  - cost-lines-v2: ?cost_sheet_version_id=uuid
  - cost-sheet-groups: ?style_id=uuid
"""
