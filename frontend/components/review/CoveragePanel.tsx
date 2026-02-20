// frontend/components/review/CoveragePanel.tsx
import React from "react";
import type { DraftBlock } from "./BlockOverlayItem";

function getFinalText(b: DraftBlock) {
  return ((b.edited_text || b.translated_text || "") + "").trim();
}

export function calcCoverage(blocks: DraftBlock[]) {
  const total = blocks.length;
  const translated = blocks.filter((b) => getFinalText(b).length > 0).length;
  const missing = total - translated;
  return { total, translated, missing };
}

type Props = {
  blocksAll: DraftBlock[];
  showMissingOnly: boolean;
  onToggleMissingOnly: () => void;
  onJumpNextMissing?: () => void; // optional
  rightSlot?: React.ReactNode; // 你可塞按鈕：Export Preview PDF / Finalize 等
};

export function CoveragePanel({
  blocksAll,
  showMissingOnly,
  onToggleMissingOnly,
  onJumpNextMissing,
  rightSlot,
}: Props) {
  const { total, translated, missing } = calcCoverage(blocksAll);

  return (
    <div
      style={{
        position: "sticky",
        top: 12,
        zIndex: 50,
        padding: 12,
        borderRadius: 12,
        border: "1px solid rgba(0,0,0,0.12)",
        background: "rgba(255,255,255,0.92)",
        boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: "rgba(107,114,128,1)" }}>Coverage</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(17,24,39,0.95)" }}>
            Total {total} · Translated {translated} · Missing{" "}
            <span style={{ color: missing > 0 ? "rgba(220,38,38,0.95)" : "rgba(16,185,129,0.95)" }}>
              {missing}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {rightSlot}
        </div>
      </div>

      <div style={{ height: 10 }} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          onClick={onToggleMissingOnly}
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: showMissingOnly ? "2px solid rgba(220,38,38,0.75)" : "1px solid rgba(0,0,0,0.15)",
            background: showMissingOnly ? "rgba(254,226,226,0.9)" : "rgba(255,255,255,0.9)",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {showMissingOnly ? "Showing Missing Only" : "Show Missing Only"}
        </button>

        {onJumpNextMissing ? (
          <button
            type="button"
            onClick={onJumpNextMissing}
            disabled={missing === 0}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.15)",
              background: missing === 0 ? "rgba(243,244,246,1)" : "rgba(255,255,255,0.9)",
              fontWeight: 800,
              cursor: missing === 0 ? "not-allowed" : "pointer",
              opacity: missing === 0 ? 0.6 : 1,
            }}
          >
            Next Missing
          </button>
        ) : null}
      </div>
    </div>
  );
}
