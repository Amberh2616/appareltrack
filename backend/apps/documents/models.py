"""
Documents Models - v2.2.1
File upload/download with presigned URLs
"""

from django.db import models
import uuid
import hashlib


class Document(models.Model):
    """
    Represents an uploaded file (Tech Pack PDF, BOM Excel, CAD, etc.)
    """
    # Document type (purpose/usage)
    DOC_TYPE_CHOICES = [
        ('techpack', 'Tech Pack'),
        ('bom', 'BOM'),
        ('spec', 'Specification'),
        ('artwork', 'Artwork'),
        ('marker', 'Marker Report'),
        ('sample_photo', 'Sample Photo'),
        ('other', 'Other'),
    ]

    # File kind (format)
    FILE_KIND_CHOICES = [
        ('pdf', 'PDF'),
        ('xlsx', 'Excel'),
        ('docx', 'Word'),
        ('img', 'Image'),
        ('csv', 'CSV'),
        ('other', 'Other'),
    ]

    # Source (origin)
    SOURCE_CHOICES = [
        ('customer', 'Customer'),
        ('internal', 'Internal'),
        ('vendor', 'Vendor'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        'core.Organization',
        on_delete=models.CASCADE,
        related_name='documents'
    )

    # Document info
    doc_type = models.CharField(
        max_length=50,
        choices=DOC_TYPE_CHOICES,
        help_text="Purpose/usage of the document"
    )
    file_kind = models.CharField(
        max_length=20,
        choices=FILE_KIND_CHOICES,
        help_text="File format"
    )
    source = models.CharField(
        max_length=20,
        choices=SOURCE_CHOICES,
        default='customer',
        help_text="Origin of the document"
    )

    filename = models.CharField(max_length=255)
    file_size = models.BigIntegerField(help_text="Size in bytes")
    file_hash = models.CharField(
        max_length=64,
        help_text="SHA256 hash for duplicate detection",
        db_index=True
    )
    content_type = models.CharField(
        max_length=100,
        blank=True,
        help_text="MIME type (e.g., application/pdf)"
    )

    # Storage (S3 key or MinIO path)
    storage_key = models.CharField(
        max_length=500,
        help_text="Storage path in S3/MinIO"
    )

    # Upload status
    STATUS_CHOICES = [
        ('pending', 'Pending Upload'),
        ('uploading', 'Uploading'),
        ('uploaded', 'Uploaded'),
        ('failed', 'Upload Failed'),
    ]
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )

    # Relationships (optional, depends on document type)
    style_revision = models.ForeignKey(
        'styles.StyleRevision',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='documents'
    )

    # Metadata
    uploaded_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_documents'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'documents'
        verbose_name = 'Document'
        verbose_name_plural = 'Documents'
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.filename} ({self.get_doc_type_display()})"

    @staticmethod
    def calculate_hash(file_content):
        """Calculate SHA256 hash of file content"""
        return hashlib.sha256(file_content).hexdigest()
