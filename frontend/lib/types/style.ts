/**
 * Style & Revision Types
 * Matches backend models in apps/styles/
 */

export type Season = 'SP' | 'SU' | 'FA' | 'HO';
export type StyleStatus = 'draft' | 'active' | 'archived';
export type RevisionStatus = 'uploaded' | 'parsing' | 'draft' | 'approved' | 'rejected';

export interface Organization {
  id: string;
  name: string;
  settings: Record<string, any>;
  ai_budget_monthly: string;
  created_at: string;
  updated_at: string;
}

export interface Style {
  id: string;
  organization: string;
  style_number: string;
  style_name: string;
  season: Season;
  year: number;
  customer: string | null;
  description: string;
  status: StyleStatus;
  tags: string[];
  created_at: string;
  updated_at: string;
  created_by: string;

  // Related data (loaded separately)
  latest_revision?: StyleRevision;
  revisions_count?: number;
}

export interface StyleRevision {
  id: string;
  style: string;  // Style UUID
  revision_label: string;  // e.g., "Rev A"
  status: RevisionStatus;
  status_display?: string;
  notes?: string;

  // Change tracking
  previous_revision: string | null;
  changes_from_previous?: Record<string, any> | null;

  // Draft data (AI output)
  draft_bom_data?: any;
  draft_measurement_data?: any;
  draft_construction_data?: any;

  // BOM items (when loaded with revision detail)
  bom_items?: any[];
  measurements?: any[];
  construction_steps?: any[];

  // Approval
  approved_at: string | null;
  approved_by: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface BOMItem {
  id: string;
  revision: string;
  item_number: number;
  category: 'fabric' | 'trim' | 'packaging' | 'other';

  // Material info
  material_code: string;
  material_name: string;
  material_description: string;
  color_code: string;
  color_name: string;
  supplier: string | null;

  // Consumption (template level - not for PO)
  consumption_value: number | null;
  consumption_unit: string;
  placement: string;

  // Evidence
  evidence: Record<string, any>;
  field_confidence: Record<string, number>;

  // Notes
  notes: string;

  created_at: string;
  updated_at: string;
}

export interface Measurement {
  id: string;
  revision: string;
  point_number: number;
  point_name: string;
  measurement_method: string;
  tolerance: string;

  // Size values (JSONB in DB)
  size_values: Record<string, number>; // e.g., {"XS": 66, "S": 70, ...}

  // Evidence
  evidence: Record<string, any>;
  confidence: number;

  created_at: string;
  updated_at: string;
}

export interface ConstructionStep {
  id: string;
  revision: string;
  step_number: number;
  step_name: string;
  description: string;
  machine_type: string;
  thread_type: string;
  stitch_type: string;
  spi: string; // stitches per inch

  // Quality control
  qc_checkpoint: boolean;
  qc_criteria: string;

  // Evidence
  evidence: Record<string, any>;
  confidence: number;

  created_at: string;
  updated_at: string;
}

/**
 * API Response Types
 */
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface StyleListItem {
  id: string;
  style_number: string;
  style_name: string;
  season: Season;
  year: number;
  customer: string | null;
  status: StyleStatus;
  latest_revision_status: RevisionStatus | null;
  latest_revision_number: number | null;
  latest_revision_id?: string | null;
  documents_count: number;
  issues_count: number;
  created_at: string;
  updated_at: string;
  revisions?: StyleRevision[];  // Optional: included when expand_revisions=true
}

export interface StyleDetail extends Style {
  revisions: StyleRevision[];
  documents: Document[];
}

export interface CreateStyleInput {
  style_number: string;
  style_name: string;
  season: Season;
  year: number;
  customer?: string;
  description?: string;
  tags?: string[];
}

export interface CreateRevisionInput {
  style: string;
  revision_name: string;
  previous_revision?: string;
}
