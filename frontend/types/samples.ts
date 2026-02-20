/**
 * Sample Request System TypeScript Types
 * Corresponds to backend/apps/samples/models.py
 */

// ==================== Enums & Choice Types ====================

export type SampleRequestType =
  | 'proto'
  | 'fit'
  | 'sales'
  | 'photo'
  | 'marketing'
  | 'wear_test'
  | 'material_test'
  | 'color_approval'
  | 'size_set'
  | 'replacement'
  | 'trade_show'
  | 'counter'
  | 'sealed'
  | 'custom';

export type SampleRequestStatus = 'open' | 'on_hold' | 'closed' | 'cancelled';

export type SampleRunStatus =
  | 'draft'
  | 'materials_planning'
  | 'po_drafted'
  | 'po_issued'
  | 'mwo_drafted'
  | 'mwo_issued'
  | 'in_progress'
  | 'sample_done'
  | 'actuals_recorded'
  | 'costing_generated'
  | 'quoted'
  | 'accepted'
  | 'revise_needed'
  | 'cancelled';

export type SampleRunType = 'proto' | 'fit' | 'sales' | 'photo' | 'other';

export type Priority = 'low' | 'normal' | 'urgent';

export type EstimateStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export type EstimateSource = 'manual' | 'from_phase2_costing';

export type T2POStatus = 'draft' | 'issued' | 'confirmed' | 'delivered' | 'cancelled';

export type MWOStatus = 'draft' | 'issued' | 'in_progress' | 'completed' | 'cancelled';

export type SampleStatus = 'in_production' | 'completed' | 'delivered' | 'rejected';

export type AttachmentFileType = 'photo' | 'pdf' | 'other';

// ==================== Model Types ====================

export interface SampleRequest {
  id: string;
  revision: string; // UUID FK to StyleRevision
  brand_name: string;
  request_type: SampleRequestType;
  request_type_custom?: string;
  quantity_requested: number;
  size_set_json?: {
    sizes?: string[];
    notes?: string;
  };
  purpose?: string;
  need_quote_first: boolean;
  priority: Priority;
  due_date?: string; // ISO date string
  status: SampleRequestStatus;
  notes_internal?: string;
  notes_customer?: string;
  brand_context_json?: Record<string, any>;
  created_by?: string; // UUID FK to User
  created_at: string; // ISO datetime
  updated_at: string;
  status_updated_at: string;

  // Added by FIX-0202 serializer
  style_number?: string;
  style_name?: string;
  revision_label?: string;

  // Related data (optional, from nested serializers)
  runs?: SampleRun[];
  estimates?: SampleCostEstimate[];
  samples?: Sample[];
  attachments?: SampleAttachment[];
}

export interface SampleRun {
  id: string;
  sample_request: string; // UUID FK
  run_no: number;
  run_type: SampleRunType;
  revision?: string; // Optional override revision
  quantity: number;
  target_due_date?: string; // ISO date
  status: SampleRunStatus;
  notes?: string;
  guidance_usage?: string; // UUID FK to UsageScenario
  actual_usage?: string; // UUID FK to UsageScenario
  costing_version?: string; // UUID FK to CostSheetVersion
  created_by?: string;
  created_at: string;
  updated_at: string;
  status_updated_at: string;
  status_timestamps?: Record<string, string>; // TRACK-PROGRESS: {"draft": "ISO", "materials_planning": "ISO", ...}

  // Nested style info (from serializer)
  style?: {
    id: string;
    style_number: string;
    style_name?: string;
  };

  // Related data
  t2pos?: T2POForSample[];
  mwos?: SampleMWO[];
  actuals?: SampleActuals;
}

// TRACK-PROGRESS: 操作歷史記錄
export interface SampleRunTransitionLog {
  id: string;
  from_status: string;
  to_status: string;
  action: string;
  actor: string | null;
  actor_name: string | null;
  note: string;
  created_at: string;
}

