/**
 * Phase 2-3 Costing System Types
 * Three-Layer Architecture: BOM → Usage → Costing
 */

// ========================================
// Layer 2: Usage Scenario (HOW MUCH)
// ========================================

export type UsagePurpose =
  | 'sample_quote'
  | 'bulk_quote'
  | 'cost_analysis'
  | 'what_if';

export type UsageScenarioStatus = 'draft' | 'superseded';

export type ConsumptionStatus =
  | 'estimated'
  | 'confirmed'
  | 'pending_lab_dip';

export interface UsageScenario {
  id: string;
  revision: string; // FK to StyleRevision
  purpose: UsagePurpose;
  version_no: number;

  // Calculation rules
  wastage_pct: string; // Decimal as string
  rounding_rule: string;
  notes: string;

  // Status & metadata
  status: UsageScenarioStatus;
  is_locked: boolean; // Derived from related CostSheetVersions
  can_edit: boolean;

  // Audit trail
  created_by: string;
  created_at: string;
  locked_at: string | null;
  locked_first_by_cost_sheet: string | null;
}

export interface UsageLine {
  id: string;
  usage_scenario: string; // FK
  bom_item: string; // FK

  // Consumption
  consumption: string; // Decimal
  consumption_unit: string;
  consumption_status: ConsumptionStatus;
  wastage_pct_override: string | null;

  // Calculated fields (from serializer)
  adjusted_consumption: string; // consumption + wastage

  // Metadata
  notes: string;
  sort_order: number;
  confirmed_by: string | null;
  confirmed_at: string | null;
}

// ========================================
// Layer 3: Cost Sheet Version (QUOTE)
// ========================================

export type CostingType = 'sample' | 'bulk';

export type CostSheetStatus =
  | 'draft'
  | 'submitted'
  | 'accepted'
  | 'rejected'
  | 'superseded';

export interface CostSheetGroup {
  id: string;
  style: string; // FK to Style
  created_at: string;
}

export interface CostSheetVersion {
  id: string;
  cost_sheet_group: string; // FK
  version_no: number;
  costing_type: CostingType;
  status: CostSheetStatus;

  // Evidence binding (Phase 2/3 boundary)
  techpack_revision: string; // FK to StyleRevision (PROTECT)
  usage_scenario: string; // FK to UsageScenario (PROTECT)

  // Cost inputs
  labor_cost: string; // Decimal
  overhead_cost: string;
  freight_cost: string;
  packing_cost: string;
  margin_pct: string;

  // Calculated totals (auto-calculated)
  material_cost: string;
  total_cost: string;
  unit_price: string;

  // Version tracking
  superseded_by: string | null; // FK to self
  cloned_from: string | null; // FK to self

  // Metadata
  change_reason: string;
  created_by: string;
  created_at: string;
  submitted_by: string | null;
  submitted_at: string | null;

  // Derived fields
  can_edit: boolean;
  is_current: boolean;
}

export interface CostLineV2 {
  id: string;
  cost_sheet_version: string; // FK
  bom_item: string; // FK (source reference only)

  // Material info (snapshot at creation time)
  material_name: string;
  material_name_zh: string;
  supplier: string;
  category: string;

  // Consumption snapshot + adjustment
  consumption_snapshot: string; // Decimal
  consumption_adjusted: string;
  consumption_unit: string;
  is_consumption_adjusted: boolean;

  // Price snapshot + adjustment
  unit_price_snapshot: string;
  unit_price_adjusted: string;
  is_price_adjusted: boolean;

  // Calculated
  line_cost: string; // consumption_adjusted × unit_price_adjusted

  // Delta percentage (from serializer)
  delta_consumption_pct: number | null;
  delta_price_pct: number | null;

  // Source tracking (Phase 2/3 boundary compliance)
  source_revision_id: string;
  source_scenario_id: string;
  source_usage_line_id: string;
  snapshot_at: string;

  // Adjustment metadata
  adjustment_reason: string;
  adjusted_by: string | null;
  adjusted_at: string | null;

  // Sorting
  sort_order: number;
}

// ========================================
// API Payloads
// ========================================

export interface CreateCostSheetPayload {
  style_id: string;
  costing_type: CostingType;
  usage_scenario_id: string;
  labor_cost?: string;
  overhead_cost?: string;
  freight_cost?: string;
  packing_cost?: string;
  margin_pct?: string;
  change_reason?: string;
}

export interface CloneCostSheetPayload {
  usage_scenario_id?: string; // Optional: can switch to different scenario
  labor_cost?: string;
  overhead_cost?: string;
  freight_cost?: string;
  packing_cost?: string;
  margin_pct?: string;
  change_reason: string;
}

export interface UpdateCostSheetSummaryPayload {
  labor_cost?: string;
  overhead_cost?: string;
  freight_cost?: string;
  packing_cost?: string;
  margin_pct?: string;
}

export interface UpdateCostLinePatch {
  consumption_adjusted?: string;
  unit_price_adjusted?: string;
  adjustment_reason?: string;
}

// ========================================
// List Response Types (with nested data)
// ========================================

export interface CostSheetVersionListItem {
  id: string;
  version_no: number;
  costing_type: CostingType;
  status: CostSheetStatus;
  unit_price: string;
  created_at: string;
  created_by: string;
  change_reason: string;
  can_edit: boolean;
  is_current: boolean;

  // Evidence (minimal info)
  techpack_revision: string;
  usage_scenario: string;
}

export interface CostSheetVersionDetail extends CostSheetVersion {
  cost_lines: CostLineV2[];
}

// ========================================
// UI State Types
// ========================================

export interface CostingPageParams {
  revisionId: string;
  costingType: CostingType;
}

export interface InlineEditState {
  isEditing: boolean;
  isSaving: boolean;
  error: string | null;
}
