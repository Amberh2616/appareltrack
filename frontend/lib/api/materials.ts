/**
 * Material API Client - P15
 */

import { apiClient } from './client';
import type {
  Material,
  MaterialListResponse,
  CreateMaterialPayload,
  UpdateMaterialPayload,
} from '../types/material';

/**
 * List all materials
 */
export async function listMaterials(params?: {
  page?: number;
  page_size?: number;
  category?: string;
  supplier?: string;
  status?: string;
  is_active?: boolean;
  search?: string;
}): Promise<MaterialListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.category) searchParams.set('category', params.category);
  if (params?.supplier) searchParams.set('supplier', params.supplier);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.is_active !== undefined) searchParams.set('is_active', String(params.is_active));
  if (params?.search) searchParams.set('search', params.search);

  const query = searchParams.toString();
  return apiClient<MaterialListResponse>(`/materials/${query ? `?${query}` : ''}`);
}

/**
 * Get a single material by ID
 */
export async function getMaterial(id: string): Promise<Material> {
  return apiClient<Material>(`/materials/${id}/`);
}

/**
 * Create a new material
 */
export async function createMaterial(data: CreateMaterialPayload): Promise<Material> {
  return apiClient<Material>('/materials/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing material
 */
export async function updateMaterial(id: string, data: UpdateMaterialPayload): Promise<Material> {
  return apiClient<Material>(`/materials/${id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/**
 * Delete a material
 */
export async function deleteMaterial(id: string): Promise<void> {
  return apiClient<void>(`/materials/${id}/`, {
    method: 'DELETE',
  });
}
