from rest_framework import serializers
from .models import SalesOrder, SalesOrderItem, ProductionOrder, MaterialRequirement


class SalesOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesOrderItem
        fields = '__all__'


class SalesOrderSerializer(serializers.ModelSerializer):
    items = SalesOrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = SalesOrder
        fields = '__all__'


# ============================================================================
# ProductionOrder Serializers
# ============================================================================

class MaterialRequirementSerializer(serializers.ModelSerializer):
    """Serializer for MaterialRequirement (物料需求)"""
    bom_item_id = serializers.UUIDField(source='bom_item.id', read_only=True)
    unit_price = serializers.DecimalField(
        source='bom_item.unit_price',
        max_digits=10,
        decimal_places=2,
        read_only=True
    )
    line_amount = serializers.SerializerMethodField()
    purchase_order_info = serializers.SerializerMethodField()

    class Meta:
        model = MaterialRequirement
        fields = [
            'id',
            'production_order',
            'bom_item',
            'bom_item_id',
            'material_name',
            'material_name_zh',
            'category',
            'supplier',
            'supplier_article_no',
            'unit',
            'consumption_per_piece',
            'wastage_pct',
            'order_quantity',
            'gross_requirement',
            'wastage_quantity',
            'total_requirement',
            'current_stock',
            'order_quantity_needed',
            'status',
            # Review fields
            'is_reviewed',
            'reviewed_at',
            'review_notes',
            'reviewed_quantity',
            'reviewed_unit_price',
            # Delivery tracking
            'required_date',
            'expected_delivery',
            # PO link
            'purchase_order_line',
            'purchase_order_info',
            'unit_price',
            'line_amount',
            'calculated_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'gross_requirement',
            'wastage_quantity',
            'total_requirement',
            'order_quantity_needed',
            'calculated_at',
            'updated_at',
        ]

    def get_line_amount(self, obj):
        """Calculate estimated line amount (total_requirement × unit_price)"""
        unit_price = obj.bom_item.unit_price if obj.bom_item.unit_price else 0
        return float(obj.total_requirement * unit_price)

    def get_purchase_order_info(self, obj):
        """Get linked PO information if exists"""
        if not obj.purchase_order_line:
            return None
        po = obj.purchase_order_line.purchase_order
        return {
            'id': str(po.id),
            'po_number': po.po_number,
            'supplier_name': po.supplier.name if po.supplier else None,
            'status': po.status,
            'expected_delivery': obj.purchase_order_line.expected_delivery,
            'delivery_status': obj.purchase_order_line.delivery_status,
        }


class MaterialRequirementSimpleSerializer(serializers.ModelSerializer):
    """Simplified serializer for list views"""
    class Meta:
        model = MaterialRequirement
        fields = [
            'id',
            'material_name',
            'material_name_zh',
            'category',
            'supplier',
            'total_requirement',
            'order_quantity_needed',
            'unit',
            'status',
            'is_reviewed',
            'required_date',
            'expected_delivery',
        ]


class ProductionOrderSerializer(serializers.ModelSerializer):
    """Serializer for ProductionOrder list view"""
    style_number = serializers.CharField(
        source='style_revision.style.style_number',
        read_only=True
    )
    style_name = serializers.CharField(
        source='style_revision.style.style_name',
        read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display',
        read_only=True
    )
    requirements_count = serializers.IntegerField(
        source='material_requirements.count',
        read_only=True
    )

    class Meta:
        model = ProductionOrder
        fields = [
            'id',
            'organization',
            'po_number',
            'order_number',
            'customer',
            'customer_po_ref',
            'style_revision',
            'style_number',
            'style_name',
            'bulk_costing',
            'total_quantity',
            'size_breakdown',
            'unit_price',
            'total_amount',
            'currency',
            'status',
            'status_display',
            'order_date',
            'delivery_date',
            'actual_delivery',
            'mrp_calculated',
            'mrp_calculated_at',
            'requirements_count',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'organization',
            'mrp_calculated',
            'mrp_calculated_at',
            'created_at',
            'updated_at',
        ]


class ProductionOrderDetailSerializer(ProductionOrderSerializer):
    """Detail serializer with material requirements"""
    material_requirements = MaterialRequirementSerializer(
        many=True,
        read_only=True
    )

    class Meta(ProductionOrderSerializer.Meta):
        fields = ProductionOrderSerializer.Meta.fields + ['material_requirements']


class ProductionOrderCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating production orders"""

    class Meta:
        model = ProductionOrder
        fields = [
            'po_number',
            'order_number',
            'customer',
            'customer_po_ref',
            'style_revision',
            'bulk_costing',
            'total_quantity',
            'size_breakdown',
            'unit_price',
            'total_amount',
            'currency',
            'order_date',
            'delivery_date',
            'notes',
        ]

    def validate_size_breakdown(self, value):
        """Ensure size breakdown is a valid dict with numeric values"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Size breakdown must be a dictionary")

        total = 0
        for size, qty in value.items():
            if not isinstance(qty, (int, float)):
                raise serializers.ValidationError(
                    f"Quantity for size {size} must be a number"
                )
            total += qty

        return value

    def validate(self, data):
        """Validate total quantity matches size breakdown"""
        size_breakdown = data.get('size_breakdown', {})
        total_quantity = data.get('total_quantity', 0)

        breakdown_total = sum(size_breakdown.values())
        if breakdown_total != total_quantity:
            raise serializers.ValidationError({
                'size_breakdown': f'Size breakdown total ({breakdown_total}) does not match total quantity ({total_quantity})'
            })

        return data


class CalculateMRPSerializer(serializers.Serializer):
    """Serializer for MRP calculation request"""
    usage_scenario_id = serializers.UUIDField(
        required=False,
        help_text="Optional UsageScenario ID to use for consumption values"
    )
    default_wastage_pct = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        required=False,
        default=5.00,
        help_text="Default wastage percentage if not specified in scenario"
    )


class GeneratePOSerializer(serializers.Serializer):
    """Serializer for PO generation request"""
    group_by_supplier = serializers.BooleanField(
        required=False,
        default=True,
        help_text="If True, create one PO per supplier"
    )
