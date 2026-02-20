"""
Parsing Services - v2.2.1
Mock AI extraction for MVP
"""

import random
from typing import Dict, Any, List
from datetime import datetime
from django.utils import timezone
from .models import ExtractionRun, DraftReviewItem


def generate_mock_bom_data(style_number: str) -> Dict[str, Any]:
    """
    Generate mock BOM data following AI-JSON-SCHEMA_v2.2.1
    """
    items = [
        {
            "item_number": 1,
            "category": "fabric",
            "material_name": f"Nulu™ Fabric for {style_number}",
            "supplier": "",  # Intentionally empty to create issue
            "color": "Black",
            "color_code": "BLK",
            "consumption": None,  # Unknown to create issue
            "consumption_maturity": "unknown",
            "unit": "yards",
            "placement": ["body", "sleeves"],
            "wastage_rate": 5.0,
            "unit_price": None,
            "ai_confidence": 0.85,
            "evidence": {
                "page": 2,
                "bbox": [100, 200, 400, 250],
                "text": "Main Fabric: Nulu™"
            }
        },
        {
            "item_number": 2,
            "category": "trim",
            "material_name": "Elastic Band",
            "supplier": "YKK",
            "color": "Black",
            "color_code": "BLK",
            "consumption": 68.5,
            "consumption_maturity": "pre_estimate",
            "unit": "cm/pc",
            "placement": ["waist"],
            "wastage_rate": 3.0,
            "unit_price": 0.15,
            "ai_confidence": 0.92,
            "evidence": {
                "page": 2,
                "bbox": [100, 300, 400, 350],
                "text": "Waist Elastic: 68.5cm"
            }
        },
        {
            "item_number": 3,
            "category": "label",
            "material_name": "Care Label",
            "supplier": "TrimCo",
            "color": "White",
            "color_code": "WHT",
            "consumption": 1,
            "consumption_maturity": "confirmed",
            "unit": "pcs",
            "placement": ["inside_back"],
            "wastage_rate": 0,
            "unit_price": 0.05,
            "ai_confidence": 0.98,
            "evidence": {
                "page": 3,
                "bbox": [100, 400, 400, 450],
                "text": "Care Label: 1pc"
            }
        }
    ]

    issues = [
        {
            "issue_type": "missing_field",
            "severity": "error",
            "field": "supplier",
            "item_number": 1,
            "message": "Supplier not specified for main fabric",
            "suggestion": "Please add supplier name",
            "page": 2
        },
        {
            "issue_type": "low_confidence",
            "severity": "warning",
            "field": "consumption",
            "item_number": 1,
            "message": "Fabric consumption not found in tech pack",
            "suggestion": "Consumption status marked as 'unknown'. Will need marker report.",
            "page": 2
        }
    ]

    return {
        "items": items,
        "issues": issues,
        "extraction_metadata": {
            "source_pages": [2, 3],
            "confidence_avg": 0.92,
            "extracted_at": datetime.utcnow().isoformat() + "Z"
        }
    }


def generate_mock_measurement_data(style_number: str) -> Dict[str, Any]:
    """
    Generate mock measurement data following AI-JSON-SCHEMA_v2.2.1
    """
    points = [
        {
            "point_name": "Chest Width",
            "point_code": "A",
            "values": {
                "XS": 40.0,
                "S": 42.0,
                "M": 44.0,
                "L": 46.0,
                "XL": 48.0
            },
            "tolerance_plus": 0.5,
            "tolerance_minus": 0.5,
            "unit": "cm",
            "ai_confidence": 0.95,
            "evidence": {
                "page": 4,
                "bbox": [50, 100, 500, 150],
                "text": "A. Chest: 40/42/44/46/48"
            }
        },
        {
            "point_name": "Body Length",
            "point_code": "B",
            "values": {
                "XS": 60.0,
                "S": 62.0,
                "M": 64.0,
                "L": 66.0,
                "XL": 68.0
            },
            "tolerance_plus": 0.5,
            "tolerance_minus": 0.5,
            "unit": "cm",
            "ai_confidence": 0.88,
            "evidence": {
                "page": 4,
                "bbox": [50, 200, 500, 250],
                "text": "B. Length: 60/62/64/66/68"
            }
        }
    ]

    issues = [
        {
            "issue_type": "low_confidence",
            "severity": "warning",
            "field": "values",
            "point_name": "Body Length",
            "message": "OCR confidence below 90% for this measurement",
            "suggestion": "Please verify measurement values",
            "page": 4
        }
    ]

    return {
        "points": points,
        "issues": issues,
        "extraction_metadata": {
            "source_pages": [4],
            "confidence_avg": 0.92,
            "extracted_at": datetime.utcnow().isoformat() + "Z"
        }
    }


