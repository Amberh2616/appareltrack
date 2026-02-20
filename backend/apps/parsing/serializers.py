"""
Parsing Serializers - v2.2.1

Block-Based Parsing:
- source_text 永遠只讀
- edited_text 才是使用者可改的
- bbox 拆成前端好用的結構輸出
"""

from rest_framework import serializers
from .models import ExtractionRun, DraftReviewItem, UploadedDocument
from .models_blocks import Revision, RevisionPage, DraftBlock


class ParseTriggerSerializer(serializers.Serializer):
    """Parse trigger request"""
    targets = serializers.ListField(
        child=serializers.ChoiceField(choices=['bom', 'measurement', 'construction']),
        required=False,
        default=list,
        help_text="Targets to parse. Empty = all targets"
    )
    options = serializers.DictField(
        required=False,
        default=dict,
        help_text="Additional options"
    )


class ParseTriggerResponseSerializer(serializers.Serializer):
    """Parse trigger response"""
    extraction_run_id = serializers.UUIDField()
    job_id = serializers.UUIDField()
    status = serializers.CharField()
    message = serializers.CharField()


class ExtractionRunDetailSerializer(serializers.Serializer):
    """Extraction run status detail"""
    extraction_run_id = serializers.UUIDField()
    revision_id = serializers.UUIDField()
    status = serializers.CharField()
    ai_model = serializers.CharField()
    confidence_score = serializers.FloatField(allow_null=True)
    processing_time_ms = serializers.IntegerField(allow_null=True)
    api_cost = serializers.FloatField(allow_null=True)
    started_at = serializers.CharField(allow_null=True)
    completed_at = serializers.CharField(allow_null=True)
    targets = serializers.ListField(child=serializers.CharField())
    issues_summary = serializers.DictField()
    issues = serializers.ListField()


