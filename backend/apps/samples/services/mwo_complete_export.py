"""
MWO Complete PDF Export Service (v2)

使用 Pillow + PyMuPDF 生成包含中文的完整 MWO PDF：
1. 封面頁（MWO 基本資訊）
2. Tech Pack 雙語頁面（如果有）
3. BOM 物料表（含中文翻譯）
4. Spec 尺寸表（含中文翻譯）

核心技術：
- Pillow: 在圖片上繪製中文文字
- PyMuPDF (fitz): 合併和輸出 PDF
- 中文字體: SimSun, MSYaHei
"""

from django.http import HttpResponse
from django.utils import timezone
from io import BytesIO
import fitz  # PyMuPDF
from PIL import Image, ImageDraw, ImageFont
import os
import logging
from typing import Optional, List, Tuple

logger = logging.getLogger(__name__)


def find_chinese_font(bold: bool = False) -> Optional[str]:
    """查找中文字體"""
    if bold:
        font_paths = [
            "C:/Windows/Fonts/msyhbd.ttc",   # 微軟雅黑粗體
            "C:/Windows/Fonts/simhei.ttf",   # 黑體
            "C:/Windows/Fonts/msyh.ttc",     # 微軟雅黑
        ]
    else:
        font_paths = [
            "C:/Windows/Fonts/msyh.ttc",     # 微軟雅黑
            "C:/Windows/Fonts/simsun.ttc",   # 宋體
            "C:/Windows/Fonts/simhei.ttf",   # 黑體
            # Linux
            "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        ]

    for path in font_paths:
        if os.path.exists(path):
            return path
    return None


class MWOCompletePDFExporter:
    """
    完整 MWO PDF 匯出器

    生成包含以下內容的 PDF：
    - 封面頁
    - Tech Pack 雙語版（如果有）
    - BOM 表格（含中文）
    - Spec 尺寸表（含中文）
    """

    # 頁面設定 (A4 橫向)
    PAGE_WIDTH = 1684   # A4 @ 200 DPI
    PAGE_HEIGHT = 1190
    MARGIN = 60

    # 顏色
    COLOR_PRIMARY = (44, 62, 80)      # 深藍灰
    COLOR_SECONDARY = (52, 73, 94)    # 次要
    COLOR_ACCENT = (68, 114, 196)     # 藍色
    COLOR_CHINESE = (0, 102, 204)     # 中文藍色
    COLOR_LIGHT_GRAY = (200, 200, 200)
    COLOR_WHITE = (255, 255, 255)
    COLOR_YELLOW_BG = (255, 243, 205) # 未翻譯警告

    def __init__(self, sample_run, include_techpack: bool = True):
        self.sample_run = sample_run
        self.include_techpack = include_techpack
        self.mwo = self._get_mwo()
        self.style_revision = sample_run.revision or sample_run.sample_request.revision

        # 載入字體
        font_path = find_chinese_font(bold=False)
        font_path_bold = find_chinese_font(bold=True) or font_path

        if not font_path:
            raise Exception("找不到中文字體！請確認 Windows 字體資料夾。")

        self.font_title = ImageFont.truetype(font_path_bold, 36)
        self.font_subtitle = ImageFont.truetype(font_path_bold, 24)
        self.font_header = ImageFont.truetype(font_path_bold, 18)
        self.font_normal = ImageFont.truetype(font_path, 14)
        self.font_small = ImageFont.truetype(font_path, 12)
        self.font_chinese = ImageFont.truetype(font_path, 14)

        logger.info(f"MWOCompletePDFExporter initialized for Run: {sample_run.id}")

    def _get_mwo(self):
        return self.sample_run.mwos.filter(is_latest=True).first()

    def export(self) -> HttpResponse:
        """生成完整 MWO PDF"""
        pages = []

        # 1. 封面頁
        cover = self._create_cover_page()
        pages.append(cover)

        # 2. Tech Pack 頁面（如果有）
        if self.include_techpack:
            techpack_pages = self._create_techpack_pages()
            pages.extend(techpack_pages)

        # 3. BOM 頁面
        bom_pages = self._create_bom_pages()
        pages.extend(bom_pages)

        # 4. Spec 頁面
        spec_pages = self._create_spec_pages()
        pages.extend(spec_pages)

        # 合併成 PDF
        pdf_bytes = self._images_to_pdf(pages)

        # 生成檔名
        mwo_no = self.mwo.mwo_no if self.mwo else 'DRAFT'
        style_number = self.style_revision.style.style_number if self.style_revision else 'UNKNOWN'
        run_no = self.sample_run.run_no
        filename = f"MWO_{style_number}_Run{run_no}.pdf"

        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        logger.info(f"MWO PDF generated: {filename}, {len(pages)} pages, {len(pdf_bytes)} bytes")
        return response

    def _create_page(self) -> Tuple[Image.Image, ImageDraw.Draw]:
        """創建空白頁面"""
        img = Image.new('RGB', (self.PAGE_WIDTH, self.PAGE_HEIGHT), self.COLOR_WHITE)
        draw = ImageDraw.Draw(img)
        return img, draw

    def _draw_header(self, draw: ImageDraw.Draw, title: str, subtitle: str = ""):
        """繪製頁面標題"""
        # 標題背景
        draw.rectangle(
            [(0, 0), (self.PAGE_WIDTH, 80)],
            fill=self.COLOR_ACCENT
        )
        draw.text((self.MARGIN, 20), title, font=self.font_title, fill=self.COLOR_WHITE)

        if subtitle:
            draw.text((self.MARGIN, 55), subtitle, font=self.font_normal, fill=(200, 220, 255))

    def _draw_footer(self, draw: ImageDraw.Draw, page_num: int, total_pages: int):
        """繪製頁腳"""
        y = self.PAGE_HEIGHT - 40
        draw.line([(self.MARGIN, y), (self.PAGE_WIDTH - self.MARGIN, y)], fill=self.COLOR_LIGHT_GRAY, width=1)

        footer_text = f"Generated: {timezone.now().strftime('%Y-%m-%d %H:%M')} | Page {page_num}/{total_pages}"
        draw.text((self.MARGIN, y + 10), footer_text, font=self.font_small, fill=(150, 150, 150))

        draw.text((self.PAGE_WIDTH - 250, y + 10), "Fashion Production System", font=self.font_small, fill=(150, 150, 150))

    def _create_cover_page(self) -> bytes:
        """創建封面頁"""
        img, draw = self._create_page()

        # 大標題
        draw.rectangle([(0, 0), (self.PAGE_WIDTH, 200)], fill=self.COLOR_ACCENT)
        draw.text((self.MARGIN, 50), "製造工單", font=self.font_title, fill=self.COLOR_WHITE)
        draw.text((self.MARGIN, 100), "Manufacturing Work Order (MWO)", font=self.font_subtitle, fill=(200, 220, 255))

        # MWO 資訊區塊
        y = 250
        info_items = [
            ("MWO 編號 / MWO No.", self.mwo.mwo_no if self.mwo else "DRAFT"),
            ("款式編號 / Style No.", self.style_revision.style.style_number if self.style_revision else "N/A"),
            ("款式名稱 / Style Name", self.style_revision.style.style_name if self.style_revision else "N/A"),
            ("版本 / Revision", self.style_revision.revision_label if self.style_revision else "N/A"),
            ("Run 編號 / Run No.", str(self.sample_run.run_no)),
            ("狀態 / Status", self.sample_run.status),
            ("生成日期 / Date", timezone.now().strftime('%Y-%m-%d')),
        ]

        for label, value in info_items:
            draw.text((self.MARGIN, y), label, font=self.font_header, fill=self.COLOR_SECONDARY)
            draw.text((350, y), str(value), font=self.font_header, fill=self.COLOR_PRIMARY)
            y += 50

        # 目錄
        y += 50
        draw.line([(self.MARGIN, y), (self.PAGE_WIDTH - self.MARGIN, y)], fill=self.COLOR_LIGHT_GRAY, width=2)
        y += 30
        draw.text((self.MARGIN, y), "文件內容 / Contents", font=self.font_subtitle, fill=self.COLOR_PRIMARY)
        y += 50

        contents = [
            "1. 封面 / Cover Page",
            "2. Tech Pack 技術包（雙語對照）",
            "3. BOM 物料清單（含中文翻譯）",
            "4. Spec 尺寸規格表（含中文翻譯）",
        ]
        for item in contents:
            draw.text((self.MARGIN + 20, y), f"• {item}", font=self.font_normal, fill=self.COLOR_SECONDARY)
            y += 35

        # 頁腳
        self._draw_footer(draw, 1, 1)  # 頁碼稍後更新

        # 轉換為 bytes
        img_bytes = BytesIO()
        img.save(img_bytes, format='PNG')
        return img_bytes.getvalue()

    def _create_techpack_pages(self) -> List[bytes]:
        """創建 Tech Pack 雙語頁面

        優先使用 Run 的快照資料 (RunTechPackPage/Block)：
        1. 先檢查 Run 是否有 Tech Pack 快照
        2. 如果有快照，使用快照數據渲染
        3. 如果沒有快照，fallback 到原始 TechPackRevision
        """
        pages = []

        try:
            # ⭐ 優先使用 Run 的 Tech Pack 快照
            from apps.samples.models import RunTechPackPage, RunTechPackBlock

            run_pages = RunTechPackPage.objects.filter(
                run=self.sample_run
            ).prefetch_related('blocks').order_by('page_number')

            if run_pages.exists():
                # 使用快照數據渲染
                logger.info(f"Using Run Tech Pack snapshot: {run_pages.count()} pages")
                pages = self._render_techpack_from_snapshot(run_pages)
                return pages

            # Fallback: 使用原始 TechPackRevision
            logger.info("No Run snapshot found, falling back to TechPackRevision")

            from apps.parsing.models import UploadedDocument

            if not self.style_revision:
                return pages

            # 查找關聯的 TechPackRevision
            uploaded_doc = UploadedDocument.objects.filter(
                style_revision=self.style_revision,
                tech_pack_revision__isnull=False
            ).order_by('-created_at').first()

            if not uploaded_doc or not uploaded_doc.tech_pack_revision:
                logger.warning(f"No TechPackRevision linked to StyleRevision: {self.style_revision.id}")
                pages.append(self._create_no_techpack_page())
                return pages

            tech_pack_revision = uploaded_doc.tech_pack_revision

            # 使用現有的 Tech Pack 匯出服務
            from apps.parsing.services.techpack_pdf_export import export_techpack_for_mwo

            techpack_bytes = export_techpack_for_mwo(tech_pack_revision)

            # 將 Tech Pack PDF 轉換為圖片頁面
            pdf_doc = fitz.open(stream=techpack_bytes, filetype="pdf")
            for page_num in range(pdf_doc.page_count):
                page = pdf_doc.load_page(page_num)
                mat = fitz.Matrix(1.5, 1.5)
                pix = page.get_pixmap(matrix=mat)
                img_bytes = pix.tobytes("png")
                pages.append(img_bytes)
            pdf_doc.close()

            logger.info(f"Tech Pack pages added: {len(pages)} pages")

        except Exception as e:
            logger.error(f"Error creating Tech Pack pages: {e}", exc_info=True)
            pages.append(self._create_no_techpack_page())

        return pages

    def _render_techpack_from_snapshot(self, run_pages) -> List[bytes]:
        """使用 Run 的快照數據渲染 Tech Pack 頁面

        Args:
            run_pages: RunTechPackPage QuerySet

        Returns:
            List of page image bytes
        """
        from apps.parsing.services.techpack_pdf_export import export_techpack_from_run_snapshot

        try:
            # 獲取原始 PDF 路徑
            from apps.parsing.models import UploadedDocument

            uploaded_doc = UploadedDocument.objects.filter(
                style_revision=self.style_revision,
                tech_pack_revision__isnull=False
            ).first()

            if not uploaded_doc or not uploaded_doc.tech_pack_revision:
                logger.warning("Cannot find original PDF for snapshot rendering")
                return [self._create_no_techpack_page()]

            tech_pack_revision = uploaded_doc.tech_pack_revision

            # 使用快照數據渲染
            pdf_bytes = export_techpack_from_run_snapshot(
                tech_pack_revision=tech_pack_revision,
                run_pages=run_pages
            )

            # 將 PDF 轉換為圖片頁面
            pages = []
            pdf_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            for page_num in range(pdf_doc.page_count):
                page = pdf_doc.load_page(page_num)
                mat = fitz.Matrix(1.5, 1.5)
                pix = page.get_pixmap(matrix=mat)
                img_bytes = pix.tobytes("png")
                pages.append(img_bytes)
            pdf_doc.close()

            logger.info(f"Tech Pack rendered from snapshot: {len(pages)} pages")
            return pages

        except Exception as e:
            logger.error(f"Error rendering Tech Pack from snapshot: {e}", exc_info=True)
            return [self._create_no_techpack_page()]

    def _create_no_techpack_page(self) -> bytes:
        """創建「無 Tech Pack」提示頁"""
        img, draw = self._create_page()
        self._draw_header(draw, "Tech Pack 技術包", "Technical Specification Document")

        # 提示訊息
        y = 300
        draw.text((self.PAGE_WIDTH // 2 - 200, y), "尚無 Tech Pack 資料", font=self.font_subtitle, fill=(150, 150, 150))
        draw.text((self.PAGE_WIDTH // 2 - 250, y + 50), "No Tech Pack data linked to this style revision", font=self.font_normal, fill=(180, 180, 180))
        draw.text((self.PAGE_WIDTH // 2 - 200, y + 100), "請先上傳並解析 Tech Pack PDF", font=self.font_normal, fill=(180, 180, 180))

        img_bytes = BytesIO()
        img.save(img_bytes, format='PNG')
        return img_bytes.getvalue()

    def _create_bom_pages(self) -> List[bytes]:
        """創建 BOM 頁面"""
        pages = []

        try:
            from apps.styles.models import BOMItem

            if not self.style_revision:
                return pages

            bom_items = list(BOMItem.objects.filter(revision=self.style_revision).order_by('item_number'))

            if not bom_items:
                pages.append(self._create_no_data_page("BOM 物料清單", "Bill of Materials"))
                return pages

            # 每頁顯示的行數
            rows_per_page = 20
            total_pages = (len(bom_items) + rows_per_page - 1) // rows_per_page

            for page_idx in range(total_pages):
                start_idx = page_idx * rows_per_page
                end_idx = min(start_idx + rows_per_page, len(bom_items))
                page_items = bom_items[start_idx:end_idx]

                img, draw = self._create_page()
                self._draw_header(draw, "BOM 物料清單", f"Bill of Materials - Page {page_idx + 1}/{total_pages}")

                # 表頭
                y = 110
                col_widths = [50, 120, 250, 250, 100, 100, 80, 100, 100]
                headers = ["#", "料號", "物料名稱 (EN)", "物料名稱 (中文)", "類別", "顏色", "單位", "用量", "供應商"]

                x = self.MARGIN
                draw.rectangle([(x, y), (self.PAGE_WIDTH - self.MARGIN, y + 35)], fill=self.COLOR_ACCENT)
                for i, header in enumerate(headers):
                    draw.text((x + 5, y + 8), header, font=self.font_small, fill=self.COLOR_WHITE)
                    x += col_widths[i]

                # 資料列
                y += 40
                for idx, item in enumerate(page_items):
                    # 取得中文名稱：優先使用 material_name_zh，如果空白則使用 material_name
                    zh_name = getattr(item, 'material_name_zh', '') or ''
                    # 檢查是否有真正的中文字符
                    has_real_chinese = any('\u4e00' <= c <= '\u9fff' for c in zh_name)
                    # 如果 zh_name 是空白、沒有中文、或像 AI 垃圾回應，則使用原始名稱
                    if not zh_name or not has_real_chinese or zh_name.startswith('The text') or zh_name.startswith('This appears'):
                        zh_name = item.material_name or '-'

                    row_bg = self.COLOR_WHITE  # 不再標黃，因為會 fallback 到 material_name

                    x = self.MARGIN
                    draw.rectangle([(x, y), (self.PAGE_WIDTH - self.MARGIN, y + 45)], fill=row_bg, outline=self.COLOR_LIGHT_GRAY)

                    # 資料
                    values = [
                        str(start_idx + idx + 1),
                        (item.supplier_article_no or '-')[:12],
                        (item.material_name or '-')[:35],
                        zh_name[:30],
                        (item.category or '-')[:10],
                        (item.color or '-')[:12],
                        item.unit or '-',
                        f"{float(item.consumption):.2f}" if item.consumption else '-',
                        (item.supplier or '-')[:12],
                    ]

                    for i, val in enumerate(values):
                        # 中文欄位用中文字體
                        font = self.font_chinese if i == 3 else self.font_small
                        color = self.COLOR_CHINESE if i == 3 and val != '-' else self.COLOR_PRIMARY
                        draw.text((x + 5, y + 12), val, font=font, fill=color)
                        x += col_widths[i]

                    y += 50

                # 頁腳
                self._draw_footer(draw, page_idx + 1, total_pages)

                img_bytes = BytesIO()
                img.save(img_bytes, format='PNG')
                pages.append(img_bytes.getvalue())

            logger.info(f"BOM pages created: {len(pages)} pages, {len(bom_items)} items")

        except Exception as e:
            logger.error(f"Error creating BOM pages: {e}", exc_info=True)
            pages.append(self._create_no_data_page("BOM 物料清單", "Bill of Materials"))

        return pages

    def _create_spec_pages(self) -> List[bytes]:
        """創建 Spec 尺寸規格頁面"""
        pages = []

        try:
            from apps.styles.models import Measurement

            if not self.style_revision:
                return pages

            measurements = list(Measurement.objects.filter(revision=self.style_revision).order_by('point_name'))

            if not measurements:
                pages.append(self._create_no_data_page("Spec 尺寸規格表", "Measurement Specification"))
                return pages

            # 獲取尺碼列表
            size_keys = set()
            for m in measurements:
                if m.values:
                    size_keys.update(m.values.keys())

            size_order = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL']
            sorted_sizes = sorted(size_keys, key=lambda x: (size_order.index(x) if x in size_order else 999, x))

            # 每頁行數
            rows_per_page = 18
            total_pages = (len(measurements) + rows_per_page - 1) // rows_per_page

            for page_idx in range(total_pages):
                start_idx = page_idx * rows_per_page
                end_idx = min(start_idx + rows_per_page, len(measurements))
                page_items = measurements[start_idx:end_idx]

                img, draw = self._create_page()
                self._draw_header(draw, "Spec 尺寸規格表", f"Measurement Specification - Page {page_idx + 1}/{total_pages}")

                # 計算欄位寬度
                y = 110
                base_cols = [50, 200, 200, 60, 60]  # #, EN, ZH, +Tol, -Tol
                size_col_width = max(60, (self.PAGE_WIDTH - 2*self.MARGIN - sum(base_cols)) // max(len(sorted_sizes), 1))

                # 表頭
                x = self.MARGIN
                header_height = 35
                draw.rectangle([(x, y), (self.PAGE_WIDTH - self.MARGIN, y + header_height)], fill=self.COLOR_ACCENT)

                headers = ["#", "量度點 (EN)", "量度點 (中文)", "+Tol", "-Tol"] + list(sorted_sizes)
                col_widths = base_cols + [size_col_width] * len(sorted_sizes)

                for i, header in enumerate(headers):
                    draw.text((x + 3, y + 8), header[:10], font=self.font_small, fill=self.COLOR_WHITE)
                    x += col_widths[i]

                # 資料列
                y += header_height + 5
                for idx, m in enumerate(page_items):
                    row_bg = self.COLOR_YELLOW_BG if not m.point_name_zh else self.COLOR_WHITE

                    x = self.MARGIN
                    draw.rectangle([(x, y), (self.PAGE_WIDTH - self.MARGIN, y + 50)], fill=row_bg, outline=self.COLOR_LIGHT_GRAY)

                    # 基本資料
                    draw.text((x + 5, y + 15), str(start_idx + idx + 1), font=self.font_small, fill=self.COLOR_PRIMARY)
                    x += base_cols[0]

                    draw.text((x + 3, y + 15), (m.point_name or '-')[:28], font=self.font_small, fill=self.COLOR_PRIMARY)
                    x += base_cols[1]

                    zh_text = m.point_name_zh or '-'
                    color = self.COLOR_CHINESE if zh_text != '-' else (150, 150, 150)
                    draw.text((x + 3, y + 15), zh_text[:25], font=self.font_chinese, fill=color)
                    x += base_cols[2]

                    draw.text((x + 3, y + 15), f"+{m.tolerance_plus or 0}", font=self.font_small, fill=self.COLOR_PRIMARY)
                    x += base_cols[3]

                    draw.text((x + 3, y + 15), f"-{m.tolerance_minus or 0}", font=self.font_small, fill=self.COLOR_PRIMARY)
                    x += base_cols[4]

                    # 尺碼數值
                    for size in sorted_sizes:
                        val = m.values.get(size, '-') if m.values else '-'
                        draw.text((x + 3, y + 15), str(val)[:8], font=self.font_small, fill=self.COLOR_PRIMARY)
                        x += size_col_width

                    y += 55

                self._draw_footer(draw, page_idx + 1, total_pages)

                img_bytes = BytesIO()
                img.save(img_bytes, format='PNG')
                pages.append(img_bytes.getvalue())

            logger.info(f"Spec pages created: {len(pages)} pages, {len(measurements)} items")

        except Exception as e:
            logger.error(f"Error creating Spec pages: {e}", exc_info=True)
            pages.append(self._create_no_data_page("Spec 尺寸規格表", "Measurement Specification"))

        return pages

    def _create_no_data_page(self, title: str, subtitle: str) -> bytes:
        """創建無資料提示頁"""
        img, draw = self._create_page()
        self._draw_header(draw, title, subtitle)

        y = 300
        draw.text((self.PAGE_WIDTH // 2 - 100, y), "尚無資料", font=self.font_subtitle, fill=(150, 150, 150))
        draw.text((self.PAGE_WIDTH // 2 - 100, y + 50), "No data available", font=self.font_normal, fill=(180, 180, 180))

        img_bytes = BytesIO()
        img.save(img_bytes, format='PNG')
        return img_bytes.getvalue()

    def _images_to_pdf(self, images: List[bytes]) -> bytes:
        """將圖片列表轉換為 PDF"""
        output_pdf = fitz.open()

        for img_bytes in images:
            img = Image.open(BytesIO(img_bytes))
            w, h = img.size

            page = output_pdf.new_page(width=w, height=h)
            page.insert_image(page.rect, stream=img_bytes)

        pdf_bytes = output_pdf.tobytes()
        output_pdf.close()

        return pdf_bytes


def export_mwo_complete(sample_run, include_techpack: bool = True) -> HttpResponse:
    """
    便捷函數：匯出完整 MWO PDF
    """
    exporter = MWOCompletePDFExporter(sample_run, include_techpack)
    return exporter.export()
