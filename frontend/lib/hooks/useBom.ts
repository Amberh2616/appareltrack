/**
 * BOM React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchBOMItems,
  fetchBOMItem,
  createBOMItem,
  updateBOMItem,
  deleteBOMItem,
  translateBOMItem,
  translateBOMBatch,
  setPreEstimate,
  setSample,
  confirmConsumption,
  lockConsumption,
  batchConfirmConsumption,
  batchLockConsumption,
} from '../api/bom';
import type { UpdateBOMItemPayload, CreateBOMItemPayload } from '../types/bom';

/**
 * Fetch BOM items for a revision
 */
export function useBOMItems(revisionId: string) {
  return useQuery({
    queryKey: ['bom', revisionId],
    queryFn: () => fetchBOMItems(revisionId),
    enabled: !!revisionId,
  });
}

/**
 * Fetch a single BOM item
 */
export function useBOMItem(revisionId: string, itemId: string) {
  return useQuery({
    queryKey: ['bom', revisionId, itemId],
    queryFn: () => fetchBOMItem(revisionId, itemId),
    enabled: !!revisionId && !!itemId,
  });
}

/**
 * Create BOM item mutation
 */
export function useCreateBOMItem(revisionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBOMItemPayload) => createBOMItem(revisionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom', revisionId] });
    },
  });
}

/**
 * Update BOM item mutation with optimistic updates
 */
export function useUpdateBOMItem(revisionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: UpdateBOMItemPayload }) =>
      updateBOMItem(revisionId, itemId, data),

    // Optimistic update
    onMutate: async ({ itemId, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['bom', revisionId] });

      // Snapshot previous value
      const previousBOM = queryClient.getQueryData(['bom', revisionId]);

      // Optimistically update
      queryClient.setQueryData(['bom', revisionId], (old: any) => {
        if (!old?.results) return old;
        return {
          ...old,
          results: old.results.map((item: any) =>
            item.id === itemId ? { ...item, ...data } : item
          ),
        };
      });

      return { previousBOM };
    },

    // Rollback on error
    onError: (err, variables, context) => {
      if (context?.previousBOM) {
        queryClient.setQueryData(['bom', revisionId], context.previousBOM);
      }
    },

    // Refetch on success or error
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bom', revisionId] });
    },
  });
}

/**
 * Delete BOM item mutation
 */
export function useDeleteBOMItem(revisionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => deleteBOMItem(revisionId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom', revisionId] });
    },
  });
}

/**
 * Translate a single BOM item mutation
 */
export function useTranslateBOMItem(revisionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => translateBOMItem(revisionId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom', revisionId] });
    },
  });
}

/**
 * Batch translate all BOM items mutation
 */
export function useTranslateBOMBatch(revisionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (force: boolean = false) => translateBOMBatch(revisionId, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom', revisionId] });
    },
  });
}

// ====== 用量四階段管理 Hooks ======

/**
 * 設置預估用量
 */
export function useSetPreEstimate(revisionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, value }: { itemId: string; value: string }) =>
      setPreEstimate(revisionId, itemId, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom', revisionId] });
    },
  });
}

/**
 * 設置樣衣用量
 */
export function useSetSample(revisionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, value }: { itemId: string; value: string }) =>
      setSample(revisionId, itemId, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom', revisionId] });
    },
  });
}

/**
 * 確認用量
 */
export function useConfirmConsumption(revisionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, value, source }: { itemId: string; value: string; source?: string }) =>
      confirmConsumption(revisionId, itemId, value, source),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom', revisionId] });
    },
  });
}

/**
 * 鎖定用量
 */
export function useLockConsumption(revisionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, value }: { itemId: string; value?: string }) =>
      lockConsumption(revisionId, itemId, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom', revisionId] });
    },
  });
}

/**
 * 批量確認用量
 */
export function useBatchConfirmConsumption(revisionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ items, source }: { items: Array<{ id: string; value: string }>; source?: string }) =>
      batchConfirmConsumption(revisionId, items, source),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom', revisionId] });
    },
  });
}

/**
 * 批量鎖定用量
 */
export function useBatchLockConsumption(revisionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => batchLockConsumption(revisionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom', revisionId] });
    },
  });
}
