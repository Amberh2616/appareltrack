'use client';

/**
 * TechPackCanvas - PDF + 可拖動/編輯翻譯文字框
 *
 * Features:
 * - 單擊選中、拖曳移動
 * - 雙擊彈出編輯框
 * - ✕ 按鈕隱藏翻譯框
 * - 縮放控制
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { fabric } from 'fabric';
import type { DraftBlock } from '@/lib/types/revision';
import { useAuthStore } from '@/lib/stores/authStore';

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem('auth-storage') || localStorage.getItem('auth-storage');
    return raw ? JSON.parse(raw)?.state?.accessToken ?? null : null;
  } catch { return null; }
}

/** Fetch image with JWT auth and return a blob URL (avoids <img> 401) */
function useAuthImageUrl(url: string): { blobUrl: string | null; isDone: boolean } {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (!url) { setIsDone(true); return; }
    let revoked = false;
    setIsDone(false);

    const load = async () => {
      try {
        let token = getStoredToken();
        let res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        // Auto-refresh on 401 (expired token)
        if (res.status === 401) {
          const refreshed = await useAuthStore.getState().refreshAccessToken();
          if (refreshed) {
            token = getStoredToken();
            res = await fetch(url, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
          } else {
            useAuthStore.getState().logout();
            if (typeof window !== 'undefined') window.location.href = '/login';
            return;
          }
        }

        if (!res.ok) {
          if (!revoked) setIsDone(true); // Image unavailable — stop loading
          return;
        }
        const blob = await res.blob();
        if (!revoked) {
          setBlobUrl(URL.createObjectURL(blob));
          setIsDone(true);
        }
      } catch {
        if (!revoked) setIsDone(true); // silently fail — canvas stays grey
      }
    };

    load();
    return () => {
      revoked = true;
      setBlobUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
      setIsDone(false);
    };
  }, [url]);

  return { blobUrl, isDone };
}

interface TechPackCanvasProps {
  pageImageUrl: string;
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  blocks: DraftBlock[];
  selectedBlockId: string | null;
  onBlockSelect: (blockId: string) => void;
  onPositionChange: (blockId: string, x: number, y: number) => void;
  onBlockDoubleClick?: (block: DraftBlock) => void;
  onBlockDelete?: (blockId: string) => void;
  zoomLevel?: number;
}

