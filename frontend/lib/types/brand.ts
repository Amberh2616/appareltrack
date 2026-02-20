/**
 * Brand Types - v2.3.0
 * Brand with BOM format configuration
 */

export type BomFormat =
  | 'auto'
  | 'vertical_table'
  | 'horizontal_table'
  | 'free_text'
  | 'mixed';

export const BOM_FORMAT_OPTIONS: { value: BomFormat; label: string; description: string }[] = [
  { value: 'auto', label: 'Auto Detect', description: 'AI automatically detects the format' },
  { value: 'vertical_table', label: 'Vertical Table', description: 'Traditional BOM table with columns (Material, Supplier, Price...)' },
  { value: 'horizontal_table', label: 'Horizontal Table', description: 'Materials on left, colors/sizes across top' },
  { value: 'free_text', label: 'Free Text', description: 'FABRIC INFO sections, "BODY:", "SHELL:" patterns' },
  { value: 'mixed', label: 'Mixed Format', description: 'Multiple formats in one document' },
];

export interface BomExtractionRules {
  fabric_section_keywords?: string[];
  trim_section_keywords?: string[];
  skip_keywords?: string[];
  column_mapping?: Record<string, string[]>;
}

export interface Brand {
  id: string;
  code: string;
  name: string;
  bom_format: BomFormat;
  bom_extraction_rules: BomExtractionRules;
  is_active: boolean;
  notes: string;
  styles_count: number;
  created_at: string;
  updated_at: string;
}

export interface BrandCreate {
  code: string;
  name: string;
  bom_format?: BomFormat;
  bom_extraction_rules?: BomExtractionRules;
  notes?: string;
}

export interface BrandUpdate {
  code?: string;
  name?: string;
  bom_format?: BomFormat;
  bom_extraction_rules?: BomExtractionRules;
  is_active?: boolean;
  notes?: string;
}
