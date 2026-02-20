/**
 * Measurement API Client
 */

import { apiClient } from './client';
import type { MeasurementListResponse, MeasurementItem, UpdateMeasurementPayload, TranslateBatchResponse, CreateMeasurementPayload } from '../types/measurement';

/**
 * Fetch Measurement items for a specific revision
 */
export async function fetchMeasurements(revisionId: string): Promise<MeasurementListResponse> {
  return apiClient<MeasurementListResponse>(`/style-revisions/${revisionId}/measurements/`);
}

/**
 * Fetch a single Measurement item
 */
export async function fetchMeasurement(revisionId: string, itemId: string): Promise<MeasurementItem> {
  return apiClient<MeasurementItem>(`/style-revisions/${revisionId}/measurements/${itemId}/`);
}

/**
 * Create a new Measurement item
 */
export async function createMeasurement(
  revisionId: string,
  data: CreateMeasurementPayload
): Promise<MeasurementItem> {
  return apiClient<MeasurementItem>(`/style-revisions/${revisionId}/measurements/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

/**
 * Update a Measurement item (PATCH)
 */
export async function updateMeasurement(
  revisionId: string,
  itemId: string,
  data: UpdateMeasurementPayload
): Promise<MeasurementItem> {
  return apiClient<MeasurementItem>(`/style-revisions/${revisionId}/measurements/${itemId}/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

/**
 * Delete a Measurement item
 */
export async function deleteMeasurement(revisionId: string, itemId: string): Promise<void> {
  return apiClient<void>(`/style-revisions/${revisionId}/measurements/${itemId}/`, {
    method: 'DELETE',
  });
}

/**
 * Translate a single Measurement item to Chinese
 */
export async function translateMeasurement(
  revisionId: string,
  itemId: string
): Promise<MeasurementItem> {
  return apiClient<MeasurementItem>(`/style-revisions/${revisionId}/measurements/${itemId}/translate/`, {
    method: 'POST',
  });
}

/**
 * Batch translate all Measurement items for a revision
 */
export async function translateMeasurementBatch(
  revisionId: string,
  force: boolean = false
): Promise<TranslateBatchResponse> {
  return apiClient<TranslateBatchResponse>(`/style-revisions/${revisionId}/measurements/translate-batch/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ force }),
  });
}
