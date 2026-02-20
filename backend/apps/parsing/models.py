"""
Parsing Models - v2.2.1
AI extraction runs and draft review items
"""

from django.db import models
import uuid

# Import Revision from models_blocks to make 'parsing.Revision' resolvable
from apps.parsing.models_blocks import Revision, RevisionPage, DraftBlock


class UploadedDocument(models.Model):
    """
    Uploaded documents (PDF / Excel) for AI classification and extraction
    Tracks upload -> classification -> extraction pipeline status
    """
    STATUS_CHOICES = [
        ('uploaded', 'Uploaded'),
        ('classifying', 'AI Classifying'),
        ('classified', 'Classified'),
        ('extracting', 'AI Extracting'),
        ('extracted', 'Extracted'),
        ('reviewing', 'Under Review'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        'core.Organization',
        on_delete=models.CASCADE,
        related_name='uploaded_documents'
    )

    # File info
    file = models.FileField(upload_to='uploads/%Y/%m/', max_length=500)
    filename = models.CharField(max_length=255)
    file_type = models.CharField(
        max_length=10,
        help_text="File extension: pdf, xlsx, csv, etc."
    )
    file_size = models.BigIntegerField(help_text="File size in bytes")

    # Classification result (AI classification of content type)
    classification_result = models.JSONField(
        null=True,
        blank=True,
        help_text="""
        AI classification result:
        {
            "file_type": "mixed" | "tech_pack_only" | "bom_only" | "measurement_only",
            "total_pages": 30,
            "pages": [
                {"page": 1, "type": "tech_pack", "confidence": 0.95},
                {"page": 2, "type": "measurement_table", "confidence": 0.98},
                {"page": 3, "type": "bom_table", "confidence": 0.92},
                ...
            ]
        }
        """
    )

    # Extraction status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='uploaded'
    )
    extraction_errors = models.JSONField(
        default=list,
        blank=True,
        help_text="List of errors during extraction"
    )

    # Link to created StyleRevision after extraction
    style_revision = models.ForeignKey(
        'styles.StyleRevision',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_documents',
        help_text="Created StyleRevision after successful extraction"
    )

    # Link to created TechPackRevision (Revision) for DraftBlocks review
    tech_pack_revision = models.ForeignKey(
        'parsing.Revision',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_documents',
        help_text="Created TechPackRevision for draft review (P0 interface)"
    )

    # Celery task tracking (for async processing)
    classify_task_id = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Celery task ID for async classification"
    )
    extract_task_id = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Celery task ID for async extraction"
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_uploaded_documents'
    )

    class Meta:
        db_table = 'uploaded_documents'
        verbose_name = 'Uploaded Document'
        verbose_name_plural = 'Uploaded Documents'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.filename} ({self.status})"


class ExtractionRun(models.Model):
    """
    Tracks an AI extraction job (parsing a Tech Pack PDF)
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(
        'documents.Document',
        on_delete=models.CASCADE,
        related_name='extraction_runs'
    )
    style_revision = models.ForeignKey(
        'styles.StyleRevision',
        on_delete=models.CASCADE,
        related_name='extraction_runs'
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )

    # AI results
    extracted_data = models.JSONField(
        null=True,
        blank=True,
        help_text="Raw AI extraction results"
    )
    confidence_score = models.FloatField(null=True, blank=True)

    # Issues detected
    issues = models.JSONField(
        default=list,
        blank=True,
        help_text="List of issues/warnings from AI"
    )

    # Processing metadata
    ai_model = models.CharField(max_length=50, blank=True)
    processing_time_ms = models.IntegerField(null=True, blank=True)
    api_cost = models.DecimalField(
        max_digits=8,
        decimal_places=4,
        null=True,
        blank=True
    )

    # Timestamps
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'extraction_runs'
        verbose_name = 'Extraction Run'
        verbose_name_plural = 'Extraction Runs'
        ordering = ['-started_at']

    def __str__(self):
        return f"Extraction {self.id} - {self.status}"


class DraftReviewItem(models.Model):
    """
    Individual item pending human review/approval
    """
    ITEM_TYPE_CHOICES = [
        ('bom_item', 'BOM Item'),
        ('measurement', 'Measurement'),
        ('construction', 'Construction Step'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('corrected', 'Corrected'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    extraction_run = models.ForeignKey(
        ExtractionRun,
        on_delete=models.CASCADE,
        related_name='review_items'
    )

    # Item info
    item_type = models.CharField(max_length=20, choices=ITEM_TYPE_CHOICES)
    ai_data = models.JSONField(help_text="AI extracted data for this item")
    ai_confidence = models.FloatField()

    # Review status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )

    # Human correction
    corrected_data = models.JSONField(
        null=True,
        blank=True,
        help_text="Human-corrected data"
    )
    correction_notes = models.TextField(blank=True)

    # Review metadata
    reviewed_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_items'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'draft_review_items'
        verbose_name = 'Draft Review Item'
        verbose_name_plural = 'Draft Review Items'
        ordering = ['item_type', '-ai_confidence']

    def __str__(self):
        return f"{self.get_item_type_display()} - {self.status}"
