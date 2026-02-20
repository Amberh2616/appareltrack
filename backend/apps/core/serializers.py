"""
Core serializers
"""

from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import Organization, User


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ['id', 'name', 'ai_budget_monthly', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class UserSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source='organization.name', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'organization', 'organization_name', 'role',
            'email_notifications', 'date_joined'
        ]
        read_only_fields = ['id', 'date_joined']


class RegisterSerializer(serializers.ModelSerializer):
    """Serializer for user registration"""
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password_confirm', 'first_name', 'last_name']

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({
                'password_confirm': 'Passwords do not match.'
            })
        return attrs

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )
        return user


class PasswordResetRequestSerializer(serializers.Serializer):
    """Serializer for password reset request"""
    email = serializers.EmailField(required=True)


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Serializer for password reset confirmation"""
    token = serializers.CharField(required=True)
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({
                'password_confirm': 'Passwords do not match.'
            })
        return attrs


# =============================================================================
# User Management Serializers (Admin)
# =============================================================================

class UserListSerializer(serializers.ModelSerializer):
    """Serializer for user list (minimal info)"""
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'role_display', 'organization', 'organization_name',
            'is_active', 'date_joined', 'last_login'
        ]
        read_only_fields = ['id', 'date_joined', 'last_login']


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating users (admin)"""
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        style={'input_type': 'password'}
    )
    send_invite = serializers.BooleanField(default=True, write_only=True)

    class Meta:
        model = User
        fields = [
            'username', 'email', 'first_name', 'last_name',
            'role', 'organization', 'password', 'send_invite'
        ]

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value

    def create(self, validated_data):
        send_invite = validated_data.pop('send_invite', True)
        password = validated_data.pop('password', None)

        user = User.objects.create(**validated_data)

        if password:
            user.set_password(password)
        else:
            # Generate random password if not provided
            import secrets
            user.set_password(secrets.token_urlsafe(16))

        user.save()

        # TODO: Send invite email if send_invite is True
        # This would send a password reset link to the user

        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating users (admin)"""
    organization_name = serializers.CharField(source='organization.name', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'organization', 'organization_name',
            'is_active', 'email_notifications'
        ]
        read_only_fields = ['id', 'username']  # Username cannot be changed

    def validate_email(self, value):
        user = self.instance
        if User.objects.filter(email=value).exclude(pk=user.pk).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value


class InviteUserSerializer(serializers.Serializer):
    """Serializer for inviting users via email"""
    email = serializers.EmailField(required=True)
    role = serializers.ChoiceField(choices=User.ROLE_CHOICES, default='merchandiser')
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value
