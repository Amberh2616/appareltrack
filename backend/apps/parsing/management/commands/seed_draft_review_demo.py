"""
Django Management Command - Seed Draft Review Demo Data

建立測試數據：
- 1 個 Revision (LW1FLPS)
- 1 個 RevisionPage (Page 4)
- 9 個 DraftBlock (基於真實 Page 4 parse 結果)

用法：
python manage.py seed_draft_review_demo
"""

from django.core.management.base import BaseCommand
from apps.parsing.models_blocks import Revision, RevisionPage, DraftBlock


class Command(BaseCommand):
    help = 'Seed Draft Review demo data (LW1FLPS Page 4)'

    def handle(self, *args, **options):
        self.stdout.write('Creating Draft Review demo data...')

        # 清空舊數據
        DraftBlock.objects.all().delete()
        RevisionPage.objects.all().delete()
        Revision.objects.all().delete()

        # 建立 Revision
        revision = Revision.objects.create(
            filename="LW1FLPS-Nulu-Cami-Tank.pdf",
            page_count=7,
            status="parsed"
        )
        self.stdout.write(f'✓ Created Revision: {revision.id}')

        # 建立 RevisionPage (Page 4)
        page = RevisionPage.objects.create(
            revision=revision,
            page_number=4,
            width=612,
            height=792
        )
        self.stdout.write(f'✓ Created Page 4')

        # 建立 9 個 DraftBlock（基於真實 parse 結果）
        blocks_data = [
            {
                "block_type": "callout",
                "bbox": {"x": 90, "y": 115, "width": 324, "height": 35},
                "source_text": "領圍/袖襬肩帶：-加包邊壓1/8\"三本雙針-加QQ帶",
                "translated_text": "領圍/袖襬肩帶：-加包邊壓1/8\"三本雙針-加QQ帶"
            },
            {
                "block_type": "callout",
                "bbox": {"x": 88, "y": 255, "width": 310, "height": 38},
                "source_text": "binding with encased elastic + topstitch",
                "translated_text": "包邊內包鬆緊帶並加上表面壓線"
            },
            {
                "block_type": "callout",
                "bbox": {"x": 90, "y": 305, "width": 260, "height": 32},
                "source_text": "shelf bra elastic encased in L2",
                "translated_text": "內建胸罩鬆緊帶包覆於L2層"
            },
            {
                "block_type": "callout",
                "bbox": {"x": 90, "y": 350, "width": 190, "height": 28},
                "source_text": "內裡層：見細節圖",
                "translated_text": "內裡層：見細節圖"
            },
            {
                "block_type": "callout",
                "bbox": {"x": 90, "y": 158, "width": 88, "height": 28},
                "source_text": "內裡層見細節圖",
                "translated_text": "內裡層見細節圖"
            },
            {
                "block_type": "callout",
                "bbox": {"x": 90, "y": 200, "width": 220, "height": 32},
                "source_text": "binding encased in L2",
                "translated_text": "包邊包覆於L2層"
            },
            {
                "block_type": "callout",
                "bbox": {"x": 360, "y": 285, "width": 200, "height": 30},
                "source_text": "L1 / L2 tack together",
                "translated_text": "L1/L2層固定縫合"
            },
            {
                "block_type": "section_title",
                "bbox": {"x": 385, "y": 340, "width": 170, "height": 32},
                "source_text": "INSIDE BRA VIEW",
                "translated_text": "內建胸罩內部視圖"
            },
            {
                "block_type": "callout",
                "bbox": {"x": 360, "y": 510, "width": 220, "height": 85},
                "source_text": "bra elastic encased in L2\nunderband join seam lines up with wearer's left shelf bra side seam",
                "translated_text": "胸罩鬆緊帶包覆於L2層\n下圍接縫線與穿著者左側內建胸罩側縫對齊"
            },
        ]

        for i, data in enumerate(blocks_data, 1):
            block = DraftBlock.objects.create(
                page=page,
                block_type=data["block_type"],
                bbox_x=data["bbox"]["x"],
                bbox_y=data["bbox"]["y"],
                bbox_width=data["bbox"]["width"],
                bbox_height=data["bbox"]["height"],
                source_text=data["source_text"],
                translated_text=data["translated_text"],
                status="auto"
            )
            self.stdout.write(f'  ✓ Block #{i}: {data["block_type"]} - {data["source_text"][:40]}...')

        self.stdout.write(self.style.SUCCESS(f'\n✅ Demo data created successfully!'))
        self.stdout.write(f'Revision ID: {revision.id}')
        self.stdout.write(f'Total blocks: {DraftBlock.objects.count()}')
        self.stdout.write(f'\nTest API:')
        self.stdout.write(f'  GET http://127.0.0.1:8000/api/v2/revisions/{revision.id}/')
