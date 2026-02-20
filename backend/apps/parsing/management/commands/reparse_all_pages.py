"""
Django management command: 重新解析所有頁面並比較結果
Usage: python manage.py reparse_all_pages <revision_id>
"""

from django.core.management.base import BaseCommand
from apps.parsing.models_blocks import Revision, RevisionPage, DraftBlock
import pdfplumber
from apps.parsing.utils.pdf import normalize_bbox
from apps.parsing.utils.text_merger import smart_merge_words
from apps.parsing.tasks.parse_page4 import is_callout_text
from django.db import transaction


class Command(BaseCommand):
    help = 'Re-parse all pages and compare results'

    def add_arguments(self, parser):
        parser.add_argument(
            '--revision-id',
            type=str,
            default='d3be25b0-01e5-4e3d-afe8-ca9578f1ebb2',
            help='Revision UUID to re-parse'
        )

    def handle(self, *args, **options):
        revision_id = options['revision_id']

        # 1️⃣ 記錄舊的 block 數量
        old_counts = {}
        pages = RevisionPage.objects.filter(revision_id=revision_id)
        for page in pages:
            old_counts[page.page_number] = DraftBlock.objects.filter(page=page).count()

        total_old = sum(old_counts.values())
        self.stdout.write(f"\n📊 舊 block 數量:")
        for page_num in sorted(old_counts.keys()):
            self.stdout.write(f"  Page {page_num}: {old_counts[page_num]}")
        self.stdout.write(f"  總計: {total_old} blocks\n")

        # 2️⃣ 重新解析所有頁面
        revision = Revision.objects.get(id=revision_id)
        pdf_path = revision.file.path

        self.stdout.write(f"🚀 Re-parsing: {revision.filename}")

        with pdfplumber.open(pdf_path) as pdf:
            for i in range(len(pdf.pages)):
                page_num = i + 1
                self.stdout.write(f"  Parsing page {page_num}...")

                page_obj, created = RevisionPage.objects.get_or_create(
                    revision=revision,
                    page_number=page_num
                )

                page = pdf.pages[i]

                # 擷取 words
                words = page.extract_words(
                    use_text_flow=False,
                    keep_blank_chars=False,
                    x_tolerance=2,
                    y_tolerance=2,
                )

                # 過濾
                filtered_words = []
                for w in words:
                    text = w['text'].strip()
                    if not is_callout_text(text, w, page.width):
                        continue
                    filtered_words.append(w)

                # 排序
                filtered_words.sort(key=lambda w: (w['top'], w['x0']))

                # 使用新的智能合併
                merged_callouts = smart_merge_words(filtered_words)

                # 寫入 DB
                with transaction.atomic():
                    DraftBlock.objects.filter(page=page_obj).delete()
                    for item in merged_callouts:
                        bbox = normalize_bbox(
                            x0=item['x0'],
                            y0=item['top'],
                            x1=item['x1'],
                            y1=item['bottom'],
                        )
                        DraftBlock.objects.create(
                            page=page_obj,
                            source_text=item['text'],
                            bbox_x=bbox['x'],
                            bbox_y=bbox['y'],
                            bbox_width=bbox['width'],
                            bbox_height=bbox['height'],
                        )

                self.stdout.write(f"    ✓ {len(merged_callouts)} blocks")

        # 3️⃣ 比較結果
        new_counts = {}
        pages = RevisionPage.objects.filter(revision_id=revision_id)
        for page in pages:
            new_counts[page.page_number] = DraftBlock.objects.filter(page=page).count()

        total_new = sum(new_counts.values())

        self.stdout.write(f"\n📊 新 block 數量:")
        for page_num in sorted(new_counts.keys()):
            self.stdout.write(f"  Page {page_num}: {new_counts[page_num]}")
        self.stdout.write(f"  總計: {total_new} blocks\n")

        # 4️⃣ 改進比較
        self.stdout.write("\n📈 改進比較:")
        for page_num in sorted(new_counts.keys()):
            old = old_counts.get(page_num, 0)
            new = new_counts[page_num]
            change = new - old
            sign = "+" if change > 0 else ""
            self.stdout.write(f"  Page {page_num}: {old} → {new} ({sign}{change})")

        total_change = total_new - total_old
        sign = "+" if total_change > 0 else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"\n🎯 總結: {total_old} → {total_new} blocks ({sign}{total_change})"
            )
        )
