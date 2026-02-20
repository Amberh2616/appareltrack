from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'order-item-bom', views.OrderItemBOMViewSet)
router.register(r'marker-reports', views.MarkerReportViewSet)
router.register(r'trim-measurements', views.TrimMeasurementViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