class DraftReviewItemSerializer(serializers.ModelSerializer):
    """Draft review item"""
    item_type_display = serializers.CharField(source='get_item_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = DraftReviewItem
        fields = [
            'id', 'extraction_run', 'item_type', 'item_type_display',
            'ai_data', 'ai_confidence', 'status', 'status_display',
            'corrected_data', 'correction_notes',
            'reviewed_by', 'reviewed_at',
        ]
        read_only_fields = ['id', 'reviewed_at']


class ExtractionRunSerializer(serializers.ModelSerializer):
    """Full extraction run serializer"""
    review_items = DraftReviewItemSerializer(many=True, read_only=True)

    class Meta:
        model = ExtractionRun
        fields = '__all__'


# ============================================
# Block-Based Parsing Serializers
# ============================================

class DraftBlockSerializer(serializers.ModelSerializer):
    """
    核心 Serializer：DraftBlock

    規則：
    - source_text: 只讀（AI 解析結果，不可覆寫）
    - translated_text: 只讀（AI 翻譯，不可覆寫）
    - edited_text: 可寫（人工修正）
    - bbox: SerializerMethodField（DB 是 flat，API 是 nested）
    - overlay: 翻譯疊加位置（用戶可拖動調整）
    """
    bbox = serializers.SerializerMethodField()
    overlay = serializers.SerializerMethodField()

    class Meta:
        model = DraftBlock
        fields = [
            "id",
            "block_type",
            "bbox",
            "overlay",
            "source_text",
            "translated_text",
            "edited_text",
            "status",
        ]
        read_only_fields = [
            "id",
            "source_text",
            "translated_text",
        ]

    def get_bbox(self, obj):
        """
        將 DB 的 flat bbox 轉成 nested 結構

        DB:  bbox_x, bbox_y, bbox_width, bbox_height
        API: {"x": 90, "y": 120, "width": 280, "height": 40}
        """
        return {
            "x": obj.bbox_x,
            "y": obj.bbox_y,
            "width": obj.bbox_width,
            "height": obj.bbox_height,
        }

    def get_overlay(self, obj):
        """
        翻譯疊加位置

        API: {"x": 100, "y": 130, "visible": true}
        如果 overlay_x/y 為 null，使用 bbox 位置作為默認值
        """
        return {
            "x": obj.overlay_x if obj.overlay_x is not None else obj.bbox_x,
            "y": obj.overlay_y if obj.overlay_y is not None else obj.bbox_y,
            "visible": obj.overlay_visible,
        }


class DraftBlockPatchSerializer(serializers.ModelSerializer):
    """
    PATCH 專用 Serializer

    用途：
    - PATCH /api/v2/draft-blocks/{id}/
    - 只能改「審稿結果」和「疊加位置」
    - 絕對改不到原文與 bbox
    """
    class Meta:
        model = DraftBlock
        fields = [
            "edited_text",
            "status",
            "overlay_x",
            "overlay_y",
            "overlay_visible",
        ]


class DraftBlockPositionSerializer(serializers.Serializer):
    """
    專門用於保存翻譯疊加位置

    用途：
    - PATCH /api/v2/draft-blocks/{id}/position/
    - 批量更新位置
    """
    overlay_x = serializers.FloatField(required=True)
    overlay_y = serializers.FloatField(required=True)
    overlay_visible = serializers.BooleanField(required=False, default=True)


class DraftBlockBatchPositionSerializer(serializers.Serializer):
    """
    批量保存多個 Block 的位置

    用途：
    - PATCH /api/v2/revisions/{id}/blocks/positions/
    - 一次保存頁面上所有 block 的位置
    """
    positions = serializers.ListField(
        child=serializers.DictField(),
        help_text="[{id: uuid, overlay_x: float, overlay_y: float, overlay_visible: bool}, ...]"
    )

    def validate_positions(self, value):
        """驗證每個 position 項目"""
        for item in value:
            if 'id' not in item:
                raise serializers.ValidationError("Each position must have an 'id' field")
            if 'overlay_x' not in item or 'overlay_y' not in item:
                raise serializers.ValidationError("Each position must have 'overlay_x' and 'overlay_y'")
        return value


class RevisionPageSerializer(serializers.ModelSerializer):
    """
    頁面級 Serializer

    規則：
    - Page 是 UI 的 scroll / viewport 單位
    - blocks 永遠跟著 page 回傳
    """
    blocks = DraftBlockSerializer(many=True, read_only=True)

    class Meta:
        model = RevisionPage
        fields = [
            "page_number",
            "width",
            "height",
            "blocks",
        ]


class RevisionSerializer(serializers.ModelSerializer):
    """
    整份文件 Serializer

    規則：
    - 前端進 Draft Review UI 只 call 一支 API
    - 不需要再另外 call page / block
    """
    pages = RevisionPageSerializer(many=True, read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Revision
        fields = [
            "id",
            "filename",
            "page_count",
            "status",
            "file_url",
            "pages",
        ]

    def get_file_url(self, obj):
        """
        回傳 PDF 檔案的 URL

        Dev:  http://127.0.0.1:8000/media/techpacks/xxx.pdf
        Prod: S3 presigned URL (Phase 2)
        """
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class RevisionListSerializer(serializers.ModelSerializer):
    """
    列表用的輕量 Serializer（不含 pages）
    """
    class Meta:
        model = Revision
        fields = [
            "id",
            "filename",
            "page_count",
            "status",
            "created_at",
            "updated_at",
        ]


# ============================================
# UploadedDocument Serializers (P4)
# ============================================

class UploadedDocumentSerializer(serializers.ModelSerializer):
    """
    UploadedDocument serializer for upload pipeline
    """
    file_url = serializers.SerializerMethodField()
    tech_pack_revision_id = serializers.SerializerMethodField()

    class Meta:
        model = UploadedDocument
        fields = [
            'id',
            'filename',
            'file_type',
            'file_size',
            'status',
            'classification_result',
            'extraction_errors',
            'style_revision',
            'tech_pack_revision_id',
            'created_at',
            'updated_at',
            'file_url',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'file_url', 'tech_pack_revision_id']

    def get_tech_pack_revision_id(self, obj):
        """Return tech_pack_revision ID as string for frontend matching"""
        if obj.tech_pack_revision:
            return str(obj.tech_pack_revision.id)
        return None

    def get_file_url(self, obj):
        """Return file URL"""
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class DocumentUploadSerializer(serializers.Serializer):
    """
    Serializer for document upload
    """
    file = serializers.FileField(required=True)

    def validate_file(self, value):
        """Validate file type and size"""
        # Check file extension
        allowed_extensions = ['.pdf', '.xlsx', '.xls']
        file_ext = '.' + value.name.split('.')[-1].lower()
        if file_ext not in allowed_extensions:
            raise serializers.ValidationError(
                f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}"
            )

        # Check file size (max 50MB)
        max_size = 50 * 1024 * 1024  # 50MB
        if value.size > max_size:
            raise serializers.ValidationError(
                f"File size exceeds maximum allowed size (50MB)"
            )

        return value
