/**
 * Purchase Order React Query Hooks - P16
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  getPOStats,
  sendPO,
  confirmPO,
  receivePO,
  cancelPO,
  startProduction,
  shipPO,
  getOverduePOs,
  listPOLines,
  createPOLine,
  updatePOLine,
  deletePOLine,
  updatePOLineReceived,
  confirmAllLines,
  confirmPOLine,
  unconfirmPOLine,
} from '../api/purchase-orders';
import type {
  CreatePOPayload,
  UpdatePOPayload,
  CreatePOLinePayload,
  UpdatePOLinePayload,
} from '../types/purchase-order';

// ============ Purchase Orders ============

/**
 * Fetch all purchase orders with optional filters
 */
export function usePurchaseOrders(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  po_type?: string;
  supplier?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ['purchase-orders', params],
    queryFn: () => listPurchaseOrders(params),
  });
}

/**
 * Fetch a single purchase order by ID
 */
export function usePurchaseOrder(id: string) {
  return useQuery({
    queryKey: ['purchase-orders', id],
    queryFn: () => getPurchaseOrder(id),
    enabled: !!id,
  });
}

/**
 * Fetch PO statistics
 */
export function usePOStats() {
  return useQuery({
    queryKey: ['purchase-orders', 'stats'],
    queryFn: () => getPOStats(),
  });
}

/**
 * Create a new purchase order mutation
 */
export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePOPayload) => createPurchaseOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
}

/**
 * Update an existing purchase order mutation
 */
export function useUpdatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePOPayload }) =>
      updatePurchaseOrder(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', variables.id] });
    },
  });
}

/**
 * Delete a purchase order mutation
 */
export function useDeletePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deletePurchaseOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
}

// ============ Status Transitions ============

/**
 * Send PO mutation
 */
export function useSendPO() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => sendPO(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
}

/**
 * Confirm PO mutation
 */
export function useConfirmPO() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => confirmPO(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
}

/**
 * Receive PO mutation
 */
export function useReceivePO() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => receivePO(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
}

/**
 * Cancel PO mutation
 */
export function useCancelPO() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => cancelPO(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
}

/**
 * P23: Start production mutation
 */
export function useStartProduction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => startProduction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
}

/**
 * P23: Ship PO mutation
 */
export function useShipPO() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => shipPO(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
}

/**
 * P23: Fetch overdue POs
 */
export function useOverduePOs() {
  return useQuery({
    queryKey: ['purchase-orders', 'overdue'],
    queryFn: () => getOverduePOs(),
  });
}

// ============ PO Lines ============

/**
 * Fetch PO lines for a purchase order
 */
export function usePOLines(purchaseOrderId: string) {
  return useQuery({
    queryKey: ['po-lines', purchaseOrderId],
    queryFn: () => listPOLines(purchaseOrderId),
    enabled: !!purchaseOrderId,
  });
}

/**
 * Create a PO line mutation
 */
export function useCreatePOLine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePOLinePayload) => createPOLine(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['po-lines', variables.purchase_order] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
}

/**
 * Update a PO line mutation
 */
export function useUpdatePOLine(purchaseOrderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePOLinePayload }) =>
      updatePOLine(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['po-lines', purchaseOrderId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
}

/**
 * Delete a PO line mutation
 */
export function useDeletePOLine(purchaseOrderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deletePOLine(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['po-lines', purchaseOrderId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
}

/**
 * Update PO line received quantity mutation
 */
export function useUpdatePOLineReceived(purchaseOrderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, quantityReceived }: { id: string; quantityReceived: string }) =>
      updatePOLineReceived(id, quantityReceived),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['po-lines', purchaseOrderId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
}

// ============ Line Confirmation ============

/**
 * Confirm all lines in a PO
 */
export function useConfirmAllLines() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => confirmAllLines(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['po-lines'] });
    },
  });
}

/**
 * Confirm a single PO line
 */
export function useConfirmPOLine(purchaseOrderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: { quantity?: string; unit_price?: string; notes?: string } }) =>
      confirmPOLine(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', purchaseOrderId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['po-lines', purchaseOrderId] });
    },
  });
}

/**
 * Unconfirm a PO line for re-editing
 */
export function useUnconfirmPOLine(purchaseOrderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => unconfirmPOLine(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', purchaseOrderId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['po-lines', purchaseOrderId] });
    },
  });
}
