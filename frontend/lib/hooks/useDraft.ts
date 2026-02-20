/**
 * Draft Review Hooks - Block-Based Revision API
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Revision, RevisionResponse } from '@/lib/types/revision';
import { apiClient } from '@/lib/api/client';

// ===== Fetch Revision Data =====
export function useDraft(revisionId: string) {
  return useQuery({
    queryKey: ['draft', revisionId],
    queryFn: async (): Promise<RevisionResponse> => {
      // apiClient handles JWT injection + auto token refresh
      const data = await apiClient<Revision>(`/revisions/${revisionId}/`);
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
      return apiClient(`/draft-blocks/${blockId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edited_text: editedText }),
      });
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
      return apiClient(`/revisions/${revisionId}/approve/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
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
        return await apiClient(`/extraction-runs/${runId}/`);
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
