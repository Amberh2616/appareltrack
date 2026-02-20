/**
 * Material React Query Hooks - P15
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listMaterials,
  getMaterial,
  createMaterial,
  updateMaterial,
  deleteMaterial,
} from '../api/materials';
import type { CreateMaterialPayload, UpdateMaterialPayload } from '../types/material';

/**
 * Fetch all materials with optional filters
 */
export function useMaterials(params?: {
  page?: number;
  page_size?: number;
  category?: string;
  supplier?: string;
  status?: string;
  is_active?: boolean;
  search?: string;
}) {
  return useQuery({
    queryKey: ['materials', params],
    queryFn: () => listMaterials(params),
  });
}

/**
 * Fetch a single material by ID
 */
export function useMaterial(id: string) {
  return useQuery({
    queryKey: ['materials', id],
    queryFn: () => getMaterial(id),
    enabled: !!id,
  });
}

/**
 * Create a new material mutation
 */
export function useCreateMaterial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateMaterialPayload) => createMaterial(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    },
  });
}

/**
 * Update an existing material mutation
 */
export function useUpdateMaterial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMaterialPayload }) =>
      updateMaterial(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['materials', variables.id] });
    },
  });
}

/**
 * Delete a material mutation
 */
export function useDeleteMaterial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteMaterial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    },
  });
}
