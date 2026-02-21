#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def main():
    """Run administrative tasks."""
    # DEBUG: print env vars at startup (remove after fixing DB issue)
    print(f"[STARTUP] SETTINGS={os.environ.get('DJANGO_SETTINGS_MODULE', 'NOT_SET')}", flush=True)
    print(f"[STARTUP] DATABASE_URL={'SET' if os.environ.get('DATABASE_URL') else 'NOT_SET'}", flush=True)
    print(f"[STARTUP] PGHOST={os.environ.get('PGHOST', 'NOT_SET')}", flush=True)
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
