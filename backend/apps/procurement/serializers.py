from rest_framework import serializers
from .models import Supplier, Material, PurchaseOrder, POLine


class SupplierSerializer(serializers.ModelSerializer):
    supplier_type_display = serializers.CharField(source='get_supplier_type_display', read_only=True)

    class Meta:
        model = Supplier
        fields = '__all__'
        read_only_fields = ['organization']


class SupplierSimpleSerializer(serializers.ModelSerializer):
    """Simplified supplier for dropdown/references"""
    class Meta:
        model = Supplier
        fields = ['id', 'name', 'supplier_code', 'supplier_type', 'email']


class MaterialSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Material
        fields = '__all__'
        read_only_fields = ['organization']


class MaterialSimpleSerializer(serializers.ModelSerializer):
    """Simplified material for dropdown/references"""
    class Meta:
        model = Material
        fields = ['id', 'article_no', 'name', 'name_zh', 'unit', 'unit_price']


class POLineSerializer(serializers.ModelSerializer):
    material_article_no = serializers.CharField(source='material.article_no', read_only=True)
    # P23: Overdue fields
    is_overdue = serializers.BooleanField(read_only=True)
    days_overdue = serializers.IntegerField(read_only=True)

    class Meta:
        model = POLine
        fields = '__all__'


class POLineDetailSerializer(serializers.ModelSerializer):
    """Detailed line serializer with material info and source traceability"""
    material_article_no = serializers.CharField(source='material.article_no', read_only=True)
    material_name_zh = serializers.CharField(source='material.name_zh', read_only=True)

    # P23: Overdue fields
    is_overdue = serializers.BooleanField(read_only=True)
    days_overdue = serializers.IntegerField(read_only=True)

    # Source traceability (from MaterialRequirement → BOMItem)
    source_info = serializers.SerializerMethodField()

    class Meta:
        model = POLine
        fields = '__all__'

    def get_source_info(self, obj):
        """Get source BOM and MRP info for this line"""
        # Find the MaterialRequirement that links to this POLine
        from apps.orders.models import MaterialRequirement

        try:
            req = MaterialRequirement.objects.select_related(
                'bom_item', 'bom_item__revision', 'bom_item__revision__style', 'production_order'
            ).get(purchase_order_line=obj)

            bom_item = req.bom_item
            revision = bom_item.revision if bom_item else None
            style = revision.style if revision else None

            return {
                # Style info
                'style_number': style.style_number if style else None,
                'style_name': style.style_name if style else None,
                'revision_label': revision.revision_label if revision else None,

                # BOM item info
                'bom_item_id': str(bom_item.id) if bom_item else None,
                'bom_item_number': bom_item.item_number if bom_item else None,
                'bom_category': bom_item.category if bom_item else None,
                'bom_placement': bom_item.placement if bom_item else None,

                # MRP calculation
                'production_order_number': req.production_order.order_number,
                'order_quantity': req.order_quantity,
                'consumption_per_piece': str(req.consumption_per_piece),
                'wastage_pct': str(req.wastage_pct),
                'gross_requirement': str(req.gross_requirement),
                'wastage_quantity': str(req.wastage_quantity),
                'total_requirement': str(req.total_requirement),
            }
        except MaterialRequirement.DoesNotExist:
            return None


class PurchaseOrderSerializer(serializers.ModelSerializer):
    """List serializer - minimal lines info"""
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    po_type_display = serializers.CharField(source='get_po_type_display', read_only=True)
    lines_count = serializers.IntegerField(source='lines.count', read_only=True)

    # P23: Overdue fields
    is_overdue = serializers.BooleanField(read_only=True)
    days_overdue = serializers.IntegerField(read_only=True)
    overdue_lines_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = '__all__'
        read_only_fields = ['organization', 'status', 'total_amount', 'actual_delivery', 'created_by']


class PurchaseOrderDetailSerializer(serializers.ModelSerializer):
    """Detail serializer - full lines info"""
    lines = POLineDetailSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    supplier_data = SupplierSimpleSerializer(source='supplier', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    po_type_display = serializers.CharField(source='get_po_type_display', read_only=True)

    # Confirmation status
    all_lines_confirmed = serializers.BooleanField(read_only=True)
    confirmed_lines_count = serializers.IntegerField(read_only=True)
    total_lines_count = serializers.IntegerField(read_only=True)

    # P23: Overdue fields
    is_overdue = serializers.BooleanField(read_only=True)
    days_overdue = serializers.IntegerField(read_only=True)
    overdue_lines_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = '__all__'
        read_only_fields = ['organization', 'status', 'total_amount', 'actual_delivery', 'created_by']
