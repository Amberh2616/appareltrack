"""
MRP Service - Material Requirements Planning

Calculates material requirements for production orders.
Formula: order_qty × consumption × (1 + wastage%)
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List
from django.db import transaction
from django.utils import timezone

from apps.orders.models import ProductionOrder, MaterialRequirement
from apps.styles.models import BOMItem
from apps.costing.models import UsageScenario, UsageLine


class MRPService:
    """
    Material Requirements Planning Service

    Calculates and creates material requirements for a production order
    based on BOM items and their consumption values.
    """

    @classmethod
    @transaction.atomic
    def calculate_requirements(
        cls,
        production_order: ProductionOrder,
        usage_scenario: Optional[UsageScenario] = None,
        default_wastage_pct: Decimal = Decimal('5.00')
    ) -> List[MaterialRequirement]:
        """
        Calculate material requirements for a production order.

        Args:
            production_order: The production order to calculate for
            usage_scenario: Optional UsageScenario to get consumption from
                           (if None, uses BOMItem.consumption_per_unit)
            default_wastage_pct: Default wastage percentage if not specified

        Returns:
            List of created MaterialRequirement objects
        """
        revision = production_order.style_revision
        bom_items = BOMItem.objects.filter(revision=revision)

        # Get usage lines if scenario provided
        usage_lines_map = {}
        if usage_scenario:
            for line in usage_scenario.usage_lines.all():
                usage_lines_map[line.bom_item_id] = line

        # Delete existing requirements (recalculation)
        MaterialRequirement.objects.filter(
            production_order=production_order
        ).delete()

        requirements = []

        for bom_item in bom_items:
            # Get consumption value
            if bom_item.id in usage_lines_map:
                usage_line = usage_lines_map[bom_item.id]
                consumption = usage_line.consumption
                wastage_pct = (
                    usage_line.wastage_pct_override
                    if usage_line.wastage_pct_override is not None
                    else usage_scenario.wastage_pct
                )
            else:
                # Fall back to BOM item consumption
                consumption = bom_item.consumption or Decimal('0')
                wastage_pct = bom_item.wastage_rate if bom_item.wastage_rate else default_wastage_pct

            # Skip if no consumption
            if not consumption or consumption == Decimal('0'):
                continue

            # Create MaterialRequirement
            requirement = MaterialRequirement(
                production_order=production_order,
                bom_item=bom_item,
                # Snapshot
                material_name=bom_item.material_name or '',
                material_name_zh=bom_item.material_name_zh or '',
                category=bom_item.category or '',
                supplier=bom_item.supplier or '',
                supplier_article_no=bom_item.supplier_article_no or '',
                unit=bom_item.unit or 'PCS',
                # Consumption data
                consumption_per_piece=consumption,
                wastage_pct=wastage_pct,
                order_quantity=production_order.total_quantity,
                # Initialize calculated fields (will be calculated next)
                gross_requirement=Decimal('0'),
                wastage_quantity=Decimal('0'),
                total_requirement=Decimal('0'),
                order_quantity_needed=Decimal('0'),
            )

            # Calculate requirements
            requirement.calculate_requirements()
            requirement.save()
            requirements.append(requirement)

        # Update production order status
        production_order.mrp_calculated = True
        production_order.mrp_calculated_at = timezone.now()
        production_order.save(update_fields=['mrp_calculated', 'mrp_calculated_at'])

        return requirements

    @classmethod
    def recalculate_requirements(
        cls,
        production_order: ProductionOrder
    ) -> List[MaterialRequirement]:
        """
        Recalculate material requirements for an existing production order.
        Uses the same consumption data but recalculates based on current order quantity.
        """
        requirements = list(production_order.material_requirements.all())

        for requirement in requirements:
            requirement.order_quantity = production_order.total_quantity
            requirement.calculate_requirements()
            requirement.save()

        production_order.mrp_calculated_at = timezone.now()
        production_order.save(update_fields=['mrp_calculated_at'])

        return requirements

    @classmethod
    def get_requirements_summary(
        cls,
        production_order: ProductionOrder
    ) -> dict:
        """
        Get a summary of material requirements for a production order.

        Returns:
            {
                'total_items': int,
                'by_category': {
                    'fabric': {'count': int, 'total_qty': Decimal},
                    'trim': {...},
                    ...
                },
                'ready_for_po': int,  # Items that need ordering
                'already_ordered': int,
            }
        """
        requirements = production_order.material_requirements.all()

        summary = {
            'total_items': 0,
            'by_category': {},
            'ready_for_po': 0,
            'already_ordered': 0,
        }

        for req in requirements:
            summary['total_items'] += 1

            # By category
            cat = req.category or 'other'
            if cat not in summary['by_category']:
                summary['by_category'][cat] = {
                    'count': 0,
                    'total_qty': Decimal('0'),
                }
            summary['by_category'][cat]['count'] += 1
            summary['by_category'][cat]['total_qty'] += req.total_requirement

            # Status
            if req.status == 'ordered':
                summary['already_ordered'] += 1
            elif req.order_quantity_needed > 0:
                summary['ready_for_po'] += 1

        return summary

    @classmethod
    @transaction.atomic
    def generate_purchase_orders(
        cls,
        production_order: ProductionOrder,
        group_by_supplier: bool = True
    ):
        """
        Generate purchase orders from material requirements.

        Args:
            production_order: The production order
            group_by_supplier: If True, create one PO per supplier.
                              If False, create one PO with all items.

        Returns:
            List of created PurchaseOrder objects
        """
        from apps.procurement.models import PurchaseOrder, POLine, Material
        from apps.core.models import Organization

        requirements = production_order.material_requirements.filter(
            status='calculated',
            order_quantity_needed__gt=0
        )

        if not requirements.exists():
            return []

        org = production_order.organization

        if group_by_supplier:
            # Group requirements by supplier
            suppliers = {}
            for req in requirements:
                supplier = req.supplier or 'Unknown'
                if supplier not in suppliers:
                    suppliers[supplier] = []
                suppliers[supplier].append(req)

            purchase_orders = []
            for supplier_name, reqs in suppliers.items():
                po = cls._create_purchase_order(
                    organization=org,
                    production_order=production_order,
                    supplier_name=supplier_name,
                    requirements=reqs
                )
                purchase_orders.append(po)

            return purchase_orders
        else:
            # Single PO with all items
            po = cls._create_purchase_order(
                organization=org,
                production_order=production_order,
                supplier_name='Multiple Suppliers',
                requirements=list(requirements)
            )
            return [po]

    @classmethod
    def _create_purchase_order(
        cls,
        organization,
        production_order: ProductionOrder,
        supplier_name: str,
        requirements: List[MaterialRequirement]
    ):
        """
        Create a single purchase order with lines from requirements.
        """
        from apps.procurement.models import PurchaseOrder, POLine, Supplier, Material
        from django.utils import timezone

        # Find or create supplier
        supplier, _ = Supplier.objects.get_or_create(
            organization=organization,
            name=supplier_name,
            defaults={
                'supplier_code': f'SUP-{supplier_name[:10].upper()}',
                'supplier_type': 'material',
            }
        )

        # Generate PO number
        now = timezone.now()
        yymm = now.strftime('%y%m')
        count = PurchaseOrder.objects.filter(
            organization=organization,
            po_number__startswith=f'PO-{yymm}-'
        ).count()
        po_number = f'PO-{yymm}-{str(count + 1).zfill(4)}'

        # Create PO
        po = PurchaseOrder.objects.create(
            organization=organization,
            po_number=po_number,
            supplier=supplier,
            po_type='production',
            status='draft',
            po_date=now.date(),
            expected_delivery=production_order.delivery_date,
            notes=f'Auto-generated from Production Order {production_order.order_number}',
        )

        # Create lines
        total_amount = Decimal('0')
        for req in requirements:
            # Find or create material
            material, _ = Material.objects.get_or_create(
                organization=organization,
                article_no=req.supplier_article_no or f'MAT-{req.bom_item_id.hex[:8]}',
                defaults={
                    'name': req.material_name,
                    'name_zh': req.material_name_zh,
                    'category': req.category or 'other',
                    'unit': req.unit,
                    'supplier': supplier,
                }
            )

            # Get unit price from BOM item
            unit_price = req.bom_item.unit_price or Decimal('0')
            line_amount = req.order_quantity_needed * unit_price

            line = POLine.objects.create(
                purchase_order=po,
                material=material,
                material_name=req.material_name,
                quantity=req.order_quantity_needed,
                unit=req.unit,
                unit_price=unit_price,
                line_total=line_amount,
            )

            total_amount += line_amount

            # Update requirement status
            req.status = 'ordered'
            req.purchase_order_line = line
            req.save()

        # Update PO total
        po.total_amount = total_amount
        po.save(update_fields=['total_amount'])

        # Update production order status
        production_order.status = 'materials_ordered'
        production_order.save(update_fields=['status'])

        return po
