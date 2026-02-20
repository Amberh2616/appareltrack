"""
Tech Pack 雙語 PDF 匯出服務
解決重疊問題：提供 4 種匯出模式
- side_by_side: 雙欄對照（推薦，MWO 整合用）
- alternating: 交替頁面
- overlay_offset: 偏移疊加
- overlay_background: 半透明背景疊加

使用 Pillow (PIL) 在 PDF 圖片上繪製中文翻譯，然後轉回 PDF
"""

from django.http import HttpResponse
import fitz  # PyMuPDF
import os
from pathlib import Path
import logging
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO
from typing import Literal, Optional, List, Tuple

logger = logging.getLogger(__name__)

# 匯出模式類型
ExportMode = Literal["side_by_side", "alternating", "overlay_offset", "overlay_background"]


def find_chinese_font() -> Optional[str]:
    """
    查找可用的中文字體（Pillow 使用）
    優先順序：微軟雅黑 > 黑體 > 宋體（避免 simsunb 字符不全）
    """
    font_paths = [
        "C:/Windows/Fonts/msyh.ttc",      # 微軟雅黑（最完整）
        "C:/Windows/Fonts/msyh.ttf",      # 微軟雅黑 TTF
        "C:/Windows/Fonts/simhei.ttf",    # 黑體
        "C:/Windows/Fonts/simsun.ttc",    # 宋體
        # Linux 字體路徑
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    ]

    for font_path in font_paths:
        if os.path.exists(font_path):
            logger.info(f"Found Chinese font for Pillow: {font_path}")
            return font_path

    logger.error("No Chinese TTF font found!")
    return None


