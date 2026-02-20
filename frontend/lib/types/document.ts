/**
 * Document Types
 * Matches backend models in apps/documents/
 */

export type DocumentType =
  | 'tech_pack'
  | 'bom_excel'
  | 'measurement_sheet'
  | 'construction_spec'
  | 'artwork'
  | 'photo'
  | 'marker_report'
  | 'sample_measurement'
  | 'other';

export interface Document {
  id: string;
  organization: string;
  style: string | null;
  revision: string | null;

  // File info
  file_name: string;
  file_type: DocumentType;
  file_size: number;
  file_hash: string; // SHA256 for deduplication
  storage_path: string;
  mime_type: string;

  // Metadata
  page_count: number | null;
  upload_notes: string;
  tags: string[];

  // Timestamps
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface UploadInitResponse {
  document_id: string;
  upload_url: string;
  expires_in: number; // seconds
  max_file_size: number; // bytes
}

export interface UploadCompleteRequest {
  file_hash: string;
  file_size: number;
  mime_type: string;
}

export interface DocumentDownloadResponse {
  download_url: string;
  expires_in: number;
}
