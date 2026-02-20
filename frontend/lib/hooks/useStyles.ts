/**
 * React Query Hooks for Styles
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import * as stylesApi from '../api/styles';
import type {
  Style,
  StyleDetail,
  StyleListItem,
  PaginatedResponse,
  CreateStyleInput,
} from '../types';

/**
 * Query Keys
 */
export const styleKeys = {
  all: ['styles'] as const,
  lists: () => [...styleKeys.all, 'list'] as const,
  list: (params: stylesApi.ListStylesParams) =>
    [...styleKeys.lists(), params] as const,
  details: () => [...styleKeys.all, 'detail'] as const,
  detail: (id: string) => [...styleKeys.details(), id] as const,
};

/**
 * List styles with pagination
 */
export function useStyles(
  params?: stylesApi.ListStylesParams,
  options?: Omit<
    UseQueryOptions<PaginatedResponse<StyleListItem>>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: styleKeys.list(params || {}),
    queryFn: () => stylesApi.listStyles(params),
    ...options,
  });
}

/**
 * Get single style by ID
 */
export function useStyle(
  id: string,
  options?: Omit<UseQueryOptions<StyleDetail>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: styleKeys.detail(id),
    queryFn: () => stylesApi.getStyle(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * Create new style
 */
export function useCreateStyle(
  options?: UseMutationOptions<Style, Error, CreateStyleInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateStyleInput) => stylesApi.createStyle(data),
    onSuccess: () => {
      // Invalidate list queries to refetch
      queryClient.invalidateQueries({ queryKey: styleKeys.lists() });
    },
    ...options,
  });
}

/**
 * Update style
 */
export function useUpdateStyle(
  options?: UseMutationOptions<
    Style,
    Error,
    { id: string; data: Partial<CreateStyleInput> }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => stylesApi.updateStyle(id, data),
    onSuccess: (_, variables) => {
      // Invalidate both list and detail queries
      queryClient.invalidateQueries({ queryKey: styleKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: styleKeys.detail(variables.id),
      });
    },
    ...options,
  });
}

/**
 * Delete style
 */
export function useDeleteStyle(
  options?: UseMutationOptions<void, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => stylesApi.deleteStyle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: styleKeys.lists() });
    },
    ...options,
  });
}

/**
 * Approve revision
 */
export function useApproveRevision(
  options?: UseMutationOptions<
    stylesApi.StyleRevision,
    Error,
    { revisionId: string; notes?: string }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ revisionId, notes }) =>
      stylesApi.approveRevision(revisionId, notes),
    onSuccess: () => {
      // Invalidate all style queries since revision status affects style data
      queryClient.invalidateQueries({ queryKey: styleKeys.all });
    },
    ...options,
  });
}

/**
 * Parse revision
 */
export function useParseRevision(
  options?: UseMutationOptions<
    stylesApi.ParseRevisionResponse,
    Error,
    { revisionId: string; targets?: string[] }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ revisionId, targets }) =>
      stylesApi.parseRevision(revisionId, targets),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: styleKeys.all });
    },
    ...options,
  });
}

/**
 * Batch parse
 */
export function useBatchParse(
  options?: UseMutationOptions<
    stylesApi.BatchParseResponse,
    Error,
    stylesApi.BatchParseRequest
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => stylesApi.batchParse(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: styleKeys.all });
    },
    ...options,
  });
}