class TechPackBilingualPDFExporter:
    """
    Export Tech Pack with bilingual translation

    支援 4 種匯出模式：
    1. side_by_side: 雙欄對照（左原文、右翻譯）- 推薦用於 MWO
    2. alternating: 交替頁面（原文頁 → 翻譯頁）
    3. overlay_offset: 偏移疊加（中文在原文下方）
    4. overlay_background: 半透明背景疊加
    """

    def __init__(
        self,
        tech_pack_revision,
        font_size: int = 20,
        mode: ExportMode = "side_by_side",
        translation_color: Tuple[int, int, int] = (0, 51, 153),  # 深藍色
        separator_color: Tuple[int, int, int] = (200, 200, 200),  # 淺灰色分隔線
    ):
        """
        Args:
            tech_pack_revision: TechPackRevision instance
            font_size: 中文字體大小 (預設 20pt，最小 16pt)
            mode: 匯出模式
            translation_color: 翻譯文字顏色 (R, G, B)
            separator_color: 分隔線顏色 (R, G, B)
        """
        self.revision = tech_pack_revision
        self.font_size = max(16, font_size)
        self.mode = mode
        self.translation_color = translation_color
        self.separator_color = separator_color

        # 加載字體
        self.chinese_font_path = find_chinese_font()
        if not self.chinese_font_path:
            raise Exception("Chinese font not found.")

        self.pil_font = ImageFont.truetype(self.chinese_font_path, self.font_size)
        self.pil_font_small = ImageFont.truetype(self.chinese_font_path, max(12, self.font_size - 4))
        self.pil_font_title = ImageFont.truetype(self.chinese_font_path, self.font_size + 4)

        logger.info(f"TechPackBilingualPDFExporter initialized: mode={mode}, font_size={font_size}")

    def export(self) -> HttpResponse:
        """
        根據模式匯出雙語 PDF

        Returns:
            HttpResponse with PDF file
        """
        if self.mode == "side_by_side":
            pdf_bytes = self._export_side_by_side()
        elif self.mode == "alternating":
            pdf_bytes = self._export_alternating()
        elif self.mode == "overlay_offset":
            pdf_bytes = self._export_overlay_offset()
        elif self.mode == "overlay_background":
            pdf_bytes = self._export_overlay_background()
        else:
            raise ValueError(f"Unknown export mode: {self.mode}")

        # 創建 HTTP 響應
        mode_suffix = {
            "side_by_side": "對照版",
            "alternating": "交替版",
            "overlay_offset": "偏移版",
            "overlay_background": "疊加版",
        }
        filename = f"{self.revision.filename.replace('.pdf', '')}_{mode_suffix.get(self.mode, 'bilingual')}.pdf"
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        return response

    def _export_side_by_side(self) -> bytes:
        """
        方案 C: 雙欄對照匯出
        左邊原文（PDF 原圖），右邊翻譯（白底 + 中文）

        布局：
        ┌────────────────────┬────────────────────┐
        │     ORIGINAL       │    中文翻譯        │
        │     TECH PACK      │    技術包          │
        │                    │                    │
        │  [原始 PDF 圖片]   │  [白底 + 翻譯文字] │
        │                    │                    │
        └────────────────────┴────────────────────┘
        """
        pdf_doc = fitz.open(self.revision.file.path)
        processed_images = []

        # 處理每一頁
        for page_data in self.revision.pages.all().order_by('page_number'):
            page = pdf_doc.load_page(page_data.page_number - 1)

            # 1. 將原始 PDF 頁面轉換為圖片
            mat = fitz.Matrix(2, 2)  # 2x 解析度
            pix = page.get_pixmap(matrix=mat)
            img_data = pix.tobytes("png")
            original_img = Image.open(BytesIO(img_data))

            orig_w, orig_h = original_img.size

            # 2. 創建右側翻譯面板（白底）
            translation_panel = Image.new('RGB', (orig_w, orig_h), color='white')
            draw = ImageDraw.Draw(translation_panel)

            # 3. 繪製標題
            title_text = f"中文翻譯 - 第 {page_data.page_number} 頁"
            draw.text((40, 30), title_text, font=self.pil_font_title, fill=(0, 0, 0))
            draw.line([(40, 70), (orig_w - 40, 70)], fill=self.separator_color, width=2)

            # 4. 獲取該頁所有 blocks 並繪製翻譯
            blocks = page_data.blocks.all().order_by('bbox_y', 'bbox_x')

            current_y = 100  # 從標題下方開始
            line_height = self.font_size + 12
            max_width = orig_w - 80  # 左右各留 40px 邊距

            for block in blocks:
                chinese_text = block.edited_text or block.translated_text
                if not chinese_text or not chinese_text.strip():
                    continue

                original_text = block.source_text or ""

                # 檢查是否有有效的 bbox（用於顯示位置標記）
                has_valid_bbox = (block.bbox_x != 0 or block.bbox_y != 0)

                # 繪製原文（小字，灰色）
                if original_text.strip():
                    # 截斷過長的原文
                    display_original = original_text[:80] + "..." if len(original_text) > 80 else original_text
                    draw.text(
                        (40, current_y),
                        f"EN: {display_original}",
                        font=self.pil_font_small,
                        fill=(128, 128, 128)  # 灰色
                    )
                    current_y += line_height - 4

                # 繪製中文翻譯（主色）
                # 自動換行處理
                wrapped_lines = self._wrap_text(chinese_text, max_width)
                for line in wrapped_lines:
                    draw.text(
                        (40, current_y),
                        line,
                        font=self.pil_font,
                        fill=self.translation_color
                    )
                    current_y += line_height

                # 如果有位置信息，顯示區域標記
                if has_valid_bbox:
                    position_info = f"[位置: x={block.bbox_x:.0f}, y={block.bbox_y:.0f}]"
                    draw.text(
                        (40, current_y),
                        position_info,
                        font=self.pil_font_small,
                        fill=(180, 180, 180)  # 淺灰色
                    )
                    current_y += line_height - 8

                # 項目間隔
                current_y += 15

                # 繪製分隔線
                draw.line(
                    [(60, current_y), (orig_w - 60, current_y)],
                    fill=(230, 230, 230),
                    width=1
                )
                current_y += 15

                # 檢查是否超出頁面
                if current_y > orig_h - 50:
                    # 添加 "續下頁" 提示
                    draw.text(
                        (orig_w // 2 - 50, orig_h - 40),
                        "...續下頁...",
                        font=self.pil_font_small,
                        fill=(150, 150, 150)
                    )
                    break

            # 5. 創建並排圖片（原文 + 翻譯）
            combined_width = orig_w * 2 + 20  # 中間留 20px 分隔
            combined_img = Image.new('RGB', (combined_width, orig_h), color='white')

            # 貼上原文（左邊）
            combined_img.paste(original_img, (0, 0))

            # 繪製中間分隔線
            combined_draw = ImageDraw.Draw(combined_img)
            combined_draw.line(
                [(orig_w + 10, 0), (orig_w + 10, orig_h)],
                fill=self.separator_color,
                width=3
            )

            # 貼上翻譯（右邊）
            combined_img.paste(translation_panel, (orig_w + 20, 0))

            # 6. 保存到內存
            img_bytes = BytesIO()
            combined_img.save(img_bytes, format='PNG', optimize=True)
            processed_images.append(img_bytes.getvalue())

            logger.info(f"Page {page_data.page_number}: Side-by-side created ({combined_width}x{orig_h})")

        pdf_doc.close()

        # 7. 創建 PDF
        return self._images_to_pdf(processed_images)

    def _export_alternating(self) -> bytes:
        """
        方案 D: 交替頁面匯出
        Page 1: 原文
        Page 2: 翻譯
        Page 3: 原文
        Page 4: 翻譯
        ...
        """
        pdf_doc = fitz.open(self.revision.file.path)
        processed_images = []

        for page_data in self.revision.pages.all().order_by('page_number'):
            page = pdf_doc.load_page(page_data.page_number - 1)

            # 1. 原文頁面
            mat = fitz.Matrix(2, 2)
            pix = page.get_pixmap(matrix=mat)
            img_data = pix.tobytes("png")
            original_img = Image.open(BytesIO(img_data))

            # 添加 "原文" 標籤到左上角
            draw_orig = ImageDraw.Draw(original_img)
            draw_orig.rectangle([(10, 10), (150, 50)], fill=(255, 255, 255, 200))
            draw_orig.text((20, 15), f"原文 P{page_data.page_number}", font=self.pil_font, fill=(0, 0, 0))

            img_bytes_orig = BytesIO()
            original_img.save(img_bytes_orig, format='PNG')
            processed_images.append(img_bytes_orig.getvalue())

            # 2. 翻譯頁面
            orig_w, orig_h = original_img.size
            translation_img = Image.new('RGB', (orig_w, orig_h), color='white')
            draw = ImageDraw.Draw(translation_img)

            # 標題
            title = f"中文翻譯 - 第 {page_data.page_number} 頁"
            draw.text((40, 30), title, font=self.pil_font_title, fill=(0, 0, 0))
            draw.line([(40, 70), (orig_w - 40, 70)], fill=self.separator_color, width=2)

            # 繪製翻譯內容
            blocks = page_data.blocks.all().order_by('bbox_y', 'bbox_x')
            current_y = 100

            for block in blocks:
                chinese_text = block.edited_text or block.translated_text
                if not chinese_text or not chinese_text.strip():
                    continue

                original_text = block.source_text or ""

                # 原文（灰色小字）
                if original_text.strip():
                    display_original = original_text[:100] + "..." if len(original_text) > 100 else original_text
                    draw.text((40, current_y), f"EN: {display_original}", font=self.pil_font_small, fill=(128, 128, 128))
                    current_y += self.font_size + 8

                # 中文翻譯
                wrapped_lines = self._wrap_text(chinese_text, orig_w - 80)
                for line in wrapped_lines:
                    draw.text((40, current_y), line, font=self.pil_font, fill=self.translation_color)
                    current_y += self.font_size + 12

                current_y += 20
                draw.line([(60, current_y), (orig_w - 60, current_y)], fill=(230, 230, 230), width=1)
                current_y += 20

                if current_y > orig_h - 50:
                    break

            img_bytes_trans = BytesIO()
            translation_img.save(img_bytes_trans, format='PNG')
            processed_images.append(img_bytes_trans.getvalue())

            logger.info(f"Page {page_data.page_number}: Alternating pages created")

        pdf_doc.close()
        return self._images_to_pdf(processed_images)

    def _export_overlay_offset(self) -> bytes:
        """
        方案 B: 偏移疊加
        中文放在原文下方，用箭頭或線條連接
        """
        pdf_doc = fitz.open(self.revision.file.path)
        processed_images = []

        for page_data in self.revision.pages.all().order_by('page_number'):
            page = pdf_doc.load_page(page_data.page_number - 1)

            mat = fitz.Matrix(2, 2)
            pix = page.get_pixmap(matrix=mat)
            img_data = pix.tobytes("png")
            img = Image.open(BytesIO(img_data))
            draw = ImageDraw.Draw(img)

            blocks = page_data.blocks.all().order_by('bbox_y', 'bbox_x')

            for block in blocks:
                chinese_text = block.edited_text or block.translated_text
                if not chinese_text or not chinese_text.strip():
                    continue

                has_valid_bbox = (block.bbox_x != 0 or block.bbox_y != 0)

                if has_valid_bbox:
                    x = block.bbox_x * 2
                    y = block.bbox_y * 2

                    # 偏移到原文下方 (原文高度約 20-30px，偏移 40px)
                    offset_y = y + 40

                    # 繪製連接線
                    draw.line([(x, y + 20), (x, offset_y - 5)], fill=(200, 200, 200), width=1)

                    # 繪製半透明背景
                    text_bbox = draw.textbbox((x, offset_y), chinese_text, font=self.pil_font)
                    padding = 4
                    draw.rectangle(
                        [
                            text_bbox[0] - padding,
                            text_bbox[1] - padding,
                            text_bbox[2] + padding,
                            text_bbox[3] + padding
                        ],
                        fill=(255, 255, 255, 220)
                    )

                    # 繪製中文
                    draw.text((x, offset_y), chinese_text, font=self.pil_font, fill=self.translation_color)

            img_bytes = BytesIO()
            img.save(img_bytes, format='PNG')
            processed_images.append(img_bytes.getvalue())

            logger.info(f"Page {page_data.page_number}: Offset overlay created")

        pdf_doc.close()
        return self._images_to_pdf(processed_images)

    def _export_overlay_background(self) -> bytes:
        """
        方案 A: 半透明背景疊加
        中文下方繪製白色半透明矩形
        如果 bbox 無效，會在頁面底部創建翻譯面板
        """
        pdf_doc = fitz.open(self.revision.file.path)
        processed_images = []

        for page_data in self.revision.pages.all().order_by('page_number'):
            page = pdf_doc.load_page(page_data.page_number - 1)

            mat = fitz.Matrix(2, 2)
            pix = page.get_pixmap(matrix=mat)
            img_data = pix.tobytes("png")

            # 轉為 RGBA 以支持半透明
            img = Image.open(BytesIO(img_data)).convert('RGBA')
            img_width, img_height = img.size

            # 創建半透明圖層
            overlay = Image.new('RGBA', img.size, (255, 255, 255, 0))
            draw = ImageDraw.Draw(overlay)

            blocks = page_data.blocks.all().order_by('bbox_y', 'bbox_x')

            # 用於 fallback 的位置追蹤
            fallback_y = 50  # 從頂部開始
            has_any_valid_bbox = False

            for block in blocks:
                chinese_text = block.edited_text or block.translated_text
                if not chinese_text or not chinese_text.strip():
                    continue

                has_valid_bbox = (block.bbox_x != 0 or block.bbox_y != 0)

                if has_valid_bbox:
                    has_any_valid_bbox = True
                    x = block.bbox_x * 2
                    y = block.bbox_y * 2

                    # 計算文字尺寸
                    text_bbox = draw.textbbox((x, y), chinese_text, font=self.pil_font)
                    padding = 6

                    # 繪製半透明白色背景 (alpha=200)
                    draw.rectangle(
                        [
                            text_bbox[0] - padding,
                            text_bbox[1] - padding,
                            text_bbox[2] + padding,
                            text_bbox[3] + padding
                        ],
                        fill=(255, 255, 255, 200)  # 半透明白色
                    )

                    # 繪製中文
                    draw.text((x, y), chinese_text, font=self.pil_font, fill=self.translation_color + (255,))

            # 如果沒有有效的 bbox，在頁面上創建翻譯面板
            if not has_any_valid_bbox and blocks.exists():
                # 在頁面右側創建翻譯面板
                panel_width = min(600, img_width // 3)
                panel_x = img_width - panel_width - 20
                panel_y = 30

                # 面板背景
                draw.rectangle(
                    [panel_x - 10, panel_y - 10, img_width - 10, img_height - 30],
                    fill=(255, 255, 255, 230)
                )

                # 標題
                draw.text(
                    (panel_x, panel_y),
                    f"中文翻譯 - P{page_data.page_number}",
                    font=self.pil_font_title,
                    fill=(0, 0, 0, 255)
                )
                current_y = panel_y + self.font_size + 20

                for block in blocks:
                    chinese_text = block.edited_text or block.translated_text
                    if not chinese_text or not chinese_text.strip():
                        continue

                    original_text = block.source_text or ""

                    # 原文（小灰字）
                    if original_text.strip():
                        display_original = original_text[:40] + "..." if len(original_text) > 40 else original_text
                        draw.text(
                            (panel_x, current_y),
                            f"EN: {display_original}",
                            font=self.pil_font_small,
                            fill=(128, 128, 128, 255)
                        )
                        current_y += self.font_size

                    # 中文翻譯
                    wrapped_lines = self._wrap_text(chinese_text, panel_width - 20)
                    for line in wrapped_lines:
                        draw.text(
                            (panel_x, current_y),
                            line,
                            font=self.pil_font,
                            fill=self.translation_color + (255,)
                        )
                        current_y += self.font_size + 8

                    current_y += 15

                    # 檢查是否超出頁面
                    if current_y > img_height - 80:
                        draw.text(
                            (panel_x, current_y),
                            "...更多內容...",
                            font=self.pil_font_small,
                            fill=(150, 150, 150, 255)
                        )
                        break

            # 合併圖層
            img = Image.alpha_composite(img, overlay)
            img = img.convert('RGB')

            img_bytes = BytesIO()
            img.save(img_bytes, format='PNG')
            processed_images.append(img_bytes.getvalue())

            logger.info(f"Page {page_data.page_number}: Background overlay created (valid_bbox={has_any_valid_bbox})")

        pdf_doc.close()
        return self._images_to_pdf(processed_images)

    def _wrap_text(self, text: str, max_width: int) -> List[str]:
        """
        自動換行：根據最大寬度分割文字
        """
        lines = []
        current_line = ""

        # 先按換行符分割
        paragraphs = text.split('\n')

        for para in paragraphs:
            words = list(para)  # 中文逐字處理

            for char in words:
                test_line = current_line + char
                # 估算寬度（中文字約等於 font_size 寬度）
                estimated_width = len(test_line) * (self.font_size * 0.6)

                if estimated_width > max_width:
                    if current_line:
                        lines.append(current_line)
                    current_line = char
                else:
                    current_line = test_line

            # 段落結束
            if current_line:
                lines.append(current_line)
                current_line = ""

        return lines if lines else [text]

    def _images_to_pdf(self, images: List[bytes]) -> bytes:
        """
        將圖片列表轉換為 PDF
        """
        output_pdf = fitz.open()

        for img_bytes in images:
            img = Image.open(BytesIO(img_bytes))
            w, h = img.size

            # 創建頁面
            page = output_pdf.new_page(width=w, height=h)
            page.insert_image(page.rect, stream=img_bytes)

        pdf_bytes = output_pdf.tobytes()
        output_pdf.close()

        return pdf_bytes


def export_techpack_bilingual_pdf(
    tech_pack_revision,
    font_size: int = 20,
    mode: ExportMode = "side_by_side"
) -> HttpResponse:
    """
    便捷函數：匯出雙語 Tech Pack PDF

    Args:
        tech_pack_revision: TechPackRevision instance
        font_size: 中文字體大小 (預設 20pt)
        mode: 匯出模式
            - "side_by_side": 雙欄對照（推薦）
            - "alternating": 交替頁面
            - "overlay_offset": 偏移疊加
            - "overlay_background": 半透明背景疊加

    Returns:
        HttpResponse with PDF file
    """
    exporter = TechPackBilingualPDFExporter(tech_pack_revision, font_size, mode)
    return exporter.export()


# ============================================================
# MWO 整合匯出接口
# ============================================================

def export_techpack_for_mwo(tech_pack_revision) -> bytes:
    """
    專門用於 MWO 整合的 Tech Pack 匯出
    使用疊加模式：中文直接顯示在原圖上（半透明白底）

    Args:
        tech_pack_revision: TechPackRevision instance

    Returns:
        bytes: PDF 文件的字節數據
    """
    exporter = TechPackBilingualPDFExporter(
        tech_pack_revision,
        font_size=20,  # 稍大字體確保清晰
        mode="overlay_background"
    )

    # 使用疊加模式
    return exporter._export_overlay_background()


def get_available_export_modes() -> dict:
    """
    獲取所有可用的匯出模式及其描述
    用於 API 文檔或前端選擇
    """
    return {
        "side_by_side": {
            "name": "雙欄對照",
            "description": "左邊原文、右邊翻譯，清晰對照，推薦用於 MWO",
            "file_size_factor": 2.0,
            "recommended_for": ["MWO", "工廠生產", "品質檢驗"]
        },
        "alternating": {
            "name": "交替頁面",
            "description": "原文頁與翻譯頁交替，適合打印",
            "file_size_factor": 2.0,
            "recommended_for": ["打印", "培訓", "存檔"]
        },
        "overlay_offset": {
            "name": "偏移疊加",
            "description": "中文放在原文下方，用線條連接",
            "file_size_factor": 1.0,
            "recommended_for": ["快速預覽", "空間充裕的文檔"]
        },
        "overlay_background": {
            "name": "半透明背景",
            "description": "中文帶白色半透明背景，覆蓋在原文上",
            "file_size_factor": 1.0,
            "recommended_for": ["空間緊湊的文檔", "簡單翻譯"]
        }
    }


# ============================================================
# Run Snapshot 匯出接口
# ============================================================

def export_techpack_from_run_snapshot(tech_pack_revision, run_pages) -> bytes:
    """
    使用 Run 的快照數據渲染 Tech Pack PDF

    這個函數使用 RunTechPackBlock 的數據（包括用戶調整的 overlay 位置），
    而不是直接使用 DraftBlock。這樣每個 Run 可以有獨立的翻譯和位置設定。

    Args:
        tech_pack_revision: 原始 TechPackRevision（用於獲取 PDF 文件）
        run_pages: RunTechPackPage QuerySet（包含快照數據）

    Returns:
        bytes: PDF 文件的字節數據
    """
    # 載入字體
    chinese_font_path = find_chinese_font()
    if not chinese_font_path:
        raise Exception("Chinese font not found.")

    font_size = 20
    pil_font = ImageFont.truetype(chinese_font_path, font_size)
    pil_font_small = ImageFont.truetype(chinese_font_path, max(12, font_size - 4))
    pil_font_title = ImageFont.truetype(chinese_font_path, font_size + 4)

    translation_color = (0, 51, 153)  # 深藍色

    # 打開原始 PDF
    pdf_doc = fitz.open(tech_pack_revision.file.path)
    processed_images = []

    # 建立頁碼映射
    run_pages_dict = {rp.page_number: rp for rp in run_pages}

    for page_num in range(1, pdf_doc.page_count + 1):
        page = pdf_doc.load_page(page_num - 1)

        mat = fitz.Matrix(2, 2)
        pix = page.get_pixmap(matrix=mat)
        img_data = pix.tobytes("png")

        # 轉為 RGBA 以支持半透明
        img = Image.open(BytesIO(img_data)).convert('RGBA')
        img_width, img_height = img.size

        # 創建半透明圖層
        overlay = Image.new('RGBA', img.size, (255, 255, 255, 0))
        draw = ImageDraw.Draw(overlay)

        # 獲取該頁的快照 blocks
        run_page = run_pages_dict.get(page_num)
        if run_page:
            blocks = run_page.blocks.all().order_by('bbox_y', 'bbox_x')
        else:
            blocks = []

        # 用於 fallback 的追蹤
        has_any_valid_overlay = False

        for block in blocks:
            # 跳過隱藏的 blocks
            if not block.overlay_visible:
                continue

            chinese_text = block.translated_text
            if not chinese_text or not chinese_text.strip():
                continue

            # ⭐ 使用 overlay 位置（用戶調整後的位置）
            # 如果沒有設定 overlay 位置，使用原始 bbox
            overlay_x = block.overlay_x if block.overlay_x is not None else block.bbox_x
            overlay_y = block.overlay_y if block.overlay_y is not None else block.bbox_y

            has_valid_position = (overlay_x != 0 or overlay_y != 0)

            if has_valid_position:
                has_any_valid_overlay = True
                x = overlay_x * 2  # 因為圖片放大了 2 倍
                y = overlay_y * 2

                # 計算文字尺寸
                text_bbox = draw.textbbox((x, y), chinese_text, font=pil_font)
                padding = 6

                # 繪製半透明白色背景
                draw.rectangle(
                    [
                        text_bbox[0] - padding,
                        text_bbox[1] - padding,
                        text_bbox[2] + padding,
                        text_bbox[3] + padding
                    ],
                    fill=(255, 255, 255, 200)
                )

                # 繪製中文
                draw.text((x, y), chinese_text, font=pil_font, fill=translation_color + (255,))

        # 如果沒有有效位置的 block，在頁面右側創建翻譯面板
        if not has_any_valid_overlay and blocks:
            panel_width = min(600, img_width // 3)
            panel_x = img_width - panel_width - 20
            panel_y = 30

            # 面板背景
            draw.rectangle(
                [panel_x - 10, panel_y - 10, img_width - 10, img_height - 30],
                fill=(255, 255, 255, 230)
            )

            # 標題
            draw.text(
                (panel_x, panel_y),
                f"中文翻譯 - P{page_num}",
                font=pil_font_title,
                fill=(0, 0, 0, 255)
            )
            current_y = panel_y + font_size + 20

            for block in blocks:
                if not block.overlay_visible:
                    continue

                chinese_text = block.translated_text
                if not chinese_text or not chinese_text.strip():
                    continue

                original_text = block.source_text or ""

                # 原文（小灰字）
                if original_text.strip():
                    display_original = original_text[:40] + "..." if len(original_text) > 40 else original_text
                    draw.text(
                        (panel_x, current_y),
                        f"EN: {display_original}",
                        font=pil_font_small,
                        fill=(128, 128, 128, 255)
                    )
                    current_y += font_size

                # 中文翻譯（自動換行）
                max_chars = (panel_width - 20) // (font_size * 0.6)
                lines = [chinese_text[i:i+int(max_chars)] for i in range(0, len(chinese_text), int(max_chars))]
                for line in lines:
                    draw.text(
                        (panel_x, current_y),
                        line,
                        font=pil_font,
                        fill=translation_color + (255,)
                    )
                    current_y += font_size + 8

                current_y += 15

                # 檢查是否超出頁面
                if current_y > img_height - 80:
                    draw.text(
                        (panel_x, current_y),
                        "...更多內容...",
                        font=pil_font_small,
                        fill=(150, 150, 150, 255)
                    )
                    break

        # 合併圖層
        img = Image.alpha_composite(img, overlay)
        img = img.convert('RGB')

        img_bytes = BytesIO()
        img.save(img_bytes, format='PNG')
        processed_images.append(img_bytes.getvalue())

        logger.info(f"Page {page_num}: Snapshot overlay created (has_valid_overlay={has_any_valid_overlay})")

    pdf_doc.close()

    # 轉換為 PDF
    output_pdf = fitz.open()
    for img_bytes in processed_images:
        img = Image.open(BytesIO(img_bytes))
        w, h = img.size
        page = output_pdf.new_page(width=w, height=h)
        page.insert_image(page.rect, stream=img_bytes)

    pdf_bytes = output_pdf.tobytes()
    output_pdf.close()

    return pdf_bytes
