#!/bin/bash
set -e
python manage.py migrate --noinput
python manage.py collectstatic --noinput
python manage.py shell -c "
from apps.core.models import User
import os
username = os.environ.get('DJANGO_SUPERUSER_USERNAME', '')
email = os.environ.get('DJANGO_SUPERUSER_EMAIL', '')
password = os.environ.get('DJANGO_SUPERUSER_PASSWORD', '')
if username and password:
    u, created = User.objects.get_or_create(username=username)
    u.email = email
    u.set_password(password)
    u.is_superuser = True
    u.is_staff = True
    u.is_active = True
    u.save()
    print(f'[STARTUP] Superuser {username} {\"created\" if created else \"updated\"} OK')
"
exec gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 1 --timeout 120
