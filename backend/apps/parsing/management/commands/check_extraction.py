"""
Django management command: 檢查提取結果
"""

from django.core.management.base import BaseCommand
from apps.parsing.models import UploadedDocument
from apps.styles.models import Style, StyleRevision, BOMItem, Measurement
from apps.parsing.models_blocks import Revision, DraftBlock


class Command(BaseCommand):
    help = 'Check extraction results for latest uploaded document'

    def add_arguments(self, parser):
        parser.add_argument(
            '--doc-id',
            type=str,
            help='Document ID to check (optional, defaults to latest)'
        )

    def handle(self, *args, **options):
        # Get document
        if options['doc_id']:
            try:
                doc = UploadedDocument.objects.get(id=options['doc_id'])
            except UploadedDocument.DoesNotExist:
                self.stdout.write(self.style.ERROR(f"Document {options['doc_id']} not found"))
                return
        else:
            doc = UploadedDocument.objects.order_by('-created_at').first()
            if not doc:
                self.stdout.write(self.style.ERROR("No documents found"))
                return

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("=" * 80))
        self.stdout.write(self.style.SUCCESS(f"  Extraction Results: {doc.filename}"))
        self.stdout.write(self.style.SUCCESS("=" * 80))
        self.stdout.write("")

        # Document info
        self.stdout.write(self.style.HTTP_INFO("📄 Document Info:"))
        self.stdout.write(f"  ID: {doc.id}")
        self.stdout.write(f"  Filename: {doc.filename}")
        self.stdout.write(f"  Status: {doc.status}")
        self.stdout.write(f"  File Type: {classification.get('file_type', 'N/A') if (classification := doc.classification_result) else 'N/A'}")
        self.stdout.write("")

        # Check if extracted
        if doc.status != 'extracted':
            self.stdout.write(self.style.WARNING(f"⚠️  Document status is '{doc.status}', not 'extracted'"))
            return

        # Get style revision
        style_revision = doc.style_revision
        if not style_revision:
            self.stdout.write(self.style.ERROR("❌ No StyleRevision linked"))
            return

        style = style_revision.style
        self.stdout.write(self.style.HTTP_INFO("👔 Style:"))
        self.stdout.write(f"  Style Number: {style.style_number}")
        self.stdout.write(f"  Style Name: {style.style_name}")
        self.stdout.write(f"  Revision: {style_revision.revision_label}")
        self.stdout.write("")

        # Check DraftBlocks (Tech Pack annotations)
        tech_pack_revision = Revision.objects.filter(filename=doc.filename).first()
        if tech_pack_revision:
            draft_blocks = DraftBlock.objects.filter(page__revision=tech_pack_revision)
            self.stdout.write(self.style.HTTP_INFO("📝 Tech Pack Annotations (DraftBlocks):"))
            self.stdout.write(f"  Total blocks: {draft_blocks.count()}")
            if draft_blocks.exists():
                self.stdout.write(f"  Sample (first 3):")
                for block in draft_blocks[:3]:
                    self.stdout.write(f"    • EN: {block.source_text[:50]}...")
                    self.stdout.write(f"      ZH: {block.translated_text[:50] if block.translated_text else '(no translation)'}...")
        else:
            self.stdout.write(self.style.WARNING("  ⚠️  No TechPackRevision found"))
        self.stdout.write("")

        # Check BOMItems
        bom_items = BOMItem.objects.filter(revision=style_revision)
        self.stdout.write(self.style.HTTP_INFO("🧵 BOM Items:"))
        self.stdout.write(f"  Total items: {bom_items.count()}")
        if bom_items.exists():
            self.stdout.write(f"  Sample (first 3):")
            for item in bom_items[:3]:
                self.stdout.write(f"    {item.item_number}. {item.material_name}")
                if item.material_name_zh:
                    self.stdout.write(f"       ZH: {item.material_name_zh}")
                else:
                    self.stdout.write(f"       ZH: (no translation)")
                self.stdout.write(f"       Supplier: {item.supplier}")
                self.stdout.write(f"       Verified: {'✅' if item.is_verified else '❌'}")
        self.stdout.write("")

        # Check Measurements
        measurements = Measurement.objects.filter(revision=style_revision)
        self.stdout.write(self.style.HTTP_INFO("📏 Measurements:"))
        self.stdout.write(f"  Total points: {measurements.count()}")
        if measurements.exists():
            self.stdout.write(f"  Sample (first 3):")
            for m in measurements[:3]:
                self.stdout.write(f"    • {m.point_name}")
                if m.point_name_zh:
                    self.stdout.write(f"      ZH: {m.point_name_zh}")
                else:
                    self.stdout.write(f"      ZH: (no translation)")
                self.stdout.write(f"      Values: {list(m.values.keys())}")
                self.stdout.write(f"      Verified: {'✅' if m.is_verified else '❌'}")
        self.stdout.write("")

        # Summary
        self.stdout.write(self.style.SUCCESS("=" * 80))
        self.stdout.write(self.style.SUCCESS("  Summary:"))
        self.stdout.write(self.style.SUCCESS("=" * 80))
        self.stdout.write(f"  ✅ Style & StyleRevision: Created")
        self.stdout.write(f"  {'✅' if tech_pack_revision and draft_blocks.exists() else '❌'} Tech Pack Annotations: {draft_blocks.count() if tech_pack_revision else 0} blocks")
        self.stdout.write(f"  {'✅' if bom_items.exists() else '❌'} BOM Items: {bom_items.count()} items")
        self.stdout.write(f"  {'✅' if measurements.exists() else '❌'} Measurements: {measurements.count()} points")
        self.stdout.write("")
