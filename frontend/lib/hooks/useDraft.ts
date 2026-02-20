/**
 * Draft Review Hooks - Block-Based Revision API
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Revision, RevisionResponse } from '@/lib/types/revision';
import { API_BASE_URL, getAccessToken } from '@/lib/api/client';

const API_BASE = API_BASE_URL;

function authHeaders() {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ===== Fetch Revision Data =====
export function useDraft(revisionId: string) {
  return useQuery({
    queryKey: ['draft', revisionId],
    queryFn: async (): Promise<RevisionResponse> => {
      const res = await fetch(`${API_BASE}/revisions/${revisionId}/`, {
        headers: authHeaders(),
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch revision: ${res.statusText}`);
      }
      const data: Revision = await res.json();
      return { data };
    },
    enabled: !!revisionId,
    staleTime: 30000, // 30 seconds
    retry: 2,
  });
}

// ===== Update Single Draft Block (PATCH) =====
export function useUpdateDraftBlock(revisionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ blockId, editedText }: { blockId: string; editedText: string }) => {
      const res = await fetch(`${API_BASE}/draft-blocks/${blockId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({ edited_text: editedText }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || `Failed to update block: ${res.statusText}`);
      }

      return res.json();
    },
    onSuccess: () => {
      // Invalidate draft query to refetch all blocks
      queryClient.invalidateQueries({ queryKey: ['draft', revisionId] });
    },
  });
}

// ===== Approve Revision =====
export function useApproveRevision(revisionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/revisions/${revisionId}/approve/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
      });

      if (!res.ok) {
        const error = await res.json();
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

      const res = await fetch(`${API_BASE}/extraction-runs/${runId}/`);
      if (!res.ok) {
        // May require auth, skip for now
        return null;
      }
      return res.json();
    },
    enabled: !!runId,
    refetchInterval: (query) => {
      // Poll every 2s if status is pending/processing
      if (!query.state.data) return false;
      const status = query.state.data?.status;
      return status === 'pending' || status === 'processing' ? 2000 : false;
    },
  });
}
