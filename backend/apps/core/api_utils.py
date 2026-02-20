"""
API Response Utilities - v2.2.1
Standardized response envelope and error handling
"""

from datetime import datetime
from typing import Any, Optional, List, Dict
from uuid import uuid4
from rest_framework.response import Response
from rest_framework import status


def generate_request_id() -> str:
    """Generate unique request ID"""
    return f"req_{uuid4().hex[:12]}"


def api_response(
    data: Any = None,
    errors: Optional[List[Dict[str, Any]]] = None,
    meta: Optional[Dict[str, Any]] = None,
    status_code: int = status.HTTP_200_OK,
    request_id: Optional[str] = None,
) -> Response:
    """
    Standardized API response envelope

    Success response:
    {
        "data": {...},
        "meta": {
            "request_id": "req_...",
            "ts": "2025-12-18T10:00:00Z"
        },
        "errors": []
    }

    Error response:
    {
        "data": null,
        "meta": {...},
        "errors": [
            {
                "code": "VALIDATION_ERROR",
                "message": "Field is required",
                "field": "field_name",
                "hint": "Provide valid value",
                "details": {}
            }
        ]
    }
    """
    # Generate request_id if not provided
    if request_id is None:
        request_id = generate_request_id()

    # Build meta
    response_meta = {
        "request_id": request_id,
        "ts": datetime.utcnow().isoformat() + "Z"
    }

    # Merge with provided meta
    if meta:
        response_meta.update(meta)

    # Build response body
    response_body = {
        "data": data if data is not None else None,
        "meta": response_meta,
        "errors": errors if errors else []
    }

    return Response(response_body, status=status_code)


def api_success(
    data: Any,
    meta: Optional[Dict[str, Any]] = None,
    status_code: int = status.HTTP_200_OK
) -> Response:
    """Success response shorthand"""
    return api_response(data=data, meta=meta, status_code=status_code)


def api_error(
    code: str,
    message: str,
    field: Optional[str] = None,
    hint: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    status_code: int = status.HTTP_400_BAD_REQUEST
) -> Response:
    """Single error response shorthand"""
    error = {
        "code": code,
        "message": message
    }
    if field:
        error["field"] = field
    if hint:
        error["hint"] = hint
    if details:
        error["details"] = details

    return api_response(
        data=None,
        errors=[error],
        status_code=status_code
    )


def api_errors(
    errors: List[Dict[str, Any]],
    status_code: int = status.HTTP_400_BAD_REQUEST
) -> Response:
    """Multiple errors response"""
    return api_response(
        data=None,
        errors=errors,
        status_code=status_code
    )


def paginated_response(
    data: List[Any],
    page: int,
    page_size: int,
    total: int,
    extra_meta: Optional[Dict[str, Any]] = None
) -> Response:
    """
    Paginated list response

    meta includes:
    {
        "pagination": {
            "page": 1,
            "page_size": 50,
            "total": 300,
            "total_pages": 6
        }
    }
    """
    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0

    pagination_meta = {
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages
        }
    }

    # Merge with extra meta
    if extra_meta:
        pagination_meta.update(extra_meta)

    return api_success(data=data, meta=pagination_meta)


# Common error codes
class ErrorCodes:
    """Standard error codes"""
    VALIDATION_ERROR = "VALIDATION_ERROR"
    NOT_FOUND = "NOT_FOUND"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    CONFLICT = "CONFLICT"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    BAD_REQUEST = "BAD_REQUEST"

    # Domain-specific
    DUPLICATE_STYLE_NUMBER = "DUPLICATE_STYLE_NUMBER"
    REVISION_ALREADY_APPROVED = "REVISION_ALREADY_APPROVED"
    EXTRACTION_FAILED = "EXTRACTION_FAILED"
    UPLOAD_FAILED = "UPLOAD_FAILED"
    GATING_BLOCKED = "GATING_BLOCKED"
    INSUFFICIENT_CONSUMPTION_MATURITY = "INSUFFICIENT_CONSUMPTION_MATURITY"
