"""
Purchase Order PDF Export Service
生成採購單 PDF
"""

import io
from datetime import datetime
from decimal import Decimal
from typing import Optional

from django.conf import settings
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Try to register Chinese font
try:
    pdfmetrics.registerFont(TTFont('MSYaHei', 'C:/Windows/Fonts/msyh.ttc'))
    CHINESE_FONT = 'MSYaHei'
except:
    CHINESE_FONT = 'Helvetica'


class POPDFExporter:
    """採購單 PDF 匯出器"""

    def __init__(self, purchase_order):
        self.po = purchase_order
        self.buffer = io.BytesIO()
        self.styles = getSampleStyleSheet()
        self._setup_styles()

    def _setup_styles(self):
        """設定樣式"""
        self.styles.add(ParagraphStyle(
            name='ChineseTitle',
            fontName=CHINESE_FONT,
            fontSize=18,
            leading=22,
            alignment=1,  # Center
            spaceAfter=12,
        ))
        self.styles.add(ParagraphStyle(
            name='ChineseNormal',
            fontName=CHINESE_FONT,
            fontSize=10,
            leading=14,
        ))
        self.styles.add(ParagraphStyle(
            name='ChineseSmall',
            fontName=CHINESE_FONT,
            fontSize=8,
            leading=10,
        ))

    def generate(self) -> bytes:
        """生成 PDF"""
        doc = SimpleDocTemplate(
            self.buffer,
            pagesize=A4,
            rightMargin=15*mm,
            leftMargin=15*mm,
            topMargin=15*mm,
            bottomMargin=15*mm,
        )

        elements = []

        # Header
        elements.extend(self._build_header())
        elements.append(Spacer(1, 10*mm))

        # PO Info
        elements.extend(self._build_po_info())
        elements.append(Spacer(1, 8*mm))

        # Supplier Info
        elements.extend(self._build_supplier_info())
        elements.append(Spacer(1, 8*mm))

        # Line Items Table
        elements.extend(self._build_items_table())
        elements.append(Spacer(1, 8*mm))

        # Summary
        elements.extend(self._build_summary())
        elements.append(Spacer(1, 10*mm))

        # Terms & Signature
        elements.extend(self._build_footer())

        doc.build(elements)
        self.buffer.seek(0)
        return self.buffer.getvalue()

    def _build_header(self):
        """建立標題"""
        elements = []

        # Company name and PO title
        title = Paragraph(
            f"<b>PURCHASE ORDER 採購單</b>",
            self.styles['ChineseTitle']
        )
        elements.append(title)

        # PO Number prominently displayed
        po_num = Paragraph(
            f"<b>{self.po.po_number}</b>",
            ParagraphStyle(
                name='PONumber',
                fontName=CHINESE_FONT,
                fontSize=14,
                alignment=1,
                textColor=colors.HexColor('#1e40af'),
            )
        )
        elements.append(po_num)

        return elements

    def _build_po_info(self):
        """建立 PO 資訊區塊"""
        elements = []

        po_type_display = "生產採購單" if self.po.po_type == 'production' else "詢價單"
        status_display = {
            'draft': '草稿',
            'sent': '已發送',
            'confirmed': '已確認',
            'partial_received': '部分收貨',
            'received': '已收貨',
            'cancelled': '已取消',
        }.get(self.po.status, self.po.status)

        data = [
            ['PO 類型 / Type:', po_type_display, 'PO 日期 / Date:', self.po.po_date.strftime('%Y-%m-%d')],
            ['狀態 / Status:', status_display, '預計交期 / Delivery:', self.po.expected_delivery.strftime('%Y-%m-%d')],
        ]

        table = Table(data, colWidths=[35*mm, 50*mm, 40*mm, 50*mm])
        table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), CHINESE_FONT),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#64748b')),
            ('TEXTCOLOR', (2, 0), (2, -1), colors.HexColor('#64748b')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
        ]))

        elements.append(table)
        return elements

    def _build_supplier_info(self):
        """建立供應商資訊區塊"""
        elements = []

        # Section title
        title = Paragraph(
            "<b>供應商資訊 / Supplier Information</b>",
            ParagraphStyle(
                name='SectionTitle',
                fontName=CHINESE_FONT,
                fontSize=11,
                textColor=colors.HexColor('#1e40af'),
                spaceAfter=4,
            )
        )
        elements.append(title)

        supplier = self.po.supplier
        supplier_info = [
            ['供應商名稱 / Name:', supplier.name if supplier else '-'],
            ['供應商代碼 / Code:', supplier.supplier_code if supplier else '-'],
            ['聯絡人 / Contact:', supplier.contact_person if supplier and supplier.contact_person else '-'],
            ['電話 / Phone:', supplier.phone if supplier and supplier.phone else '-'],
            ['Email:', supplier.email if supplier and supplier.email else '-'],
            ['地址 / Address:', supplier.address if supplier and supplier.address else '-'],
        ]

        table = Table(supplier_info, colWidths=[40*mm, 135*mm])
        table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), CHINESE_FONT),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#64748b')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ]))

        elements.append(table)
        return elements

    def _build_items_table(self):
        """建立物料明細表"""
        elements = []

        # Section title
        title = Paragraph(
            "<b>採購明細 / Order Items</b>",
            ParagraphStyle(
                name='SectionTitle',
                fontName=CHINESE_FONT,
                fontSize=11,
                textColor=colors.HexColor('#1e40af'),
                spaceAfter=4,
            )
        )
        elements.append(title)

        # Table header
        header = ['#', '物料名稱\nMaterial', '顏色\nColor', '數量\nQty', '單位\nUnit', '單價\nPrice', '小計\nTotal']

        # Table data
        data = [header]
        lines = self.po.lines.all()

        for idx, line in enumerate(lines, 1):
            material_text = line.material_name
            if hasattr(line, 'material') and line.material and line.material.name_zh:
                material_text = f"{line.material_name}\n{line.material.name_zh}"

            row = [
                str(idx),
                material_text,
                line.color or '-',
                f"{Decimal(line.quantity):,.2f}",
                line.unit,
                f"${Decimal(line.unit_price):,.2f}",
                f"${Decimal(line.line_total):,.2f}",
            ]
            data.append(row)

        # Column widths
        col_widths = [10*mm, 55*mm, 25*mm, 25*mm, 15*mm, 25*mm, 30*mm]

        table = Table(data, colWidths=col_widths)
        table.setStyle(TableStyle([
            # Font
            ('FONTNAME', (0, 0), (-1, -1), CHINESE_FONT),
            ('FONTSIZE', (0, 0), (-1, -1), 8),

            # Header style
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e40af')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('VALIGN', (0, 0), (-1, 0), 'MIDDLE'),

            # Data rows
            ('ALIGN', (0, 1), (0, -1), 'CENTER'),  # #
            ('ALIGN', (1, 1), (1, -1), 'LEFT'),    # Material
            ('ALIGN', (2, 1), (2, -1), 'CENTER'),  # Color
            ('ALIGN', (3, 1), (-1, -1), 'RIGHT'),  # Numbers right-aligned
            ('VALIGN', (0, 1), (-1, -1), 'MIDDLE'),

            # Borders
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#1e40af')),
            ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor('#1e40af')),
            ('LINEBELOW', (0, 1), (-1, -2), 0.5, colors.HexColor('#e2e8f0')),

            # Alternating row colors
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),

            # Padding
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ]))

        elements.append(table)
        return elements

    def _build_summary(self):
        """建立合計區塊"""
        elements = []

        lines_count = self.po.lines.count()
        total_qty = sum(Decimal(line.quantity) for line in self.po.lines.all())

        summary_data = [
            ['', '', '項目數 Items:', f'{lines_count}'],
            ['', '', '總數量 Total Qty:', f'{total_qty:,.2f}'],
            ['', '', '總金額 Total Amount:', f'${Decimal(self.po.total_amount):,.2f}'],
        ]

        table = Table(summary_data, colWidths=[60*mm, 45*mm, 40*mm, 40*mm])
        table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), CHINESE_FONT),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
            ('ALIGN', (3, 0), (3, -1), 'RIGHT'),
            ('TEXTCOLOR', (2, 0), (2, -1), colors.HexColor('#64748b')),
            ('FONTSIZE', (2, -1), (3, -1), 12),  # Total amount larger
            ('TEXTCOLOR', (3, -1), (3, -1), colors.HexColor('#1e40af')),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))

        elements.append(table)
        return elements

    def _build_footer(self):
        """建立頁尾（條款與簽名）"""
        elements = []

        # Notes
        if self.po.notes:
            notes_title = Paragraph(
                "<b>備註 / Notes:</b>",
                ParagraphStyle(name='NotesTitle', fontName=CHINESE_FONT, fontSize=9, textColor=colors.HexColor('#64748b'))
            )
            elements.append(notes_title)
            elements.append(Spacer(1, 2*mm))

            notes_text = Paragraph(
                self.po.notes,
                ParagraphStyle(name='NotesText', fontName=CHINESE_FONT, fontSize=9)
            )
            elements.append(notes_text)
            elements.append(Spacer(1, 8*mm))

        # Terms
        terms = Paragraph(
            "<b>條款 / Terms:</b><br/>"
            "1. 請依據上述規格及數量準備物料<br/>"
            "2. 交貨時請附上送貨單及發票<br/>"
            "3. 如有任何問題請立即聯繫採購部門",
            ParagraphStyle(name='Terms', fontName=CHINESE_FONT, fontSize=8, leading=12, textColor=colors.HexColor('#64748b'))
        )
        elements.append(terms)
        elements.append(Spacer(1, 15*mm))

        # Signature lines
        sig_data = [
            ['採購人員 / Buyer:', '_' * 25, '日期 / Date:', '_' * 15],
            ['', '', '', ''],
            ['供應商確認 / Supplier:', '_' * 25, '日期 / Date:', '_' * 15],
        ]

        table = Table(sig_data, colWidths=[40*mm, 55*mm, 30*mm, 40*mm])
        table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), CHINESE_FONT),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#64748b')),
            ('TEXTCOLOR', (2, 0), (2, -1), colors.HexColor('#64748b')),
            ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]))

        elements.append(table)

        # Generated timestamp
        elements.append(Spacer(1, 10*mm))
        timestamp = Paragraph(
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            ParagraphStyle(name='Timestamp', fontName='Helvetica', fontSize=7, textColor=colors.HexColor('#94a3b8'), alignment=2)
        )
        elements.append(timestamp)

        return elements


def export_po_pdf(purchase_order) -> bytes:
    """匯出採購單 PDF"""
    exporter = POPDFExporter(purchase_order)
    return exporter.generate()
