/**
 * Costing React Query Hooks - Phase 2-3
 * Three-Layer Architecture: BOM → Usage → Costing
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCostSheetVersions,
  fetchCostSheetVersionDetail,
  createCostSheetVersion,
  cloneCostSheetVersion,
  submitCostSheetVersion,
  updateCostSheetSummary,
  updateCostLine,
  // P11: Refresh Snapshot
  refreshCostSheetSnapshot,
  // P18: Sample → Bulk APIs
  createBulkQuote,
  acceptCostSheetVersion,
  rejectCostSheetVersion,
  // P18: T8 Create Production Order
  createProductionOrderFromQuote,
  type CreateBulkQuotePayload,
  type CreateProductionOrderPayload,
} from '../api/costing-phase23';
import type {
  CreateCostSheetPayload,
  CloneCostSheetPayload,
  UpdateCostSheetSummaryPayload,
  UpdateCostLinePatch,
} from '@/types/costing-phase23';

// ========================================
// Query Hooks
// ========================================

/**
 * Fetch all CostSheetVersions for a style (filterable by costing_type)
 */
export function useCostSheetVersions(
  styleId: string,
  params?: {
    costing_type?: 'sample' | 'bulk';
    cost_sheet_group_id?: string;
  }
) {
  return useQuery({
    queryKey: ['cost-sheet-versions', styleId, params],
    queryFn: () => fetchCostSheetVersions(styleId, params),
    enabled: !!styleId,
  });
}

/**
 * Fetch single CostSheetVersion detail with nested cost_lines
 */
export function useCostSheetVersionDetail(costSheetId: string | null) {
  return useQuery({
    queryKey: ['cost-sheet-version', costSheetId],
    queryFn: () => fetchCostSheetVersionDetail(costSheetId!),
    enabled: !!costSheetId,
  });
}

// ========================================
// Mutation Hooks
// ========================================

/**
 * Create new CostSheetVersion (snapshot from UsageScenario)
 */
export function useCreateCostSheetVersion(styleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateCostSheetPayload) => createCostSheetVersion(payload),
    onSuccess: (data) => {
      // Invalidate list to show new version
      queryClient.invalidateQueries({ queryKey: ['cost-sheet-versions', styleId] });
      // Set detail cache
      queryClient.setQueryData(['cost-sheet-version', data.id], data);
    },
  });
}

/**
 * Clone existing CostSheetVersion
 */
export function useCloneCostSheetVersion(styleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ costSheetId, payload }: { costSheetId: string; payload: CloneCostSheetPayload }) =>
      cloneCostSheetVersion(costSheetId, payload),
    onSuccess: (data) => {
      // Invalidate list to show cloned version
      queryClient.invalidateQueries({ queryKey: ['cost-sheet-versions', styleId] });
      // Set detail cache for new version
      queryClient.setQueryData(['cost-sheet-version', data.id], data);
    },
  });
}

/**
 * Submit CostSheetVersion (Draft → Submitted, locks UsageScenario)
 */
export function useSubmitCostSheetVersion(styleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (costSheetId: string) => submitCostSheetVersion(costSheetId),
    onSuccess: (data) => {
      // Update detail cache (status changed)
      queryClient.setQueryData(['cost-sheet-version', data.id], data);
      // Invalidate list to refresh status badges
      queryClient.invalidateQueries({ queryKey: ['cost-sheet-versions', styleId] });
    },
  });
}

/**
 * Update CostSheetVersion summary fields (Draft only)
 */
export function useUpdateCostSheetSummary(styleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ costSheetId, payload }: { costSheetId: string; payload: UpdateCostSheetSummaryPayload }) =>
      updateCostSheetSummary(costSheetId, payload),
    onSuccess: (data) => {
      // Update detail cache (totals changed)
      queryClient.setQueryData(['cost-sheet-version', data.id], data);
      // Invalidate list to refresh unit_price
      queryClient.invalidateQueries({ queryKey: ['cost-sheet-versions', styleId] });
    },
  });
}

/**
 * P11: Refresh CostSheetVersion snapshot from current BOM data (Draft only)
 */
export function useRefreshCostSheetSnapshot(styleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (costSheetId: string) => refreshCostSheetSnapshot(costSheetId),
    onSuccess: (data) => {
      // Update detail cache with refreshed data
      queryClient.setQueryData(['cost-sheet-version', data.id], data);
      // Invalidate list to refresh any displayed values
      queryClient.invalidateQueries({ queryKey: ['cost-sheet-versions', styleId] });
    },
  });
}

/**
 * Update CostLineV2 (adjust consumption/price, Draft only)
 * With optimistic updates for better UX
 *
 * Fix: Pass costSheetId through mutation variables to avoid stale closure issues
 */
