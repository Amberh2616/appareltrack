"""
PDF Utils

pdfplumber bbox → DraftBlock bbox 轉換
BBox 間距檢查（避免重疊）
"""


def normalize_bbox(*, x0, y0, x1, y1):
    """
    pdfplumber bbox → DraftBlock bbox

    pdfplumber 格式:
    - (x0, y0, x1, y1)  # 左上角、右下角

    DraftBlock 格式:
    - {x, y, width, height}  # 左上角 + 尺寸

    Args:
        x0: 左上角 X
        y0: 左上角 Y
        x1: 右下角 X
        y1: 右下角 Y

    Returns:
        dict: {"x": float, "y": float, "width": float, "height": float}
    """
    return {
        "x": float(x0),
        "y": float(y0),
        "width": float(x1 - x0),
        "height": float(y1 - y0),
    }


def check_bbox_overlap(blocks):
    """
    檢查 blocks 之間的間距，偵測可能的重疊風險

    Critical Issue #3 修正：BBox 間距檢查

    Args:
        blocks: list of dict, 每個 dict 包含 bbox {x, y, width, height}

    Returns:
        list: 重疊風險 issues

    Example:
        blocks = [
            {"id": "b1", "bbox": {"x": 90, "y": 115, "width": 280, "height": 35}},
            {"id": "b2", "bbox": {"x": 90, "y": 158, "width": 88, "height": 28}},
        ]
        issues = check_bbox_overlap(blocks)
        # [{"type": "bbox_overlap_risk", "severity": "warning", ...}]
    """
    # 按 y 座標排序
    blocks_sorted = sorted(blocks, key=lambda b: b["bbox"]["y"])

    issues = []

    for i in range(len(blocks_sorted) - 1):
        curr = blocks_sorted[i]
        next_block = blocks_sorted[i + 1]

        curr_bbox = curr["bbox"]
        next_bbox = next_block["bbox"]

        # 計算當前 block 底部
        curr_bottom = curr_bbox["y"] + curr_bbox["height"]

        # 計算間距
        gap = next_bbox["y"] - curr_bottom

        # 間距 < 10pt → 警告（翻譯後可能重疊）
        if gap < 10:
            issues.append({
                "type": "bbox_overlap_risk",
                "severity": "warning",
                "title": f"BBox間距過小 ({gap:.1f}pt)",
                "description": f"Block {curr.get('id', '?')} 與 {next_block.get('id', '?')} 間距只有 {gap:.1f}pt，翻譯後可能重疊",
                "blocks": [curr.get("id"), next_block.get("id")],
                "gap": gap,
                "recommendation": "建議使用側欄對照模式，避免 overlay 重疊"
            })

    return issues
