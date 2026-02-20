/**
 * Sample Request React Query Hooks
 * Phase 3-1: Sample Request System MVP
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchSampleRequests,
  fetchSampleRequest,
  createSampleRequest,
  updateSampleRequest,
  deleteSampleRequest,
  confirmSampleRequest,
  fetchAllowedActions,
  createNextRun,
  fetchRunsSummary,
  fetchSampleRuns,
  fetchSampleRun,
  createSampleRun,
  updateSampleRun,
  deleteSampleRun,
  submitSampleRun,
  quoteSampleRun,
  approveSampleRun,
  rejectSampleRun,
  cancelSampleRun,
  startExecutionSampleRun,
  completeSampleRun,
  fetchSampleCostEstimates,
  fetchSampleCostEstimate,
  fetchT2POsForSample,
  fetchT2POForSample,
  fetchSampleMWOs,
  fetchSampleMWO,
  fetchSamples,
  fetchSample,
  fetchSampleAttachments,
  fetchSampleAttachment,
  createSampleAttachment,
  deleteSampleAttachment,
  fetchSampleActuals,
  fetchSampleActualsDetail,
  updateSampleActuals,
  // Kanban APIs (P0-2)
  fetchKanbanCounts,
  fetchKanbanRuns,
  transitionSampleRun,
} from '../api/samples';
import type {
  CreateSampleRequestPayload,
  UpdateSampleRequestPayload,
  CreateSampleRunPayload,
  UpdateSampleRunPayload,
  CreateSampleAttachmentPayload,
  SampleActuals,
} from '@/types/samples';
import type { CreateNextRunPayload } from '../api/samples';

// ========================================
// SampleRequest Hooks
// ========================================

/**
 * Fetch all SampleRequests (with optional filtering)
 */
export function useSampleRequests(params?: {
  revision_id?: string;
  status?: string;
  brand_name?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ['sample-requests', params],
    queryFn: () => fetchSampleRequests(params),
  });
}

/**
 * Fetch single SampleRequest detail
 */
export function useSampleRequest(id: string | null) {
  return useQuery({
    queryKey: ['sample-request', id],
    queryFn: () => fetchSampleRequest(id!),
    enabled: !!id,
  });
}

/**
 * Create new SampleRequest
 */
export function useCreateSampleRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateSampleRequestPayload) => createSampleRequest(payload),
    onSuccess: (data) => {
      // Invalidate list to show new request
      queryClient.invalidateQueries({ queryKey: ['sample-requests'] });
      // Set detail cache
      queryClient.setQueryData(['sample-request', data.id], data);
    },
  });
}

/**
 * Update SampleRequest
 */
export function useUpdateSampleRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateSampleRequestPayload }) =>
      updateSampleRequest(id, payload),
    onSuccess: (data) => {
      // Update detail cache
      queryClient.setQueryData(['sample-request', data.id], data);
      // Invalidate list to refresh
      queryClient.invalidateQueries({ queryKey: ['sample-requests'] });
    },
  });
}

/**
 * Delete SampleRequest
 */
export function useDeleteSampleRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteSampleRequest(id),
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: ['sample-request', id] });
      // Invalidate list
      queryClient.invalidateQueries({ queryKey: ['sample-requests'] });
    },
  });
}

/**
 * 方案 B：確認樣衣 - 觸發 BOM/Spec 整合並生成文件
 */
export function useConfirmSampleRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => confirmSampleRequest(id),
    onSuccess: (data, id) => {
      // Invalidate request detail to show new run
      queryClient.invalidateQueries({ queryKey: ['sample-request', id] });
      // Invalidate runs list
      queryClient.invalidateQueries({ queryKey: ['sample-runs'] });
      // Invalidate list
      queryClient.invalidateQueries({ queryKey: ['sample-requests'] });
    },
  });
}

/**
 * Fetch allowed actions for a SampleRequest
 */
export function useAllowedActions(id: string | null) {
  return useQuery({
    queryKey: ['sample-request-allowed-actions', id],
    queryFn: () => fetchAllowedActions(id!),
    enabled: !!id,
  });
}

// ========================================
// 多輪 Fit Sample Hooks
// ========================================

/**
 * 創建下一輪 SampleRun（支援多輪 Fit Sample）
 *
 * 用於 Fit Sample 多輪調整場景：
 * - Fit 1st → 客戶評論 → 調整 → Fit 2nd → ...
 */
