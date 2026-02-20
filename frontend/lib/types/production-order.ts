/**
 * Production Order Types (大貨訂單)
 */

export type ProductionOrderStatus =
  | "draft"
  | "confirmed"
  | "materials_ordered"
  | "in_production"
  | "completed"
  | "cancelled";

export const PRODUCTION_ORDER_STATUS_OPTIONS: {
  value: ProductionOrderStatus;
  label: string;
  label_zh: string;
}[] = [
  { value: "draft", label: "Draft", label_zh: "草稿" },
  { value: "confirmed", label: "Confirmed", label_zh: "已確認" },
  { value: "materials_ordered", label: "Materials Ordered", label_zh: "已下料單" },
  { value: "in_production", label: "In Production", label_zh: "生產中" },
  { value: "completed", label: "Completed", label_zh: "已完成" },
  { value: "cancelled", label: "Cancelled", label_zh: "已取消" },
];

export interface SizeBreakdown {
  [size: string]: number;
}

export interface ProductionOrder {
  id: string;
  organization: string;
  po_number: string;
  order_number: string;
  customer: string;
  customer_po_ref?: string;
  style_revision: string;
  style_number?: string;
  style_name?: string;
  bulk_costing?: string | null;
  total_quantity: number;
  size_breakdown: SizeBreakdown;
  unit_price: number;
  total_amount: number;
  currency: string;
  status: ProductionOrderStatus;
  status_display?: string;
  order_date: string;
  delivery_date: string;
  actual_delivery?: string | null;
  mrp_calculated: boolean;
  mrp_calculated_at?: string | null;
  requirements_count?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductionOrderDetail extends ProductionOrder {
  material_requirements: MaterialRequirement[];
}

export interface CreateProductionOrderPayload {
  po_number: string;
  order_number: string;
  customer: string;
  customer_po_ref?: string;
  style_revision: string;
  bulk_costing?: string;
  total_quantity: number;
  size_breakdown: SizeBreakdown;
  unit_price: number;
  total_amount: number;
  currency?: string;
  order_date: string;
  delivery_date: string;
  notes?: string;
}

export interface UpdateProductionOrderPayload
  extends Partial<CreateProductionOrderPayload> {}

// Material Requirement Types
export type MaterialRequirementStatus = "calculated" | "ordered" | "received";

export interface PurchaseOrderInfo {
  id: string;
  po_number: string;
  supplier_name?: string;
  status: string;
  expected_delivery?: string | null;
  delivery_status: string;
}

export interface MaterialRequirement {
  id: string;
  production_order: string;
  bom_item: string;
  bom_item_id?: string;
  material_name: string;
  material_name_zh?: string;
  category: string;
  supplier?: string;
  supplier_article_no?: string;
  unit: string;
  consumption_per_piece: number;
  wastage_pct: number;
  order_quantity: number;
  gross_requirement: number;
  wastage_quantity: number;
  total_requirement: number;
  current_stock: number;
  order_quantity_needed: number;
  status: MaterialRequirementStatus;
  // Review fields
  is_reviewed: boolean;
  reviewed_at?: string | null;
  review_notes?: string;
  reviewed_quantity?: number | null;
  reviewed_unit_price?: number | null;
  // Delivery tracking
  required_date?: string | null;
  expected_delivery?: string | null;
  // PO link
  purchase_order_line?: string | null;
  purchase_order_info?: PurchaseOrderInfo | null;
  unit_price?: number;
  line_amount?: number;
  calculated_at: string;
  updated_at: string;
}

export interface MaterialRequirementSimple {
  id: string;
  material_name: string;
  material_name_zh?: string;
  category: string;
  supplier?: string;
  total_requirement: number;
  order_quantity_needed: number;
  unit: string;
  status: MaterialRequirementStatus;
  is_reviewed: boolean;
  required_date?: string | null;
  expected_delivery?: string | null;
}

// Review payload
export interface ReviewMaterialRequirementPayload {
  quantity?: string;
  unit_price?: string;
  notes?: string;
  required_date?: string;
  expected_delivery?: string;
}

// Generate PO from single MR
export interface GeneratePOFromMRResponse {
  id: string;
  status: string;
  purchase_order: {
    id: string;
    po_number: string;
    supplier: string;
    quantity: number;
    unit_price: number;
    total_amount: number;
  };
  message: string;
}

// MRP Calculation
export interface CalculateMRPPayload {
  usage_scenario_id?: string;
  default_wastage_pct?: number;
}

export interface CalculateMRPResponse {
  message: string;
  requirements_count: number;
  summary: RequirementsSummary;
}

export interface RequirementsSummary {
  total_items: number;
  by_category: {
    [category: string]: {
      count: number;
      total_qty: number;
    };
  };
  ready_for_po: number;
  already_ordered: number;
}

// PO Generation
export interface GeneratePOPayload {
  group_by_supplier?: boolean;
}

export interface GeneratePOResponse {
  message: string;
  purchase_orders: {
    id: string;
    po_number: string;
    supplier: string;
    total_amount: number;
    lines_count: number;
  }[];
}

// Stats
export interface ProductionOrderStats {
  total: number;
  by_status: {
    [status: string]: number;
  };
  total_quantity: number;
  total_amount: number;
}

// List Response
export interface ProductionOrderListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ProductionOrder[];
}

export interface MaterialRequirementListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: MaterialRequirementSimple[];
}
