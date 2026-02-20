/**
 * Supplier Types - P14
 */

export type SupplierType = 'fabric' | 'trim' | 'label' | 'packaging' | 'factory';

export interface Supplier {
  id: string;
  organization: string;
  name: string;
  supplier_code: string;
  supplier_type: SupplierType;
  supplier_type_display?: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  payment_terms: string;
  lead_time_days: number | null;
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface SupplierListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Supplier[];
}

export interface CreateSupplierPayload {
  name: string;
  supplier_code?: string;
  supplier_type: SupplierType;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  payment_terms?: string;
  lead_time_days?: number;
  notes?: string;
}

export interface UpdateSupplierPayload {
  name?: string;
  supplier_code?: string;
  supplier_type?: SupplierType;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  payment_terms?: string;
  lead_time_days?: number;
  is_active?: boolean;
  notes?: string;
}

export const SUPPLIER_TYPE_OPTIONS = [
  { value: 'fabric', label: 'Fabric Supplier', label_zh: '布料供應商' },
  { value: 'trim', label: 'Trim Supplier', label_zh: '輔料供應商' },
  { value: 'label', label: 'Label Supplier', label_zh: '標籤供應商' },
  { value: 'packaging', label: 'Packaging Supplier', label_zh: '包裝供應商' },
  { value: 'factory', label: 'Garment Factory', label_zh: '成衣工廠' },
] as const;