def generate_mock_construction_data(style_number: str) -> Dict[str, Any]:
    """
    Generate mock construction data following AI-JSON-SCHEMA_v2.2.1
    """
    steps = [
        {
            "step_number": 1,
            "description": "Join shoulder seams using flatlock stitch",
            "stitch_type": "Flatlock",
            "machine_type": "Overlock",
            "ai_confidence": 0.90,
            "evidence": {
                "page": 5,
                "bbox": [100, 100, 400, 150],
                "text": "1. Flatlock shoulder seams"
            }
        },
        {
            "step_number": 2,
            "description": "Attach elastic waistband with 4-needle coverseam",
            "stitch_type": "Coverseam",
            "machine_type": "Coverstitch",
            "ai_confidence": 0.88,
            "evidence": {
                "page": 5,
                "bbox": [100, 200, 400, 250],
                "text": "2. 4-needle cover for waistband"
            }
        },
        {
            "step_number": 3,
            "description": "Hem bottom edge with blind stitch",
            "stitch_type": "Blind Stitch",
            "machine_type": "Blind Hem",
            "ai_confidence": 0.92,
            "evidence": {
                "page": 5,
                "bbox": [100, 300, 400, 350],
                "text": "3. Blind hem at bottom"
            }
        }
    ]

    issues = []

    return {
        "steps": steps,
        "issues": issues,
        "extraction_metadata": {
            "source_pages": [5],
            "confidence_avg": 0.90,
            "extracted_at": datetime.utcnow().isoformat() + "Z"
        }
    }


def trigger_parse_extraction(revision, targets: List[str], options: Dict[str, Any]) -> ExtractionRun:
    """
    Trigger parsing extraction
    For MVP: Synchronous mock extraction
    TODO: Replace with Celery async task
    """
    from apps.documents.models import Document

    # Get primary document (tech pack)
    doc = Document.objects.filter(
        style_revision=revision,
        doc_type='techpack'
    ).first()

    # Create ExtractionRun
    extraction_run = ExtractionRun.objects.create(
        document=doc if doc else None,
        style_revision=revision,
        status='processing',
        ai_model='mock-ai-v1.0',
    )

    # Generate mock draft data
    style_number = revision.style.style_number

    # Simulate processing time (in real scenario, this would be async)
    extracted_data = {}
    all_issues = []

    if 'bom' in targets or not targets:
        bom_data = generate_mock_bom_data(style_number)
        extracted_data['bom'] = bom_data
        all_issues.extend([{**issue, 'target': 'bom'} for issue in bom_data['issues']])

    if 'measurement' in targets or not targets:
        measurement_data = generate_mock_measurement_data(style_number)
        extracted_data['measurement'] = measurement_data
        all_issues.extend([{**issue, 'target': 'measurement'} for issue in measurement_data['issues']])

    if 'construction' in targets or not targets:
        construction_data = generate_mock_construction_data(style_number)
        extracted_data['construction'] = construction_data
        all_issues.extend([{**issue, 'target': 'construction'} for issue in construction_data['issues']])

    # Update ExtractionRun
    extraction_run.extracted_data = extracted_data
    extraction_run.issues = all_issues
    extraction_run.confidence_score = 0.91
    extraction_run.status = 'completed'
    extraction_run.completed_at = timezone.now()
    extraction_run.processing_time_ms = random.randint(2000, 5000)
    extraction_run.api_cost = 1.25
    extraction_run.save()

    # Write draft data to StyleRevision
    if 'bom' in extracted_data:
        revision.draft_bom_data = extracted_data['bom']

    if 'measurement' in extracted_data:
        revision.draft_measurement_data = extracted_data['measurement']

    if 'construction' in extracted_data:
        revision.draft_construction_data = extracted_data['construction']

    revision.save(update_fields=['draft_bom_data', 'draft_measurement_data', 'draft_construction_data'])

    # Create DraftReviewItems for issues
    for issue in all_issues:
        DraftReviewItem.objects.create(
            extraction_run=extraction_run,
            item_type=f"{issue['target']}_item",
            ai_data=issue,
            ai_confidence=0.5 if issue['severity'] == 'error' else 0.75,
            status='pending'
        )

    return extraction_run


def get_extraction_run_status(extraction_run_id: str) -> Dict[str, Any]:
    """
    Get extraction run status with details
    """
    extraction_run = ExtractionRun.objects.select_related(
        'style_revision__style',
        'document'
    ).get(id=extraction_run_id)

    # Count issues by severity
    issues_summary = {
        'total': len(extraction_run.issues),
        'error': sum(1 for i in extraction_run.issues if i.get('severity') == 'error'),
        'warning': sum(1 for i in extraction_run.issues if i.get('severity') == 'warning'),
    }

    return {
        "extraction_run_id": str(extraction_run.id),
        "revision_id": str(extraction_run.style_revision_id),
        "status": extraction_run.status,
        "ai_model": extraction_run.ai_model,
        "confidence_score": extraction_run.confidence_score,
        "processing_time_ms": extraction_run.processing_time_ms,
        "api_cost": float(extraction_run.api_cost) if extraction_run.api_cost else None,
        "started_at": extraction_run.started_at.isoformat() if extraction_run.started_at else None,
        "completed_at": extraction_run.completed_at.isoformat() if extraction_run.completed_at else None,
        "targets": list(extraction_run.extracted_data.keys()) if extraction_run.extracted_data else [],
        "issues_summary": issues_summary,
        "issues": extraction_run.issues,
    }
