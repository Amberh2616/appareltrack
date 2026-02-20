/**
 * Centralized Type Exports
 */

export * from './style';
export * from './document';
export * from './brand';
// Note: bom.ts has its own BOMItem that conflicts with style.ts
// Import from './bom' directly when needed for BOM-specific types
export type { BOMCategory, ConsumptionMaturity, MaterialStatus, BOMListResponse, UpdateBOMItemPayload } from './bom';
export type { BOMItem as BOMItemV2 } from './bom';

/**
 * Common Types
 */

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'merchandiser' | 'factory' | 'viewer';
  organization: string;
  created_at: string;
}

export interface ApiError {
  message: string;
  status: number;
  errors?: Record<string, string[]>;
}
