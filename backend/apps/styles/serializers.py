"""
Styles Serializers - v2.3.0
Added: Brand serializer with BOM format configuration
"""

from rest_framework import serializers
from .models import Style, StyleRevision, BOMItem, Measurement, ConstructionStep, Brand


# ========== Brand Serializer ==========

class BrandSerializer(serializers.ModelSerializer):
    """Brand with BOM format configuration"""
    styles_count = serializers.SerializerMethodField()

    class Meta:
        model = Brand
        fields = [
            'id', 'code', 'name',
            'bom_format', 'bom_extraction_rules',
            'is_active', 'notes',
            'styles_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'styles_count']

    def get_styles_count(self, obj):
        return obj.styles.count()


# ========== Verified Data Serializers (DB Objects) ==========

class BOMItemSerializer(serializers.ModelSerializer):
    """Verified BOM Item (from DB)"""
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    consumption_maturity_display = serializers.SerializerMethodField()
    current_consumption = serializers.DecimalField(
        max_digits=10, decimal_places=4, read_only=True
    )
    can_edit_consumption = serializers.BooleanField(read_only=True)
    # Make revision and item_number read_only for API (set by ViewSet)
    revision = serializers.PrimaryKeyRelatedField(read_only=True)
    item_number = serializers.IntegerField(read_only=True)

    class Meta:
        model = BOMItem
        fields = [
            'id', 'revision', 'item_number', 'category', 'category_display',
            'material_name', 'supplier', 'supplier_article_no', 'color', 'color_code',
            'material_status',
            'consumption', 'consumption_maturity', 'consumption_maturity_display',
            # 用量四階段
            'pre_estimate_value', 'sample_value', 'confirmed_value', 'locked_value',
            'current_consumption', 'can_edit_consumption',
            'sample_confirmed_at', 'consumption_confirmed_at', 'consumption_locked_at',
            'consumption_history',
            # 其他欄位
            'unit', 'placement', 'wastage_rate', 'unit_price', 'leadtime_days',
            'ai_confidence', 'is_verified',
            # Translation fields
            'material_name_zh', 'description_zh', 'translation_status',
            'translated_at', 'translated_by',
        ]

    def get_consumption_maturity_display(self, obj):
        """用量成熟度顯示名稱"""
        displays = {
            'unknown': '待填寫',
            'pre_estimate': '預估',
            'sample': '樣衣',
            'confirmed': '已確認',
            'locked': '已鎖定',
        }
        return displays.get(obj.consumption_maturity, obj.consumption_maturity)


class MeasurementSerializer(serializers.ModelSerializer):
    """Verified Measurement (from DB)"""
    # Make revision read_only for API (set by ViewSet)
    revision = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Measurement
        fields = [
            'id', 'revision', 'point_name', 'point_code', 'values',
            'tolerance_plus', 'tolerance_minus', 'unit',
            'ai_confidence', 'is_verified',
            # Translation fields
            'point_name_zh', 'translation_status',
        ]


class ConstructionStepSerializer(serializers.ModelSerializer):
    """Verified Construction Step (from DB)"""
    class Meta:
        model = ConstructionStep
        fields = [
            'id', 'revision', 'step_number', 'description',
            'stitch_type', 'machine_type',
            'ai_confidence', 'is_verified',
        ]


# ========== Draft Data Serializers (JSON) ==========

class DraftDataSerializer(serializers.Serializer):
    """Draft data from AI extraction (JSON structure)"""
    bom_data = serializers.JSONField(required=False, allow_null=True)
    measurement_data = serializers.JSONField(required=False, allow_null=True)
    construction_data = serializers.JSONField(required=False, allow_null=True)


# ========== StyleRevision Serializers ==========

class StyleRevisionSerializer(serializers.ModelSerializer):
    """Full StyleRevision with verified data"""
    bom_items = BOMItemSerializer(many=True, read_only=True)
    measurements = MeasurementSerializer(many=True, read_only=True)
    construction_steps = ConstructionStepSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = StyleRevision
        fields = [
            'id', 'style', 'revision_label', 'status', 'status_display',
            'notes', 'changes_from_previous',
            'draft_bom_data', 'draft_measurement_data', 'draft_construction_data',
            'previous_revision',
            'created_at', 'updated_at', 'approved_at', 'approved_by',
            # Related data
            'bom_items', 'measurements', 'construction_steps',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class StyleRevisionListSerializer(serializers.ModelSerializer):
    """Lightweight revision list serializer"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    bom_count = serializers.SerializerMethodField()
    has_draft_data = serializers.SerializerMethodField()

    class Meta:
        model = StyleRevision
        fields = [
            'id', 'revision_label', 'status', 'status_display',
            'created_at', 'approved_at',
            'bom_count', 'has_draft_data',
        ]

    def get_bom_count(self, obj):
        return obj.bom_items.count()

    def get_has_draft_data(self, obj):
        return bool(obj.draft_bom_data or obj.draft_measurement_data or obj.draft_construction_data)


# ========== Style Serializers ==========

class StyleSerializer(serializers.ModelSerializer):
    """Full Style with all revisions"""
    revisions = StyleRevisionListSerializer(many=True, read_only=True)
    current_revision_label = serializers.CharField(
        source='current_revision.revision_label', read_only=True, allow_null=True
    )
    current_revision_status = serializers.CharField(
        source='current_revision.status', read_only=True, allow_null=True
    )
    brand_code = serializers.CharField(source='brand.code', read_only=True, allow_null=True)
    brand_name = serializers.CharField(source='brand.name', read_only=True, allow_null=True)

    class Meta:
        model = Style
        fields = [
            'id', 'organization', 'style_number', 'style_name',
            'season', 'customer', 'brand', 'brand_code', 'brand_name',
            'current_revision', 'current_revision_label', 'current_revision_status',
            'created_at', 'updated_at', 'created_by',
            'revisions',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class StyleListSerializer(serializers.ModelSerializer):
    """Lightweight style list serializer with readiness summary"""
    current_revision_label = serializers.CharField(
        source='current_revision.revision_label', read_only=True, allow_null=True
    )
    current_revision_status = serializers.CharField(
        source='current_revision.status', read_only=True, allow_null=True
    )
    brand_name = serializers.CharField(
        source='brand.name', read_only=True, allow_null=True
    )
    revision_count = serializers.SerializerMethodField()
    risk = serializers.SerializerMethodField()
    readiness = serializers.SerializerMethodField()

    class Meta:
        model = Style
        fields = [
            'id', 'style_number', 'style_name', 'season', 'customer',
            'brand_name',
            'current_revision_label', 'current_revision_status',
            'revision_count', 'risk', 'readiness', 'created_at',
        ]

    def get_revision_count(self, obj):
        return obj.revisions.count()

    def get_risk(self, obj):
        """Calculate risk badges"""
        from .services import compute_risk_badges
        return compute_risk_badges(obj)

    def get_readiness(self, obj):
        """Lightweight readiness summary for list view"""
        from apps.parsing.models import UploadedDocument
        from apps.parsing.models_blocks import DraftBlock
        from apps.samples.models import SampleRequest, SampleRun, SampleMWO

        revision = obj.current_revision

        # Tech Pack
        has_tech_pack = UploadedDocument.objects.filter(
            style_revision__style=obj,
            tech_pack_revision__isnull=False,
        ).exists()

        # Translation progress
        tech_pack_progress = 0
        if has_tech_pack:
            tp_rev_ids = UploadedDocument.objects.filter(
                style_revision__style=obj,
                tech_pack_revision__isnull=False,
            ).values_list('tech_pack_revision_id', flat=True)
            from django.db.models import Count, Q
            stats = DraftBlock.objects.filter(
                page__revision_id__in=list(tp_rev_ids)
            ).aggregate(
                total=Count('id'),
                done=Count('id', filter=Q(translation_status='done')),
                skipped=Count('id', filter=Q(translation_status='skipped')),
            )
            total = stats['total'] or 0
            completed = (stats['done'] or 0) + (stats['skipped'] or 0)
            tech_pack_progress = round(completed / total * 100) if total > 0 else 0

        # BOM / Spec
        bom_total = 0
        bom_verified = 0
        spec_total = 0
        spec_verified = 0
        if revision:
            bom_total = revision.bom_items.count()
            bom_verified = revision.bom_items.filter(is_verified=True).count()
            spec_total = revision.measurements.count()
            spec_verified = revision.measurements.filter(is_verified=True).count()

        # Sample / MWO
        has_sample_request = False
        mwo_status = None
        if revision:
            sr = SampleRequest.objects.filter(revision=revision).first()
            if sr:
                has_sample_request = True
                run = SampleRun.objects.filter(sample_request=sr).order_by('-run_no').first()
                if run:
                    mwo = SampleMWO.objects.filter(sample_run=run, is_latest=True).first()
                    mwo_status = mwo.status if mwo else None

        return {
            'has_tech_pack': has_tech_pack,
            'tech_pack_progress': tech_pack_progress,
            'bom_total': bom_total,
            'bom_verified': bom_verified,
            'spec_total': spec_total,
            'spec_verified': spec_verified,
            'has_sample_request': has_sample_request,
            'mwo_status': mwo_status,
        }


# ========== Intake Serializers ==========

class IntakeBulkCreateItemSerializer(serializers.Serializer):
    """Single item in bulk create request"""
    style_number = serializers.CharField(max_length=50)
    style_name = serializers.CharField(max_length=200)
    season = serializers.CharField(max_length=50, required=False, allow_blank=True)
    customer = serializers.CharField(max_length=100, required=False, allow_blank=True)
    revision_label = serializers.CharField(max_length=20, default='Rev A')
    source = serializers.ChoiceField(
        choices=[('customer', 'Customer'), ('internal', 'Internal')],
        default='customer'
    )


class IntakeBulkCreateRequestSerializer(serializers.Serializer):
    """Bulk create styles + revisions request"""
    items = IntakeBulkCreateItemSerializer(many=True)
    options = serializers.DictField(required=False, default=dict)


class IntakeBulkCreateResultItemSerializer(serializers.Serializer):
    """Single item result in bulk create response"""
    index = serializers.IntegerField()
    style_id = serializers.UUIDField(required=False, allow_null=True)
    style_number = serializers.CharField()
    revision_id = serializers.UUIDField(required=False, allow_null=True)
    revision_label = serializers.CharField()
    created = serializers.BooleanField()
    status = serializers.ChoiceField(choices=['success', 'skipped', 'error'])
    errors = serializers.ListField(child=serializers.DictField(), default=list)


class IntakeBulkCreateResponseSerializer(serializers.Serializer):
    """Bulk create response"""
    data = IntakeBulkCreateResultItemSerializer(many=True)
    meta = serializers.DictField()
