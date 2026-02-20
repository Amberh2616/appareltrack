/**
 * Brand Hooks - v2.3.0
 * React Query hooks for brand management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchBrands,
  fetchBrand,
  createBrand,
  updateBrand,
  deleteBrand,
} from '../api/brands';
import type { BrandCreate, BrandUpdate } from '../types/brand';

export const brandKeys = {
  all: ['brands'] as const,
  lists: () => [...brandKeys.all, 'list'] as const,
  list: (filters: string) => [...brandKeys.lists(), { filters }] as const,
  details: () => [...brandKeys.all, 'detail'] as const,
  detail: (id: string) => [...brandKeys.details(), id] as const,
};

export function useBrands() {
  return useQuery({
    queryKey: brandKeys.lists(),
    queryFn: fetchBrands,
  });
}

export function useBrand(id: string) {
  return useQuery({
    queryKey: brandKeys.detail(id),
    queryFn: () => fetchBrand(id),
    enabled: !!id,
  });
}

export function useCreateBrand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BrandCreate) => createBrand(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brandKeys.lists() });
    },
  });
}

export function useUpdateBrand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: BrandUpdate }) =>
      updateBrand(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: brandKeys.lists() });
      queryClient.invalidateQueries({ queryKey: brandKeys.detail(variables.id) });
    },
  });
}

export function useDeleteBrand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteBrand(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brandKeys.lists() });
    },
  });
}
