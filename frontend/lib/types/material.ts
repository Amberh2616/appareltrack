/**
 * Material Types - P15
 */

export type MaterialCategory = 'fabric' | 'trim' | 'label' | 'packaging';

export type MaterialStatus = 'active' | 'pending_approval' | 'approved' | 'discontinued';

export interface Material {
  id: string;
  organization: string;
  article_no: string;
  name: string;
  name_zh: string;
  description: string;
  category: MaterialCategory;
  category_display?: string;
  supplier: string | null;
  supplier_name?: string;
  color: string;
  color_code: string;
  composition: string;
  weight: string;
  width: string;
  unit: string;
  unit_price: string | null;
  currency: string;
  moq: number | null;
  lead_time_days: number | null;
  wastage_rate: string;
  status: MaterialStatus;
  status_display?: string;
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface MaterialListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Material[];
}

export interface CreateMaterialPayload {
  article_no: string;
  name: string;
  name_zh?: string;
  description?: string;
  category: MaterialCategory;
  supplier?: string;
  color?: string;
  color_code?: string;
  composition?: string;
  weight?: string;
  width?: string;
  unit?: string;
  unit_price?: string;
  currency?: string;
  moq?: number;
  lead_time_days?: number;
  wastage_rate?: string;
  status?: MaterialStatus;
  notes?: string;
}

export interface UpdateMaterialPayload {
  article_no?: string;
  name?: string;
  name_zh?: string;
  description?: string;
  category?: MaterialCategory;
  supplier?: string | null;
  color?: string;
  color_code?: string;
  composition?: string;
  weight?: string;
  width?: string;
  unit?: string;
  unit_price?: string;
  currency?: string;
  moq?: number;
  lead_time_days?: number;
  wastage_rate?: string;
  status?: MaterialStatus;
  is_active?: boolean;
  notes?: string;
}

export const MATERIAL_CATEGORY_OPTIONS = [
  { value: 'fabric', label: 'Fabric', label_zh: '布料' },
  { value: 'trim', label: 'Trim', label_zh: '輔料' },
  { value: 'label', label: 'Label', label_zh: '標籤' },
  { value: 'packaging', label: 'Packaging', label_zh: '包裝' },
] as const;

export const MATERIAL_STATUS_OPTIONS = [
  { value: 'active', label: 'Active', label_zh: '使用中' },
  { value: 'pending_approval', label: 'Pending Approval', label_zh: '待核准' },
  { value: 'approved', label: 'Approved', label_zh: '已核准' },
  { value: 'discontinued', label: 'Discontinued', label_zh: '已停用' },
] as const;
