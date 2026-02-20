/**
 * Measurement React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchMeasurements,
  fetchMeasurement,
  createMeasurement,
  updateMeasurement,
  deleteMeasurement,
  translateMeasurement,
  translateMeasurementBatch,
} from '../api/measurement';
import type { UpdateMeasurementPayload, CreateMeasurementPayload } from '../types/measurement';

/**
 * Fetch Measurement items for a revision
 */
export function useMeasurements(revisionId: string) {
  return useQuery({
    queryKey: ['measurements', revisionId],
    queryFn: () => fetchMeasurements(revisionId),
    enabled: !!revisionId,
  });
}

/**
 * Fetch a single Measurement item
 */
export function useMeasurement(revisionId: string, itemId: string) {
  return useQuery({
    queryKey: ['measurements', revisionId, itemId],
    queryFn: () => fetchMeasurement(revisionId, itemId),
    enabled: !!revisionId && !!itemId,
  });
}

/**
 * Create Measurement item mutation
 */
export function useCreateMeasurement(revisionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateMeasurementPayload) => createMeasurement(revisionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['measurements', revisionId] });
    },
  });
}

/**
 * Update Measurement item mutation with optimistic updates
 */
export function useUpdateMeasurement(revisionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: UpdateMeasurementPayload }) =>
      updateMeasurement(revisionId, itemId, data),

    // Optimistic update
    onMutate: async ({ itemId, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['measurements', revisionId] });

      // Snapshot previous value
      const previousMeasurements = queryClient.getQueryData(['measurements', revisionId]);

      // Optimistically update
      queryClient.setQueryData(['measurements', revisionId], (old: any) => {
        if (!old?.results) return old;
        return {
          ...old,
          results: old.results.map((item: any) =>
            item.id === itemId ? { ...item, ...data } : item
          ),
        };
      });

      return { previousMeasurements };
    },

    // Rollback on error
    onError: (err, variables, context) => {
      if (context?.previousMeasurements) {
        queryClient.setQueryData(['measurements', revisionId], context.previousMeasurements);
      }
    },

    // Refetch on success or error
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['measurements', revisionId] });
    },
  });
}

/**
 * Delete Measurement item mutation
 */
export function useDeleteMeasurement(revisionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => deleteMeasurement(revisionId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['measurements', revisionId] });
    },
  });
}

/**
 * Translate a single Measurement item mutation
 */
export function useTranslateMeasurement(revisionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => translateMeasurement(revisionId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['measurements', revisionId] });
    },
  });
}

/**
 * Batch translate all Measurement items mutation
 */
export function useTranslateMeasurementBatch(revisionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (force: boolean = false) => translateMeasurementBatch(revisionId, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['measurements', revisionId] });
    },
  });
}
