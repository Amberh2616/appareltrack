/**
 * Draft Block API
 * Handles block editing and revision updates
 */

import { apiClient } from './client';

export interface DraftBlockPatch {
  edited_text?: string;
  status?: 'auto' | 'edited' | 'verified';
}

export interface DraftBlockPatchResponse {
  id: string;
  edited_text: string;
  status: 'auto' | 'edited' | 'verified';
  updated_at: string;
}

/**
 * Update a draft block (PATCH)
 * Endpoint: PATCH /api/v2/draft-blocks/{id}/
 */
export async function updateDraftBlock(
  blockId: string,
  data: DraftBlockPatch
): Promise<DraftBlockPatchResponse> {
  return apiClient<DraftBlockPatchResponse>(`/draft-blocks/${blockId}/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

/**
 * Approve a revision
 * Endpoint: POST /api/v2/revisions/{id}/approve/
 */
export async function approveRevision(revisionId: string): Promise<{ status: string }> {
  return apiClient<{ status: string }>(`/revisions/${revisionId}/approve/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
