/**
 * Documents API Client
 * Handles file upload/download
 */

import { apiClient, uploadFile } from './client';
import type {
  Document,
  DocumentType,
  UploadInitResponse,
  UploadCompleteRequest,
  DocumentDownloadResponse,
} from '../types';

const BASE_PATH = '/v2/documents';

/**
 * Initialize upload - get presigned URL
 */
export interface InitUploadRequest {
  file_name: string;
  file_type: DocumentType;
  style_id?: string;
  revision_id?: string;
  upload_notes?: string;
  tags?: string[];
}

export async function initUpload(
  data: InitUploadRequest
): Promise<UploadInitResponse> {
  return apiClient<UploadInitResponse>(`${BASE_PATH}/upload-init`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

/**
 * Complete upload - notify backend
 */
export async function completeUpload(
  documentId: string,
  data: UploadCompleteRequest
): Promise<Document> {
  return apiClient<Document>(`${BASE_PATH}/${documentId}/upload-complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

/**
 * Get download URL
 */
export async function getDownloadUrl(
  documentId: string
): Promise<DocumentDownloadResponse> {
  return apiClient<DocumentDownloadResponse>(
    `${BASE_PATH}/${documentId}/download`
  );
}

/**
 * List documents
 */
export interface ListDocumentsParams {
  style_id?: string;
  revision_id?: string;
  file_type?: DocumentType;
  page?: number;
  page_size?: number;
}

export async function listDocuments(
  params?: ListDocumentsParams
): Promise<{ count: number; results: Document[] }> {
  const searchParams = new URLSearchParams();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
  }

  const query = searchParams.toString();
  const endpoint = query ? `${BASE_PATH}?${query}` : BASE_PATH;

  return apiClient(endpoint);
}

/**
 * Delete document
 */
export async function deleteDocument(documentId: string): Promise<void> {
  return apiClient<void>(`${BASE_PATH}/${documentId}`, {
    method: 'DELETE',
  });
}

/**
 * Upload file directly to presigned URL
 */
export async function uploadToPresignedUrl(
  url: string,
  file: File
): Promise<void> {
  const response = await fetch(url, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
    },
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }
}

/**
 * Calculate file hash (SHA-256)
 */
export async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hashHex;
}

/**
 * Complete upload flow helper
 */
export interface UploadFileOptions {
  file: File;
  file_type: DocumentType;
  style_id?: string;
  revision_id?: string;
  upload_notes?: string;
  tags?: string[];
  onProgress?: (progress: number) => void;
}

export async function uploadFileComplete(
  options: UploadFileOptions
): Promise<Document> {
  const { file, onProgress, ...initData } = options;

  // 1. Calculate hash
  if (onProgress) onProgress(10);
  const fileHash = await calculateFileHash(file);

  // 2. Initialize upload
  if (onProgress) onProgress(20);
  const initResponse = await initUpload({
    ...initData,
    file_name: file.name,
  });

  // 3. Upload to presigned URL
  if (onProgress) onProgress(30);
  await uploadToPresignedUrl(initResponse.upload_url, file);
  if (onProgress) onProgress(80);

  // 4. Complete upload
  const document = await completeUpload(initResponse.document_id, {
    file_hash: fileHash,
    file_size: file.size,
    mime_type: file.type,
  });

  if (onProgress) onProgress(100);
  return document;
}
