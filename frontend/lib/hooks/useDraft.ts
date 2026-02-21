/**
 * Draft Review Hooks - Block-Based Revision API
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Revision, RevisionResponse } from '@/lib/types/revision';
import { API_BASE_URL } from '@/lib/api/client';
import { useAuthStore } from '@/lib/stores/authStore';

const API_BASE = API_BASE_URL;

/**
 * Read JWT token directly from storage (bypasses Zustand hydration timing)
 * Checks both sessionStorage and localStorage (matches authStore persist logic)
 */
function getTokenFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw =
      sessionStorage.getItem('auth-storage') ||
      localStorage.getItem('auth-storage');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.accessToken ?? null;
  } catch {
    return null;
  }
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getTokenFromStorage();
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  // Auto-refresh on 401
  if (res.status === 401 && token) {
    const refreshed = await useAuthStore.getState().refreshAccessToken();
    if (refreshed) {
      const newToken = getTokenFromStorage();
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
        },
      });
    } else {
      // Refresh failed → redirect to login
      useAuthStore.getState().logout();
      if (typeof window !== 'undefined') window.location.href = '/login';
    }
  }

  return res;
}

// ===== Fetch Revision Data =====
export function useDraft(revisionId: string) {
  return useQuery({
    queryKey: ['draft', revisionId],
    queryFn: async (): Promise<RevisionResponse> => {
      const res = await fetchWithAuth(`${API_BASE}/revisions/${revisionId}/`);
      if (!res.ok) {
        throw new Error(`Failed to fetch revision: ${res.status} ${res.statusText}`);
      }
      const data: Revision = await res.json();
      return { data };
    },
    enabled: !!revisionId,
    staleTime: 30000,
    retry: 1,
  });
}

// ===== Update Single Draft Block (PATCH) =====
export function useUpdateDraftBlock(revisionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ blockId, editedText }: { blockId: string; editedText: string }) => {
      const res = await fetchWithAuth(`${API_BASE}/draft-blocks/${blockId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edited_text: editedText }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || `Failed to update block: ${res.statusText}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft', revisionId] });
    },
  });
}

// ===== Approve Revision =====
export function useApproveRevision(revisionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetchWithAuth(`${API_BASE}/revisions/${revisionId}/approve/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.errors?.[0]?.message || 'Failed to approve');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft', revisionId] });
      queryClient.invalidateQueries({ queryKey: ['revisions'] });
    },
  });
}

// ===== Extraction Run Status (for polling) =====
export function useExtractionRun(runId: string | null) {
  return useQuery({
    queryKey: ['extraction-run', runId],
    queryFn: async () => {
      if (!runId) return null;
      try {
        const res = await fetchWithAuth(`${API_BASE}/extraction-runs/${runId}/`);
        if (!res.ok) return null;
        return res.json();
      } catch {
        return null;
      }
    },
    enabled: !!runId,
    refetchInterval: (query) => {
      if (!query.state.data) return false;
      const status = (query.state.data as any)?.status;
      return status === 'pending' || status === 'processing' ? 2000 : false;
    },
  });
}
