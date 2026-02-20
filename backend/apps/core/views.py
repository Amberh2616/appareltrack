"""
Core views - Health check, Auth, and basic utilities
"""

from django.http import JsonResponse
from django.db import connection
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.template.loader import render_to_string
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
import redis
import logging

from rest_framework import viewsets, filters
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend

from .models import User, Organization
from .serializers import (
    RegisterSerializer,
    UserSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    UserListSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
    InviteUserSerializer,
    OrganizationSerializer,
)
from .permissions import IsAdmin, has_permission

logger = logging.getLogger(__name__)


# =============================================================================
# Auth Views
# =============================================================================

@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """
    Register a new user.

    POST /api/v2/auth/register/
    {
        "username": "newuser",
        "email": "user@example.com",
        "password": "securepassword123",
        "password_confirm": "securepassword123",
        "first_name": "John",
        "last_name": "Doe"
    }
    """
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        return Response({
            'message': 'User registered successfully.',
            'user': UserSerializer(user).data
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def get_current_user(request):
    """
    Get current authenticated user info.

    GET /api/v2/auth/user/
    """
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_request(request):
    """
    Request a password reset email.

    POST /api/v2/auth/password-reset/
    {
        "email": "user@example.com"
    }
    """
    serializer = PasswordResetRequestSerializer(data=request.data)
    if serializer.is_valid():
        email = serializer.validated_data['email']
        try:
            user = User.objects.get(email=email)
            # Generate token
            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))

            # Build reset URL (frontend URL)
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
            reset_url = f"{frontend_url}/reset-password?uid={uid}&token={token}"

            # Send email
            subject = 'Password Reset Request - Fashion PLM'
            message = f"""
Hello {user.first_name or user.username},

You requested a password reset for your Fashion PLM account.

Click the link below to reset your password:
{reset_url}

This link will expire in 24 hours.

If you didn't request this, please ignore this email.

Best regards,
Fashion PLM Team
"""
            try:
                send_mail(
                    subject,
                    message,
                    settings.DEFAULT_FROM_EMAIL if hasattr(settings, 'DEFAULT_FROM_EMAIL') else 'noreply@fashionplm.com',
                    [email],
                    fail_silently=False,
                )
                logger.info(f"Password reset email sent to {email}")
            except Exception as e:
                logger.error(f"Failed to send password reset email: {e}")
                # In development, log the reset URL
                if settings.DEBUG:
                    logger.info(f"DEBUG: Password reset URL: {reset_url}")

        except User.DoesNotExist:
            # Don't reveal whether email exists
            pass

        # Always return success to prevent email enumeration
        return Response({
            'message': 'If an account with this email exists, a password reset link has been sent.'
        })
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_confirm(request):
    """
    Confirm password reset with token.

    POST /api/v2/auth/password-reset/confirm/
    {
        "uid": "base64-encoded-user-id",
        "token": "reset-token",
        "password": "newpassword123",
        "password_confirm": "newpassword123"
    }
    """
    uid = request.data.get('uid')
    token = request.data.get('token')

    if not uid or not token:
        return Response({
            'error': 'Missing uid or token.'
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return Response({
            'error': 'Invalid reset link.'
        }, status=status.HTTP_400_BAD_REQUEST)

    if not default_token_generator.check_token(user, token):
        return Response({
            'error': 'Invalid or expired reset link.'
        }, status=status.HTTP_400_BAD_REQUEST)

    serializer = PasswordResetConfirmSerializer(data=request.data)
    if serializer.is_valid():
        user.set_password(serializer.validated_data['password'])
        user.save()
        return Response({
            'message': 'Password has been reset successfully.'
        })
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# =============================================================================
# Health Check Views
# =============================================================================


def health_check(request):
    """
    Health check endpoint for load balancers and monitoring
    """
    try:
        # Test database connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")

        return JsonResponse({
            'status': 'healthy',
            'database': 'connected'
        })
    except Exception as e:
        return JsonResponse({
            'status': 'unhealthy',
            'error': str(e)
        }, status=500)


def services_health_check(request):
    """
    Detailed health check for async processing services (Redis + Celery)
    Used by frontend to show service status before triggering async tasks.

    Returns:
        - database: Database connection status
        - redis: Redis connection status
        - celery: Celery worker status
        - async_ready: Whether async processing is available
    """
    result = {
        'database': {'status': 'unknown', 'message': ''},
        'redis': {'status': 'unknown', 'message': ''},
        'celery': {'status': 'unknown', 'message': ''},
        'async_ready': False,
    }

    # 1. Check Database
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        result['database'] = {'status': 'ok', 'message': 'Connected'}
    except Exception as e:
        result['database'] = {'status': 'error', 'message': str(e)}

    # 2. Check Redis
    try:
        broker_url = getattr(settings, 'CELERY_BROKER_URL', 'redis://localhost:6379/0')
        # Parse Redis URL
        if broker_url.startswith('redis://'):
            # Simple parse: redis://localhost:6379/0
            parts = broker_url.replace('redis://', '').split('/')
            host_port = parts[0].split(':')
            host = host_port[0] or 'localhost'
            port = int(host_port[1]) if len(host_port) > 1 else 6379
            db = int(parts[1]) if len(parts) > 1 else 0

            r = redis.Redis(host=host, port=port, db=db, socket_timeout=2)
            r.ping()
            result['redis'] = {'status': 'ok', 'message': f'Connected to {host}:{port}'}
        else:
            result['redis'] = {'status': 'warning', 'message': 'Non-Redis broker configured'}
    except redis.ConnectionError as e:
        result['redis'] = {'status': 'error', 'message': 'Redis not running. Start with: redis-server'}
    except Exception as e:
        result['redis'] = {'status': 'error', 'message': str(e)}

    # 3. Check Celery Worker
    try:
        from config.celery import app as celery_app

        # Inspect active workers (timeout 2 seconds)
        inspector = celery_app.control.inspect(timeout=2)
        active_workers = inspector.active()

        if active_workers:
            worker_count = len(active_workers)
            worker_names = list(active_workers.keys())
            result['celery'] = {
                'status': 'ok',
                'message': f'{worker_count} worker(s) online',
                'workers': worker_names
            }
        else:
            result['celery'] = {
                'status': 'error',
                'message': 'No workers online. Start with: celery -A config worker -l info --pool=solo'
            }
    except Exception as e:
        error_msg = str(e)
        if 'redis' in error_msg.lower() or 'connection' in error_msg.lower():
            result['celery'] = {'status': 'error', 'message': 'Cannot connect (Redis required)'}
        else:
            result['celery'] = {'status': 'error', 'message': error_msg}

    # 4. Determine if async is ready
    result['async_ready'] = (
        result['redis']['status'] == 'ok' and
        result['celery']['status'] == 'ok'
    )

    # Overall status
    if result['async_ready']:
        overall_status = 'healthy'
    elif result['database']['status'] == 'ok':
        overall_status = 'degraded'  # Sync mode still works
    else:
        overall_status = 'unhealthy'

    result['status'] = overall_status
    result['sync_available'] = result['database']['status'] == 'ok'

    # Add hint for degraded mode
    if overall_status == 'degraded':
        result['hint'] = 'Async processing unavailable. Sync mode will be used (slower but functional).'

    return JsonResponse(result)


# =============================================================================
# User Management ViewSet (Admin Only)
# =============================================================================

class UserViewSet(viewsets.ModelViewSet):
    """
    User management API for administrators.

    GET    /api/v2/users/              - List all users
    POST   /api/v2/users/              - Create new user
    GET    /api/v2/users/{id}/         - Get user details
    PUT    /api/v2/users/{id}/         - Update user
    PATCH  /api/v2/users/{id}/         - Partial update user
    DELETE /api/v2/users/{id}/         - Deactivate user (soft delete)

    POST   /api/v2/users/invite/       - Invite user via email
    POST   /api/v2/users/{id}/activate/   - Activate user
    POST   /api/v2/users/{id}/deactivate/ - Deactivate user
    GET    /api/v2/users/me/           - Get current user
    """
    queryset = User.objects.all().select_related('organization')
    permission_classes = [IsAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['role', 'is_active', 'organization']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    ordering_fields = ['username', 'date_joined', 'last_login']
    ordering = ['-date_joined']

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        elif self.action == 'invite':
            return InviteUserSerializer
        return UserListSerializer

    def get_queryset(self):
        """Filter users by organization for non-superusers."""
        qs = super().get_queryset()
        user = self.request.user

        # Superusers see all users
        if user.is_superuser:
            return qs

        # Admins only see users in their organization
        if user.organization:
            return qs.filter(organization=user.organization)

        return qs.none()

    def perform_destroy(self, instance):
        """Soft delete - deactivate instead of delete."""
        instance.is_active = False
        instance.save()

    @action(detail=False, methods=['get'], permission_classes=[])
    def me(self, request):
        """Get current authenticated user."""
        serializer = UserListSerializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def invite(self, request):
        """
        Invite a new user via email.

        POST /api/v2/users/invite/
        {
            "email": "newuser@example.com",
            "role": "merchandiser",
            "first_name": "John",
            "last_name": "Doe"
        }
        """
        serializer = InviteUserSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data

            # Generate username from email
            email = data['email']
            username = email.split('@')[0]
            base_username = username
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}{counter}"
                counter += 1

            # Create user with random password
            import secrets
            temp_password = secrets.token_urlsafe(16)

            user = User.objects.create_user(
                username=username,
                email=email,
                password=temp_password,
                first_name=data.get('first_name', ''),
                last_name=data.get('last_name', ''),
                role=data.get('role', 'merchandiser'),
                organization=request.user.organization,
                is_active=True,
            )

            # Generate password reset token for invite
            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))

            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
            invite_url = f"{frontend_url}/reset-password?uid={uid}&token={token}"

            # Send invite email
            subject = 'You are invited to Fashion PLM'
            message = f"""
Hello {user.first_name or user.username},

You have been invited to join Fashion PLM by {request.user.first_name or request.user.username}.

Click the link below to set your password and activate your account:
{invite_url}

This link will expire in 24 hours.

Best regards,
Fashion PLM Team
"""
            try:
                send_mail(
                    subject,
                    message,
                    settings.DEFAULT_FROM_EMAIL if hasattr(settings, 'DEFAULT_FROM_EMAIL') else 'noreply@fashionplm.com',
                    [email],
                    fail_silently=False,
                )
                logger.info(f"Invite email sent to {email}")
            except Exception as e:
                logger.error(f"Failed to send invite email: {e}")
                if settings.DEBUG:
                    logger.info(f"DEBUG: Invite URL: {invite_url}")

            return Response({
                'message': f'Invitation sent to {email}',
                'user': UserListSerializer(user).data,
                'invite_url': invite_url if settings.DEBUG else None,
            }, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate a user account."""
        user = self.get_object()
        user.is_active = True
        user.save()
        return Response({
            'message': f'User {user.username} has been activated.',
            'user': UserListSerializer(user).data,
        })

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Deactivate a user account."""
        user = self.get_object()

        # Prevent self-deactivation
        if user.id == request.user.id:
            return Response({
                'error': 'You cannot deactivate your own account.'
            }, status=status.HTTP_400_BAD_REQUEST)

        user.is_active = False
        user.save()
        return Response({
            'message': f'User {user.username} has been deactivated.',
            'user': UserListSerializer(user).data,
        })

    @action(detail=False, methods=['get'])
    def roles(self, request):
        """Get available roles."""
        return Response({
            'roles': [
                {'value': role[0], 'label': role[1]}
                for role in User.ROLE_CHOICES
            ]
        })

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get user statistics for dashboard."""
        qs = self.get_queryset()
        return Response({
            'total': qs.count(),
            'active': qs.filter(is_active=True).count(),
            'inactive': qs.filter(is_active=False).count(),
            'by_role': {
                role[0]: qs.filter(role=role[0]).count()
                for role in User.ROLE_CHOICES
            }
        })


class OrganizationViewSet(viewsets.ModelViewSet):
    """
    Organization management API (superuser only for now).
    """
    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return super().get_queryset()
        # Non-superuser admins can only see their own organization
        if user.organization:
            return Organization.objects.filter(id=user.organization.id)
        return Organization.objects.none()
