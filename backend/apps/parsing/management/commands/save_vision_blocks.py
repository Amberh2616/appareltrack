"""
Django management command: 保存 Vision 提取的文字到數據庫
"""

from django.core.management.base import BaseCommand
from apps.parsing.models_blocks import Revision, RevisionPage, DraftBlock
from apps.parsing.utils.vision_extract import extract_text_from_pdf_page_vision
from apps.parsing.utils.translate import machine_translate
from django.db import transaction


class Command(BaseCommand):
    help = 'Save Vision-extracted blocks to database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--page',
            type=int,
            default=7,
            help='Page number to process'
        )

    def handle(self, *args, **options):
        revision_id = 'd3be25b0-01e5-4e3d-afe8-ca9578f1ebb2'
        page_num = options['page']

        revision = Revision.objects.get(id=revision_id)
        pdf_path = revision.file.path

        self.stdout.write(f"\n🔍 提取 Page {page_num} Vision 文字...")

        # 提取
        extracted = extract_text_from_pdf_page_vision(pdf_path, page_number=page_num)

        self.stdout.write(f"✅ 提取到 {len(extracted)} 個文字塊")
        self.stdout.write("")

        # 獲取或創建頁面
        page_obj, created = RevisionPage.objects.get_or_create(
            revision=revision,
            page_number=page_num
        )

        # 獲取現有 blocks（pdfplumber 提取的）
        existing_texts = set(
            DraftBlock.objects.filter(page=page_obj).values_list('source_text', flat=True)
        )

        self.stdout.write(f"📊 現有 blocks: {len(existing_texts)}")
        self.stdout.write("")

        # 保存新的 Vision blocks
        added_count = 0
        skipped_count = 0

        with transaction.atomic():
            for i, block in enumerate(extracted, 1):
                text = block.get('text', '').strip()
                block_type = block.get('type', 'unknown')

                # 跳過已存在的（避免重複）
                if text in existing_texts or not text:
                    skipped_count += 1
                    continue

                # 翻譯
                try:
                    translation = machine_translate(text)
                except Exception as e:
                    self.stdout.write(f"⚠️  翻譯失敗: {text[:40]} - {e}")
                    translation = ""

                # 創建 DraftBlock（沒有 bbox，因為 Vision 無法提供精確座標）
                # 使用 bbox_y = 1000 + i 來排序（放在頁面底部）
                DraftBlock.objects.create(
                    page=page_obj,
                    source_text=text,
                    translated_text=translation,
                    bbox_x=0,
                    bbox_y=1000 + i,  # 虛擬 Y 座標，確保排序
                    bbox_width=100,
                    bbox_height=10,
                )

                added_count += 1
                self.stdout.write(f"✅ {i:2d}. [{block_type:10s}] {text[:50]}")
                self.stdout.write(f"       → {translation[:50]}")
                self.stdout.write("")

        self.stdout.write(
            self.style.SUCCESS(
                f"\n🎯 完成！新增 {added_count} 個 Vision blocks, 跳過 {skipped_count} 個重複"
            )
        )

        # 最終統計
        total = DraftBlock.objects.filter(page=page_obj).count()
        self.stdout.write(f"📊 Page {page_num} 總計: {total} blocks")