export function useCreateNextRun(requestId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload?: CreateNextRunPayload) => {
      if (!requestId) throw new Error('Request ID is required');
      return createNextRun(requestId, payload);
    },
    onSuccess: (data) => {
      // 創建下一輪後刷新相關查詢
      queryClient.invalidateQueries({ queryKey: ['sample-requests'] });
      queryClient.invalidateQueries({ queryKey: ['sample-request', requestId] });
      queryClient.invalidateQueries({ queryKey: ['sample-runs'] });
      queryClient.invalidateQueries({ queryKey: ['runs-summary', requestId] });
      queryClient.invalidateQueries({ queryKey: ['kanban-runs'] });
      queryClient.invalidateQueries({ queryKey: ['kanban-counts'] });
    },
  });
}

/**
 * 獲取該 SampleRequest 的所有 Run 摘要
 */
export function useRunsSummary(requestId: string | null) {
  return useQuery({
    queryKey: ['runs-summary', requestId],
    queryFn: () => fetchRunsSummary(requestId!),
    enabled: !!requestId,
  });
}

// ========================================
// SampleRun Hooks
// ========================================

/**
 * Fetch all SampleRuns (filterable by request)
 */
export function useSampleRuns(params?: { sample_request_id?: string }) {
  return useQuery({
    queryKey: ['sample-runs', params],
    queryFn: () => fetchSampleRuns(params),
  });
}

/**
 * Fetch single SampleRun detail
 */
export function useSampleRun(id: string | null) {
  return useQuery({
    queryKey: ['sample-run', id],
    queryFn: () => fetchSampleRun(id!),
    enabled: !!id,
  });
}

/**
 * Create new SampleRun
 */
export function useCreateSampleRun(requestId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateSampleRunPayload) => createSampleRun(payload),
    onSuccess: (data) => {
      // Invalidate list to show new run
      queryClient.invalidateQueries({ queryKey: ['sample-runs'] });
      if (requestId) {
        queryClient.invalidateQueries({ queryKey: ['sample-runs', { sample_request_id: requestId }] });
      }
      // Set detail cache
      queryClient.setQueryData(['sample-run', data.id], data);
      // Invalidate parent request to refresh nested runs
      if (data.sample_request) {
        queryClient.invalidateQueries({ queryKey: ['sample-request', data.sample_request] });
      }
    },
  });
}

/**
 * Update SampleRun
 */
export function useUpdateSampleRun(requestId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateSampleRunPayload }) =>
      updateSampleRun(id, payload),
    onSuccess: (data) => {
      // Update detail cache
      queryClient.setQueryData(['sample-run', data.id], data);
      // Invalidate list to refresh
      queryClient.invalidateQueries({ queryKey: ['sample-runs'] });
      if (requestId) {
        queryClient.invalidateQueries({ queryKey: ['sample-runs', { sample_request_id: requestId }] });
      }
      // Invalidate parent request
      if (data.sample_request) {
        queryClient.invalidateQueries({ queryKey: ['sample-request', data.sample_request] });
      }
    },
  });
}

/**
 * Delete SampleRun
 */
export function useDeleteSampleRun(requestId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteSampleRun(id),
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: ['sample-run', id] });
      // Invalidate list
      queryClient.invalidateQueries({ queryKey: ['sample-runs'] });
      if (requestId) {
        queryClient.invalidateQueries({ queryKey: ['sample-runs', { sample_request_id: requestId }] });
        queryClient.invalidateQueries({ queryKey: ['sample-request', requestId] });
      }
    },
  });
}

// ========================================
// SampleRun Workflow Action Hooks
// ========================================

/**
 * Submit SampleRun
 */
export function useSubmitSampleRun(requestId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => submitSampleRun(id, notes),
    onSuccess: (data) => {
      queryClient.setQueryData(['sample-run', data.id], data);
      queryClient.invalidateQueries({ queryKey: ['sample-runs'] });
      if (requestId) {
        queryClient.invalidateQueries({ queryKey: ['sample-request', requestId] });
      }
    },
  });
}

/**
 * Quote SampleRun
 */
export function useQuoteSampleRun(requestId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => quoteSampleRun(id, notes),
    onSuccess: (data) => {
      queryClient.setQueryData(['sample-run', data.id], data);
      queryClient.invalidateQueries({ queryKey: ['sample-runs'] });
      if (requestId) {
        queryClient.invalidateQueries({ queryKey: ['sample-request', requestId] });
      }
    },
  });
}

