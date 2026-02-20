"""
Block-Based Parsing Models
基於真實 Tech Pack Page 4 結構設計

核心設計：
- PDF 是不可變背景
- Block 是最小 review 單位
- 座標是第一級公民（bbox_x/y/width/height）
- 翻譯是疊加狀態，不覆寫原文

參考: backend/demo_data/DEMO_TECHPACKS.md Page 4
"""

import uuid
from django.db import models


class Revision(models.Model):
    """
    整份 Tech Pack PDF
    """
    STATUS_CHOICES = [
        ("uploaded", "Uploaded"),
        ("parsing", "Parsing"),
        ("parsed", "Parsed"),
        ("reviewing", "Reviewing"),
        ("completed", "Completed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # 檔案
    file = models.FileField(
        upload_to='techpacks/',
        help_text="Tech Pack PDF 檔案"
    )
    filename = models.CharField(max_length=255)
    page_count = models.PositiveIntegerField()

    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="uploaded"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'revisions'
        verbose_name = 'Revision'
        verbose_name_plural = 'Revisions'

    def __str__(self):
        return self.filename

    @property
    def translation_stats(self):
        """整份文件的翻譯進度統計"""
        from django.db.models import Count, Q

        # 一次查詢所有 blocks 的狀態
        stats = DraftBlock.objects.filter(
            page__revision=self
        ).aggregate(
            total=Count('id'),
            done=Count('id', filter=Q(translation_status='done')),
            pending=Count('id', filter=Q(translation_status='pending')),
            failed=Count('id', filter=Q(translation_status='failed')),
            skipped=Count('id', filter=Q(translation_status='skipped')),
            translating=Count('id', filter=Q(translation_status='translating')),
        )

        total = stats['total'] or 0
        done = stats['done'] or 0
        skipped = stats['skipped'] or 0
        completed = done + skipped
        progress = round(completed / total * 100) if total > 0 else 0

        return {
            'total': total,
            'done': done,
            'pending': stats['pending'] or 0,
            'failed': stats['failed'] or 0,
            'skipped': skipped,
            'translating': stats['translating'] or 0,
            'progress': progress,
        }


class RevisionPage(models.Model):
    """
    PDF 的單頁
    """
    revision = models.ForeignKey(
        Revision, related_name="pages", on_delete=models.CASCADE
    )

    page_number = models.PositiveIntegerField()
    width = models.PositiveIntegerField()   # PDF page width (points)
    height = models.PositiveIntegerField()  # PDF page height (points)

    class Meta:
        db_table = 'revision_pages'
        unique_together = ("revision", "page_number")
        ordering = ["page_number"]
        verbose_name = 'Revision Page'
        verbose_name_plural = 'Revision Pages'

    def __str__(self):
        return f"Page {self.page_number}"

    @property
    def translation_stats(self):
        """翻譯進度統計"""
        blocks = self.blocks.all()
        total = blocks.count()
        if total == 0:
            return {'total': 0, 'done': 0, 'pending': 0, 'failed': 0, 'progress': 100}

        done = blocks.filter(translation_status='done').count()
        pending = blocks.filter(translation_status='pending').count()
        failed = blocks.filter(translation_status='failed').count()
        skipped = blocks.filter(translation_status='skipped').count()

        # 進度計算：done + skipped 視為完成
        completed = done + skipped
        progress = round(completed / total * 100) if total > 0 else 0

        return {
            'total': total,
            'done': done,
            'pending': pending,
            'failed': failed,
            'skipped': skipped,
            'progress': progress,
        }


class DraftBlock(models.Model):
    """
    核心 Model：Page 4 JSON 的資料庫版本

    範例（Callout）：
    {
        "block_type": "callout",
        "bbox": {"x": 90, "y": 120, "width": 280, "height": 40},
        "source_text": "binding with encased elastic + topstitch",
        "translated_text": "包邊內包鬆緊帶並加上表面壓線",
        "status": "auto"
    }
    """
    BLOCK_TYPE_CHOICES = [
        ("callout", "Callout"),              # 一條紅線 + 說明
        ("legend", "Legend"),                # 圖例區
        ("section_title", "Section Title"),  # 區塊標題
        ("description", "Description"),      # 段落說明
        ("table", "Table"),                  # 整張表格
    ]

    STATUS_CHOICES = [
        ("auto", "Auto Translated"),         # AI 自動翻譯
        ("edited", "Edited"),                # 人工修改過
        ("approved", "Approved"),            # 已確認
    ]

    # 翻譯狀態（延遲翻譯優化）
    TRANSLATION_STATUS_CHOICES = [
        ("pending", "Pending"),              # 等待翻譯
        ("translating", "Translating"),      # 翻譯中
        ("done", "Done"),                    # 翻譯完成
        ("failed", "Failed"),                # 翻譯失敗
        ("skipped", "Skipped"),              # 跳過（空白/重複）
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    page = models.ForeignKey(
        RevisionPage, related_name="blocks", on_delete=models.CASCADE
    )

    block_type = models.CharField(
        max_length=30, choices=BLOCK_TYPE_CHOICES
    )

    # BBox: 第一級欄位（效能 + 查詢友善）
    bbox_x = models.FloatField()
    bbox_y = models.FloatField()
    bbox_width = models.FloatField()
    bbox_height = models.FloatField()

    # 文字內容
    source_text = models.TextField(
        help_text="原文（英文，locked，永不覆寫）"
    )
    translated_text = models.TextField(
        help_text="AI 翻譯（中文，機翻初稿）"
    )
    edited_text = models.TextField(
        blank=True,
        null=True,
        help_text="人工修正後的中文（可選）"
    )

    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="auto"
    )

    # ⭐ 翻譯狀態（延遲翻譯優化）
    translation_status = models.CharField(
        max_length=20,
        choices=TRANSLATION_STATUS_CHOICES,
        default="pending",
        help_text="翻譯處理狀態"
    )
    translation_error = models.TextField(
        blank=True,
        null=True,
        help_text="翻譯失敗時的錯誤訊息"
    )
    translation_retry_count = models.PositiveIntegerField(
        default=0,
        help_text="翻譯重試次數"
    )

    # ⭐ 翻譯疊加位置（用戶可拖動調整）
    overlay_x = models.FloatField(
        null=True,
        blank=True,
        help_text="翻譯文字框 X 位置（用戶調整後）"
    )
    overlay_y = models.FloatField(
        null=True,
        blank=True,
        help_text="翻譯文字框 Y 位置（用戶調整後）"
    )
    overlay_visible = models.BooleanField(
        default=True,
        help_text="是否在 MWO 中顯示此翻譯"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'draft_blocks'
        ordering = ["page__page_number", "bbox_y", "bbox_x"]
        verbose_name = 'Draft Block'
        verbose_name_plural = 'Draft Blocks'
        indexes = [
            models.Index(fields=['page', 'block_type']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.block_type} (Page {self.page.page_number})"


class DraftBlockHistory(models.Model):
    """
    Block 修改歷史（可選，但強烈建議）

    用途：
    - 追蹤誰改了什麼
    - 未來做審稿紀錄 / 回溯
    - 避免 edited_text 被覆蓋
    """
    block = models.ForeignKey(
        DraftBlock, related_name="histories", on_delete=models.CASCADE
    )

    previous_text = models.TextField()
    new_text = models.TextField()

    changed_by = models.CharField(max_length=100, blank=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'draft_block_histories'
        ordering = ['-changed_at']
        verbose_name = 'Draft Block History'
        verbose_name_plural = 'Draft Block Histories'

    def __str__(self):
        return f"{self.block} changed at {self.changed_at}"
