"""
Management command to create test Revision with sample data
"""

from django.core.management.base import BaseCommand
from django.core.files.base import ContentFile
from apps.parsing.models_blocks import Revision, RevisionPage, DraftBlock
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import io


class Command(BaseCommand):
    help = 'Create test Revision with mock PDF for Phase 3 UI verification'

    def handle(self, *args, **options):
        # Generate a simple PDF with text
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=letter)
        width, height = letter

        # Page 1
        p.drawString(100, height - 100, "Fashion Production System - Test Tech Pack")
        p.drawString(100, height - 150, "Page 1: Overview")
        p.showPage()

        # Page 2
        p.drawString(100, height - 100, "Page 2: Materials")
        p.showPage()

        # Page 3
        p.drawString(100, height - 100, "Page 3: Construction")
        p.showPage()

        # Page 4 - This is what we'll parse
        p.drawString(100, height - 100, "FRONT / INSIDE BRA VIEW")
        p.drawString(100, height - 150, "Test callout 1")
        p.drawString(300, height - 200, "Test callout 2")
        p.drawString(100, height - 250, "Test callout 3")
        p.showPage()

        p.save()
        buffer.seek(0)

        # Create Revision
        revision = Revision.objects.create(
            filename="test-techpack.pdf",
            page_count=4,
            status="pending"
        )

        # Save PDF file
        revision.file.save(
            "test-techpack.pdf",
            ContentFile(buffer.read()),
            save=True
        )

        # Create Page 4
        page4 = RevisionPage.objects.create(
            revision=revision,
            page_number=4,
            width=612,  # letter width in points
            height=792,  # letter height in points
        )

        # Create sample DraftBlocks (simulating parsed data)
        blocks_data = [
            {
                "block_type": "callout",
                "bbox_x": 100,
                "bbox_y": 100,
                "bbox_width": 200,
                "bbox_height": 20,
                "source_text": "FRONT / INSIDE BRA VIEW",
                "translated_text": "前視圖 / 內側文胸視圖",
            },
            {
                "block_type": "callout",
                "bbox_x": 100,
                "bbox_y": 150,
                "bbox_width": 150,
                "bbox_height": 20,
                "source_text": "Test callout 1",
                "translated_text": "測試標註 1",
            },
            {
                "block_type": "callout",
                "bbox_x": 300,
                "bbox_y": 200,
                "bbox_width": 150,
                "bbox_height": 20,
                "source_text": "Test callout 2",
                "translated_text": "測試標註 2",
            },
            {
                "block_type": "callout",
                "bbox_x": 100,
                "bbox_y": 250,
                "bbox_width": 150,
                "bbox_height": 20,
                "source_text": "Test callout 3",
                "translated_text": "測試標註 3",
            },
        ]

        for data in blocks_data:
            DraftBlock.objects.create(
                page=page4,
                **data
            )

        self.stdout.write(
            self.style.SUCCESS(
                f'✅ Test Revision created: {revision.id}\n'
                f'   File URL: /media/{revision.file.name}\n'
                f'   Page 4 blocks: {page4.blocks.count()}'
            )
        )

        return str(revision.id)
