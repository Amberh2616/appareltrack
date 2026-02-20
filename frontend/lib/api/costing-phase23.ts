/**
 * Costing API Client - Phase 2-3
 * Three-Layer Architecture: BOM → Usage → Costing
 */

import { apiClient } from './client';
import type {
  CostSheetVersion,
  CostSheetVersionDetail,
  CostLineV2,
  CreateCostSheetPayload,
  CloneCostSheetPayload,
  UpdateCostSheetSummaryPayload,
  UpdateCostLinePatch,
} from '@/types/costing-phase23';

// ========================================
// CostSheetVersion APIs
// ========================================

/**
 * List all CostSheetVersions for a style (with filtering)
 * GET /cost-sheet-versions/?style_id=uuid&costing_type=sample|bulk
 */
export async function fetchCostSheetVersions(
  styleId: string,
  params?: {
    costing_type?: 'sample' | 'bulk';
    cost_sheet_group_id?: string;
  }
): Promise<CostSheetVersion[]> {
  const searchParams = new URLSearchParams({ style_id: styleId });

  if (params?.costing_type) {
    searchParams.set('costing_type', params.costing_type);
  }
  if (params?.cost_sheet_group_id) {
    searchParams.set('cost_sheet_group_id', params.cost_sheet_group_id);
  }

  const queryString = searchParams.toString();
  const url = `/cost-sheet-versions/${queryString ? `?${queryString}` : ''}`;

  // Backend returns paginated response
  const response = await apiClient<{ results: CostSheetVersion[] }>(url);
  return response.results;
}

/**
 * Get single CostSheetVersion detail with nested cost_lines
 * GET /cost-sheet-versions/{id}/
 */
export async function fetchCostSheetVersionDetail(
  costSheetId: string
): Promise<CostSheetVersionDetail> {
  return apiClient<CostSheetVersionDetail>(`/cost-sheet-versions/${costSheetId}/`);
}

/**
 * Create new CostSheetVersion (snapshot from UsageScenario)
 * POST /cost-sheet-versions/
 */
export async function createCostSheetVersion(
  payload: CreateCostSheetPayload
): Promise<CostSheetVersionDetail> {
  return apiClient<CostSheetVersionDetail>('/cost-sheet-versions/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/**
 * Clone existing CostSheetVersion
 * POST /cost-sheet-versions/{id}/clone/
 */
export async function cloneCostSheetVersion(
  costSheetId: string,
  payload: CloneCostSheetPayload
): Promise<CostSheetVersionDetail> {
  return apiClient<CostSheetVersionDetail>(
    `/cost-sheet-versions/${costSheetId}/clone/`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
}

/**
 * Submit CostSheetVersion (Draft → Submitted, locks UsageScenario)
 * POST /cost-sheet-versions/{id}/submit/
 */
export async function submitCostSheetVersion(
  costSheetId: string
): Promise<CostSheetVersionDetail> {
  return apiClient<CostSheetVersionDetail>(
    `/cost-sheet-versions/${costSheetId}/submit/`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Update CostSheetVersion summary fields (Draft only)
 * PATCH /cost-sheet-versions/{id}/
 */
export async function updateCostSheetSummary(
  costSheetId: string,
  payload: UpdateCostSheetSummaryPayload
): Promise<CostSheetVersionDetail> {
  return apiClient<CostSheetVersionDetail>(`/cost-sheet-versions/${costSheetId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ========================================
// CostLineV2 APIs
// ========================================

/**
 * Update CostLineV2 (adjust consumption/price, Draft only)
 * PATCH /cost-lines-v2/{id}/
 */
export async function updateCostLine(
  lineId: string,
  patch: UpdateCostLinePatch
): Promise<CostLineV2> {
  return apiClient<CostLineV2>(`/cost-lines-v2/${lineId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

// ========================================
// P18: Sample → Bulk Quotation APIs
// ========================================

export interface CreateBulkQuotePayload {
  expected_quantity?: number;
  copy_labor_overhead?: boolean;
  change_reason?: string;
}

/**
 * P18: Create Bulk Quote from Sample CostSheetVersion (T6 核心連結)
 * POST /cost-sheet-versions/{id}/create-bulk-quote/
 *
 * Prerequisites:
 * - Source must be costing_type='sample'
 * - Source must be status='accepted' (best practice) or 'submitted'
 */
export async function createBulkQuote(
  sampleCostSheetId: string,
  payload: CreateBulkQuotePayload = {}
): Promise<CostSheetVersionDetail> {
  return apiClient<CostSheetVersionDetail>(
    `/cost-sheet-versions/${sampleCostSheetId}/create-bulk-quote/`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
}

/**
 * P11: Refresh CostSheetVersion snapshot from current BOM data
 * POST /cost-sheet-versions/{id}/refresh-snapshot/
 *
 * Only allowed for draft status.
 * Re-reads consumption and unit_price from BOMItem.
 */
export async function refreshCostSheetSnapshot(
  costSheetId: string
): Promise<CostSheetVersionDetail> {
  return apiClient<CostSheetVersionDetail>(
    `/cost-sheet-versions/${costSheetId}/refresh-snapshot/`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * P18: Accept CostSheetVersion (Submitted → Accepted)
 * POST /cost-sheet-versions/{id}/accept/
 *
 * Used for both Sample and Bulk quotations
 */
export async function acceptCostSheetVersion(
  costSheetId: string
): Promise<CostSheetVersionDetail> {
  return apiClient<CostSheetVersionDetail>(
    `/cost-sheet-versions/${costSheetId}/accept/`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * P18: Reject CostSheetVersion (Submitted → Rejected)
 * POST /cost-sheet-versions/{id}/reject/
 */
export async function rejectCostSheetVersion(
  costSheetId: string,
  rejectReason?: string
): Promise<CostSheetVersionDetail> {
  return apiClient<CostSheetVersionDetail>(
    `/cost-sheet-versions/${costSheetId}/reject/`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reject_reason: rejectReason }),
    }
  );
}

// ========================================
// P18: T8 Create Production Order from Bulk Quote
// ========================================

export interface CreateProductionOrderPayload {
  po_number: string;
  customer: string;
  total_quantity: number;
  size_breakdown: Record<string, number>;
  order_date: string;
  delivery_date: string;
  notes?: string;
  calculate_mrp?: boolean;
}

export interface CreateProductionOrderResponse {
  success: boolean;
  data: {
    id: string;
    order_number: string;
    po_number: string;
    customer: string;
    total_quantity: number;
    size_breakdown: Record<string, number>;
    unit_price: string;
    total_amount: string;
    status: string;
    order_date: string;
    delivery_date: string;
    mrp_calculated: boolean;
    material_requirements?: Array<{
      id: string;
      material_name: string;
      category: string;
      total_requirement: string;
      unit: string;
      status: string;
    }>;
  };
  message: string;
}

/**
 * P18: T8 核心 - Create Production Order from Accepted Bulk Quote
 * POST /cost-sheet-versions/{id}/create-production-order/
 *
 * Prerequisites:
 * - Source must be costing_type='bulk'
 * - Source must be status='accepted'
 */
export async function createProductionOrderFromQuote(
  bulkCostSheetId: string,
  payload: CreateProductionOrderPayload
): Promise<CreateProductionOrderResponse> {
  return apiClient<CreateProductionOrderResponse>(
    `/cost-sheet-versions/${bulkCostSheetId}/create-production-order/`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
}
