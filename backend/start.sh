#!/bin/bash
set -e
python manage.py migrate --noinput
python manage.py collectstatic --noinput
python manage.py createsuperuser --noinput || true
exec gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 1 --timeout 120