export function TechPackCanvas({
  pageImageUrl,
  pageNumber,
  pageWidth,
  pageHeight,
  blocks,
  selectedBlockId,
  onBlockSelect,
  onPositionChange,
  onBlockDoubleClick,
  onBlockDelete,
  zoomLevel = 1,
}: TechPackCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const objectsMapRef = useRef<Map<string, fabric.Group>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // Fetch page image with auth (blob URL bypasses JWT restriction on <img>)
  const { blobUrl: authImageUrl, isDone: imageLoadDone } = useAuthImageUrl(pageImageUrl);
  const [scale, setScale] = useState(1);
  const [canvasReady, setCanvasReady] = useState(false);
  const [deleteButtonPos, setDeleteButtonPos] = useState<{ x: number; y: number; blockId: string } | null>(null);

  // 保存回调的 ref
  const onBlockSelectRef = useRef(onBlockSelect);
  const onPositionChangeRef = useRef(onPositionChange);
  const onBlockDoubleClickRef = useRef(onBlockDoubleClick);
  const onBlockDeleteRef = useRef(onBlockDelete);
  onBlockSelectRef.current = onBlockSelect;
  onPositionChangeRef.current = onPositionChange;
  onBlockDoubleClickRef.current = onBlockDoubleClick;
  onBlockDeleteRef.current = onBlockDelete;

  // 計算 canvas 尺寸
  useEffect(() => {
    setScale(zoomLevel);
  }, [zoomLevel]);

  // 初始化 Canvas
  useEffect(() => {
    if (!canvasRef.current || scale === 0) return;

    if (fabricRef.current) {
      fabricRef.current.dispose();
      fabricRef.current = null;
    }

    const width = Math.floor(pageWidth * scale);
    const height = Math.floor(pageHeight * scale);

    const canvas = new fabric.Canvas(canvasRef.current, {
      width,
      height,
      selection: false,
      preserveObjectStacking: true,
      backgroundColor: '#e5e7eb',
    });

    fabricRef.current = canvas;
    objectsMapRef.current.clear();
    setCanvasReady(true);
    setDeleteButtonPos(null);

    return () => {
      canvas.dispose();
      fabricRef.current = null;
      setCanvasReady(false);
    };
  }, [scale, pageWidth, pageHeight, pageNumber]);

  // 載入背景圖（使用已認證的 blob URL）
  useEffect(() => {
    if (!fabricRef.current || !canvasReady || !imageLoadDone) return;

    // Image failed to load (file missing / auth error) — show grey canvas + allow blocks to render
    if (!authImageUrl) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const canvas = fabricRef.current;

    fabric.Image.fromURL(
      authImageUrl,
      (img) => {
        if (!img || !fabricRef.current) {
          setIsLoading(false);
          return;
        }

        const canvasWidth = canvas.getWidth() || pageWidth * scale;
        const canvasHeight = canvas.getHeight() || pageHeight * scale;

        canvas.setBackgroundImage(img, () => {
          canvas.renderAll();
          setIsLoading(false);
        }, {
          scaleX: canvasWidth / (img.width || pageWidth),
          scaleY: canvasHeight / (img.height || pageHeight),
        });
      },
      { crossOrigin: 'anonymous' }
    );
  }, [authImageUrl, imageLoadDone, canvasReady, scale, pageWidth, pageHeight]);

  // 添加翻譯框
  useEffect(() => {
    if (!fabricRef.current || !canvasReady || isLoading) return;

    const canvas = fabricRef.current;

    // 清除舊對象
    objectsMapRef.current.forEach((obj) => {
      canvas.remove(obj);
    });
    objectsMapRef.current.clear();

    // 添加新對象
    blocks.forEach((block) => {
      const translatedText = block.edited_text || block.translated_text;
      if (!translatedText?.trim()) return;
      if (block.overlay?.visible === false) return;

      const posX = (block.overlay?.x ?? block.bbox?.x ?? 0) * scale;
      const posY = (block.overlay?.y ?? block.bbox?.y ?? 0) * scale;

      // 處理換行顯示
      const lines = translatedText.split('\n');
      const displayText = lines.length > 2
        ? lines.slice(0, 2).join('\n') + '...'
        : translatedText.length > 50
        ? translatedText.substring(0, 50) + '...'
        : translatedText;

      const text = new fabric.Text(displayText, {
        fontSize: Math.max(11, 13 * scale),
        fill: '#1e40af',
        fontFamily: 'Microsoft YaHei, SimHei, sans-serif',
        fontWeight: 'bold',
      });

      const padding = 6;
      const rect = new fabric.Rect({
        width: (text.width || 100) + padding * 2 + 16, // 額外空間給 ✕ 按鈕
        height: (text.height || 20) + padding * 2,
        fill: 'rgba(255, 255, 255, 0.95)',
        rx: 4,
        ry: 4,
        stroke: '#3b82f6',
        strokeWidth: 1,
        shadow: new fabric.Shadow({
          color: 'rgba(0,0,0,0.2)',
          blur: 3,
          offsetX: 1,
          offsetY: 1,
        }),
      });

      text.set({ left: padding, top: padding });

      const group = new fabric.Group([rect, text], {
        left: posX,
        top: posY,
        selectable: true,
        evented: true,
        hasControls: false,
        hasBorders: true,
        borderColor: '#2563eb',
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
        hoverCursor: 'grab',
        moveCursor: 'grabbing',
      });

      (group as any).blockId = block.id;
      (group as any).blockData = block;

      canvas.add(group);
      objectsMapRef.current.set(block.id, group);
    });

    // 監聽拖動結束
    const handleModified = (e: fabric.IEvent) => {
      const obj = e.target as any;
      if (obj?.blockId) {
        const newX = (obj.left || 0) / scale;
        const newY = (obj.top || 0) / scale;
        onPositionChangeRef.current(obj.blockId, newX, newY);
        updateDeleteButtonPosition(obj);
      }
    };

    // 選中處理
    const handleSelection = (e: fabric.IEvent) => {
      const obj = e.selected?.[0] as any;
      if (obj?.blockId) {
        onBlockSelectRef.current(obj.blockId);
        updateDeleteButtonPosition(obj);
      }
    };

    // 取消選中
    const handleDeselection = () => {
      setDeleteButtonPos(null);
    };

    // 雙擊處理
    const handleDoubleClick = (e: fabric.IEvent) => {
      const obj = e.target as any;
      if (obj?.blockId && obj?.blockData && onBlockDoubleClickRef.current) {
        onBlockDoubleClickRef.current(obj.blockData);
      }
    };

    // 更新刪除按鈕位置
    const updateDeleteButtonPosition = (obj: any) => {
      if (!containerRef.current) return;
      const group = obj as fabric.Group;
      const groupWidth = group.width || 0;
      const left = (group.left || 0) + groupWidth * (group.scaleX || 1) - 8;
      const top = (group.top || 0) - 8;

      // 獲取 container 的滾動位置
      const container = containerRef.current;
      const canvasWrapper = container.querySelector('.canvas-wrapper');
      const offsetLeft = canvasWrapper ? (container.clientWidth - (pageWidth * scale)) / 2 : 0;
      const offsetTop = canvasWrapper ? (container.clientHeight - (pageHeight * scale)) / 2 : 0;

      setDeleteButtonPos({
        x: left + Math.max(0, offsetLeft),
        y: top + Math.max(0, offsetTop),
        blockId: obj.blockId,
      });
    };

    canvas.on('object:modified', handleModified);
    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', handleDeselection);
    canvas.on('mouse:dblclick', handleDoubleClick);

    canvas.renderAll();

    return () => {
      canvas.off('object:modified', handleModified);
      canvas.off('selection:created', handleSelection);
      canvas.off('selection:updated', handleSelection);
      canvas.off('selection:cleared', handleDeselection);
      canvas.off('mouse:dblclick', handleDoubleClick);
    };
  }, [blocks, canvasReady, isLoading, scale, pageWidth, pageHeight]);

  // 更新選中狀態
  useEffect(() => {
    if (!fabricRef.current) return;

    objectsMapRef.current.forEach((group, blockId) => {
      const rect = group.getObjects()[0] as fabric.Rect;
      if (rect) {
        rect.set({
          stroke: selectedBlockId === blockId ? '#2563eb' : '#3b82f6',
          strokeWidth: selectedBlockId === blockId ? 2 : 1,
        });
      }

      // 更新刪除按鈕位置
      if (selectedBlockId === blockId) {
        const groupWidth = group.width || 0;
        const left = (group.left || 0) + groupWidth * (group.scaleX || 1) - 8;
        const top = (group.top || 0) - 8;

        if (containerRef.current) {
          const offsetLeft = Math.max(0, (containerRef.current.clientWidth - pageWidth * scale) / 2);
          const offsetTop = Math.max(0, (containerRef.current.clientHeight - pageHeight * scale) / 2);
          setDeleteButtonPos({
            x: left + offsetLeft,
            y: top + offsetTop,
            blockId,
          });
        }
      }
    });

    if (!selectedBlockId) {
      setDeleteButtonPos(null);
    }

    fabricRef.current.renderAll();
  }, [selectedBlockId, scale, pageWidth, pageHeight]);

  // 處理刪除
  const handleDelete = useCallback(() => {
    if (deleteButtonPos && onBlockDeleteRef.current) {
      onBlockDeleteRef.current(deleteButtonPos.blockId);
      setDeleteButtonPos(null);
    }
  }, [deleteButtonPos]);

  const canvasWidth = Math.floor(pageWidth * scale);
  const canvasHeight = Math.floor(pageHeight * scale);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center bg-gray-300 overflow-auto"
      style={{ minHeight: '500px' }}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-20 pointer-events-none">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading page {pageNumber}...</p>
          </div>
        </div>
      )}

      <div
        className="canvas-wrapper relative bg-white shadow-xl"
        style={{
          width: canvasWidth,
          height: canvasHeight,
        }}
      >
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          style={{ display: 'block', width: canvasWidth, height: canvasHeight }}
        />

        {/* 刪除按鈕 - 選中時顯示 */}
        {deleteButtonPos && (
          <button
            onClick={handleDelete}
            className="absolute z-10 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md transition-colors"
            style={{
              left: deleteButtonPos.x - (Math.max(0, (containerRef.current?.clientWidth || 0) - canvasWidth) / 2),
              top: deleteButtonPos.y - (Math.max(0, (containerRef.current?.clientHeight || 0) - canvasHeight) / 2),
            }}
            title="Hide this translation box"
          >
            ✕
          </button>
        )}
      </div>

      {/* 提示 */}
      <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs px-3 py-2 rounded pointer-events-none">
        Click to select | Double-click to edit | Drag to move | {Math.round(zoomLevel * 100)}%
      </div>

      <div className="absolute top-4 right-4 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none">
        {blocks.filter(b => (b.edited_text || b.translated_text)?.trim() && b.overlay?.visible !== false).length} boxes
      </div>
    </div>
  );
}
