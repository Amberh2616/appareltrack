"""
Django management command: 批次翻譯所有缺失的 blocks
Usage: python manage.py batch_translate <revision_id>
"""

from django.core.management.base import BaseCommand
from apps.parsing.models_blocks import Revision, RevisionPage, DraftBlock
from apps.parsing.utils.translate import machine_translate
from django.db import transaction


class Command(BaseCommand):
    help = 'Batch translate all missing blocks for a revision'

    def add_arguments(self, parser):
        parser.add_argument(
            '--revision-id',
            type=str,
            default='d3be25b0-01e5-4e3d-afe8-ca9578f1ebb2',
            help='Revision UUID to translate'
        )

    def handle(self, *args, **options):
        revision_id = options['revision_id']

        revision = Revision.objects.get(id=revision_id)
        self.stdout.write(f"\n🌐 批次翻譯: {revision.filename}")

        # 找出所有缺翻譯的 blocks
        pages = RevisionPage.objects.filter(revision=revision).order_by('page_number')

        total_blocks = 0
        total_translated = 0
        total_skipped = 0
        total_failed = 0

        for page in pages:
            blocks = DraftBlock.objects.filter(page=page).order_by('bbox_y', 'bbox_x')

            if blocks.count() == 0:
                continue

            self.stdout.write(f"\n📄 Page {page.page_number}: {blocks.count()} blocks")

            for i, block in enumerate(blocks, 1):
                total_blocks += 1

                # 已有翻譯，跳過
                if block.translated_text:
                    total_skipped += 1
                    continue

                # 翻譯
                try:
                    self.stdout.write(f"  {i:2d}. Translating: {block.source_text[:50]}...")

                    translated = machine_translate(block.source_text)

                    # 更新 DB
                    block.translated_text = translated
                    block.save(update_fields=['translated_text'])

                    total_translated += 1
                    self.stdout.write(f"      → {translated[:50]}...")

                except Exception as e:
                    total_failed += 1
                    self.stdout.write(
                        self.style.ERROR(f"      ✗ Failed: {str(e)}")
                    )

        # 統計
        self.stdout.write(
            self.style.SUCCESS(
                f"\n✅ 完成！總計 {total_blocks} blocks："
            )
        )
        self.stdout.write(f"  - 新翻譯: {total_translated}")
        self.stdout.write(f"  - 已存在: {total_skipped}")
        self.stdout.write(f"  - 失敗: {total_failed}")
