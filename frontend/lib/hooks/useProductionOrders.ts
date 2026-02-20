/**
 * Production Order React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getProductionOrders,
  getProductionOrder,
  createProductionOrder,
  updateProductionOrder,
  deleteProductionOrder,
  calculateMRP,
  generatePO,
  getRequirementsSummary,
  confirmProductionOrder,
  getProductionOrderStats,
  getMaterialRequirements,
  getMaterialRequirement,
  updateMaterialRequirementStock,
  importProductionOrdersExcel,
  reviewMaterialRequirement,
  unreviewMaterialRequirement,
  generatePOFromMaterialRequirement,
  type ProductionOrderListParams,
  type MaterialRequirementListParams,
  type ImportExcelResponse,
} from "../api/production-orders";
import type {
  CreateProductionOrderPayload,
  UpdateProductionOrderPayload,
  CalculateMRPPayload,
  GeneratePOPayload,
  ReviewMaterialRequirementPayload,
} from "../types/production-order";

// ============================================================================
// Query Keys
// ============================================================================

export const productionOrderKeys = {
  all: ["production-orders"] as const,
  lists: () => [...productionOrderKeys.all, "list"] as const,
  list: (params: ProductionOrderListParams) =>
    [...productionOrderKeys.lists(), params] as const,
  details: () => [...productionOrderKeys.all, "detail"] as const,
  detail: (id: string) => [...productionOrderKeys.details(), id] as const,
  stats: () => [...productionOrderKeys.all, "stats"] as const,
  summary: (id: string) =>
    [...productionOrderKeys.detail(id), "summary"] as const,
};

export const materialRequirementKeys = {
  all: ["material-requirements"] as const,
  lists: () => [...materialRequirementKeys.all, "list"] as const,
  list: (params: MaterialRequirementListParams) =>
    [...materialRequirementKeys.lists(), params] as const,
  details: () => [...materialRequirementKeys.all, "detail"] as const,
  detail: (id: string) => [...materialRequirementKeys.details(), id] as const,
};

// ============================================================================
// Production Order Queries
// ============================================================================

export function useProductionOrders(params: ProductionOrderListParams = {}) {
  return useQuery({
    queryKey: productionOrderKeys.list(params),
    queryFn: () => getProductionOrders(params),
  });
}

export function useProductionOrder(id: string) {
  return useQuery({
    queryKey: productionOrderKeys.detail(id),
    queryFn: () => getProductionOrder(id),
    enabled: !!id,
  });
}

export function useProductionOrderStats() {
  return useQuery({
    queryKey: productionOrderKeys.stats(),
    queryFn: getProductionOrderStats,
  });
}

export function useRequirementsSummary(id: string) {
  return useQuery({
    queryKey: productionOrderKeys.summary(id),
    queryFn: () => getRequirementsSummary(id),
    enabled: !!id,
  });
}

// ============================================================================
// Production Order Mutations
// ============================================================================

export function useCreateProductionOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProductionOrderPayload) =>
      createProductionOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productionOrderKeys.lists() });
      queryClient.invalidateQueries({ queryKey: productionOrderKeys.stats() });
    },
  });
}

export function useUpdateProductionOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductionOrderPayload }) =>
      updateProductionOrder(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: productionOrderKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: productionOrderKeys.detail(variables.id),
      });
    },
  });
}

export function useDeleteProductionOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteProductionOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productionOrderKeys.lists() });
      queryClient.invalidateQueries({ queryKey: productionOrderKeys.stats() });
    },
  });
}

export function useCalculateMRP() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload?: CalculateMRPPayload;
    }) => calculateMRP(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: productionOrderKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: productionOrderKeys.summary(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: materialRequirementKeys.lists(),
      });
    },
  });
}

export function useGeneratePO() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: GeneratePOPayload }) =>
      generatePO(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: productionOrderKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: materialRequirementKeys.lists(),
      });
      // Also invalidate purchase orders
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });
}

export function useConfirmProductionOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => confirmProductionOrder(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: productionOrderKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: productionOrderKeys.detail(id),
      });
      queryClient.invalidateQueries({ queryKey: productionOrderKeys.stats() });
    },
  });
}

// ============================================================================
// Material Requirement Queries
// ============================================================================

export function useMaterialRequirements(
  params: MaterialRequirementListParams = {}
) {
  return useQuery({
    queryKey: materialRequirementKeys.list(params),
    queryFn: () => getMaterialRequirements(params),
  });
}

export function useMaterialRequirement(id: string) {
  return useQuery({
    queryKey: materialRequirementKeys.detail(id),
    queryFn: () => getMaterialRequirement(id),
    enabled: !!id,
  });
}

// ============================================================================
// Material Requirement Mutations
// ============================================================================

export function useUpdateMaterialRequirementStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, currentStock }: { id: string; currentStock: number }) =>
      updateMaterialRequirementStock(id, currentStock),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: materialRequirementKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: materialRequirementKeys.lists(),
      });
    },
  });
}

// ============================================================================
// Excel Import
// ============================================================================

export function useImportProductionOrdersExcel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => importProductionOrdersExcel(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productionOrderKeys.lists() });
      queryClient.invalidateQueries({ queryKey: productionOrderKeys.stats() });
    },
  });
}

// ============================================================================
// Material Requirement Review Mutations
// ============================================================================

/**
 * Review and confirm a single material requirement
 */
export function useReviewMaterialRequirement(productionOrderId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: ReviewMaterialRequirementPayload;
    }) => reviewMaterialRequirement(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: materialRequirementKeys.lists(),
      });
      if (productionOrderId) {
        queryClient.invalidateQueries({
          queryKey: productionOrderKeys.detail(productionOrderId),
        });
      }
    },
  });
}

/**
 * Unreview a material requirement for re-editing
 */
export function useUnreviewMaterialRequirement(productionOrderId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => unreviewMaterialRequirement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: materialRequirementKeys.lists(),
      });
      if (productionOrderId) {
        queryClient.invalidateQueries({
          queryKey: productionOrderKeys.detail(productionOrderId),
        });
      }
    },
  });
}

/**
 * Generate a single PurchaseOrder from a reviewed material requirement
 */
export function useGeneratePOFromMaterialRequirement(productionOrderId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => generatePOFromMaterialRequirement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: materialRequirementKeys.lists(),
      });
      queryClient.invalidateQueries({
        queryKey: ["purchase-orders"],
      });
      if (productionOrderId) {
        queryClient.invalidateQueries({
          queryKey: productionOrderKeys.detail(productionOrderId),
        });
      }
    },
  });
}