export interface SampleActuals {
  id: string;
  sample_run: string; // UUID FK (OneToOne)
  labor_minutes?: number;
  labor_cost?: number;
  overhead_cost?: number;
  shipping_cost?: number;
  rework_cost?: number;
  waste_pct_actual?: number;
  issues_notes?: string;
  recorded_by?: string;
  recorded_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SampleCostEstimate {
  id: string;
  sample_request: string; // UUID FK
  estimate_version: number;
  status: EstimateStatus;
  currency: string;
  valid_until?: string; // ISO date
  estimated_total: number;
  breakdown_snapshot_json?: {
    materials?: any[];
    labor?: any[];
    overhead?: any[];
  };
  source: EstimateSource;
  source_revision_id?: string;
  snapshot_hash?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface T2POForSample {
  id: string;
  sample_run?: string; // UUID FK (Phase 3 design)
  sample_request?: string; // Legacy FK (nullable)
  estimate?: string;
  version_no: number;
  is_latest: boolean;
  po_no?: string;
  supplier_name: string;
  status: T2POStatus;
  issued_at?: string;
  confirmed_at?: string;
  delivered_at?: string;
  delivery_date?: string; // ISO date
  currency: string;
  total_amount: number;
  notes?: string;
  source_revision_id: string;
  snapshot_at: string;
  snapshot_hash: string;
  created_at: string;
  updated_at: string;

  // Related data
  lines?: T2POLineForSample[];
}

export interface T2POLineForSample {
  id: string;
  t2po: string; // UUID FK
  line_no: number;
  material_name: string;
  supplier_article_no?: string;
  uom: string;
  consumption_per_piece: number;
  wastage_pct: number;
  quantity_requested: number;
  unit_price: number;
  line_total: number;
}

export interface SampleMWO {
  id: string;
  sample_run?: string; // UUID FK (Phase 3 design)
  sample_request?: string; // Legacy FK (nullable)
  estimate?: string;
  version_no: number;
  is_latest: boolean;
  mwo_no?: string;
  factory_name: string;
  status: MWOStatus;
  start_date?: string; // ISO date
  due_date?: string; // ISO date
  notes?: string;
  source_revision_id: string;
  snapshot_at: string;
  snapshot_hash: string;
  bom_snapshot_json?: any[];
  construction_snapshot_json?: any[];
  qc_snapshot_json?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Sample {
  id: string;
  sample_request: string; // UUID FK
  sample_mwo?: string;
  physical_ref?: string;
  quantity_made: number;
  status: SampleStatus;
  received_date?: string; // ISO date
  delivered_date?: string; // ISO date
  customer_feedback?: string;
  fit_comments?: string;
  created_at: string;
  updated_at: string;

  // Related data
  attachments?: SampleAttachment[];
}

export interface SampleAttachment {
  id: string;
  sample_request?: string; // UUID FK (nullable)
  sample?: string; // UUID FK (nullable)
  file_url: string;
  file_type: AttachmentFileType;
  caption?: string;
  uploaded_by?: string;
  uploaded_at: string;
}

// ==================== API Payload Types ====================

export interface CreateSampleRequestPayload {
  revision: string;
  brand_name?: string;
  request_type: SampleRequestType;
  request_type_custom?: string;
  quantity_requested?: number;
  size_set_json?: Record<string, any>;
  purpose?: string;
  need_quote_first?: boolean;
  priority?: Priority;
  due_date?: string;
  notes_internal?: string;
  notes_customer?: string;
  brand_context_json?: Record<string, any>;
}

export interface UpdateSampleRequestPayload {
  brand_name?: string;
  request_type?: SampleRequestType;
  request_type_custom?: string;
  quantity_requested?: number;
  size_set_json?: Record<string, any>;
  purpose?: string;
  need_quote_first?: boolean;
  priority?: Priority;
  due_date?: string;
  status?: SampleRequestStatus;
  notes_internal?: string;
  notes_customer?: string;
  brand_context_json?: Record<string, any>;
}

export interface CreateSampleRunPayload {
  sample_request: string;
  run_no?: number; // Auto-increment if not provided
  run_type: SampleRunType;
  revision?: string;
  quantity?: number;
  target_due_date?: string;
  notes?: string;
  guidance_usage?: string;
}

export interface UpdateSampleRunPayload {
  run_type?: SampleRunType;
  revision?: string;
  quantity?: number;
  target_due_date?: string;
  status?: SampleRunStatus;
  notes?: string;
  guidance_usage?: string;
  actual_usage?: string;
  costing_version?: string;
}

export interface TransitionSampleRunPayload {
  action:
    | 'submit'
    | 'quote'
    | 'approve'
    | 'reject'
    | 'cancel'
    | 'start_execution'
    | 'complete';
  notes?: string;
}

export interface CreateSampleAttachmentPayload {
  sample_request?: string;
  sample?: string;
  file_url: string;
  file_type?: AttachmentFileType;
  caption?: string;
}

// ==================== Display Labels ====================

export const SampleRequestTypeLabels: Record<SampleRequestType, string> = {
  proto: 'Proto Sample',
  fit: 'Fit Sample',
  sales: 'Sales Sample',
  photo: 'Photo Sample',
  marketing: 'Marketing Sample',
  wear_test: 'Wear Test',
  material_test: 'Material Test',
  color_approval: 'Color Approval',
  size_set: 'Size Set',
  replacement: 'Replacement',
  trade_show: 'Trade Show',
  counter: 'Counter Sample',
  sealed: 'Sealed Sample',
  custom: 'Custom',
};

export const SampleRequestStatusLabels: Record<SampleRequestStatus, string> = {
  open: 'Open',
  on_hold: 'On Hold',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

export const SampleRunStatusLabels: Record<SampleRunStatus, string> = {
  draft: 'Draft',
  materials_planning: 'Materials Planning',
  po_drafted: 'PO Drafted',
  po_issued: 'PO Issued',
  mwo_drafted: 'MWO Drafted',
  mwo_issued: 'MWO Issued',
  in_progress: 'In Progress',
  sample_done: 'Sample Done',
  actuals_recorded: 'Actuals Recorded',
  costing_generated: 'Costing Generated',
  quoted: 'Quoted',
  accepted: 'Accepted',
  revise_needed: 'Revise Needed',
  cancelled: 'Cancelled',
};

export const PriorityLabels: Record<Priority, string> = {
  low: 'Low',
  normal: 'Normal',
  urgent: 'Urgent',
};

export const SampleRunTypeLabels: Record<SampleRunType, string> = {
  proto: 'Proto Sample',
  fit: 'Fit Sample',
  sales: 'Sales Sample',
  photo: 'Photo Sample',
  other: 'Other',
};
