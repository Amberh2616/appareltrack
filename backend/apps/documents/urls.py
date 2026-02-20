"""
Documents URLs - v2.2.1
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'documents', views.DocumentViewSet, basename='documents')

urlpatterns = [
    path('', include(router.urls)),
]
