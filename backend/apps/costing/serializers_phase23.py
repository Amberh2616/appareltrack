"""
Phase 2-3 Serializers
Three-Layer Separation Architecture
"""

from rest_framework import serializers
from .models import UsageScenario, UsageLine, CostSheetGroup, CostSheetVersion, CostLineV2


class UsageLineSerializer(serializers.ModelSerializer):
    """UsageLine serializer"""
    adjusted_consumption = serializers.DecimalField(
        max_digits=10,
        decimal_places=4,
        read_only=True
    )
    bom_item_name = serializers.CharField(
        source='bom_item.material_name',
        read_only=True
    )

    class Meta:
        model = UsageLine
        fields = [
            'id',
            'usage_scenario',
            'bom_item',
            'bom_item_name',
            'consumption',
            'consumption_unit',
            'consumption_status',
            'wastage_pct_override',
            'adjusted_consumption',
            'sort_order',
            'confirmed_by',
            'confirmed_at',
        ]
        read_only_fields = ['id', 'confirmed_by', 'confirmed_at']


class UsageScenarioListSerializer(serializers.ModelSerializer):
    """UsageScenario list serializer"""
    is_locked = serializers.BooleanField(read_only=True)
    can_edit = serializers.BooleanField(read_only=True)
    purpose_display = serializers.CharField(source='get_purpose_display', read_only=True)

    class Meta:
        model = UsageScenario
        fields = [
            'id',
            'revision',
            'purpose',
            'purpose_display',
            'version_no',
            'wastage_pct',
            'status',
            'is_locked',
            'can_edit',
            'created_at',
        ]


class UsageScenarioDetailSerializer(serializers.ModelSerializer):
    """UsageScenario detail serializer with nested lines"""
    usage_lines = UsageLineSerializer(many=True, read_only=True)
    is_locked = serializers.BooleanField(read_only=True)
    can_edit = serializers.BooleanField(read_only=True)
    purpose_display = serializers.CharField(source='get_purpose_display', read_only=True)

    class Meta:
        model = UsageScenario
        fields = [
            'id',
            'revision',
            'purpose',
            'purpose_display',
            'version_no',
            'wastage_pct',
            'rounding_rule',
            'status',
            'is_locked',
            'can_edit',
            'locked_at',
            'locked_first_by_cost_sheet',
            'notes',
            'created_by',
            'created_at',
            'usage_lines',
        ]


class CostLineV2Serializer(serializers.ModelSerializer):
    """CostLineV2 serializer"""
    delta_consumption_pct = serializers.SerializerMethodField()
    delta_price_pct = serializers.SerializerMethodField()

    class Meta:
        model = CostLineV2
        fields = [
            'id',
            'cost_sheet_version',
            'material_name',
            'material_name_zh',
            'category',
            'supplier',
            'supplier_article_no',
            'unit',
            'consumption_snapshot',
            'consumption_adjusted',
            'is_consumption_adjusted',
            'delta_consumption_pct',
            'unit_price_snapshot',
            'unit_price_adjusted',
            'is_price_adjusted',
            'delta_price_pct',
            'adjustment_reason',
            'line_cost',
            'sort_order',
            'adjusted_by',
            'adjusted_at',
        ]
        read_only_fields = [
            'id',
            'consumption_snapshot',
            'unit_price_snapshot',
            'line_cost',
            'adjusted_by',
            'adjusted_at',
        ]

    def get_delta_consumption_pct(self, obj):
        """Calculate consumption delta percentage"""
        if obj.consumption_snapshot == 0:
            return None
        delta = ((obj.consumption_adjusted - obj.consumption_snapshot) / obj.consumption_snapshot) * 100
        return round(float(delta), 2)

    def get_delta_price_pct(self, obj):
        """Calculate price delta percentage"""
        if obj.unit_price_snapshot == 0:
            return None
        delta = ((obj.unit_price_adjusted - obj.unit_price_snapshot) / obj.unit_price_snapshot) * 100
        return round(float(delta), 2)


class CostSheetVersionListSerializer(serializers.ModelSerializer):
    """CostSheetVersion list serializer"""
    style_number = serializers.CharField(source='cost_sheet_group.style.style_number', read_only=True)
    costing_type_display = serializers.CharField(source='get_costing_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    can_edit = serializers.BooleanField(read_only=True)
    techpack_revision = serializers.CharField(source='techpack_revision.id', read_only=True)
    usage_scenario = serializers.CharField(source='usage_scenario.id', read_only=True)

    class Meta:
        model = CostSheetVersion
        fields = [
            'id',
            'cost_sheet_group',
            'style_number',
            'version_no',
            'costing_type',
            'costing_type_display',
            'status',
            'status_display',
            'can_edit',
            'techpack_revision',
            'usage_scenario',
            'unit_price',
            'margin_pct',
            'created_at',
            'submitted_at',
        ]


class CostSheetVersionDetailSerializer(serializers.ModelSerializer):
    """CostSheetVersion detail serializer with nested lines"""
    cost_lines = CostLineV2Serializer(many=True, read_only=True)
    style_number = serializers.CharField(source='cost_sheet_group.style.style_number', read_only=True)
    costing_type_display = serializers.CharField(source='get_costing_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    can_edit = serializers.BooleanField(read_only=True)

    class Meta:
        model = CostSheetVersion
        fields = [
            'id',
            'cost_sheet_group',
            'style_number',
            'version_no',
            'costing_type',
            'costing_type_display',
            'status',
            'status_display',
            'can_edit',

            # Evidence
            'techpack_revision',
            'usage_scenario',

            # Costing parameters
            'labor_cost',
            'overhead_cost',
            'freight_cost',
            'packing_cost',
            'margin_pct',
            'currency',
            'exchange_rate',

            # Calculated results
            'material_cost',
            'total_cost',
            'unit_price',

            # Version relations
            'superseded_by',
            'cloned_from',
            'change_reason',

            # Metadata
            'created_by',
            'created_at',
            'submitted_by',
            'submitted_at',

            # Nested
            'cost_lines',
        ]
        read_only_fields = [
            'id',
            'material_cost',
            'total_cost',
            'unit_price',
            'created_by',
            'created_at',
            'submitted_by',
            'submitted_at',
        ]


class CostSheetGroupSerializer(serializers.ModelSerializer):
    """CostSheetGroup serializer"""
    style_number = serializers.CharField(source='style.style_number', read_only=True)
    style_name = serializers.CharField(source='style.style_name', read_only=True)

    class Meta:
        model = CostSheetGroup
        fields = [
            'id',
            'style',
            'style_number',
            'style_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
