"""Check BOM import quality"""

from django.core.management.base import BaseCommand
from apps.styles.models import Style, StyleRevision, BOMItem
from collections import Counter


class Command(BaseCommand):
    help = 'Check BOM import data quality'

    def handle(self, *args, **options):
        # 使用 .last() 取得最新的記錄
        style = Style.objects.filter(style_number='LW1FLWS').last()
        if not style:
            self.stdout.write(self.style.ERROR('❌ 找不到 Style LW1FLWS'))
            return

        rev = StyleRevision.objects.filter(style=style, revision_label='Rev A').last()
        if not rev:
            self.stdout.write(self.style.ERROR('❌ 找不到 Revision Rev A'))
            return

        items = BOMItem.objects.filter(revision=rev).order_by('category', 'item_number')

        self.stdout.write(f'\n總共：{items.count()} 筆 BOM items\n')

        # 按類別統計
        by_category = Counter([item.category for item in items])
        self.stdout.write('📊 按類別統計：')
        for cat, count in by_category.items():
            self.stdout.write(f'  {cat}: {count}')

        # 檢查有 consumption 的項目
        with_cons = items.exclude(consumption__isnull=True).exclude(consumption=0)
        no_cons = items.filter(consumption__isnull=True) | items.filter(consumption=0)
        self.stdout.write(f'\n✅ 有用量（consumption）：{with_cons.count()} 筆')
        self.stdout.write(f'❌ 無用量（consumption）：{no_cons.count()} 筆')

        # 顯示所有有效項目
        self.stdout.write(f'\n所有有用量的項目：')
        for item in with_cons:
            cons = f'{item.consumption} {item.unit}' if item.consumption else 'N/A'
            price = f'${item.unit_price}' if item.unit_price else 'N/A'
            self.stdout.write(
                f'{item.item_number:2d}. [{item.category:10s}] {item.material_name[:40]:40s} | '
                f'{cons:15s} | {price:8s}'
            )

        # 顯示無效項目（前 10 筆）
        self.stdout.write(f'\n無用量的項目（前 10 筆）：')
        for item in no_cons[:10]:
            self.stdout.write(
                f'{item.item_number:2d}. [{item.category:10s}] {item.material_name[:60]:60s}'
            )
