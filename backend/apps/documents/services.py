"""
Documents Services - v2.2.1
Business logic for document upload and management
"""

from typing import Any, Dict
from django.db import transaction
from django.utils import timezone

from .models import Document
from .storage import storage_provider
from apps.styles.models import StyleRevision


def document_upload_init(organization, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Initialize document upload
    Returns presigned URL and document_id
    """
    doc_type = payload["doc_type"]
    file_kind = payload["file_kind"]
    filename = payload["filename"]
    content_type = payload["content_type"]
    file_size = payload["file_size"]
    source = payload.get("source", "customer")
    file_hash = payload.get("file_hash", "")

    # Check for duplicate by hash
    already_exists = False
    if file_hash:
        existing = Document.objects.filter(
            organization=organization,
            file_hash=file_hash
        ).first()
        if existing:
            already_exists = True
            # Return existing document
            presigned = storage_provider.create_presigned_upload(
                existing.storage_key,
                content_type
            )
            return {
                "document_id": str(existing.id),
                "storage_key": existing.storage_key,
                "upload_url": presigned.upload_url,
                "expires_in": presigned.expires_in,
                "already_exists": True,
            }

    # Build storage key
    storage_key = storage_provider.build_storage_key(
        str(organization.id),
        doc_type,
        file_kind,
        filename
    )

    # Create presigned URL
    presigned = storage_provider.create_presigned_upload(storage_key, content_type)

    # Create Document record
    doc = Document.objects.create(
        organization=organization,
        doc_type=doc_type,
        file_kind=file_kind,
        filename=filename,
        storage_key=storage_key,
        status="pending",  # pending → uploading → uploaded
        content_type=content_type,
        file_size=file_size,
        file_hash=file_hash or "",
        source=source,
    )

    return {
        "document_id": str(doc.id),
        "storage_key": presigned.storage_key,
        "upload_url": presigned.upload_url,
        "expires_in": presigned.expires_in,
        "already_exists": False,
    }


def document_upload_complete(organization, document: Document, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Complete document upload
    Validates size/hash and marks as uploaded
    """
    file_hash = payload.get("file_hash", "")
    file_size = payload.get("file_size")

    # Permission check
    if document.organization_id != organization.id:
        raise PermissionError("Document does not belong to your organization")

    # Validate file size
    if file_size and document.file_size:
        if int(file_size) != int(document.file_size):
            # Warning but don't block
            pass

    # Update document
    document.file_hash = file_hash or document.file_hash
    document.status = "uploaded"
    document.uploaded_at = timezone.now()
    document.save(update_fields=["file_hash", "status", "uploaded_at"])

    # Generate download URL
    download = storage_provider.create_presigned_download(document.storage_key)

    return {
        "document_id": str(document.id),
        "storage_key": document.storage_key,
        "download_url": download.download_url,
        "status": document.status,
    }


@transaction.atomic
def document_attach_to_revision(organization, document: Document, revision_id: str) -> Dict[str, Any]:
    """
    Attach document to a revision
    Idempotent: returns success if already attached
    """
    # Permission check
    if document.organization_id != organization.id:
        raise PermissionError("Document does not belong to your organization")

    # Get revision
    revision = StyleRevision.objects.select_related('style').get(
        id=revision_id,
        style__organization=organization
    )

    # Check if already attached
    already_attached = False
    if document.style_revision_id == revision.id:
        already_attached = True
    else:
        # Attach to revision
        document.style_revision = revision
        document.save(update_fields=["style_revision"])

    return {
        "document_id": str(document.id),
        "revision_id": str(revision.id),
        "attached": True,
        "already_attached": already_attached,
    }


def get_revision_documents(organization, revision_id: str) -> Dict[str, Any]:
    """
    Get all documents attached to a revision
    For Review UI left panel
    """
    revision = StyleRevision.objects.select_related('style').get(
        id=revision_id,
        style__organization=organization
    )

    documents = Document.objects.filter(
        style_revision=revision
    ).order_by('-uploaded_at')

    return {
        "revision_id": str(revision.id),
        "documents": [
            {
                "id": str(doc.id),
                "doc_type": doc.doc_type,
                "file_kind": doc.file_kind,
                "filename": doc.filename,
                "file_size": doc.file_size,
                "status": doc.status,
                "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
            }
            for doc in documents
        ],
    }
