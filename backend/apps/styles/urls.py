"""
Styles app URLs - v2.4.0
Added: batch-verify for BOM and Measurements
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'brands', views.BrandViewSet, basename='brands')
router.register(r'styles', views.StyleViewSet, basename='styles')
router.register(r'style-revisions', views.StyleRevisionViewSet, basename='style-revisions')  # Fix: Avoid conflict with parsing/revisions
router.register(r'portfolio', views.PortfolioViewSet, basename='portfolio')  # Portfolio Kanban API

# Manually create nested BOM URLs
bom_list = views.BOMItemViewSet.as_view({
    'get': 'list',
    'post': 'create'
})
bom_detail = views.BOMItemViewSet.as_view({
    'get': 'retrieve',
    'patch': 'partial_update',
    'put': 'update',
    'delete': 'destroy'
})
bom_translate = views.BOMItemViewSet.as_view({
    'post': 'translate'
})
bom_translate_batch = views.BOMItemViewSet.as_view({
    'post': 'translate_batch'
})
# 用量四階段管理
bom_set_pre_estimate = views.BOMItemViewSet.as_view({
    'post': 'set_pre_estimate'
})
bom_set_sample = views.BOMItemViewSet.as_view({
    'post': 'set_sample'
})
bom_confirm_consumption = views.BOMItemViewSet.as_view({
    'post': 'confirm_consumption'
})
bom_lock_consumption = views.BOMItemViewSet.as_view({
    'post': 'lock_consumption'
})
bom_batch_confirm = views.BOMItemViewSet.as_view({
    'post': 'batch_confirm'
})
bom_batch_lock = views.BOMItemViewSet.as_view({
    'post': 'batch_lock'
})
bom_batch_verify = views.BOMItemViewSet.as_view({
    'post': 'batch_verify'
})

# Manually create nested Measurement URLs
measurement_list = views.MeasurementViewSet.as_view({
    'get': 'list',
    'post': 'create'
})
measurement_detail = views.MeasurementViewSet.as_view({
    'get': 'retrieve',
    'patch': 'partial_update',
    'put': 'update',
    'delete': 'destroy'
})
measurement_translate = views.MeasurementViewSet.as_view({
    'post': 'translate'
})
measurement_translate_batch = views.MeasurementViewSet.as_view({
    'post': 'translate_batch'
})
measurement_batch_verify = views.MeasurementViewSet.as_view({
    'post': 'batch_verify'
})

urlpatterns = [
    path('', include(router.urls)),
    # Nested BOM routes under revisions
    path('style-revisions/<uuid:revision_pk>/bom/', bom_list, name='revision-bom-list'),
    path('style-revisions/<uuid:revision_pk>/bom/<uuid:pk>/', bom_detail, name='revision-bom-detail'),
    path('style-revisions/<uuid:revision_pk>/bom/<uuid:pk>/translate/', bom_translate, name='revision-bom-translate'),
    path('style-revisions/<uuid:revision_pk>/bom/translate-batch/', bom_translate_batch, name='revision-bom-translate-batch'),
    # 用量四階段管理路由
    path('style-revisions/<uuid:revision_pk>/bom/<uuid:pk>/set-pre-estimate/', bom_set_pre_estimate, name='revision-bom-set-pre-estimate'),
    path('style-revisions/<uuid:revision_pk>/bom/<uuid:pk>/set-sample/', bom_set_sample, name='revision-bom-set-sample'),
    path('style-revisions/<uuid:revision_pk>/bom/<uuid:pk>/confirm-consumption/', bom_confirm_consumption, name='revision-bom-confirm-consumption'),
    path('style-revisions/<uuid:revision_pk>/bom/<uuid:pk>/lock-consumption/', bom_lock_consumption, name='revision-bom-lock-consumption'),
    path('style-revisions/<uuid:revision_pk>/bom/batch-confirm/', bom_batch_confirm, name='revision-bom-batch-confirm'),
    path('style-revisions/<uuid:revision_pk>/bom/batch-lock/', bom_batch_lock, name='revision-bom-batch-lock'),
    path('style-revisions/<uuid:revision_pk>/bom/batch-verify/', bom_batch_verify, name='revision-bom-batch-verify'),
    # Nested Measurement routes under revisions
    path('style-revisions/<uuid:revision_pk>/measurements/', measurement_list, name='revision-measurement-list'),
    path('style-revisions/<uuid:revision_pk>/measurements/<uuid:pk>/', measurement_detail, name='revision-measurement-detail'),
    path('style-revisions/<uuid:revision_pk>/measurements/<uuid:pk>/translate/', measurement_translate, name='revision-measurement-translate'),
    path('style-revisions/<uuid:revision_pk>/measurements/translate-batch/', measurement_translate_batch, name='revision-measurement-translate-batch'),
    path('style-revisions/<uuid:revision_pk>/measurements/batch-verify/', measurement_batch_verify, name='revision-measurement-batch-verify'),
]
