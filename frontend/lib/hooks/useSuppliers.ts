/**
 * Supplier React Query Hooks - P14
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../api/suppliers';
import type { CreateSupplierPayload, UpdateSupplierPayload } from '../types/supplier';

/**
 * Fetch all suppliers with optional filters
 */
export function useSuppliers(params?: {
  page?: number;
  page_size?: number;
  supplier_type?: string;
  is_active?: boolean;
  search?: string;
}) {
  return useQuery({
    queryKey: ['suppliers', params],
    queryFn: () => listSuppliers(params),
  });
}

/**
 * Fetch a single supplier by ID
 */
export function useSupplier(id: string) {
  return useQuery({
    queryKey: ['suppliers', id],
    queryFn: () => getSupplier(id),
    enabled: !!id,
  });
}

/**
 * Create a new supplier mutation
 */
export function useCreateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSupplierPayload) => createSupplier(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

/**
 * Update an existing supplier mutation
 */
export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSupplierPayload }) =>
      updateSupplier(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers', variables.id] });
    },
  });
}

/**
 * Delete a supplier mutation
 */
export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteSupplier(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}
