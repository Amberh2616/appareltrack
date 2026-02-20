"""
Core app URLs - Health check endpoints
"""

from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health_check, name='health_check'),
    path('services/', views.services_health_check, name='services_health_check'),
]
