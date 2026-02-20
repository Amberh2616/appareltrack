/**
 * BOM (Bill of Materials) Types
 */

export type BOMCategory = 'fabric' | 'trim' | 'packaging' | 'label';

export type ConsumptionMaturity = 'unknown' | 'pre_estimate' | 'sample' | 'confirmed' | 'locked';

export type MaterialStatus =
  | 'Pending Submission'
  | 'Pending Approval'
  | 'Approved'
  | 'Approved with Limitations'
  | 'Rejected'
  | 'Discontinued';

export type TranslationStatus = 'pending' | 'confirmed';

export interface BOMItem {
  id: string;
  revision: string;
  item_number: number;
  category: BOMCategory;
  category_display: string;
  material_name: string;
  supplier: string;
  supplier_article_no: string | null;
  color: string;
  color_code: string;
  material_status: string | null;
  consumption: string; // Decimal as string (原始 Tech Pack 用量)
  consumption_maturity: ConsumptionMaturity;
  consumption_maturity_display: string;
  // 用量四階段
  pre_estimate_value: string | null; // 預估用量
  sample_value: string | null; // 樣衣用量
  confirmed_value: string | null; // 確認用量
  locked_value: string | null; // 鎖定用量
  current_consumption: string | null; // 當前最佳用量
  can_edit_consumption: boolean; // 是否可編輯
  sample_confirmed_at: string | null;
  consumption_confirmed_at: string | null;
  consumption_locked_at: string | null;
  consumption_history: ConsumptionHistoryEntry[];
  // 其他欄位
  unit: string;
  placement: string[];
  wastage_rate: string; // Decimal as string
  unit_price: string | null; // Decimal as string
  leadtime_days: number | null;
  ai_confidence: number | null;
  is_verified: boolean;
  // Translation fields
  material_name_zh?: string;
  description_zh?: string;
  translation_status?: TranslationStatus;
  translated_at?: string;
  translated_by?: string;
}

export interface ConsumptionHistoryEntry {
  action: string;
  old_value?: string | null;
  new_value?: string;
  locked_value?: string;
  source?: string;
  timestamp: string;
  user?: string | null;
}

export interface BOMListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: BOMItem[];
}

export interface UpdateBOMItemPayload {
  supplier_article_no?: string;
  material_status?: string;
  consumption?: string;
  unit_price?: string;
  leadtime_days?: number;
  wastage_rate?: string;
  is_verified?: boolean;
  // Translation fields
  material_name_zh?: string;
  description_zh?: string;
  translation_status?: TranslationStatus;
}

export interface TranslateBatchResponse {
  success: boolean;
  translated_count: number;
  skipped_count: number;
  error_count: number;
  errors?: string[];
}

export interface CreateBOMItemPayload {
  material_name: string;
  category: BOMCategory;
  supplier?: string;
  supplier_article_no?: string;
  color?: string;
  color_code?: string;
  consumption?: string;
  unit?: string;
  unit_price?: string;
  placement?: string[];
  wastage_rate?: string;
  leadtime_days?: number;
}
