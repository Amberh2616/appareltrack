#!/bin/bash
set -e
echo "Starting Celery worker..."
exec celery -A config worker -l info --concurrency=2