/**
 * Approve SampleRun
 */
export function useApproveSampleRun(requestId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => approveSampleRun(id, notes),
    onSuccess: (data) => {
      queryClient.setQueryData(['sample-run', data.id], data);
      queryClient.invalidateQueries({ queryKey: ['sample-runs'] });
      if (requestId) {
        queryClient.invalidateQueries({ queryKey: ['sample-request', requestId] });
      }
    },
  });
}

/**
 * Reject SampleRun
 */
export function useRejectSampleRun(requestId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => rejectSampleRun(id, notes),
    onSuccess: (data) => {
      queryClient.setQueryData(['sample-run', data.id], data);
      queryClient.invalidateQueries({ queryKey: ['sample-runs'] });
      if (requestId) {
        queryClient.invalidateQueries({ queryKey: ['sample-request', requestId] });
      }
    },
  });
}

/**
 * Cancel SampleRun
 */
export function useCancelSampleRun(requestId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => cancelSampleRun(id, notes),
    onSuccess: (data) => {
      queryClient.setQueryData(['sample-run', data.id], data);
      queryClient.invalidateQueries({ queryKey: ['sample-runs'] });
      if (requestId) {
        queryClient.invalidateQueries({ queryKey: ['sample-request', requestId] });
      }
    },
  });
}

/**
 * Start Execution of SampleRun
 */
export function useStartExecutionSampleRun(requestId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => startExecutionSampleRun(id, notes),
    onSuccess: (data) => {
      queryClient.setQueryData(['sample-run', data.id], data);
      queryClient.invalidateQueries({ queryKey: ['sample-runs'] });
      if (requestId) {
        queryClient.invalidateQueries({ queryKey: ['sample-request', requestId] });
      }
    },
  });
}

/**
 * Complete SampleRun
 */
export function useCompleteSampleRun(requestId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => completeSampleRun(id, notes),
    onSuccess: (data) => {
      queryClient.setQueryData(['sample-run', data.id], data);
      queryClient.invalidateQueries({ queryKey: ['sample-runs'] });
      if (requestId) {
        queryClient.invalidateQueries({ queryKey: ['sample-request', requestId] });
      }
    },
  });
}

// ========================================
// SampleCostEstimate Hooks
// ========================================

/**
 * Fetch all SampleCostEstimates (filterable by request)
 */
export function useSampleCostEstimates(params?: { sample_request_id?: string }) {
  return useQuery({
    queryKey: ['sample-cost-estimates', params],
    queryFn: () => fetchSampleCostEstimates(params),
  });
}

/**
 * Fetch single SampleCostEstimate detail
 */
export function useSampleCostEstimate(id: string | null) {
  return useQuery({
    queryKey: ['sample-cost-estimate', id],
    queryFn: () => fetchSampleCostEstimate(id!),
    enabled: !!id,
  });
}

// ========================================
// T2POForSample Hooks
// ========================================

/**
 * Fetch all T2POsForSample (filterable by run)
 */
export function useT2POsForSample(params?: { sample_run_id?: string }) {
  return useQuery({
    queryKey: ['t2pos-for-sample', params],
    queryFn: () => fetchT2POsForSample(params),
  });
}

/**
 * Fetch single T2POForSample detail
 */
export function useT2POForSample(id: string | null) {
  return useQuery({
    queryKey: ['t2po-for-sample', id],
    queryFn: () => fetchT2POForSample(id!),
    enabled: !!id,
  });
}

// ========================================
// SampleMWO Hooks
// ========================================

/**
 * Fetch all SampleMWOs (filterable by run)
 */
export function useSampleMWOs(params?: { sample_run_id?: string }) {
  return useQuery({
    queryKey: ['sample-mwos', params],
    queryFn: () => fetchSampleMWOs(params),
  });
}

/**
 * Fetch single SampleMWO detail
 */
export function useSampleMWO(id: string | null) {
  return useQuery({
    queryKey: ['sample-mwo', id],
    queryFn: () => fetchSampleMWO(id!),
    enabled: !!id,
  });
}

// ========================================
// Sample Hooks
// ========================================

/**
 * Fetch all Samples (filterable by request)
 */
export function useSamples(params?: { sample_request_id?: string }) {
  return useQuery({
    queryKey: ['samples', params],
    queryFn: () => fetchSamples(params),
  });
}

