/**
 * BOM API Client
 */

import { apiClient } from './client';
import type { BOMListResponse, BOMItem, UpdateBOMItemPayload, TranslateBatchResponse, CreateBOMItemPayload } from '../types/bom';

/**
 * Fetch BOM items for a specific revision
 */
export async function fetchBOMItems(revisionId: string): Promise<BOMListResponse> {
  return apiClient<BOMListResponse>(`/style-revisions/${revisionId}/bom/`);
}

/**
 * Fetch a single BOM item
 */
export async function fetchBOMItem(revisionId: string, itemId: string): Promise<BOMItem> {
  return apiClient<BOMItem>(`/style-revisions/${revisionId}/bom/${itemId}/`);
}

/**
 * Create a new BOM item
 */
export async function createBOMItem(
  revisionId: string,
  data: CreateBOMItemPayload
): Promise<BOMItem> {
  return apiClient<BOMItem>(`/style-revisions/${revisionId}/bom/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

/**
 * Update a BOM item (PATCH)
 */
export async function updateBOMItem(
  revisionId: string,
  itemId: string,
  data: UpdateBOMItemPayload
): Promise<BOMItem> {
  return apiClient<BOMItem>(`/style-revisions/${revisionId}/bom/${itemId}/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

/**
 * Delete a BOM item
 */
export async function deleteBOMItem(revisionId: string, itemId: string): Promise<void> {
  return apiClient<void>(`/style-revisions/${revisionId}/bom/${itemId}/`, {
    method: 'DELETE',
  });
}

/**
 * Translate a single BOM item to Chinese
 */
export async function translateBOMItem(
  revisionId: string,
  itemId: string
): Promise<BOMItem> {
  return apiClient<BOMItem>(`/style-revisions/${revisionId}/bom/${itemId}/translate/`, {
    method: 'POST',
  });
}

/**
 * Batch translate all BOM items for a revision
 */
export async function translateBOMBatch(
  revisionId: string,
  force: boolean = false
): Promise<TranslateBatchResponse> {
  return apiClient<TranslateBatchResponse>(`/style-revisions/${revisionId}/bom/translate-batch/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ force }),
  });
}

// ====== 用量四階段管理 API ======

/**
 * 設置預估用量
 */
export async function setPreEstimate(
  revisionId: string,
  itemId: string,
  value: string
): Promise<BOMItem> {
  return apiClient<BOMItem>(`/style-revisions/${revisionId}/bom/${itemId}/set-pre-estimate/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ value }),
  });
}

/**
 * 設置樣衣用量
 */
export async function setSample(
  revisionId: string,
  itemId: string,
  value: string
): Promise<BOMItem> {
  return apiClient<BOMItem>(`/style-revisions/${revisionId}/bom/${itemId}/set-sample/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ value }),
  });
}

/**
 * 確認用量
 */
export async function confirmConsumption(
  revisionId: string,
  itemId: string,
  value: string,
  source: string = 'manual'
): Promise<BOMItem> {
  return apiClient<BOMItem>(`/style-revisions/${revisionId}/bom/${itemId}/confirm-consumption/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ value, source }),
  });
}

/**
 * 鎖定用量
 * @param value 可選，指定鎖定值。若不提供則使用 confirmed_value
 */
export async function lockConsumption(
  revisionId: string,
  itemId: string,
  value?: string
): Promise<BOMItem> {
  return apiClient<BOMItem>(`/style-revisions/${revisionId}/bom/${itemId}/lock-consumption/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(value ? { value } : {}),
  });
}

/**
 * 批量確認用量
 */
export async function batchConfirmConsumption(
  revisionId: string,
  items: Array<{ id: string; value: string }>,
  source: string = 'manual'
): Promise<{ confirmed: number; errors: Array<{ id: string; error: string }> }> {
  return apiClient(`/style-revisions/${revisionId}/bom/batch-confirm/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ items, source }),
  });
}

/**
 * 批量鎖定用量
 */
export async function batchLockConsumption(
  revisionId: string
): Promise<{ locked: number; errors: Array<{ id: string; error: string }> }> {
  return apiClient(`/style-revisions/${revisionId}/bom/batch-lock/`, {
    method: 'POST',
  });
}
