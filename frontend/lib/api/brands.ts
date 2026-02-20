/**
 * Brand API Functions - v2.3.0
 */

import { API_BASE_URL } from './client';
import type { Brand, BrandCreate, BrandUpdate } from '../types/brand';

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export async function fetchBrands(): Promise<Brand[]> {
  const response = await fetch(`${API_BASE_URL}/brands/`);
  if (!response.ok) {
    throw new Error('Failed to fetch brands');
  }
  const data: PaginatedResponse<Brand> = await response.json();
  return data.results;
}

export async function fetchBrand(id: string): Promise<Brand> {
  const response = await fetch(`${API_BASE_URL}/brands/${id}/`);
  if (!response.ok) {
    throw new Error('Failed to fetch brand');
  }
  return response.json();
}

export async function createBrand(data: BrandCreate): Promise<Brand> {
  const response = await fetch(`${API_BASE_URL}/brands/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to create brand');
  }
  return response.json();
}

export async function updateBrand(id: string, data: BrandUpdate): Promise<Brand> {
  const response = await fetch(`${API_BASE_URL}/brands/${id}/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to update brand');
  }
  return response.json();
}

export async function deleteBrand(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/brands/${id}/`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete brand');
  }
}