export function useUpdateCostLine(costSheetId: string, styleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    // Include costSheetId and styleId in the mutation variables
    mutationFn: async ({
      lineId,
      patch,
      csId,
      sId,
    }: {
      lineId: string;
      patch: UpdateCostLinePatch;
      csId: string;
      sId: string;
    }) => {
      const result = await updateCostLine(lineId, patch);
      return { result, csId, sId };
    },

    // Optimistic update (immediate UI feedback)
    onMutate: async ({ lineId, patch, csId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['cost-sheet-version', csId] });

      // Snapshot previous value
      const previous = queryClient.getQueryData(['cost-sheet-version', csId]);

      // Optimistically update detail cache
      queryClient.setQueryData(['cost-sheet-version', csId], (old: any) => {
        if (!old?.cost_lines) return old;

        return {
          ...old,
          cost_lines: old.cost_lines.map((line: any) =>
            line.id === lineId
              ? {
                  ...line,
                  ...patch,
                  // Mark as adjusted if consumption changed
                  is_consumption_adjusted:
                    patch.consumption_adjusted !== undefined
                      ? patch.consumption_adjusted !== line.consumption_snapshot
                      : line.is_consumption_adjusted,
                }
              : line
          ),
        };
      });

      return { previous, csId };
    },

    // On error, rollback to previous value
    onError: (err, variables, context) => {
      if (context?.previous && context?.csId) {
        queryClient.setQueryData(['cost-sheet-version', context.csId], context.previous);
      }
    },

    // On success, refetch to get recalculated totals from server
    onSuccess: (data) => {
      const { csId, sId } = data;
      // Refetch detail to get updated totals (material_cost, total_cost, unit_price)
      queryClient.invalidateQueries({ queryKey: ['cost-sheet-version', csId] });
      // Invalidate list to refresh unit_price
      queryClient.invalidateQueries({ queryKey: ['cost-sheet-versions', sId] });
    },
  });
}

// ========================================
// P18: Sample → Bulk Quotation Hooks
// ========================================

/**
 * P18: Create Bulk Quote from Sample CostSheetVersion (T6 核心連結)
 * Creates new Bulk costing version linked to accepted Sample via cloned_from
 */
export function useCreateBulkQuote(styleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sampleCostSheetId,
      payload,
    }: {
      sampleCostSheetId: string;
      payload?: CreateBulkQuotePayload;
    }) => createBulkQuote(sampleCostSheetId, payload),
    onSuccess: (data) => {
      // Invalidate list to show new Bulk version
      queryClient.invalidateQueries({ queryKey: ['cost-sheet-versions', styleId] });
      // Set detail cache for new Bulk CostSheetVersion
      queryClient.setQueryData(['cost-sheet-version', data.id], data);
      // Invalidate sample runs to update UI (may show "Bulk Quote Created" badge)
      queryClient.invalidateQueries({ queryKey: ['sample-runs'] });
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
    },
  });
}

/**
 * P18: Accept CostSheetVersion (Submitted → Accepted)
 * Used for both Sample and Bulk quotations
 */
export function useAcceptCostSheetVersion(styleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (costSheetId: string) => acceptCostSheetVersion(costSheetId),
    onSuccess: (data) => {
      // Update detail cache (status changed to accepted)
      queryClient.setQueryData(['cost-sheet-version', data.id], data);
      // Invalidate list to refresh status badges
      queryClient.invalidateQueries({ queryKey: ['cost-sheet-versions', styleId] });
      // Invalidate sample runs to update Kanban status
      queryClient.invalidateQueries({ queryKey: ['sample-runs'] });
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
    },
  });
}

/**
 * P18: Reject CostSheetVersion (Submitted → Rejected)
 * Used for both Sample and Bulk quotations
 */
export function useRejectCostSheetVersion(styleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ costSheetId, reason }: { costSheetId: string; reason?: string }) =>
      rejectCostSheetVersion(costSheetId, reason),
    onSuccess: (data) => {
      // Update detail cache (status changed to rejected)
      queryClient.setQueryData(['cost-sheet-version', data.id], data);
      // Invalidate list to refresh status badges
      queryClient.invalidateQueries({ queryKey: ['cost-sheet-versions', styleId] });
      // Invalidate sample runs to update Kanban status
      queryClient.invalidateQueries({ queryKey: ['sample-runs'] });
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
    },
  });
}

// ========================================
// P18: T8 Create Production Order from Bulk Quote
// ========================================

/**
 * P18: T8 核心 - Create Production Order from Accepted Bulk Quote
 * Creates ProductionOrder with MRP calculation from accepted Bulk CostSheetVersion
 */
export function useCreateProductionOrder(styleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      bulkCostSheetId,
      payload,
    }: {
      bulkCostSheetId: string;
      payload: CreateProductionOrderPayload;
    }) => createProductionOrderFromQuote(bulkCostSheetId, payload),
    onSuccess: () => {
      // Invalidate cost sheet versions to update UI
      queryClient.invalidateQueries({ queryKey: ['cost-sheet-versions', styleId] });
      // Invalidate production orders list
      queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      // Invalidate sample runs / kanban
      queryClient.invalidateQueries({ queryKey: ['sample-runs'] });
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
    },
  });
}
