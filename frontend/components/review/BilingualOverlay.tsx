// frontend/components/review/BilingualOverlay.tsx
import React, { useMemo } from "react";
import { BlockOverlayItem, DraftBlock } from "./BlockOverlayItem";

type Props = {
  blocks: DraftBlock[];
  scale: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  showMissingOnly: boolean;
  showSourceText: boolean; // 是否顯示英文原文
  // 如果你有 PDF 原始頁面寬高(pts)與 rendered px 對應，也可以補這兩個做更精準 mapping
  // pageWidthPx?: number;
  // pageHeightPx?: number;
};

export function BilingualOverlay({
  blocks,
  scale,
  selectedId,
  onSelect,
  showMissingOnly,
  showSourceText,
}: Props) {
  const sorted = useMemo(() => {
    // 讓 overlay 的渲染穩定：先由上到下、左到右
    return [...blocks].sort((a, b) => {
      if (a.bbox.y !== b.bbox.y) return a.bbox.y - b.bbox.y;
      return a.bbox.x - b.bbox.x;
    });
  }, [blocks]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none", // 重要：預設不吃事件，讓子元素吃
      }}
      onClick={() => {
        // 點空白取消選取（可選）
        // onSelect("") // 你可以在 page.tsx 轉成 setSelectedId(null)
      }}
    >
      {sorted.map((block) => (
        <BlockOverlayItem
          key={block.id}
          block={block}
          scale={scale}
          isSelected={selectedId === block.id}
          showMissingOnly={showMissingOnly}
          showSourceText={showSourceText}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
