/**
 * Purchase Order Types - P16
 */

// P23: Added in_production and shipped statuses
export type POStatus = 'draft' | 'sent' | 'confirmed' | 'in_production' | 'shipped' | 'partial_received' | 'received' | 'cancelled';

export type POType = 'rfq' | 'production';

export interface POLineSourceInfo {
  // Style info
  style_number: string | null;
  style_name: string | null;
  revision_label: string | null;
  // BOM item info
  bom_item_id: string | null;
  bom_item_number: number | null;
  bom_category: string | null;
  bom_placement: string | null;
  // MRP calculation
  production_order_number: string;
  order_quantity: number;
  consumption_per_piece: string;
  wastage_pct: string;
  gross_requirement: string;
  wastage_quantity: string;
  total_requirement: string;
}

export interface POLine {
  id: string;
  purchase_order: string;
  material: string | null;
  material_article_no?: string;
  material_name_zh?: string;
  order_item_bom: string | null;
  material_name: string;
  color: string;
  quantity: string;
  unit: string;
  unit_price: string;
  line_total: string;
  quantity_received: string;
  // Confirmation status
  is_confirmed: boolean;
  confirmed_at: string | null;
  notes: string;
  // Source traceability
  source_info?: POLineSourceInfo | null;
  // P23: Overdue fields
  is_overdue?: boolean;
  days_overdue?: number;
}

export interface PurchaseOrder {
  id: string;
  organization: string;
  po_number: string;
  po_type: POType;
  po_type_display?: string;
  supplier: string;
  supplier_name?: string;
  supplier_data?: {
    id: string;
    name: string;
    supplier_code: string;
    supplier_type: string;
    email?: string;
  };
  status: POStatus;
  status_display?: string;
  po_date: string;
  expected_delivery: string;
  actual_delivery: string | null;
  total_amount: string;
  notes: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  lines?: POLine[];
  lines_count?: number;
  // Confirmation status
  all_lines_confirmed?: boolean;
  confirmed_lines_count?: number;
  total_lines_count?: number;
  // P24: Email tracking
  sent_at?: string | null;
  sent_to_email?: string | null;
  sent_count?: number;
  // P23: Overdue fields
  is_overdue?: boolean;
  days_overdue?: number;
  overdue_lines_count?: number;
}

export interface POListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: PurchaseOrder[];
}

export interface POStats {
  total: number;
  by_status: Record<POStatus, number>;
  total_amount: number;
}

export interface CreatePOPayload {
  po_number: string;
  po_type: POType;
  supplier: string;
  po_date: string;
  expected_delivery: string;
  notes?: string;
}

export interface UpdatePOPayload {
  po_number?: string;
  po_type?: POType;
  supplier?: string;
  po_date?: string;
  expected_delivery?: string;
  actual_delivery?: string;
  total_amount?: string;
  notes?: string;
}

export interface CreatePOLinePayload {
  purchase_order: string;
  material?: string;
  material_name: string;
  color?: string;
  quantity: string;
  unit: string;
  unit_price: string;
  line_total: string;
}

export interface UpdatePOLinePayload {
  material?: string;
  material_name?: string;
  color?: string;
  quantity?: string;
  unit?: string;
  unit_price?: string;
  line_total?: string;
  quantity_received?: string;
}

export const PO_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', label_zh: '草稿', color: 'bg-gray-100 text-gray-800' },
  { value: 'sent', label: 'Sent', label_zh: '已發送', color: 'bg-blue-100 text-blue-800' },
  { value: 'confirmed', label: 'Confirmed', label_zh: '已確認', color: 'bg-green-100 text-green-800' },
  { value: 'in_production', label: 'In Production', label_zh: '生產中', color: 'bg-purple-100 text-purple-800' },  // P23
  { value: 'shipped', label: 'Shipped', label_zh: '已出貨', color: 'bg-indigo-100 text-indigo-800' },  // P23
  { value: 'partial_received', label: 'Partial Received', label_zh: '部分收貨', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'received', label: 'Received', label_zh: '已收貨', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'cancelled', label: 'Cancelled', label_zh: '已取消', color: 'bg-red-100 text-red-800' },
] as const;

export const PO_TYPE_OPTIONS = [
  { value: 'rfq', label: 'RFQ', label_zh: '詢價單' },
  { value: 'production', label: 'Production PO', label_zh: '生產採購單' },
] as const;

// Status transition map - P23: Updated with new statuses
export const PO_TRANSITIONS: Record<POStatus, { action: string; label: string; nextStatus: POStatus }[]> = {
  draft: [{ action: 'send', label: '發送給供應商', nextStatus: 'sent' }],
  sent: [{ action: 'confirm', label: '確認收到', nextStatus: 'confirmed' }],
  confirmed: [
    { action: 'start_production', label: '開始生產', nextStatus: 'in_production' },
    { action: 'ship', label: '已出貨', nextStatus: 'shipped' },
    { action: 'receive', label: '收貨', nextStatus: 'received' },
  ],
  in_production: [
    { action: 'ship', label: '已出貨', nextStatus: 'shipped' },
    { action: 'receive', label: '收貨', nextStatus: 'received' },
  ],
  shipped: [{ action: 'receive', label: '收貨', nextStatus: 'received' }],
  partial_received: [{ action: 'receive', label: '完成收貨', nextStatus: 'received' }],
  received: [],
  cancelled: [],
};
