"""
URL configuration for Fashion Production System v2.2.1
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework import routers
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
# TODO: Add drf_spectacular to requirements, then uncomment
# from drf_spectacular.views import (
#     SpectacularAPIView,
#     SpectacularRedocView,
#     SpectacularSwaggerView,
# )

# API Router
router = routers.DefaultRouter()

# TODO: Register app viewsets here as they are created
# Example:
# from apps.styles.views import StyleViewSet
# router.register(r'styles', StyleViewSet)

urlpatterns = [
    # Admin
    path("admin/", admin.site.urls),

    # API v2 - App routes
    path("api/v2/", include("apps.styles.urls")),
    path("api/v2/", include("apps.documents.urls")),
    path("api/v2/", include("apps.parsing.urls")),
    path("api/v2/", include("apps.costing.urls")),
    path("api/v2/", include("apps.samples.urls")),  # Phase 3
    path("api/v2/", include("apps.procurement.urls")),  # P14: Suppliers & POs
    path("api/v2/", include("apps.orders.urls")),  # P17: Production Orders
    path("api/v2/assistant/", include("apps.assistant.urls")),  # Assistant feature

    # API Documentation (TODO: Uncomment when drf_spectacular is added)
    # path("api/v2/schema/", SpectacularAPIView.as_view(), name="schema"),
    # path("api/v2/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    # path("api/v2/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),

    # Health check (both paths for compatibility)
    path("health/", include("apps.core.urls")),
    path("api/v2/health/", include("apps.core.urls")),  # API path for frontend

    # DRF auth
    path("api-auth/", include("rest_framework.urls")),

    # JWT Authentication
    path("api/v2/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/v2/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # Auth endpoints (register, password reset, user info)
    path("api/v2/auth/", include("apps.core.auth_urls")),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
