/**
 * Style Detail API
 * Readiness, batch-verify, and detail endpoints
 */

import { apiClient } from './client';

// ---- Types ----

export interface StyleReadiness {
  style_id: string;
  style_number: string;
  style_name: string;
  brand_name: string | null;
  season: string;
  revision_id: string | null;
  revision_label: string | null;
  revision_status: string | null;
  tech_pack_revision_id: string | null;
  documents: StyleDocument[];
  translation: TranslationProgress;
  bom: { total: number; verified: number; translated: number };
  spec: { total: number; verified: number; translated: number };
  sample_request: { id: string; status: string; request_type: string } | null;
  sample_run: {
    id: string;
    run_no: number;
    status: string;
    mwo_status: string | null;
    mwo_id: string | null;
  } | null;
  overall_readiness: number;
}

export interface StyleDocument {
  id: string;
  filename: string;
  file_type: string;
  status: string;
}

export interface TranslationProgress {
  total: number;
  done: number;
  pending: number;
  failed: number;
  skipped: number;
  progress: number;
}

export interface ReadinessSummary {
  has_tech_pack: boolean;
  tech_pack_progress: number;
  bom_total: number;
  bom_verified: number;
  spec_total: number;
  spec_verified: number;
  has_sample_request: boolean;
  mwo_status: string | null;
}

export interface StyleListItemWithReadiness {
  id: string;
  style_number: string;
  style_name: string;
  season: string;
  customer: string;
  brand_name: string | null;
  current_revision_label: string | null;
  current_revision_status: string | null;
  revision_count: number;
  risk: string[];
  readiness: ReadinessSummary;
  created_at: string;
}

export interface BatchVerifyResponse {
  verified_count: number;
  already_verified: number;
}

// ---- API Functions ----

export async function getStyleReadiness(styleId: string): Promise<StyleReadiness> {
  return apiClient<StyleReadiness>(`/styles/${styleId}/readiness/`);
}

export async function batchVerifyBOM(
  revisionId: string,
  ids?: string[]
): Promise<BatchVerifyResponse> {
  return apiClient<BatchVerifyResponse>(
    `/style-revisions/${revisionId}/bom/batch-verify/`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids ? { ids } : {}),
    }
  );
}

export async function batchVerifySpec(
  revisionId: string,
  ids?: string[]
): Promise<BatchVerifyResponse> {
  return apiClient<BatchVerifyResponse>(
    `/style-revisions/${revisionId}/measurements/batch-verify/`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids ? { ids } : {}),
    }
  );
}
