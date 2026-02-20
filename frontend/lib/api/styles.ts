/**
 * Styles API Client
 * Handles all style-related API calls
 */

import { apiClient } from './client';
import type {
  Style,
  StyleDetail,
  StyleListItem,
  PaginatedResponse,
  CreateStyleInput,
  CreateRevisionInput,
  StyleRevision,
} from '../types';

// Re-export types used by hooks
export type { StyleRevision };

const BASE_PATH = '/styles';

/**
 * List styles with pagination and filters
 */
export interface ListStylesParams {
  page?: number;
  page_size?: number;
  search?: string;
  season?: string;
  year?: number;
  customer?: string;
  status?: string;
  ordering?: string; // e.g., "-created_at", "style_number"
}

export async function listStyles(
  params?: ListStylesParams
): Promise<PaginatedResponse<StyleListItem>> {
  const searchParams = new URLSearchParams();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
  }

  const query = searchParams.toString();
  const endpoint = query ? `${BASE_PATH}/?${query}` : `${BASE_PATH}/`;

  const data = await apiClient<StyleListItem[] | PaginatedResponse<StyleListItem>>(endpoint);

  // Backend returns array (apiClient unwraps `data`), wrap into PaginatedResponse
  if (Array.isArray(data)) {
    return { results: data, count: data.length, next: null, previous: null };
  }
  return data;
}

/**
 * Get style by ID
 */
export async function getStyle(id: string): Promise<StyleDetail> {
  return apiClient<StyleDetail>(`${BASE_PATH}/${id}`);
}

/**
 * Get revision by ID
 */
export async function getRevision(revisionId: string): Promise<StyleRevision> {
  return apiClient<StyleRevision>(`/style-revisions/${revisionId}/`);
}

/**
 * Create new style
 */
export async function createStyle(
  data: CreateStyleInput
): Promise<Style> {
  return apiClient<Style>(BASE_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

/**
 * Update style
 */
export async function updateStyle(
  id: string,
  data: Partial<CreateStyleInput>
): Promise<Style> {
  return apiClient<Style>(`${BASE_PATH}/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

/**
 * Delete style
 */
export async function deleteStyle(id: string): Promise<void> {
  return apiClient<void>(`${BASE_PATH}/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Create new revision for a style
 */
export async function createRevision(
  styleId: string,
  data: CreateRevisionInput
): Promise<StyleRevision> {
  return apiClient<StyleRevision>(`${BASE_PATH}/${styleId}/revisions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

/**
 * Approve a revision
 */
export async function approveRevision(
  revisionId: string,
  notes?: string
): Promise<StyleRevision> {
  return apiClient<StyleRevision>(`/revisions/${revisionId}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ approval_notes: notes || '' }),
  });
}

/**
 * Trigger parsing for a revision
 */
export interface ParseRevisionResponse {
  extraction_run_id: string;
  status: string;
  message: string;
}

export async function parseRevision(
  revisionId: string,
  targets?: string[]
): Promise<ParseRevisionResponse> {
  return apiClient<ParseRevisionResponse>(`/revisions/${revisionId}/parse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      targets: targets || ['bom', 'measurement', 'construction'],
    }),
  });
}

/**
 * Get draft data for a revision
 */
export interface DraftData {
  bom: {
    items: any[];
    issues: any[];
  };
  measurement: {
    points: any[];
    issues: any[];
  };
  construction: {
    steps: any[];
    issues: any[];
  };
}

export async function getRevisionDraft(
  revisionId: string
): Promise<DraftData> {
  return apiClient<DraftData>(`/revisions/${revisionId}/draft`);
}

/**
 * Update verified data for a revision
 */
export async function updateRevisionVerified(
  revisionId: string,
  data: {
    bom?: any;
    measurement?: any;
    construction?: any;
    packaging?: any;
  }
): Promise<StyleRevision> {
  return apiClient<StyleRevision>(`/revisions/${revisionId}/verified`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

/**
 * Batch parse multiple revisions
 */
export interface BatchParseRequest {
  revision_ids: string[];
  targets?: string[];
}

export interface BatchParseResponse {
  batch_run_id: string;
  total_items: number;
  status: string;
}

export async function batchParse(
  data: BatchParseRequest
): Promise<BatchParseResponse> {
  return apiClient<BatchParseResponse>('/batch-runs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      run_type: 'parse',
      ...data,
    }),
  });
}
