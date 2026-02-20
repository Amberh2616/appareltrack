"""
Celery configuration for Fashion Production System v2.2.1

This module contains the Celery application instance.
Tasks are auto-discovered from all installed apps that have a tasks.py file.
"""

import os
from celery import Celery

# Set the default Django settings module
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

# Create Celery app
app = Celery("fashion_plm")

# Load settings from Django settings, using CELERY_ prefix
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks in all installed apps
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Debug task for testing Celery"""
    print(f"Request: {self.request!r}")
