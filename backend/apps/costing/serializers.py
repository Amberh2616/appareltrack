"""
Costing Serializers
Phase 2-2I: 版本策略 - Guard Rules
P18: 統一報價架構 (Sample → Bulk)
"""

from decimal import Decimal
from rest_framework import serializers
from .models import (
    CostSheet,
    CostLine,
    # P18: 三層架構模型
    UsageScenario,
    UsageLine,
    CostSheetGroup,
    CostSheetVersion,
    CostLineV2,
)


# A/B Fields Definition (版本策略)
A_FIELDS = {
    "labor_cost",
    "overhead_cost",
    "freight_cost",
    "packaging_cost",
    "testing_cost",
    "notes",
}

B_FIELDS = {"margin_pct", "wastage_pct"}


class CostLineSerializer(serializers.ModelSerializer):
    """
    CostLine serializer（read-only，顯示快照）
    """

    class Meta:
        model = CostLine
        fields = [
            'id',
            'bom_item',
            'material_name',
            'supplier',
            'category',
            'unit',
            'consumption',
            'unit_price',
            'line_cost',
            'sort_order',
        ]
        read_only_fields = fields  # Phase 1: 全部 read-only


class CostSheetListSerializer(serializers.ModelSerializer):
    """
    CostSheet list serializer（版本列表用）
    """
    costing_type_display = serializers.CharField(
        source='get_costing_type_display',
        read_only=True
    )

    class Meta:
        model = CostSheet
        fields = [
            'id',
            'revision',
            'costing_type',
            'costing_type_display',
            'version_no',
            'is_current',
            'material_cost',
            'total_cost',
            'unit_price',
            'created_at',
        ]
        read_only_fields = fields


class CostSheetDetailSerializer(serializers.ModelSerializer):
    """
    CostSheet detail serializer（包含 nested lines）
    """
    lines = CostLineSerializer(many=True, read_only=True)
    costing_type_display = serializers.CharField(
        source='get_costing_type_display',
        read_only=True
    )

    class Meta:
        model = CostSheet
        fields = [
            'id',
            'revision',
            'costing_type',
            'costing_type_display',
            'version_no',
            'is_current',
            # 成本輸入
            'labor_cost',
            'overhead_cost',
            'freight_cost',
            'packaging_cost',
            'testing_cost',
            # 定價參數
            'margin_pct',
            'wastage_pct',
            # 計算結果
            'material_cost',
            'total_cost',
            'unit_price',
            # 元數據
            'notes',
            'created_at',
            'updated_at',
            # Nested lines
            'lines',
        ]
        read_only_fields = [
            'id',
            'version_no',
            'material_cost',
            'total_cost',
            'unit_price',
            'created_at',
            'updated_at',
            'lines',
        ]


class CostSheetCreateSerializer(serializers.Serializer):
    """
    Create CostSheet serializer（用於 Generate API）
    """
    costing_type = serializers.ChoiceField(
        choices=['sample', 'bulk'],
        required=True
    )
    labor_cost = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        required=False
    )
    overhead_cost = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        required=False
    )
    freight_cost = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        required=False
    )
    packaging_cost = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        required=False
    )
    testing_cost = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        required=False
    )
    margin_pct = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=30,
        required=False
    )
    wastage_pct = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=5,
        required=False
    )
    notes = serializers.CharField(
        required=False,
        allow_blank=True
    )

    def validate(self, attrs):
        """Validate margin and wastage ranges"""
        if attrs["margin_pct"] < 0 or attrs["margin_pct"] >= 100:
            raise serializers.ValidationError({
                "margin_pct": "Must be in [0, 100)."
            })
        if attrs["wastage_pct"] < 0 or attrs["wastage_pct"] > 100:
            raise serializers.ValidationError({
                "wastage_pct": "Must be in [0, 100]."
            })
        return attrs


class CostSheetPatchSerializer(serializers.ModelSerializer):
    """
    PATCH serializer - 版本策略 Guard Rules

    只允許 A-fields (同版本可修改)
    禁止 B-fields (必須新版本)
    """

    class Meta:
        model = CostSheet
        fields = [
            # A fields (allowed in PATCH)
            'labor_cost',
            'overhead_cost',
            'freight_cost',
            'packaging_cost',
            'testing_cost',
            'notes',
            # B fields (included to detect & block)
            'margin_pct',
            'wastage_pct',
        ]

    def validate(self, attrs):
        """
        Guard Rule: PATCH 禁止修改 margin_pct 或 wastage_pct
        """
        incoming = set(attrs.keys())

        # Block B fields
        if incoming & B_FIELDS:
            raise serializers.ValidationError({
                "version_policy": "margin_pct and wastage_pct require a new version. "
                                  "Use POST /revisions/{id}/cost-sheets/ to create a new version."
            })

        # Ensure only A fields
        illegal = incoming - A_FIELDS
        if illegal:
            raise serializers.ValidationError({
                "fields": f"Illegal fields in PATCH: {sorted(list(illegal))}"
            })

        # Validate numeric fields >= 0
        for f in ["labor_cost", "overhead_cost", "freight_cost", "packaging_cost", "testing_cost"]:
            if f in attrs and attrs[f] is not None and Decimal(str(attrs[f])) < 0:
                raise serializers.ValidationError({f: "Must be >= 0"})

        return attrs


