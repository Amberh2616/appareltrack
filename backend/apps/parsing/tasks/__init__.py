"""
Parsing Tasks Package

Re-exports all tasks for Celery auto-discovery.
"""

from ._main import (
    parse_techpack_task,
    generate_stub_extraction_data,
    classify_document_task,
    extract_document_task,
)

__all__ = [
    'parse_techpack_task',
    'generate_stub_extraction_data',
    'classify_document_task',
    'extract_document_task',
]