/**
 * Fetch single Sample detail
 */
export function useSample(id: string | null) {
  return useQuery({
    queryKey: ['sample', id],
    queryFn: () => fetchSample(id!),
    enabled: !!id,
  });
}

// ========================================
// SampleAttachment Hooks
// ========================================

/**
 * Fetch all SampleAttachments (filterable by request or sample)
 */
export function useSampleAttachments(params?: {
  sample_request_id?: string;
  sample_id?: string;
}) {
  return useQuery({
    queryKey: ['sample-attachments', params],
    queryFn: () => fetchSampleAttachments(params),
  });
}

/**
 * Fetch single SampleAttachment detail
 */
export function useSampleAttachment(id: string | null) {
  return useQuery({
    queryKey: ['sample-attachment', id],
    queryFn: () => fetchSampleAttachment(id!),
    enabled: !!id,
  });
}

/**
 * Create new SampleAttachment
 */
export function useCreateSampleAttachment(params?: {
  sample_request_id?: string;
  sample_id?: string;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateSampleAttachmentPayload) => createSampleAttachment(payload),
    onSuccess: (data) => {
      // Invalidate list to show new attachment
      queryClient.invalidateQueries({ queryKey: ['sample-attachments', params] });
      queryClient.invalidateQueries({ queryKey: ['sample-attachments'] });
      // Set detail cache
      queryClient.setQueryData(['sample-attachment', data.id], data);
    },
  });
}

/**
 * Delete SampleAttachment
 */
export function useDeleteSampleAttachment(params?: {
  sample_request_id?: string;
  sample_id?: string;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteSampleAttachment(id),
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: ['sample-attachment', id] });
      // Invalidate list
      queryClient.invalidateQueries({ queryKey: ['sample-attachments', params] });
      queryClient.invalidateQueries({ queryKey: ['sample-attachments'] });
    },
  });
}

// ========================================
// SampleActuals Hooks
// ========================================

/**
 * Fetch SampleActuals for a specific run
 */
export function useSampleActualsForRun(params?: { sample_run_id?: string }) {
  return useQuery({
    queryKey: ['sample-actuals', params],
    queryFn: () => fetchSampleActuals(params),
    enabled: !!params?.sample_run_id,
  });
}

/**
 * Fetch single SampleActuals detail
 */
export function useSampleActualsDetail(id: string | null) {
  return useQuery({
    queryKey: ['sample-actuals-detail', id],
    queryFn: () => fetchSampleActualsDetail(id!),
    enabled: !!id,
  });
}

/**
 * Update SampleActuals
 */
export function useUpdateSampleActuals(runId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<SampleActuals> }) =>
      updateSampleActuals(id, payload),
    onSuccess: (data) => {
      // Update detail cache
      queryClient.setQueryData(['sample-actuals-detail', data.id], data);
      // Invalidate list to refresh
      queryClient.invalidateQueries({ queryKey: ['sample-actuals'] });
      if (runId) {
        queryClient.invalidateQueries({ queryKey: ['sample-actuals', { sample_run_id: runId }] });
        queryClient.invalidateQueries({ queryKey: ['sample-run', runId] });
      }
    },
  });
}

// ========================================
// Kanban Hooks (P0-2)
// ========================================

/**
 * Fetch Kanban counts for lanes
 */
export function useKanbanCounts(daysAhead?: number) {
  return useQuery({
    queryKey: ['kanban-counts', daysAhead],
    queryFn: () => fetchKanbanCounts(daysAhead),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

import type { KanbanFilters } from '../api/samples';

/**
 * Fetch Kanban runs for board (300+ styles support)
 */
export function useKanbanRuns(params?: KanbanFilters) {
  return useQuery({
    queryKey: ['kanban-runs', params],
    queryFn: () => fetchKanbanRuns(params),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

/**
 * Transition sample run status (for Kanban drag-drop)
 */
export function useTransitionSampleRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ runId, action, payload }: {
      runId: string;
      action: string;
      payload?: { notes?: string; reason?: string };
    }) => transitionSampleRun(runId, action, payload),
    onSuccess: () => {
      // Invalidate all Kanban queries
      queryClient.invalidateQueries({ queryKey: ['kanban-counts'] });
      queryClient.invalidateQueries({ queryKey: ['kanban-runs'] });
      queryClient.invalidateQueries({ queryKey: ['sample-runs'] });
    },
  });
}
