/**
 * Translation API - 延遲翻譯優化
 */

import { API_BASE_URL } from './client';
import { getAccessToken } from '@/lib/stores/authStore';

export interface TranslationStats {
  total: number;
  success: number;
  failed: number;
  pages?: number;
}

export interface PageProgress {
  page_id: string;
  page_number: number;
  total: number;
  done: number;
  pending: number;
  failed: number;
  skipped: number;
  progress: number;
}

export interface TranslationProgress {
  total: number;
  done: number;
  pending: number;
  failed: number;
  skipped: number;
  translating: number;
  progress: number;
  pages: PageProgress[];
}

export interface AsyncTaskResponse {
  task_id: string;
  status: 'pending';
}

const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAccessToken()}`,
});

/**
 * Get translation progress for a revision
 */
export async function getTranslationProgress(revisionId: string): Promise<TranslationProgress> {
  const response = await fetch(
    `${API_BASE_URL}/revisions/${revisionId}/translation-progress/`,
    { headers: authHeaders() }
  );

  if (!response.ok) {
    throw new Error('Failed to get translation progress');
  }

  return response.json();
}

/**
 * Translate entire document
 */
export async function translateDocument(
  revisionId: string,
  options: { mode?: 'missing_only' | 'all'; async?: boolean } = {}
): Promise<TranslationStats | AsyncTaskResponse> {
  const { mode = 'missing_only', async: useAsync = false } = options;

  const response = await fetch(
    `${API_BASE_URL}/revisions/${revisionId}/translate-batch/`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ mode, async: useAsync }),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to translate document');
  }

  return response.json();
}

/**
 * Translate a single page
 */
export async function translatePage(
  revisionId: string,
  pageNumber: number,
  options: { force?: boolean; async?: boolean } = {}
): Promise<TranslationStats | AsyncTaskResponse> {
  const { force = false, async: useAsync = false } = options;

  const response = await fetch(
    `${API_BASE_URL}/revisions/${revisionId}/translate-page/${pageNumber}/`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ force, async: useAsync }),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to translate page');
  }

  return response.json();
}

/**
 * Retry failed translations
 */
export async function retryFailedTranslations(
  revisionId: string,
  options: { async?: boolean } = {}
): Promise<TranslationStats | AsyncTaskResponse> {
  const { async: useAsync = false } = options;

  const response = await fetch(
    `${API_BASE_URL}/revisions/${revisionId}/retry-failed/`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ async: useAsync }),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to retry translations');
  }

  return response.json();
}
