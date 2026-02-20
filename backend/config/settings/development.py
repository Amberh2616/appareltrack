"""
Development settings
"""

from .base import *

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0"]

# Database
# Use SQLite for development (easy setup)
# Switch to PostgreSQL when ready for production-like testing
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

# For PostgreSQL in development, uncomment and configure:
# DATABASES = {
#     "default": {
#         "ENGINE": "django.db.backends.postgresql",
#         "NAME": os.getenv("DB_NAME", "fashion_plm_dev"),
#         "USER": os.getenv("DB_USER", "postgres"),
#         "PASSWORD": os.getenv("DB_PASSWORD", "postgres"),
#         "HOST": os.getenv("DB_HOST", "localhost"),
#         "PORT": os.getenv("DB_PORT", "5432"),
#     }
# }

# CORS settings for development
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# Remove XFrameOptionsMiddleware to allow PDF iframe embedding
# Frontend (localhost:3000) needs to embed PDF from backend (localhost:8000)
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    # "django.middleware.clickjacking.XFrameOptionsMiddleware",  # REMOVED for iframe
]

# Email backend for development (console)
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Logging
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "apps": {
            "handlers": ["console"],
            "level": "DEBUG",
            "propagate": False,
        },
    },
}

# Development-specific settings
INTERNAL_IPS = ["127.0.0.1"]

# DRF: Allow unauthenticated access in development (MVP)
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",  # MVP: No auth required
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",  # Simpler than cursor
    "PAGE_SIZE": 50,
}

# Cache (use local memory for development)
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "fashion-plm-cache",
    }
}

# Celery Configuration
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "Asia/Taipei"
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes
CELERY_TASK_SOFT_TIME_LIMIT = 25 * 60  # 25 minutes
