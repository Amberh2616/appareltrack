/**
 * Authentication API
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v2';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface TokenPair {
  access: string;
  refresh: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

/**
 * Login and get JWT tokens
 */
export async function login(credentials: LoginCredentials): Promise<TokenPair> {
  const response = await fetch(`${API_BASE_URL}/auth/token/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Login failed');
  }

  return response.json();
}

/**
 * Refresh access token
 */
export async function refreshToken(refresh: string): Promise<{ access: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh }),
  });

  if (!response.ok) {
    throw new Error('Token refresh failed');
  }

  return response.json();
}

/**
 * Get current user info
 */
export async function getCurrentUser(accessToken: string): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/auth/user/`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get user info');
  }

  return response.json();
}

/**
 * Register a new user
 */
export interface RegisterData {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
  first_name?: string;
  last_name?: string;
}

export async function register(data: RegisterData): Promise<{ message: string; user: User }> {
  const response = await fetch(`${API_BASE_URL}/auth/register/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    // Format validation errors
    if (typeof error === 'object' && !error.detail) {
      const messages = Object.entries(error)
        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
        .join('; ');
      throw new Error(messages || 'Registration failed');
    }
    throw new Error(error.detail || 'Registration failed');
  }

  return response.json();
}

/**
 * Request password reset
 */
export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/password-reset/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to send reset email');
  }

  return response.json();
}

/**
 * Confirm password reset
 */
export interface PasswordResetConfirmData {
  uid: string;
  token: string;
  password: string;
  password_confirm: string;
}

export async function confirmPasswordReset(data: PasswordResetConfirmData): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/password-reset/confirm/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.detail || 'Failed to reset password');
  }

  return response.json();
}
