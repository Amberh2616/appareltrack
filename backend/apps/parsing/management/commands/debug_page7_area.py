"""
Django management command: Debug Page 7 specific area
"""

from django.core.management.base import BaseCommand
from apps.parsing.models_blocks import Revision
import pdfplumber


class Command(BaseCommand):
    help = 'Debug Page 7 specific area around dimension annotations'

    def handle(self, *args, **options):
        revision_id = 'd3be25b0-01e5-4e3d-afe8-ca9578f1ebb2'
        revision = Revision.objects.get(id=revision_id)
        pdf_path = revision.file.path

        self.stdout.write("📄 Page 7 - 尺寸標註區域（Y=220-260）")
        self.stdout.write("")

        with pdfplumber.open(pdf_path) as pdf:
            page = pdf.pages[6]  # Page 7 (0-indexed)

            # 提取所有 words
            words = page.extract_words(
                use_text_flow=False,
                keep_blank_chars=False,
                x_tolerance=2,
                y_tolerance=2,
            )

            # 篩選 Y=220-260 範圍的 words
            area_words = [w for w in words if 220 <= w['top'] <= 260]

            # 按 Y, X 排序
            area_words.sort(key=lambda w: (w['top'], w['x0']))

            self.stdout.write(f"區域內文字: {len(area_words)} words")
            self.stdout.write("")

            for i, w in enumerate(area_words, 1):
                self.stdout.write(
                    f"{i:2d}. Y={w['top']:6.1f} X={w['x0']:6.1f}-{w['x1']:6.1f} | {w['text']}"
                )

            # 再看 Y=180-200 範圍（CB/CF 區域）
            self.stdout.write("\n📄 Page 7 - CF/CB 區域（Y=180-200）")
            self.stdout.write("")

            cb_area = [w for w in words if 180 <= w['top'] <= 200]
            cb_area.sort(key=lambda w: (w['top'], w['x0']))

            for i, w in enumerate(cb_area, 1):
                self.stdout.write(
                    f"{i:2d}. Y={w['top']:6.1f} X={w['x0']:6.1f}-{w['x1']:6.1f} | {w['text']}"
                )
