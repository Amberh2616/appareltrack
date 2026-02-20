// frontend/components/review/BlockOverlayItem.tsx
import React, { CSSProperties, memo } from "react";
import { CheckCircle } from "lucide-react";
import { canRenderInline } from "./utils/canRenderInline";

export type BBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DraftBlock = {
  id: string;
  block_type: string;
  status: "auto" | "edited" | "approved" | "verified" | string;
  bbox: BBox;
  source_text: string;
  translated_text?: string | null;
  edited_text?: string | null;
  page_number?: number; // optional
  // Phase 2-1: Verification tracking
  verified_by?: string | null;  // username
  verified_at?: string | null;  // ISO datetime
  translation_status?: "pending" | "confirmed" | null;
};

type Props = {
  block: DraftBlock;
  scale: number; // PDF render scale → 乘上 bbox 變成 px
  isSelected: boolean;
  showMissingOnly: boolean;
  showSourceText: boolean; // 是否顯示英文原文
  onSelect: (id: string) => void;
};

function clampText(text: string, maxChars: number) {
  const t = (text || "").trim();
  if (t.length <= maxChars) return t;
  return t.slice(0, maxChars) + "…";
}

export const BlockOverlayItem = memo(function BlockOverlayItem({
  block,
  scale,
  isSelected,
  showMissingOnly,
  showSourceText,
  onSelect,
}: Props) {
  const bboxPx = {
    left: block.bbox.x * scale,
    top: block.bbox.y * scale,
    width: block.bbox.width * scale,
    height: block.bbox.height * scale,
  };

  const finalText = ((block.edited_text || block.translated_text || "") + "").trim();
  const missing = finalText.length === 0;
  const isVerified = block.status === "verified" && block.translation_status === "confirmed";

  // Missing only 模式下：非 missing 的 block 半透明/不顯示（你可改成只淡化）
  if (showMissingOnly && !missing) return null;

  const inline = canRenderInline(bboxPx.height, block.source_text, finalText);

  // Phase 2-1: Different border colors based on status
  const getBorderStyle = () => {
    if (missing) return "1.5px solid rgba(220,38,38,0.8)";  // Red for missing
    if (isVerified) return "2px solid rgba(34,197,94,0.9)";  // Green for verified
    if (isSelected) return "2px solid rgba(37,99,235,0.9)";  // Blue for selected
    return "1px solid rgba(0,0,0,0.15)";  // Default gray
  };

  // Tooltip text
  const getTooltipText = () => {
    if (isVerified && block.verified_by && block.verified_at) {
      const date = new Date(block.verified_at).toLocaleString();
      return `✓ Verified by ${block.verified_by} at ${date}\n${block.source_text.substring(0, 100)}`;
    }
    return block.source_text.substring(0, 150);
  };

  const baseBoxStyle: CSSProperties = {
    position: "absolute",
    left: bboxPx.left,
    top: bboxPx.top,
    width: bboxPx.width,
    height: bboxPx.height,
    boxSizing: "border-box",
    borderRadius: 3,
    cursor: "pointer",
    outline: "none",
    border: getBorderStyle(),
    background: inline ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.0)",
    boxShadow: isSelected ? "0 0 0 2px rgba(37,99,235,0.15)" : isVerified ? "0 0 0 1px rgba(34,197,94,0.1)" : undefined,
    zIndex: isSelected ? 30 : missing ? 25 : isVerified ? 20 : 10,
    pointerEvents: "auto",
  };

  const textWrapStyle: CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    padding: 3,
    overflow: "hidden",
    whiteSpace: "pre-line",
    lineHeight: 1.15,
    fontSize: 10,
  };

  const cardStyle: CSSProperties = {
    position: "absolute",
    left: bboxPx.left,
    top: bboxPx.top + bboxPx.height + 4,
    width: Math.max(180, Math.min(300, bboxPx.width)),
    maxWidth: 360,
    padding: 6,
    borderRadius: 6,
    border: missing ? "1.5px solid rgba(220,38,38,0.8)" : isVerified ? "1.5px solid rgba(34,197,94,0.8)" : "1px solid rgba(0,0,0,0.15)",
    background: "rgba(255,255,255,0.75)",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    zIndex: isSelected ? 35 : 20,
    pointerEvents: "auto",
  };

  return (
    <>
      {/* bbox highlight box - 始終顯示 */}
      <div
        style={baseBoxStyle}
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(block.id);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(block.id);
          }
        }}
        title={getTooltipText()}
      >
        {/* Phase 2-1: Verification icon */}
        {isVerified && (
          <div style={{ position: "absolute", top: 2, right: 2, pointerEvents: "none" }}>
            <CheckCircle className="w-4 h-4 text-green-600" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.1))" }} />
          </div>
        )}

        {/* 方案 1: inline 模式只在選中時顯示文字 */}
        {inline && isSelected ? (
          <div style={textWrapStyle}>
            <div style={{ color: missing ? "rgba(220,38,38,0.9)" : isVerified ? "rgba(34,197,94,0.95)" : "rgba(17,24,39,0.95)", fontWeight: 600 }}>
              {missing ? "【缺】" : clampText(finalText, 100)}
            </div>
          </div>
        ) : null}
      </div>

      {/* 方案 1: card 模式只在選中時顯示 */}
      {!inline && isSelected ? (
        <div
          style={cardStyle}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(block.id);
          }}
        >
          {/* Phase 2-1: Verification icon for card mode */}
          {isVerified && (
            <div style={{ position: "absolute", top: 4, right: 4, pointerEvents: "none" }}>
              <CheckCircle className="w-3 h-3 text-green-600" />
            </div>
          )}

          {/* 英文原文 - 只在 showSourceText === true 時顯示 */}
          {showSourceText && (
            <div style={{ fontSize: 10, color: "rgba(107,114,128,0.85)", marginBottom: 4 }}>
              {clampText(block.source_text, 120)}
            </div>
          )}

          {/* 中文翻譯 */}
          <div style={{ fontSize: 11, fontWeight: 600, color: missing ? "rgba(220,38,38,0.9)" : isVerified ? "rgba(34,197,94,0.95)" : "rgba(17,24,39,0.95)", whiteSpace: "pre-line", display: "flex", alignItems: "flex-start", gap: 4 }}>
            <span>{missing ? "【缺翻譯】" : finalText}</span>
          </div>
        </div>
      ) : null}
    </>
  );
});
