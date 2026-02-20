/**
 * User Management API
 */

import { API_BASE_URL } from './client';
import { getAccessToken } from '@/lib/stores/authStore';

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'merchandiser' | 'factory' | 'viewer';
  role_display: string;
  organization: string | null;
  organization_name: string | null;
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
}

export interface UserCreateData {
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  password?: string;
  send_invite?: boolean;
}

export interface UserUpdateData {
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  is_active?: boolean;
  email_notifications?: boolean;
}

export interface InviteUserData {
  email: string;
  role?: string;
  first_name?: string;
  last_name?: string;
}

export interface UserStats {
  total: number;
  active: number;
  inactive: number;
  by_role: Record<string, number>;
}

export interface Role {
  value: string;
  label: string;
}

const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAccessToken()}`,
});

/**
 * List all users
 */
export async function listUsers(params?: {
  search?: string;
  role?: string;
  is_active?: boolean;
}): Promise<User[]> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set('search', params.search);
  if (params?.role) searchParams.set('role', params.role);
  if (params?.is_active !== undefined) searchParams.set('is_active', String(params.is_active));

  const url = `${API_BASE_URL}/auth/users/?${searchParams.toString()}`;
  const response = await fetch(url, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }

  return response.json();
}

/**
 * Get user by ID
 */
export async function getUser(id: number): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/auth/users/${id}/`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user');
  }

  return response.json();
}

/**
 * Create new user
 */
export async function createUser(data: UserCreateData): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/auth/users/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || JSON.stringify(error) || 'Failed to create user');
  }

  return response.json();
}

/**
 * Update user
 */
export async function updateUser(id: number, data: UserUpdateData): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/auth/users/${id}/`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to update user');
  }

  return response.json();
}

/**
 * Invite user via email
 */
export async function inviteUser(data: InviteUserData): Promise<{ message: string; user: User; invite_url?: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/users/invite/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || error.email?.[0] || 'Failed to invite user');
  }

  return response.json();
}

/**
 * Activate user
 */
export async function activateUser(id: number): Promise<{ message: string; user: User }> {
  const response = await fetch(`${API_BASE_URL}/auth/users/${id}/activate/`, {
    method: 'POST',
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to activate user');
  }

  return response.json();
}

/**
 * Deactivate user
 */
export async function deactivateUser(id: number): Promise<{ message: string; user: User }> {
  const response = await fetch(`${API_BASE_URL}/auth/users/${id}/deactivate/`, {
    method: 'POST',
    headers: authHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to deactivate user');
  }

  return response.json();
}

/**
 * Get available roles
 */
export async function getRoles(): Promise<{ roles: Role[] }> {
  const response = await fetch(`${API_BASE_URL}/auth/users/roles/`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch roles');
  }

  return response.json();
}

/**
 * Get user statistics
 */
export async function getUserStats(): Promise<UserStats> {
  const response = await fetch(`${API_BASE_URL}/auth/users/stats/`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user stats');
  }

  return response.json();
}

/**
 * Get current user
 */
export async function getCurrentUser(): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/auth/users/me/`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch current user');
  }

  return response.json();
}
