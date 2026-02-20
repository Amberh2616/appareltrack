// frontend/components/review/utils/canRenderInline.ts

export function canRenderInline(bboxHeightPx: number, sourceText: string, zhText: string) {
  // 目標：在 bbox 內顯示 2 行（原文 + 中文）
  // 保守估：一行 14~16px，2 行 + padding 大概需要 34~40px
  if (bboxHeightPx < 40) return false;

  // 如果文字太長，bbox 不夠高也容易擠爆，保守處理
  const sourceLen = (sourceText || "").trim().length;
  const zhLen = (zhText || "").trim().length;

  // 很長就偏向卡片模式
  if (sourceLen > 80 || zhLen > 60) return false;

  return true;
}
