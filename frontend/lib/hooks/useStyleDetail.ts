/**
 * React Query hooks for Style Detail / Readiness
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getStyleReadiness,
  batchVerifyBOM,
  batchVerifySpec,
} from '@/lib/api/style-detail';
import { listStyles } from '@/lib/api/styles';
import type { ListStylesParams } from '@/lib/api/styles';
import {
  createSampleRequest,
  confirmSampleRequest,
  createNextRun,
  transitionSampleRun,
} from '@/lib/api/samples';
import type { CreateNextRunPayload } from '@/lib/api/samples';

export function useStyleReadiness(styleId: string | undefined) {
  return useQuery({
    queryKey: ['style-readiness', styleId],
    queryFn: () => getStyleReadiness(styleId!),
    enabled: !!styleId,
  });
}

export function useStylesList(params?: ListStylesParams) {
  return useQuery({
    queryKey: ['styles-list', params],
    queryFn: () => listStyles(params),
  });
}

export function useBatchVerifyBOM(revisionId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => batchVerifyBOM(revisionId!, ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['style-readiness'] });
    },
  });
}

export function useBatchVerifySpec(revisionId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => batchVerifySpec(revisionId!, ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['style-readiness'] });
    },
  });
}

/**
 * Create a SampleRequest + confirm it (generates Run #1 + MWO + Quote)
 * Two-step: POST /sample-requests/ then POST /sample-requests/{id}/confirm/
 */
export function useCreateSampleWithMWO() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      revisionId: string;
      type: string;
      quantity: number;
      priority: string;
    }) => {
      // Step 1: Create sample request
      const sr = await createSampleRequest({
        revision: params.revisionId,
        request_type: params.type as any,
        quantity_requested: params.quantity,
        priority: params.priority as any,
      });
      // Step 2: Confirm → generates Run #1 + MWO + CostSheet
      const confirmed = await confirmSampleRequest(sr.id);
      return { sampleRequest: sr, confirmed };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['style-readiness'] });
      qc.invalidateQueries({ queryKey: ['sample-requests'] });
      qc.invalidateQueries({ queryKey: ['runs-summary'] });
    },
  });
}

/**
 * Create next round (multi-round fit sample)
 */
export function useCreateNextRound(requestId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload?: CreateNextRunPayload) => {
      if (!requestId) throw new Error('Request ID is required');
      return createNextRun(requestId, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['style-readiness'] });
      qc.invalidateQueries({ queryKey: ['runs-summary'] });
      qc.invalidateQueries({ queryKey: ['sample-requests'] });
    },
  });
}

/**
 * Issue MWO for a sample run
 */
export function useIssueMWO() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => transitionSampleRun(runId, 'issue_mwo'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['style-readiness'] });
      qc.invalidateQueries({ queryKey: ['runs-summary'] });
    },
  });
}
