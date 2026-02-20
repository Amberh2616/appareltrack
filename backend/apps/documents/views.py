"""
Documents Views - v2.2.1
"""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from apps.core.api_utils import api_success, api_error, ErrorCodes
from .models import Document
from .serializers import (
    DocumentUploadInitSerializer,
    DocumentUploadCompleteSerializer,
    DocumentAttachSerializer,
    DocumentListSerializer,
)
from .services import (
    document_upload_init,
    document_upload_complete,
    document_attach_to_revision,
    get_revision_documents,
)


class DocumentViewSet(viewsets.ViewSet):
    """
    ViewSet for Document upload and management
    """
    # TODO: Enable authentication in production
    # permission_classes = [IsAuthenticated]
    permission_classes = []

    def _get_organization(self, request):
        """Get organization from request user"""
        org = getattr(request.user, 'organization', None)
        if org is None:
            from apps.core.models import Organization
            org = Organization.objects.first()
        return org

    @action(detail=False, methods=['post'], url_path='upload-init')
    def upload_init(self, request):
        """
        POST /api/v2/documents/upload-init
        Initialize document upload, get presigned URL
        """
        org = self._get_organization(request)
        if org is None:
            return api_error(
                code=ErrorCodes.UNAUTHORIZED,
                message="Organization not found",
                status_code=status.HTTP_403_FORBIDDEN
            )

        serializer = DocumentUploadInitSerializer(data=request.data)
        if not serializer.is_valid():
            return api_error(
                code=ErrorCodes.VALIDATION_ERROR,
                message="Invalid upload-init payload",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        try:
            data = document_upload_init(org, serializer.validated_data)
            return api_success(data=data, status_code=status.HTTP_200_OK)
        except Exception as e:
            return api_error(
                code=ErrorCodes.INTERNAL_ERROR,
                message=str(e),
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'], url_path='complete')
    def complete(self, request, pk=None):
        """
        POST /api/v2/documents/{id}/complete
        Complete upload, mark as uploaded
        """
        org = self._get_organization(request)
        if org is None:
            return api_error(
                code=ErrorCodes.UNAUTHORIZED,
                message="Organization not found",
                status_code=status.HTTP_403_FORBIDDEN
            )

        serializer = DocumentUploadCompleteSerializer(data=request.data)
        if not serializer.is_valid():
            return api_error(
                code=ErrorCodes.VALIDATION_ERROR,
                message="Invalid complete payload",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        doc = get_object_or_404(Document, id=pk)

        try:
            data = document_upload_complete(org, doc, serializer.validated_data)
            return api_success(data=data, status_code=status.HTTP_200_OK)
        except PermissionError as e:
            return api_error(
                code=ErrorCodes.FORBIDDEN,
                message=str(e),
                status_code=status.HTTP_403_FORBIDDEN
            )
        except ValueError as e:
            return api_error(
                code=ErrorCodes.VALIDATION_ERROR,
                message=str(e),
                status_code=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return api_error(
                code=ErrorCodes.INTERNAL_ERROR,
                message=str(e),
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'], url_path='attach')
    def attach(self, request, pk=None):
        """
        POST /api/v2/documents/{id}/attach
        Attach document to a revision
        """
        org = self._get_organization(request)
        if org is None:
            return api_error(
                code=ErrorCodes.UNAUTHORIZED,
                message="Organization not found",
                status_code=status.HTTP_403_FORBIDDEN
            )

        serializer = DocumentAttachSerializer(data=request.data)
        if not serializer.is_valid():
            return api_error(
                code=ErrorCodes.VALIDATION_ERROR,
                message="Invalid attach payload",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        doc = get_object_or_404(Document, id=pk)

        try:
            data = document_attach_to_revision(
                org,
                doc,
                str(serializer.validated_data["revision_id"])
            )
            return api_success(data=data, status_code=status.HTTP_200_OK)
        except PermissionError as e:
            return api_error(
                code=ErrorCodes.FORBIDDEN,
                message=str(e),
                status_code=status.HTTP_403_FORBIDDEN
            )
        except Exception as e:
            return api_error(
                code=ErrorCodes.INTERNAL_ERROR,
                message=str(e),
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def list(self, request):
        """
        GET /api/v2/documents
        List documents (optionally filter by revision)
        """
        org = self._get_organization(request)
        if org is None:
            return api_error(
                code=ErrorCodes.UNAUTHORIZED,
                message="Organization not found",
                status_code=status.HTTP_403_FORBIDDEN
            )

        revision_id = request.query_params.get('revision_id')

        if revision_id:
            try:
                data = get_revision_documents(org, revision_id)
                return api_success(data=data, status_code=status.HTTP_200_OK)
            except Exception as e:
                return api_error(
                    code=ErrorCodes.INTERNAL_ERROR,
                    message=str(e),
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        # List all documents
        documents = Document.objects.filter(organization=org).order_by('-uploaded_at')[:100]
        serializer = DocumentListSerializer(documents, many=True)

        return api_success(data=serializer.data, status_code=status.HTTP_200_OK)
