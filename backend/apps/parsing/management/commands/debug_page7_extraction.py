"""
Django management command: Debug Page 7 原始提取
"""

from django.core.management.base import BaseCommand
from apps.parsing.models_blocks import Revision
import pdfplumber


class Command(BaseCommand):
    help = 'Debug Page 7 raw extraction'

    def handle(self, *args, **options):
        revision_id = 'd3be25b0-01e5-4e3d-afe8-ca9578f1ebb2'
        revision = Revision.objects.get(id=revision_id)
        pdf_path = revision.file.path

        self.stdout.write("📄 Page 7 原始文字提取（未過濾）")
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

            self.stdout.write(f"總共提取: {len(words)} words")
            self.stdout.write("")

            # 搜索包含關鍵字的 words
            keywords = ['5.5', 'from', 'mid', 'logo', 'CB', '1.5', 'UP', 'HEM', 'SIZE', 'M', 'ONLY']

            relevant_words = []
            for w in words:
                text = w['text'].strip()
                for kw in keywords:
                    if kw.lower() in text.lower():
                        relevant_words.append(w)
                        break

            # 按 Y 座標排序
            relevant_words.sort(key=lambda w: (w['top'], w['x0']))

            self.stdout.write(f"包含關鍵字的 words: {len(relevant_words)}")
            self.stdout.write("")

            for i, w in enumerate(relevant_words, 1):
                self.stdout.write(f"{i:2d}. Y={w['top']:6.1f} X={w['x0']:6.1f} | {w['text']}")
