"""
Import BOM from multiple Tech Pack PDFs
Supports: LM7B24S, LM7BPSS (and similar Sabrina Fashion format)
"""

from django.core.management.base import BaseCommand
from apps.core.models import Organization
from apps.styles.models import Style, StyleRevision, BOMItem
from decimal import Decimal
import pdfplumber


class Command(BaseCommand):
    help = 'Import BOM from multiple Tech Pack PDFs'

    def add_arguments(self, parser):
        parser.add_argument(
            '--style',
            type=str,
            help='Style number to import (e.g., LM7B24S). If not specified, imports all available.',
        )

    def handle(self, *args, **options):
        # Define BOM PDF mappings
        BOM_PDFS = {
            'LM7B24S': {
                'path': 'demo_data/techpacks/Winter2025_PaceBreakerShort7LinedLM7B24S_SabrinaFashionIndustrialCorporation_2024-Jun17-1127.pdf',
                'style_name': 'Pace Breaker Short 7" Lined',
                'season': 'WI25',
                'customer': 'Lululemon',
                'pages': [1, 2, 3],  # 0-indexed: pages 2, 3, 4
            },
            'LM7BPSS': {
                'path': 'demo_data/techpacks/Winter2025_WI25ZEROEDIN5LLSPECIALEDITIONCRINKLELM7BPSS_SabrinaFashionIndustrialCorporation_2024-Jun13-1627.pdf',
                'style_name': 'Zeroed In 5" LL Special Edition Crinkle',
                'season': 'WI25',
                'customer': 'Lululemon',
                'pages': [1, 2, 3],  # 0-indexed: pages 2, 3, 4
            },
        }

        # Filter by style if specified
        target_style = options.get('style')
        if target_style:
            if target_style not in BOM_PDFS:
                self.stdout.write(self.style.ERROR(f'❌ Unknown style: {target_style}'))
                self.stdout.write(f'Available styles: {", ".join(BOM_PDFS.keys())}')
                return
            styles_to_import = {target_style: BOM_PDFS[target_style]}
        else:
            styles_to_import = BOM_PDFS

        # Get organization
        org = Organization.objects.first()
        if not org:
            self.stdout.write(self.style.ERROR('❌ No organization found'))
            return

        self.stdout.write(f'\n📦 Organization: {org.name}')
        self.stdout.write(f'📋 Importing {len(styles_to_import)} style(s)\n')

        # Import each style
        for style_number, config in styles_to_import.items():
            self.import_style_bom(org, style_number, config)

        self.stdout.write('\n' + '='*70)
        self.stdout.write(self.style.SUCCESS('✅ All BOM imports completed'))
        self.stdout.write('')

    def import_style_bom(self, org, style_number, config):
        """Import BOM for a single style"""
        self.stdout.write(f'\n{"="*70}')
        self.stdout.write(f'📄 Importing BOM for: {style_number}')
        self.stdout.write(f'   Name: {config["style_name"]}')
        self.stdout.write(f'   PDF: {config["path"]}')

        # Extract BOM tables from PDF
        all_rows = []
        try:
            with pdfplumber.open(config['path']) as pdf:
                for page_num in config['pages']:
                    page = pdf.pages[page_num]
                    tables = page.extract_tables()

                    if not tables:
                        continue

                    main_table = max(tables, key=len)
                    all_rows.extend(main_table)
                    self.stdout.write(f'✓ Page {page_num + 1}: {len(main_table)} rows')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ PDF extraction failed: {str(e)}'))
            return

        self.stdout.write(f'\n✅ Total extracted: {len(all_rows)} rows\n')

        # Create or get Style and Revision
        style, created = Style.objects.get_or_create(
            organization=org,
            style_number=style_number,
            defaults={
                'style_name': config['style_name'],
                'season': config['season'],
                'customer': config['customer'],
            }
        )

        if created:
            self.stdout.write(f'✅ Created Style: {style.style_number}')
        else:
            self.stdout.write(f'✓ Style exists: {style.style_number}')

        revision, rev_created = StyleRevision.objects.get_or_create(
            organization=org,
            style=style,
            revision_label='Rev A',
            defaults={'status': 'draft'}
        )

        if rev_created:
            self.stdout.write(f'✅ Created Revision: {revision.revision_label}')
        else:
            self.stdout.write(f'✓ Revision exists: {revision.revision_label}')

        # Delete old BOM items
        deleted_count = BOMItem.objects.filter(revision=revision).count()
        if deleted_count > 0:
            BOMItem.objects.filter(revision=revision).delete()
            self.stdout.write(f'🗑️  Deleted {deleted_count} old BOM items\n')

        # Parse BOM table
        self.stdout.write('📋 Parsing BOM table...\n')

        # Column indices (same as LW1FLWS format)
        col_indices = {
            'placement': 2,
            'supplier_article_no': 3,
            'material_status': 4,
            'material': 5,
            'supplier': 6,
            'total_leadtime': 8,
            'usage': 11,
            'bom_uom': 12,
            'price_per_unit': 13,
        }

        item_number = 1
        current_category = 'fabric'
        created_items = []

        for row_idx, row in enumerate(all_rows):
            # Check for category header
            first_cell = ' '.join(str(row[0]).split()).lower() if row[0] else ''
            if first_cell in ['fabric', 'trim', 'packaging', 'label']:
                current_category = first_cell
                self.stdout.write(f'\n📂 Category: {current_category.upper()}')
                continue

            # Skip empty rows
            if not any(cell and str(cell).strip() for cell in row):
                continue

            # Skip header rows
            row_text = ' '.join([str(cell) for cell in row if cell]).lower()
            if 'supplier article' in row_text or 'placement' in row_text:
                continue

            # Extract fields
            try:
                def clean_cell(cell):
                    if cell is None or cell == '':
                        return ''
                    return ' '.join(str(cell).split())

                placement = clean_cell(row[col_indices['placement']] if len(row) > col_indices['placement'] else '')
                supplier_article_no = clean_cell(row[col_indices['supplier_article_no']] if len(row) > col_indices['supplier_article_no'] else '')
                material = clean_cell(row[col_indices['material']] if len(row) > col_indices['material'] else '')
                supplier = clean_cell(row[col_indices['supplier']] if len(row) > col_indices['supplier'] else '')
                material_status = clean_cell(row[col_indices['material_status']] if len(row) > col_indices['material_status'] else '')
                usage = clean_cell(row[col_indices['usage']] if len(row) > col_indices['usage'] else '')
                bom_uom = clean_cell(row[col_indices['bom_uom']] if len(row) > col_indices['bom_uom'] else '')
                price = clean_cell(row[col_indices['price_per_unit']] if len(row) > col_indices['price_per_unit'] else '')

                # Skip rows without material name
                if not material or len(material) < 3:
                    continue

                # Parse consumption
                try:
                    consumption_value = Decimal(usage.replace('$', '').replace(',', '')) if usage else Decimal('0')
                except:
                    consumption_value = Decimal('0')

                # Parse price
                try:
                    price_value = Decimal(price.replace('$', '').replace(',', '')) if price else None
                except:
                    price_value = None

                # Determine consumption maturity
                if 'approved' in material_status.lower():
                    consumption_maturity = 'confirmed'
                else:
                    consumption_maturity = 'pre_estimate'

                # Create BOMItem
                bom_item = BOMItem.objects.create(
                    organization=org,
                    revision=revision,
                    item_number=item_number,
                    category=current_category,
                    material_name=material[:200],
                    supplier=supplier[:100] if supplier else '',
                    supplier_article_no=supplier_article_no[:100] if supplier_article_no else '',
                    material_status=material_status[:100] if material_status else '',
                    placement=[placement] if placement else [],
                    consumption=consumption_value,
                    consumption_maturity=consumption_maturity,
                    unit=bom_uom if bom_uom else ('yards' if current_category == 'fabric' else 'pcs'),
                    unit_price=price_value,
                    is_verified=True,
                    translation_status='confirmed',
                )

                created_items.append(bom_item)

                # Display
                status_emoji = '✅' if consumption_maturity == 'confirmed' else '📊'
                usage_display = f'{consumption_value} {bom_uom}' if consumption_value else 'N/A'

                self.stdout.write(
                    f'{status_emoji} {item_number:2d}. {material[:30]:30s} '
                    f'| Art#: {supplier_article_no[:12]:12s} '
                    f'| Usage: {usage_display:10s}'
                )

                item_number += 1

            except Exception as e:
                self.stdout.write(f'⚠️  Row {row_idx}: {str(e)}')
                continue

        # Summary
        self.stdout.write('\n' + '-'*70)
        self.stdout.write(self.style.SUCCESS(f'✅ Imported {len(created_items)} BOM items for {style_number}'))

        # Category breakdown
        from collections import Counter
        category_counts = Counter([item.category for item in created_items])
        self.stdout.write(f'\n📊 Category breakdown:')
        for category, count in category_counts.items():
            self.stdout.write(f'   {category.capitalize()}: {count}')
