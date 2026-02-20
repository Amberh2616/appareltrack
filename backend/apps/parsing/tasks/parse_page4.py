"""
Celery Parse Tasks - Multi-page Support

目標：
- Parse Tech Pack 所有頁面或單一頁面
- 產出 DraftBlock（callout 為主）
- bbox + source_text + translation

任務：
- parse_revision_page_4() - 舊版，只解析 Page 4
- parse_single_page() - 通用，解析指定頁面
- parse_all_pages() - 新版，解析所有頁面
"""

import pdfplumber
from celery import shared_task
from django.db import transaction

from ..models_blocks import Revision, RevisionPage, DraftBlock
from ..utils.pdf import normalize_bbox, check_bbox_overlap
from ..utils.translate import machine_translate
from ..utils.text_merger import smart_merge_words


def is_callout_text(text: str, word: dict, page_width: float) -> bool:
    """
    MVP callout filter（放寬版 - 2025-12-27）

    規則：
    - 太短不要（< 2 字元）
    - 保留全大寫（區域標題、頁面引用很重要！）
    - 保留頁眉（產品信息需要翻譯）
    - 只過濾明顯的頁碼、單字元
    """
    # 太短不要（只過濾 1-2 字元的碎片）
    if len(text) < 2:
        return False

    # 移除長度上限檢查 - 長句子也要抓
    # if len(text) > 120:
    #     return False

    # 移除全大寫過濾 - "INSIDE BRA VIEW" 也是重要文本！
    # if text.isupper():
    #     return False

    # 太寬的通常是段落（放寬到 95%）
    if (word["x1"] - word["x0"]) > page_width * 0.95:
        return False

    # 移除頁首頁尾過濾 - 頁眉也要翻譯！
    # if word["top"] < 50 or word["bottom"] > 780:
    #     return False

    return True


@shared_task(bind=True)
def parse_revision_page_4(self, revision_id: str):
    """
    MVP Parse Task
    - 只 parse Tech Pack Page 4
    - 產出 DraftBlock（callout 為主）

    Args:
        revision_id: Revision UUID

    Returns:
        dict: {
            "status": "success",
            "blocks_count": 7,
            "page_number": 4
        }
    """

    revision = Revision.objects.get(id=revision_id)

    # 更新狀態
    revision.status = "parsing"
    revision.save(update_fields=["status"])

    # 假設 Revision 有 FileField
    # TODO: 需要在 Revision model 加入 file field
    pdf_path = revision.file.path

    # Page 4 = index 3 (0-based)
    PAGE_INDEX = 3
    PAGE_NUMBER = 4

    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[PAGE_INDEX]

        # 1️⃣ 建立 / 取得 RevisionPage
        page_obj, _ = RevisionPage.objects.get_or_create(
            revision=revision,
            page_number=PAGE_NUMBER,
            defaults={
                "width": int(page.width),
                "height": int(page.height),
            },
        )

        # 2️⃣ 擷取 raw words（pdfplumber 最穩）
        words = page.extract_words(
            use_text_flow=False,
            keep_blank_chars=False,
            x_tolerance=2,
            y_tolerance=2,
        )

        """
        words example:
        {
          'text': 'binding with encased elastic + topstitch',
          'x0': 88.1, 'top': 121.3,
          'x1': 352.4, 'bottom': 148.7
        }
        """

        # 3️⃣ 合併相鄰文字成完整 callout（使用智能合併算法）
        # 先過濾出候選詞
        filtered_words = []
        for w in words:
            text = w["text"].strip()
            if not is_callout_text(text, w, page.width):
                continue
            filtered_words.append(w)

        # 按 y 座標（top）排序，同一行的會相鄰
        filtered_words.sort(key=lambda w: (w["top"], w["x0"]))

        # 使用智能合併算法（兩層策略）
        # Layer 1: 同行合併（放寬容差 x_gap: 100pt, y: 10pt）
        # Layer 2: Dimension 專用跨行合併（修復碎片）
        merged_callouts = smart_merge_words(filtered_words)

        # 4️⃣ 轉換成 DraftBlock 格式
        callout_candidates = []
        for item in merged_callouts:
            bbox = normalize_bbox(
                x0=item["x0"],
                y0=item["top"],
                x1=item["x1"],
                y1=item["bottom"],
            )
            callout_candidates.append(
                {
                    "text": item["text"],
                    "bbox": bbox,
                }
            )

        # 5️⃣ 寫入 DB（transaction 很重要）
        with transaction.atomic():
            # 先清空舊 block（Page 4 重跑安全）
            DraftBlock.objects.filter(page=page_obj).delete()

            for item in callout_candidates:
                DraftBlock.objects.create(
                    page=page_obj,
                    block_type="callout",
                    bbox_x=item["bbox"]["x"],
                    bbox_y=item["bbox"]["y"],
                    bbox_width=item["bbox"]["width"],
                    bbox_height=item["bbox"]["height"],
                    source_text=item["text"],
                    translated_text=machine_translate(item["text"]),
                    status="auto",
                )

    # 6️⃣ BBox Overlap 檢查（Critical Issue #3）
    overlap_issues = check_bbox_overlap(callout_candidates)

    # 更新狀態
    revision.status = "parsed"
    revision.save(update_fields=["status"])

    return {
        "status": "success",
        "blocks_count": len(callout_candidates),
        "page_number": PAGE_NUMBER,
        "overlap_warnings": len(overlap_issues),
        "issues": overlap_issues,
    }


