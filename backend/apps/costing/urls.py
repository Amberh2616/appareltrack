"""
Costing URL Configuration
"""

from django.urls import path, include
from . import views

# Old Phase 2 endpoints (保留兼容性)
old_urlpatterns = [
    # List/Create CostSheets for a revision (GET/POST)
    path(
        'revisions/<uuid:revision_id>/cost-sheets/',
        views.cost_sheets_list_create,
        name='cost-sheets-list-create'
    ),

    # Get/Update single CostSheet detail (GET/PATCH)
    path(
        'cost-sheets/<int:cost_sheet_id>/',
        views.cost_sheet_detail_update,
        name='cost-sheet-detail-update'
    ),

    # Duplicate CostSheet with new margin/wastage (POST)
    path(
        'cost-sheets/<int:cost_sheet_id>/duplicate/',
        views.cost_sheet_duplicate,
        name='cost-sheet-duplicate'
    ),
]

urlpatterns = [
    # Phase 2-3 New Architecture (DRF Router)
    path('', include('apps.costing.urls_phase23')),

    # Old Phase 2 endpoints (backward compatibility)
    *old_urlpatterns,
]
