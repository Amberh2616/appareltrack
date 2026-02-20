"""
Text Merger - Smart text merging for Tech Pack callouts

目標：
- Layer 1: 同行合併（放寬容差）
- Layer 2: Dimension 專用跨行合併（修復碎片問題）

Example: "5.5" from mid of logo to CB" 被拆成 ["5.5\"", "CB"]
→ Merge into: "5.5\" from mid of logo to CB"
"""

import re
from typing import List, Dict, Any


def is_dimension_fragment(text: str) -> bool:
    """
    檢測是否為尺寸標註片段

    特徵：
    - 包含數字 + 單位符號：5.5", 1.5", 2"
    - 或單字母縮寫（可能是尺寸相關）：CB, HPS, CF
    """
    # 數字 + 引號（英寸符號）
    if re.search(r'\d+\.?\d*\s*["\']', text):
        return True

    # 純數字 + 可能的單位
    if re.search(r'\d+\.?\d*\s*(cm|mm|inch|in)?$', text, re.IGNORECASE):
        return True

    # 單字母或雙字母縮寫（可能是尺寸參考點）
    if re.match(r'^[A-Z]{1,3}$', text.strip()):
        return True

    return False


def has_x_overlap(word1: dict, word2: dict, min_overlap_ratio: float = 0.15) -> bool:
    """
    檢查兩個 word 的 x 座標範圍是否有重疊

    用於判斷是否在同一條標註線上

    Args:
        word1, word2: pdfplumber word dict {x0, x1, top, bottom}
        min_overlap_ratio: 最小重疊比例（相對於較短的 word）

    Returns:
        True if has overlap >= min_overlap_ratio
    """
    x_start = max(word1["x0"], word2["x0"])
    x_end = min(word1["x1"], word2["x1"])

    overlap = max(0, x_end - x_start)

    # 計算重疊比例（相對於較短的 word）
    width1 = word1["x1"] - word1["x0"]
    width2 = word2["x1"] - word2["x0"]
    min_width = min(width1, width2)

    if min_width == 0:
        return False

    overlap_ratio = overlap / min_width

    return overlap_ratio >= min_overlap_ratio


def merge_words_layer1(words: List[dict], x_gap_threshold: int = 100, y_tolerance: int = 10) -> List[dict]:
    """
    Layer 1: 同行合併（放寬容差）

    Args:
        words: pdfplumber words (sorted by top, x0)
        x_gap_threshold: 同行最大間距（50 → 100pt）
        y_tolerance: 同行 y 座標容差（5 → 10pt）

    Returns:
        Merged words list
    """
    if not words:
        return []

    merged = []
    current_group = None

    for w in words:
        if current_group is None:
            # 第一個詞，開始新 group
            current_group = {
                "text": w["text"].strip(),
                "x0": w["x0"],
                "top": w["top"],
                "x1": w["x1"],
                "bottom": w["bottom"],
            }
        else:
            # 判斷是否同一行
            y_diff = abs(w["top"] - current_group["top"])
            x_gap = w["x0"] - current_group["x1"]

            # 同行合併條件（放寬）
            if y_diff < y_tolerance and x_gap < x_gap_threshold:
                current_group["text"] += " " + w["text"].strip()
                current_group["x1"] = w["x1"]  # 擴展右邊界
                current_group["bottom"] = max(current_group["bottom"], w["bottom"])
            else:
                # 新的一行，儲存舊 group
                merged.append(current_group)
                current_group = {
                    "text": w["text"].strip(),
                    "x0": w["x0"],
                    "top": w["top"],
                    "x1": w["x1"],
                    "bottom": w["bottom"],
                }

    # 最後一個 group
    if current_group is not None:
        merged.append(current_group)

    return merged


def merge_words_layer2_dimension(words: List[dict], y_threshold: int = 15, x_overlap_ratio: float = 0.15) -> List[dict]:
    """
    Layer 2: Dimension 專用跨行合併（有護欄）

    目標：修復尺寸標註碎片
    Example: ["5.5\"", "CB"] → "5.5\" from mid of logo to CB"

    護欄：
    1. 只合併 dimension 片段
    2. y_diff < 15pt（避免跨頁合併）
    3. x 範圍有重疊 > 15%（確保在同一條標註線上）

    Args:
        words: Layer 1 merged words
        y_threshold: 最大垂直距離（15pt）
        x_overlap_ratio: 最小 x 重疊比例（0.15 = 15%）

    Returns:
        Further merged words list
    """
    if not words:
        return []

    # 先標記哪些是 dimension 片段
    for w in words:
        w["is_dimension"] = is_dimension_fragment(w["text"])

    merged = []
    current_group = None

    for w in words:
        if current_group is None:
            current_group = {
                "text": w["text"].strip(),
                "x0": w["x0"],
                "top": w["top"],
                "x1": w["x1"],
                "bottom": w["bottom"],
                "is_dimension": w["is_dimension"],
            }
        else:
            # 跨行合併條件（嚴格護欄）
            y_diff = abs(w["top"] - current_group["top"])

            # 只有 dimension 片段才允許跨行合併
            both_dimension = current_group["is_dimension"] and w["is_dimension"]

            # y 距離不能太遠（避免跨頁）
            close_enough = y_diff < y_threshold

            # x 範圍要有重疊（確保在同一條標註線上）
            has_overlap = has_x_overlap(current_group, w, min_overlap_ratio=x_overlap_ratio)

            if both_dimension and close_enough and has_overlap:
                # 合併（保留原文順序）
                current_group["text"] += " " + w["text"].strip()
                current_group["x0"] = min(current_group["x0"], w["x0"])
                current_group["x1"] = max(current_group["x1"], w["x1"])
                current_group["top"] = min(current_group["top"], w["top"])
                current_group["bottom"] = max(current_group["bottom"], w["bottom"])
            else:
                # 不符合條件，儲存舊 group
                merged.append(current_group)
                current_group = {
                    "text": w["text"].strip(),
                    "x0": w["x0"],
                    "top": w["top"],
                    "x1": w["x1"],
                    "bottom": w["bottom"],
                    "is_dimension": w["is_dimension"],
                }

    # 最後一個 group
    if current_group is not None:
        merged.append(current_group)

    # 移除臨時標記
    for w in merged:
        w.pop("is_dimension", None)

    return merged


def smart_merge_words(words: List[dict]) -> List[dict]:
    """
    智能合併 pdfplumber words（兩層策略）

    Pipeline:
    1. Layer 1: 同行合併（放寬容差）
    2. Layer 2: Dimension 專用跨行合併

    Args:
        words: pdfplumber words (已排序 by top, x0)

    Returns:
        Merged callouts
    """
    # Layer 1: 同行合併（放寬容差）
    layer1_merged = merge_words_layer1(
        words,
        x_gap_threshold=100,  # 50 → 100pt
        y_tolerance=10        # 5 → 10pt
    )

    # Layer 2: Dimension 專用跨行合併
    layer2_merged = merge_words_layer2_dimension(
        layer1_merged,
        y_threshold=15,         # 最大垂直距離
        x_overlap_ratio=0.15    # 最小 x 重疊比例
    )

    return layer2_merged