def _parse_page_core(pdf_page, page_obj):
    """
    核心解析邏輯（可重用於任何頁面）

    Args:
        pdf_page: pdfplumber Page object
        page_obj: RevisionPage model instance

    Returns:
        list: Parsed callout candidates with bbox and text
    """
    # 2️⃣ 擷取 raw words
    words = pdf_page.extract_words(
        use_text_flow=False,
        keep_blank_chars=False,
        x_tolerance=2,
        y_tolerance=2,
    )

    # 3️⃣ 合併相鄰文字成完整 callout
    filtered_words = []
    for w in words:
        text = w["text"].strip()
        if not is_callout_text(text, w, pdf_page.width):
            continue
        filtered_words.append(w)

    # 按 y 座標（top）排序
    filtered_words.sort(key=lambda w: (w["top"], w["x0"]))

    # 合併同一行、間距小的詞
    merged_callouts = []
    current_group = None

    for w in filtered_words:
        if current_group is None:
            current_group = {
                "text": w["text"].strip(),
                "x0": w["x0"],
                "top": w["top"],
                "x1": w["x1"],
                "bottom": w["bottom"],
            }
        else:
            y_diff = abs(w["top"] - current_group["top"])
            x_gap = w["x0"] - current_group["x1"]
            x_align = abs(w["x0"] - current_group["x0"])

            same_line = (y_diff < 5 and x_gap < 50)
            multiline_callout = (x_align < 50 and y_diff < 30 and x_gap < 200)

            if same_line or multiline_callout:
                current_group["text"] += " " + w["text"].strip()
                current_group["x1"] = w["x1"]
                current_group["bottom"] = max(current_group["bottom"], w["bottom"])
            else:
                merged_callouts.append(current_group)
                current_group = {
                    "text": w["text"].strip(),
                    "x0": w["x0"],
                    "top": w["top"],
                    "x1": w["x1"],
                    "bottom": w["bottom"],
                }

    if current_group is not None:
        merged_callouts.append(current_group)

    # 4️⃣ 轉換成 DraftBlock 格式
    callout_candidates = []
    for item in merged_callouts:
        bbox = normalize_bbox(
            x0=item["x0"],
            y0=item["top"],
            x1=item["x1"],
            y1=item["bottom"],
        )
        callout_candidates.append({
            "text": item["text"],
            "bbox": bbox,
        })

    # 5️⃣ 寫入 DB
    with transaction.atomic():
        # 先清空該頁舊 blocks
        DraftBlock.objects.filter(page=page_obj).delete()

        for item in callout_candidates:
            DraftBlock.objects.create(
                page=page_obj,
                block_type="callout",
                bbox_x=item["bbox"]["x"],
                bbox_y=item["bbox"]["y"],
                bbox_width=item["bbox"]["width"],
                bbox_height=item["bbox"]["height"],
                source_text=item["text"],
                translated_text=machine_translate(item["text"]),
                status="auto",
            )

    return callout_candidates


@shared_task(bind=True)
def parse_all_pages(self, revision_id: str):
    """
    解析 Tech Pack 所有頁面

    Args:
        revision_id: Revision UUID

    Returns:
        dict: {
            "status": "success",
            "total_pages": 8,
            "total_blocks": 45,
            "pages": [
                {"page": 1, "blocks": 3},
                {"page": 2, "blocks": 5},
                ...
            ]
        }
    """
    revision = Revision.objects.get(id=revision_id)

    # 更新狀態
    revision.status = "parsing"
    revision.save(update_fields=["status"])

    pdf_path = revision.file.path

    results = []
    total_blocks = 0

    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)

        for page_index in range(total_pages):
            page = pdf.pages[page_index]
            page_number = page_index + 1  # 1-based

            # 建立 / 取得 RevisionPage
            page_obj, _ = RevisionPage.objects.get_or_create(
                revision=revision,
                page_number=page_number,
                defaults={
                    "width": int(page.width),
                    "height": int(page.height),
                },
            )

            # 解析該頁
            callout_candidates = _parse_page_core(page, page_obj)

            blocks_count = len(callout_candidates)
            total_blocks += blocks_count

            results.append({
                "page": page_number,
                "blocks": blocks_count,
            })

            # 更新進度（Celery progress）
            # 只在異步調用時才更新狀態
            if self and self.request.id:
                self.update_state(
                    state='PROGRESS',
                    meta={
                        'current': page_number,
                        'total': total_pages,
                        'status': f'Parsing page {page_number}/{total_pages}...'
                    }
                )

    # 更新狀態
    revision.status = "parsed"
    revision.save(update_fields=["status"])

    return {
        "status": "success",
        "total_pages": total_pages,
        "total_blocks": total_blocks,
        "pages": results,
    }
