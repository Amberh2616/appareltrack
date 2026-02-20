/**
 * Draft Review Types - v2.2.1
 * Matches AI-JSON-SCHEMA_v2.2.1_COMPLETE.md
 */

// ===== Evidence =====
export interface Evidence {
  source: string;
  page: number;
  bbox: [number, number, number, number]; // [x, y, width, height]
  text_snippet: string;
}

// ===== Field Confidence =====
export interface FieldConfidence {
  [fieldName: string]: number; // 0.0 - 1.0
}

// ===== Issue =====
export interface DraftIssue {
  type: 'missing_field' | 'conflict' | 'low_confidence' | 'validation_error';
  severity: 'error' | 'warning' | 'info';
  target: 'bom' | 'measurement' | 'construction' | 'global';
  item_number?: number;
  point_code?: string;
  step_number?: number;
  field?: string;
  message: string;
  suggested_fix?: string;
  evidence?: Evidence;
}

// ===== BOM =====
export interface BOMItemDraft {
  item_number: number;
  category: 'fabric' | 'trim' | 'packaging' | 'other';
  description: string;
  material_code: string;
  color: string;
  supplier: string | null;
  consumption: number | null;
  uom: string;
  placement: string;
  notes: string;
  evidence: Evidence;
  field_confidence: FieldConfidence;
}

export interface BOMDraft {
  items: BOMItemDraft[];
  issues: DraftIssue[];
}

// ===== Measurement =====
export interface MeasurementPointDraft {
  point_code: string;
  point_name: string;
  measurement_method?: string;
  tolerance?: string;
  sizes: {
    [sizeName: string]: number; // e.g., {"XS": 40.0, "S": 42.5}
  };
  evidence: Evidence;
  field_confidence: FieldConfidence;
}

export interface MeasurementDraft {
  points: MeasurementPointDraft[];
  issues: DraftIssue[];
}

// ===== Construction =====
export interface ConstructionStepDraft {
  step_number: number;
  step_name: string;
  description: string;
  machine_type?: string;
  special_requirements?: string;
  qc_checkpoints?: string[];
  evidence: Evidence;
  field_confidence: FieldConfidence;
}

export interface ConstructionDraft {
  steps: ConstructionStepDraft[];
  issues: DraftIssue[];
}

// ===== Complete Draft Response =====
export interface DraftData {
  bom: BOMDraft;
  measurement: MeasurementDraft;
  construction: ConstructionDraft;
  issues: DraftIssue[]; // Global issues
}

export interface DraftResponse {
  data: DraftData;
  meta: {
    request_id: string;
    ts: string;
  };
  errors: any[];
}

// ===== UI State Types =====
export type DraftTab = 'bom' | 'measurement' | 'construction';

export interface TableSelection {
  tab: DraftTab;
  rowKey: string | number; // item_number, point_code, or step_number
  fieldKey?: string;
}

export interface UIState {
  activeTab: DraftTab;
  activeIssueId: string | null;
  activeEvidence: Evidence | null;
  tableSelection: TableSelection | null;
  filters: {
    issueOnly: boolean;
    missingOnly: boolean;
    lowConfidence: boolean;
  };
  search: string;
}

// ===== Edit Operations =====
export interface DraftEdit {
  op: 'replace' | 'add' | 'remove';
  path: string; // JSON Pointer format: /bom/items/0/supplier
  value?: any;
}

// ===== Helper Types =====
export interface IssueTarget {
  tab: DraftTab;
  rowKey: string | number;
  fieldKey?: string;
  evidence?: Evidence;
}

export interface ConfidenceLevel {
  value: number;
  label: 'high' | 'medium' | 'low';
  color: 'green' | 'yellow' | 'red';
}