class CostSheetDuplicateSerializer(serializers.Serializer):
    """
    Duplicate serializer - 創建新版本（僅改 margin/wastage）

    Optional endpoint: 不重建 CostLines，只用新的 margin/wastage
    """
    margin_pct = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        required=True
    )
    wastage_pct = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        required=True
    )
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True
    )

    def validate(self, attrs):
        """Validate margin and wastage ranges"""
        if attrs["margin_pct"] < 0 or attrs["margin_pct"] >= 100:
            raise serializers.ValidationError({
                "margin_pct": "Must be in [0, 100)."
            })
        if attrs["wastage_pct"] < 0 or attrs["wastage_pct"] > 100:
            raise serializers.ValidationError({
                "wastage_pct": "Must be in [0, 100]."
            })
        return attrs


# ============================================================================
# P18: 統一報價架構 Serializers
# ============================================================================

class UsageLineSerializer(serializers.ModelSerializer):
    """UsageLine 序列化器"""
    bom_item_name = serializers.CharField(source='bom_item.material_name', read_only=True)
    bom_item_category = serializers.CharField(source='bom_item.category', read_only=True)

    class Meta:
        model = UsageLine
        fields = [
            'id',
            'bom_item',
            'bom_item_name',
            'bom_item_category',
            'consumption',
            'consumption_unit',
            'consumption_status',
            'wastage_pct_override',
            'sort_order',
        ]
        read_only_fields = ['id']


class UsageScenarioSerializer(serializers.ModelSerializer):
    """UsageScenario 序列化器"""
    purpose_display = serializers.CharField(source='get_purpose_display', read_only=True)
    usage_lines = UsageLineSerializer(many=True, read_only=True)
    is_locked = serializers.BooleanField(read_only=True)
    line_count = serializers.SerializerMethodField()

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
            'line_count',
            'usage_lines',
            'created_at',
        ]
        read_only_fields = ['id', 'version_no', 'created_at']

    def get_line_count(self, obj):
        return obj.usage_lines.count()


class CostLineV2Serializer(serializers.ModelSerializer):
    """CostLineV2 序列化器"""

    class Meta:
        model = CostLineV2
        fields = [
            'id',
            'material_name',
            'material_name_zh',
            'category',
            'supplier',
            'supplier_article_no',
            'unit',
            'consumption_snapshot',
            'consumption_adjusted',
            'unit_price_snapshot',
            'unit_price_adjusted',
            'is_consumption_adjusted',
            'is_price_adjusted',
            'adjustment_reason',
            'line_cost',
            'sort_order',
        ]
        read_only_fields = ['id', 'consumption_snapshot', 'unit_price_snapshot']


class CostSheetVersionSerializer(serializers.ModelSerializer):
    """CostSheetVersion 序列化器（P18 核心）"""
    costing_type_display = serializers.CharField(source='get_costing_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    style_number = serializers.CharField(source='cost_sheet_group.style.style_number', read_only=True)
    revision_label = serializers.CharField(source='techpack_revision.revision_label', read_only=True)
    cloned_from_info = serializers.SerializerMethodField()
    cost_lines = CostLineV2Serializer(many=True, read_only=True)
    line_count = serializers.SerializerMethodField()

    class Meta:
        model = CostSheetVersion
        fields = [
            'id',
            'cost_sheet_group',
            'style_number',
            'techpack_revision',
            'revision_label',
            'usage_scenario',
            'version_no',
            'costing_type',
            'costing_type_display',
            'status',
            'status_display',
            # 成本參數
            'labor_cost',
            'overhead_cost',
            'freight_cost',
            'packing_cost',
            'margin_pct',
            'currency',
            'exchange_rate',
            # 計算結果
            'material_cost',
            'total_cost',
            'unit_price',
            # 版本追溯
            'cloned_from',
            'cloned_from_info',
            'change_reason',
            # 時間戳
            'created_at',
            'submitted_at',
            # 明細
            'cost_lines',
            'line_count',
        ]
        read_only_fields = [
            'id', 'version_no', 'material_cost', 'total_cost', 'unit_price',
            'created_at', 'submitted_at', 'cost_lines',
        ]

    def get_cloned_from_info(self, obj):
        if obj.cloned_from:
            return {
                'id': str(obj.cloned_from.id),
                'version_no': obj.cloned_from.version_no,
                'costing_type': obj.cloned_from.costing_type,
            }
        return None

    def get_line_count(self, obj):
        return obj.cost_lines.count()


class CostSheetVersionListSerializer(serializers.ModelSerializer):
    """CostSheetVersion 列表序列化器（輕量版）"""
    costing_type_display = serializers.CharField(source='get_costing_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    style_number = serializers.CharField(source='cost_sheet_group.style.style_number', read_only=True)
    line_count = serializers.SerializerMethodField()

    class Meta:
        model = CostSheetVersion
        fields = [
            'id',
            'style_number',
            'version_no',
            'costing_type',
            'costing_type_display',
            'status',
            'status_display',
            'material_cost',
            'total_cost',
            'unit_price',
            'line_count',
            'created_at',
        ]

    def get_line_count(self, obj):
        return obj.cost_lines.count()


class CreateBulkQuoteSerializer(serializers.Serializer):
    """創建大貨報價的請求序列化器"""
    expected_quantity = serializers.IntegerField(
        required=False,
        default=1000,
        min_value=1,
        help_text="預估大貨數量（用於量大折扣計算）"
    )
    copy_labor_overhead = serializers.BooleanField(
        required=False,
        default=True,
        help_text="是否複製人工/製費"
    )
    change_reason = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        help_text="報價變更原因"
    )
