/**
 * Block-Based Revision Types
 * Matches backend/apps/parsing/models_blocks.py
 */

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BlockOverlay {
  x: number;
  y: number;
  visible: boolean;
}

export interface DraftBlock {
  id: string;
  block_type: 'callout' | 'dimension' | 'note' | 'specification' | 'other';
  bbox: BBox;
  source_text: string;           // Original text (locked)
  translated_text: string | null; // AI translation
  edited_text: string | null;    // Human edits
  status: 'auto' | 'edited' | 'verified';
  overlay?: BlockOverlay;        // User-adjustable position for translation overlay
}

export interface RevisionPage {
  id?: string;
  page_number: number;
  width: number;
  height: number;
  image_url?: string;            // PDF page rendered as image
  blocks: DraftBlock[];
}

export interface Revision {
  id: string;
  filename: string;
  page_count: number;
  status: 'pending' | 'processing' | 'draft' | 'approved' | 'completed';
  file_url: string;
  pages: RevisionPage[];
}

export interface RevisionResponse {
  data: Revision;
}
