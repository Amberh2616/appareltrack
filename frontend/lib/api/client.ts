/**
 * API Client Configuration
 * Base URL and common fetch wrapper with auto token refresh
 */

import { getAccessToken, useAuthStore } from '@/lib/stores/authStore';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v2';

export interface ApiError {
  message: string;
  status: number;
  errors?: Record<string, string[]>;
}

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Execute fetch with current token
 */
async function executeRequest<T>(
  url: string,
  options?: RequestInit,
  token?: string | null
): Promise<Response> {
  const authHeaders: Record<string, string> = {};
  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers: {
      ...authHeaders,
      ...options?.headers,
    },
  });
}

/**
 * Parse response and return data
 */
async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    if (!response.ok) {
      throw {
        message: `HTTP Error: ${response.status} ${response.statusText}`,
        status: response.status,
      } as ApiError;
    }
    return null as T;
  }

  const json = await response.json();

  if (!response.ok) {
    throw {
      message: json.detail || json.message || 'Request failed',
      status: response.status,
      errors: json.errors,
    } as ApiError;
  }

  if (json && typeof json === 'object' && 'data' in json) {
    return json.data as T;
  }

  return json as T;
}

/**
 * Enhanced fetch wrapper with auto token refresh on 401
 */
export async function apiClient<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getAccessToken();

  try {
    const response = await executeRequest(url, options, token);

    // If 401 and we have a token, try to refresh
    if (response.status === 401 && token) {
      // Prevent multiple simultaneous refresh attempts
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = useAuthStore.getState().refreshAccessToken();
      }

      const refreshed = await refreshPromise;
      isRefreshing = false;
      refreshPromise = null;

      if (refreshed) {
        // Retry with new token
        const newToken = getAccessToken();
        const retryResponse = await executeRequest(url, options, newToken);
        return parseResponse<T>(retryResponse);
      } else {
        // Refresh failed, logout and redirect
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        throw { message: 'Session expired', status: 401 } as ApiError;
      }
    }

    return parseResponse<T>(response);
  } catch (error) {
    if ((error as ApiError).status) {
      throw error;
    }

    throw {
      message: error instanceof Error ? error.message : 'Network error',
      status: 0,
    } as ApiError;
  }
}

/**
 * Upload file with FormData
 */
export async function uploadFile<T>(
  endpoint: string,
  formData: FormData
): Promise<T> {
  return apiClient<T>(endpoint, {
    method: 'POST',
    body: formData,
    // Don't set Content-Type, browser will set it with boundary
  });
}

// Object-style API client (for compatibility)
apiClient.get = async function<T>(endpoint: string): Promise<T> {
  return apiClient<T>(endpoint, { method: 'GET' });
};

apiClient.post = async function<T>(endpoint: string, data?: unknown): Promise<T> {
  return apiClient<T>(endpoint, {
    method: 'POST',
    headers: data ? { 'Content-Type': 'application/json' } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
};

apiClient.patch = async function<T>(endpoint: string, data?: unknown): Promise<T> {
  return apiClient<T>(endpoint, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
};

apiClient.delete = async function<T>(endpoint: string): Promise<T> {
  return apiClient<T>(endpoint, { method: 'DELETE' });
};

export { API_BASE_URL };
