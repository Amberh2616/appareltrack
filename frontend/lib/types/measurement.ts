/**
 * Measurement (Spec) Types
 */

export type TranslationStatus = 'pending' | 'confirmed';

export interface MeasurementValues {
  [size: string]: number;
}

export interface MeasurementItem {
  id: string;
  revision: string;
  point_name: string;
  point_code: string;
  values: MeasurementValues;
  tolerance_plus: string; // Decimal as string
  tolerance_minus: string; // Decimal as string
  unit: string;
  ai_confidence: number | null;
  is_verified: boolean;
  // Translation fields
  point_name_zh?: string;
  translation_status?: TranslationStatus;
}

export interface MeasurementListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: MeasurementItem[];
}

export interface UpdateMeasurementPayload {
  point_name?: string;
  point_code?: string;
  values?: MeasurementValues;
  tolerance_plus?: string;
  tolerance_minus?: string;
  unit?: string;
  is_verified?: boolean;
  // Translation fields
  point_name_zh?: string;
  translation_status?: TranslationStatus;
}

export interface TranslateBatchResponse {
  success: boolean;
  translated: number;
  skipped: number;
  errors: string[];
  translation_map?: Record<string, string>;
}

export interface CreateMeasurementPayload {
  point_name: string;
  point_code?: string;
  values?: MeasurementValues;
  tolerance_plus?: string;
  tolerance_minus?: string;
  unit?: string;
}
