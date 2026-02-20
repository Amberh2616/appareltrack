"""
Documents Storage - v2.2.1
Handles S3/MinIO presigned URL generation
"""

import uuid
from dataclasses import dataclass
from datetime import datetime


@dataclass
class UploadInitResult:
    """Result of upload initialization"""
    storage_key: str
    upload_url: str
    expires_in: int


@dataclass
class DownloadUrlResult:
    """Result of download URL generation"""
    download_url: str
    expires_in: int


class StorageProvider:
    """
    Storage provider for document uploads
    MVP: Returns mock URLs for local development
    Production: Will use boto3/minio for real presigned URLs
    """

    def build_storage_key(self, organization_id: str, doc_type: str, file_kind: str, filename: str) -> str:
        """
        Build storage key for uploaded file
        Format: {org_id}/{doc_type}/{year}/{month}/{uuid}.{ext}
        """
        now = datetime.utcnow()
        file_uuid = uuid.uuid4()

        # Extract extension from filename
        ext = filename.rsplit('.', 1)[-1] if '.' in filename else file_kind

        return f"{organization_id}/{doc_type}/{now.year}/{now.month:02d}/{file_uuid}.{ext}"

    def create_presigned_upload(self, storage_key: str, content_type: str) -> UploadInitResult:
        """
        Generate presigned upload URL
        TODO: Replace with actual S3/MinIO implementation
        """
        # Mock implementation for development
        upload_url = f"http://localhost:9000/uploads/{storage_key}"

        return UploadInitResult(
            storage_key=storage_key,
            upload_url=upload_url,
            expires_in=900,  # 15 minutes
        )

    def create_presigned_download(self, storage_key: str) -> DownloadUrlResult:
        """
        Generate presigned download URL
        TODO: Replace with actual S3/MinIO implementation
        """
        # Mock implementation for development
        download_url = f"http://localhost:9000/downloads/{storage_key}"

        return DownloadUrlResult(
            download_url=download_url,
            expires_in=900,  # 15 minutes
        )


# Singleton instance
storage_provider = StorageProvider()
