/**
 * Purchase Order API Client - P16
 */

import { apiClient, API_BASE_URL } from './client';
import type {
  PurchaseOrder,
  POListResponse,
  POStats,
  CreatePOPayload,
  UpdatePOPayload,
  POLine,
  CreatePOLinePayload,
  UpdatePOLinePayload,
} from '../types/purchase-order';

// ============ Purchase Orders ============

/**
 * List all purchase orders
 */
export async function listPurchaseOrders(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  po_type?: string;
  supplier?: string;
  search?: string;
}): Promise<POListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.status) searchParams.set('status', params.status);
  if (params?.po_type) searchParams.set('po_type', params.po_type);
  if (params?.supplier) searchParams.set('supplier', params.supplier);
  if (params?.search) searchParams.set('search', params.search);

  const query = searchParams.toString();
  return apiClient<POListResponse>(`/purchase-orders/${query ? `?${query}` : ''}`);
}

/**
 * Get a single purchase order by ID
 */
export async function getPurchaseOrder(id: string): Promise<PurchaseOrder> {
  return apiClient<PurchaseOrder>(`/purchase-orders/${id}/`);
}

/**
 * Create a new purchase order
 */
export async function createPurchaseOrder(data: CreatePOPayload): Promise<PurchaseOrder> {
  return apiClient<PurchaseOrder>('/purchase-orders/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing purchase order
 */
export async function updatePurchaseOrder(id: string, data: UpdatePOPayload): Promise<PurchaseOrder> {
  return apiClient<PurchaseOrder>(`/purchase-orders/${id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/**
 * Delete a purchase order
 */
export async function deletePurchaseOrder(id: string): Promise<void> {
  return apiClient<void>(`/purchase-orders/${id}/`, {
    method: 'DELETE',
  });
}

/**
 * Get PO statistics
 */
export async function getPOStats(): Promise<POStats> {
  return apiClient<POStats>('/purchase-orders/stats/');
}

// ============ Status Transitions ============

/**
 * P24: Send PO to supplier via email
 * @param id - PO ID
 * @param email - Optional custom recipient email (defaults to supplier.email)
 */
export async function sendPO(
  id: string,
  email?: string
): Promise<{
  status: string;
  message: string;
  sent_to?: string;
  sent_at?: string;
  sent_count?: number;
  error?: string;
}> {
  return apiClient<{
    status: string;
    message: string;
    sent_to?: string;
    sent_at?: string;
    sent_count?: number;
  }>(`/purchase-orders/${id}/send/`, {
    method: 'POST',
    headers: email ? { 'Content-Type': 'application/json' } : undefined,
    body: email ? JSON.stringify({ email }) : undefined,
  });
}

/**
 * Confirm PO (sent → confirmed)
 */
export async function confirmPO(id: string): Promise<{ status: string; message: string }> {
  return apiClient<{ status: string; message: string }>(`/purchase-orders/${id}/confirm/`, {
    method: 'POST',
  });
}

/**
 * Receive PO (confirmed → partial_received/received)
 */
export async function receivePO(id: string): Promise<{ status: string; message: string }> {
  return apiClient<{ status: string; message: string }>(`/purchase-orders/${id}/receive/`, {
    method: 'POST',
  });
}

/**
 * Cancel PO (any → cancelled)
 */
export async function cancelPO(id: string): Promise<{ status: string; message: string }> {
  return apiClient<{ status: string; message: string }>(`/purchase-orders/${id}/cancel/`, {
    method: 'POST',
  });
}

/**
 * P23: Start production (confirmed → in_production)
 */
export async function startProduction(id: string): Promise<{ status: string; message: string }> {
  return apiClient<{ status: string; message: string }>(`/purchase-orders/${id}/start_production/`, {
    method: 'POST',
  });
}

/**
 * P23: Ship PO (confirmed/in_production → shipped)
 */
export async function shipPO(id: string): Promise<{ status: string; message: string }> {
  return apiClient<{ status: string; message: string }>(`/purchase-orders/${id}/ship/`, {
    method: 'POST',
  });
}

/**
 * P23: Get overdue POs
 */
export async function getOverduePOs(): Promise<POListResponse> {
  return apiClient<POListResponse>('/purchase-orders/overdue/');
}

// ============ PO Lines ============

/**
 * List PO lines for a purchase order
 */
export async function listPOLines(purchaseOrderId: string): Promise<POLine[]> {
  const response = await apiClient<{ results: POLine[] }>(`/po-lines/?purchase_order=${purchaseOrderId}`);
  return response.results || [];
}

/**
 * Create a PO line
 */
export async function createPOLine(data: CreatePOLinePayload): Promise<POLine> {
  return apiClient<POLine>('/po-lines/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/**
 * Update a PO line
 */
export async function updatePOLine(id: string, data: UpdatePOLinePayload): Promise<POLine> {
  return apiClient<POLine>(`/po-lines/${id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/**
 * Delete a PO line
 */
export async function deletePOLine(id: string): Promise<void> {
  return apiClient<void>(`/po-lines/${id}/`, {
    method: 'DELETE',
  });
}

/**
 * Update quantity received for a PO line
 */
export async function updatePOLineReceived(id: string, quantityReceived: string): Promise<{ id: string; quantity_received: string; message: string }> {
  return apiClient<{ id: string; quantity_received: string; message: string }>(`/po-lines/${id}/update_received/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity_received: quantityReceived }),
  });
}

/**
 * Get PO PDF export URL
 */
export function getPOPdfUrl(id: string): string {
  return `${API_BASE_URL}/purchase-orders/${id}/export-pdf/`;
}

/**
 * Confirm all lines in a PO at once
 */
export async function confirmAllLines(id: string): Promise<{ confirmed_count: number; all_lines_confirmed: boolean; message: string }> {
  return apiClient<{ confirmed_count: number; all_lines_confirmed: boolean; message: string }>(`/purchase-orders/${id}/confirm-all-lines/`, {
    method: 'POST',
  });
}

/**
 * Confirm a single PO line
 */
export async function confirmPOLine(
  id: string,
  data?: { quantity?: string; unit_price?: string; notes?: string }
): Promise<{ id: string; is_confirmed: boolean; line_total: string; po_total_amount: string; all_lines_confirmed: boolean; message: string }> {
  return apiClient<{ id: string; is_confirmed: boolean; line_total: string; po_total_amount: string; all_lines_confirmed: boolean; message: string }>(`/po-lines/${id}/confirm/`, {
    method: 'POST',
    headers: data ? { 'Content-Type': 'application/json' } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * Unconfirm a PO line for re-editing
 */
export async function unconfirmPOLine(id: string): Promise<{ id: string; is_confirmed: boolean; message: string }> {
  return apiClient<{ id: string; is_confirmed: boolean; message: string }>(`/po-lines/${id}/unconfirm/`, {
    method: 'POST',
  });
}
