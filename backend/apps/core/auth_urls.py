"""
Auth & User Management URLs
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Router for ViewSets
router = DefaultRouter()
router.register(r'users', views.UserViewSet, basename='user')
router.register(r'organizations', views.OrganizationViewSet, basename='organization')

urlpatterns = [
    # Auth endpoints
    path('register/', views.register, name='register'),
    path('user/', views.get_current_user, name='current_user'),
    path('password-reset/', views.password_reset_request, name='password_reset'),
    path('password-reset/confirm/', views.password_reset_confirm, name='password_reset_confirm'),

    # User management (via router)
    path('', include(router.urls)),
]
