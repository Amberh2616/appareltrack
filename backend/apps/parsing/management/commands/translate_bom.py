"""
Translate BOM items (material_name → material_name_zh)

Usage:
    python manage.py translate_bom           # 翻译所有未翻译的
    python manage.py translate_bom --force   # 强制重新翻译全部
    python manage.py translate_bom --dry-run # 预览不执行
"""

from django.core.management.base import BaseCommand
from apps.styles.models import BOMItem
from apps.parsing.services.bom_translator import translate_bom_items


class Command(BaseCommand):
    help = 'Translate BOM items material_name to Chinese'

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

        # 统计
        total = BOMItem.objects.count()
        empty_zh = BOMItem.objects.filter(material_name_zh='').count()

        self.stdout.write(f'\n📊 BOM 统计:')
        self.stdout.write(f'   总数: {total}')
        self.stdout.write(f'   未翻译: {empty_zh}')

        if dry_run:
            # 预览
            self.stdout.write(f'\n🔍 预览模式 (--dry-run)')

            unique_names = BOMItem.objects.filter(
                material_name_zh=''
            ).values_list('material_name', flat=True).distinct()

            self.stdout.write(f'\n需要翻译的唯一物料名 ({len(set(unique_names))} 个):')
            for name in set(unique_names):
                self.stdout.write(f'   - {name}')

            return

        # 执行翻译
        self.stdout.write(f'\n🚀 开始翻译...')

        result = translate_bom_items(revision_id=revision_id, force=force)

        self.stdout.write(f'\n✅ 翻译完成:')
        self.stdout.write(f'   已翻译: {result["translated"]}')
        self.stdout.write(f'   跳过: {result["skipped"]}')

        if result.get('errors'):
            self.stdout.write(f'\n❌ 错误:')
            for err in result['errors']:
                self.stdout.write(f'   - {err}')

        if result.get('translation_map'):
            self.stdout.write(f'\n📝 翻译结果:')
            for en, zh in result['translation_map'].items():
                self.stdout.write(f'   {en} → {zh}')
