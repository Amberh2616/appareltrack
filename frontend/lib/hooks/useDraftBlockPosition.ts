/**
 * useDraftBlockPosition - Hook for managing draggable translation block positions
 *
 * Features:
 * - Save single block position (debounced)
 * - Batch save multiple positions
 * - Toggle block visibility
 * - Auto-save on drag end
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import type { BlockOverlay } from '@/lib/types/revision';
import { API_BASE_URL } from '@/lib/api/client';

const API_BASE = API_BASE_URL;

function getTokenFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw =
      sessionStorage.getItem('auth-storage') ||
      localStorage.getItem('auth-storage');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.accessToken ?? null;
  } catch {
    return null;
  }
}

function authHeaders(): Record<string, string> {
  const token = getTokenFromStorage();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface PositionUpdate {
  blockId: string;
  overlay_x: number;
  overlay_y: number;
  overlay_visible?: boolean;
}

interface BatchPositionUpdate {
  positions: Array<{
    block_id: string;
    overlay_x: number;
    overlay_y: number;
    overlay_visible?: boolean;
  }>;
}

// ===== Update Single Block Position =====
export function useUpdateBlockPosition(revisionId: string) {
  return useMutation({
    mutationFn: async ({ blockId, overlay_x, overlay_y, overlay_visible = true }: PositionUpdate) => {
      const res = await fetch(`${API_BASE}/draft-blocks/${blockId}/position/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({ overlay_x, overlay_y, overlay_visible }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || `Failed to update position: ${res.statusText}`);
      }

      return res.json();
    },
    // 不要 invalidate，避免重新渲染导致位置重置
  });
}

// ===== Batch Update Block Positions =====
export function useBatchUpdateBlockPositions(revisionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: { positions: Array<{ block_id: string; overlay_x: number; overlay_y: number; overlay_visible: boolean }> }) => {
      // 後端格式：{ positions: [{ id, overlay_x, overlay_y, overlay_visible }] }
      const payload = {
        positions: updates.positions.map(p => ({
          id: p.block_id,
          overlay_x: p.overlay_x,
          overlay_y: p.overlay_y,
          overlay_visible: p.overlay_visible,
        })),
      };

      const res = await fetch(`${API_BASE}/revisions/${revisionId}/blocks/positions/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || `Failed to batch update positions: ${res.statusText}`);
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft', revisionId] });
    },
  });
}

// ===== Toggle Block Visibility =====
export function useToggleBlockVisibility(revisionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ blockId, visible }: { blockId: string; visible: boolean }) => {
      const res = await fetch(`${API_BASE}/draft-blocks/${blockId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({ overlay_visible: visible }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || `Failed to toggle visibility: ${res.statusText}`);
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft', revisionId] });
    },
  });
}

// ===== Debounced Position Save Hook =====
export function useDebouncedPositionSave(revisionId: string, debounceMs = 500) {
  const updateMutation = useUpdateBlockPosition(revisionId);
  const pendingUpdates = useRef<Map<string, PositionUpdate>>(new Map());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const savePosition = useCallback((blockId: string, x: number, y: number, visible = true) => {
    // Store the update
    pendingUpdates.current.set(blockId, {
      blockId,
      overlay_x: x,
      overlay_y: y,
      overlay_visible: visible,
    });

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      const updates = pendingUpdates.current.get(blockId);
      if (updates) {
        updateMutation.mutate(updates);
        pendingUpdates.current.delete(blockId);
      }
    }, debounceMs);
  }, [updateMutation, debounceMs]);

  // Immediate save (for drag end)
  const savePositionNow = useCallback((blockId: string, x: number, y: number, visible = true) => {
    // Clear any pending debounced save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    pendingUpdates.current.delete(blockId);

    // Save immediately
    updateMutation.mutate({
      blockId,
      overlay_x: x,
      overlay_y: y,
      overlay_visible: visible,
    });
  }, [updateMutation]);

  return {
    savePosition,
    savePositionNow,
    isLoading: updateMutation.isPending,
    error: updateMutation.error,
  };
}
