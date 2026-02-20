/**
 * Supplier API Client - P14
 */

import { apiClient } from './client';
import type {
  Supplier,
  SupplierListResponse,
  CreateSupplierPayload,
  UpdateSupplierPayload,
} from '../types/supplier';

/**
 * List all suppliers
 */
export async function listSuppliers(params?: {
  page?: number;
  page_size?: number;
  supplier_type?: string;
  is_active?: boolean;
  search?: string;
}): Promise<SupplierListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.supplier_type) searchParams.set('supplier_type', params.supplier_type);
  if (params?.is_active !== undefined) searchParams.set('is_active', String(params.is_active));
  if (params?.search) searchParams.set('search', params.search);

  const query = searchParams.toString();
  return apiClient<SupplierListResponse>(`/suppliers/${query ? `?${query}` : ''}`);
}

/**
 * Get a single supplier by ID
 */
export async function getSupplier(id: string): Promise<Supplier> {
  return apiClient<Supplier>(`/suppliers/${id}/`);
}

/**
 * Create a new supplier
 */
export async function createSupplier(data: CreateSupplierPayload): Promise<Supplier> {
  return apiClient<Supplier>('/suppliers/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing supplier
 */
export async function updateSupplier(id: string, data: UpdateSupplierPayload): Promise<Supplier> {
  return apiClient<Supplier>(`/suppliers/${id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/**
 * Delete a supplier
 */
export async function deleteSupplier(id: string): Promise<void> {
  return apiClient<void>(`/suppliers/${id}/`, {
    method: 'DELETE',
  });
}
