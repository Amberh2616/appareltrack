/**
 * React Query Hooks for TechPack API
 * These hooks handle data fetching, caching, and state management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTechPacks,
  getTechPackDetail,
  uploadTechPack,
  // updateTechPack,         // TODO: Implement in techpack.ts
  // deleteTechPack,         // TODO: Implement in techpack.ts
  // parseTechPack,          // TODO: Implement in techpack.ts
  approveTechPack,
  // updateBOMItem,          // TODO: Implement in techpack.ts
  // updateMeasurement,      // TODO: Implement in techpack.ts
  // updateConstructionStep, // TODO: Implement in techpack.ts
  type TechPack,
  type UploadTechPackData,
} from '../api/techpack';

// ============================================================================
// Query Keys
// ============================================================================

export const techPackKeys = {
  all: ['techpacks'] as const,
  lists: () => [...techPackKeys.all, 'list'] as const,
  list: (filters: string) => [...techPackKeys.lists(), filters] as const,
  details: () => [...techPackKeys.all, 'detail'] as const,
  detail: (id: string) => [...techPackKeys.details(), id] as const,
};

// ============================================================================
// Queries
// ============================================================================

/**
 * Fetch all Tech Packs with optional filters
 */
export function useTechPacks(params?: {
  page?: number;
  search?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: techPackKeys.list(JSON.stringify(params || {})),
    queryFn: () => getTechPacks(params),
    staleTime: 30000, // Cache for 30 seconds
  });
}

/**
 * Fetch single Tech Pack detail
 * Auto-refetch every 5 seconds if status is 'parsing'
 */
export function useTechPackDetail(id: string) {
  return useQuery({
    queryKey: techPackKeys.detail(id),
    queryFn: () => getTechPackDetail(id),
    enabled: !!id,
    refetchInterval: (query) => {
      // Auto-refresh every 5 seconds while parsing
      return query.state.data?.status === 'parsing' ? 5000 : false;
    },
    staleTime: 10000, // Cache for 10 seconds
  });
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Upload new Tech Pack with PDF
 * Automatically triggers AI parsing on backend
 */
export function useUploadTechPack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UploadTechPackData) => uploadTechPack(data),
    onSuccess: (data) => {
      // Invalidate list to refresh
      queryClient.invalidateQueries({ queryKey: techPackKeys.lists() });

      // Set detail cache with initial data
      queryClient.setQueryData(techPackKeys.detail(data.id), data);
    },
  });
}

/*
// TODO: Uncomment when API functions are implemented
export function useUpdateTechPack(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<any>) => updateTechPack(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: techPackKeys.lists() });
      queryClient.setQueryData(techPackKeys.detail(id), data);
    },
  });
}

export function useDeleteTechPack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTechPack(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: techPackKeys.lists() });
    },
  });
}

export function useParseTechPack(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => parseTechPack(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: techPackKeys.detail(id) });
    },
  });
}
*/

/**
 * Approve AI draft
 */
export function useApproveTechPack(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      notes?: string;
      bom_items?: any[];
      measurements?: any[];
      construction_steps?: any[];
    }) => approveTechPack(id, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: techPackKeys.lists() });
      queryClient.setQueryData(techPackKeys.detail(id), response);
    },
  });
}

/*
// TODO: Uncomment when API functions are implemented
export function useUpdateBOMItem(techPackId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateBOMItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: techPackKeys.detail(techPackId) });
    },
  });
}

export function useUpdateMeasurement(techPackId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateMeasurement(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: techPackKeys.detail(techPackId) });
    },
  });
}

export function useUpdateConstructionStep(techPackId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateConstructionStep(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: techPackKeys.detail(techPackId) });
    },
  });
}
*/
