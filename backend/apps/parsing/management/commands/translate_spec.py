"""
Translate Measurement items (point_name → point_name_zh)

Usage:
    python manage.py translate_spec           # 翻譯所有未翻譯的
    python manage.py translate_spec --force   # 強制重新翻譯全部
    python manage.py translate_spec --dry-run # 預覽不執行
"""

from django.core.management.base import BaseCommand
from apps.styles.models import Measurement
from apps.parsing.services.measurement_translator import translate_measurements


class Command(BaseCommand):
    help = 'Translate Measurement point_name to Chinese'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force re-translate all items (even if already translated)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview without executing'
        )
        parser.add_argument(
            '--revision',
            type=str,
            help='Only translate specific revision ID'
        )

    def handle(self, *args, **options):
        force = options['force']
        dry_run = options['dry_run']
        revision_id = options.get('revision')

        # 統計
        total = Measurement.objects.count()
        empty_zh = Measurement.objects.filter(point_name_zh='').count()

        self.stdout.write(f'\n📊 Measurement 統計:')
        self.stdout.write(f'   總數: {total}')
        self.stdout.write(f'   未翻譯: {empty_zh}')

        if dry_run:
            # 預覽
            self.stdout.write(f'\n🔍 預覽模式 (--dry-run)')

            unique_names = Measurement.objects.filter(
                point_name_zh=''
            ).values_list('point_name', flat=True).distinct()

            self.stdout.write(f'\n需要翻譯的唯一尺寸點名 ({len(set(unique_names))} 個):')
            for name in set(unique_names):
                self.stdout.write(f'   - {name}')

            return

        # 執行翻譯
        self.stdout.write(f'\n🚀 開始翻譯...')

        result = translate_measurements(revision_id=revision_id, force=force)

        self.stdout.write(f'\n✅ 翻譯完成:')
        self.stdout.write(f'   已翻譯: {result["translated"]}')
        self.stdout.write(f'   跳過: {result["skipped"]}')

        if result.get('errors'):
            self.stdout.write(f'\n❌ 錯誤:')
            for err in result['errors']:
                self.stdout.write(f'   - {err}')

        if result.get('translation_map'):
            self.stdout.write(f'\n📝 翻譯結果:')
            for en, zh in result['translation_map'].items():
                self.stdout.write(f'   {en} → {zh}')
