/**
 * Batch Upload API Client
 */

import { API_BASE_URL } from './client';

export interface StyleResult {
  style_number: string;
  style_id: string | null;
  revision_id: string | null;
  style_created?: boolean;
  documents: {
    id: string;
    filename: string;
    file_type: string;
    status: string;
  }[];
  status: 'pending' | 'created' | 'error';
  error?: string;
}

export interface BatchUploadResponse {
  total_files: number;
  styles_found: number;
  styles_created: number;
  documents_created: number;
  errors: string[];
  style_results: Record<string, StyleResult>;
}

export interface BatchProcessResponse {
  total: number;
  processed: number;
  failed: number;
  results: Record<string, {
    status: 'completed' | 'error' | 'skipped';
    blocks_count?: number;
    bom_items_count?: number;
    measurements_count?: number;
    revision_id?: string;
    error?: string;
    reason?: string;
  }>;
}

/**
 * Upload ZIP file containing multiple Tech Pack PDFs
 */
export async function batchUpload(file: File): Promise<BatchUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/uploaded-documents/batch-upload/`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Batch upload failed');
  }

  return response.json();
}

/**
 * Process uploaded documents (classify + extract)
 */
export async function batchProcess(
  documentIds: string[],
  runAsync: boolean = false
): Promise<BatchProcessResponse> {
  const response = await fetch(`${API_BASE_URL}/uploaded-documents/batch-process/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      document_ids: documentIds,
      async: runAsync,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Batch process failed');
  }

  return response.json();
}
