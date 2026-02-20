import { apiClient, API_BASE_URL } from './client';

export interface TechPack {
  id: string;
  style_number: string;
  style_name: string;
  season: string;
  customer: string;
  status: string;
  ai_confidence: number | null;
  ai_data: any;
  ai_issues: any[];
  bom_count: number;
  measurement_count: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface TechPackDetail extends TechPack {
  bom_items: BOMItem[];
  measurements: Measurement[];
  construction_steps: ConstructionStep[];
}

export interface BOMItem {
  id: string;
  item_number: number;
  category: string;
  material_name: string;
  supplier: string;
  color: string;
  consumption: string;
  unit: string;
  wastage_rate: string;
  unit_price: string | null;
  placement: string[];
  ai_confidence: number | null;
  is_verified: boolean;
}

export interface Measurement {
  id: string;
  point_name: string;
  point_code: string;
  values: Record<string, number>;
  tolerance_plus: string;
  tolerance_minus: string;
  unit: string;
  ai_confidence: number | null;
  is_verified: boolean;
}

export interface ConstructionStep {
  id: string;
  step_number: number;
  description: string;
  details: string;
  ai_confidence: number | null;
}

export interface TechPackListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: TechPack[];
}

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  success: boolean;
  response: string;
  action?: {
    type: string;
    params: any;
  };
  action_result?: any;
  error?: string;
}

// Get Tech Pack list
export async function getTechPacks(params?: {
  search?: string;
  status?: string;
  page?: number;
}): Promise<TechPackListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.search) queryParams.append('search', params.search);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.page) queryParams.append('page', params.page.toString());

  return apiClient<TechPackListResponse>(
    `/techpacks/?${queryParams.toString()}`
  );
}

// Get Tech Pack detail
export async function getTechPackDetail(id: string): Promise<TechPackDetail> {
  return apiClient<TechPackDetail>(`/techpacks/${id}/`);
}

// Upload Tech Pack data type
export interface UploadTechPackData {
  style_number: string;
  style_name: string;
  season: string;
  customer: string;
  file: File;
}

// Upload Tech Pack
export async function uploadTechPack(data: UploadTechPackData): Promise<TechPack> {
  const formData = new FormData();
  formData.append('style_number', data.style_number);
  formData.append('style_name', data.style_name);
  formData.append('season', data.season);
  formData.append('customer', data.customer);
  formData.append('file', data.file);

  const response = await fetch(`${API_BASE_URL}/techpacks/`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(error.detail || 'Upload failed');
  }

  return response.json();
}

// Send AI message
export async function sendAIMessage(
  techPackId: string,
  message: string,
  conversationHistory: AIMessage[]
): Promise<AIResponse> {
  return apiClient<AIResponse>(`/techpacks/${techPackId}/ai_chat/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      conversation_history: conversationHistory,
    }),
  });
}

// Approve Tech Pack
export async function approveTechPack(
  id: string,
  corrections?: any
): Promise<TechPack> {
  return apiClient<TechPack>(`/techpacks/${id}/approve/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ corrections }),
  });
}
