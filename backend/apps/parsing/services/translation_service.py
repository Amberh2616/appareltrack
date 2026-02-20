"""
Translation Service - 延遲翻譯優化

提供按需翻譯功能：
- 單個 Block 翻譯
- 單頁批量翻譯
- 整份文件翻譯
- 失敗重試
"""

import logging
from typing import List, Optional
from django.db import transaction

from apps.parsing.models_blocks import DraftBlock, RevisionPage, Revision as TechPackRevision
from apps.parsing.utils.translate import batch_translate, machine_translate

logger = logging.getLogger(__name__)

# 最大重試次數
MAX_RETRY_COUNT = 3


def translate_block(block: DraftBlock) -> bool:
    """
    翻譯單個 Block

    Returns:
        bool: 是否成功
    """
    if block.translation_status == 'done':
        return True

    if block.translation_status == 'skipped':
        return True

    if block.translation_retry_count >= MAX_RETRY_COUNT:
        logger.warning(f"Block {block.id} exceeded max retries")
        return False

    try:
        block.translation_status = 'translating'
        block.save(update_fields=['translation_status', 'updated_at'])

        # 翻譯
        translated = machine_translate(block.source_text)

        block.translated_text = translated
        block.translation_status = 'done'
        block.translation_error = None
        block.save(update_fields=['translated_text', 'translation_status', 'translation_error', 'updated_at'])

        return True

    except Exception as e:
        logger.error(f"Translation failed for block {block.id}: {e}")
        block.translation_status = 'failed'
        block.translation_error = str(e)
        block.translation_retry_count += 1
        block.save(update_fields=['translation_status', 'translation_error', 'translation_retry_count', 'updated_at'])
        return False


def translate_page(page: RevisionPage, force: bool = False) -> dict:
    """
    翻譯單頁所有 pending blocks（方案 B：批量翻譯）

    Args:
        page: RevisionPage instance
        force: 是否重新翻譯已翻譯的 blocks

    Returns:
        dict: {'total': int, 'success': int, 'failed': int}
    """
    if force:
        blocks = page.blocks.exclude(translation_status='skipped')
    else:
        blocks = page.blocks.filter(translation_status='pending')

    blocks = list(blocks)
    if not blocks:
        return {'total': 0, 'success': 0, 'failed': 0}

    # 標記為翻譯中
    block_ids = [b.id for b in blocks]
    DraftBlock.objects.filter(id__in=block_ids).update(translation_status='translating')

    # ⭐ 批量翻譯（方案 B）：收集所有文字一次翻譯
    texts = [b.source_text for b in blocks]

    try:
        translations = batch_translate(texts)
    except Exception as e:
        logger.error(f"Batch translation failed for page {page.id}: {e}")
        # 全部標記失敗
        DraftBlock.objects.filter(id__in=block_ids).update(
            translation_status='failed',
            translation_error=str(e)
        )
        return {'total': len(blocks), 'success': 0, 'failed': len(blocks)}

    # 更新翻譯結果
    success_count = 0
    failed_count = 0

    with transaction.atomic():
        for i, block in enumerate(blocks):
            translation = translations[i] if i < len(translations) else ''

            if translation:
                block.translated_text = translation
                block.translation_status = 'done'
                block.translation_error = None
                success_count += 1
            else:
                block.translation_status = 'failed'
                block.translation_error = 'Empty translation returned'
                failed_count += 1

            block.save(update_fields=['translated_text', 'translation_status', 'translation_error', 'updated_at'])

    logger.info(f"Page {page.page_number} translation: {success_count} success, {failed_count} failed")

    return {
        'total': len(blocks),
        'success': success_count,
        'failed': failed_count,
    }


def translate_document(revision: TechPackRevision, mode: str = 'missing_only') -> dict:
    """
    翻譯整份文件

    Args:
        revision: TechPackRevision instance
        mode: 'missing_only' (只翻譯 pending) | 'all' (全部重新翻譯)

    Returns:
        dict: {'total': int, 'success': int, 'failed': int, 'pages': int}
    """
    pages = revision.pages.all().order_by('page_number')

    total_stats = {
        'total': 0,
        'success': 0,
        'failed': 0,
        'pages': 0,
    }

    force = mode == 'all'

    for page in pages:
        stats = translate_page(page, force=force)
        total_stats['total'] += stats['total']
        total_stats['success'] += stats['success']
        total_stats['failed'] += stats['failed']
        if stats['total'] > 0:
            total_stats['pages'] += 1

    logger.info(f"Document {revision.id} translation completed: {total_stats}")

    return total_stats


def retry_failed_blocks(revision: TechPackRevision) -> dict:
    """
    重試失敗的 blocks

    Returns:
        dict: {'total': int, 'success': int, 'failed': int}
    """
    failed_blocks = DraftBlock.objects.filter(
        page__revision=revision,
        translation_status='failed',
        translation_retry_count__lt=MAX_RETRY_COUNT
    )

    total = failed_blocks.count()
    if total == 0:
        return {'total': 0, 'success': 0, 'failed': 0}

    # 按頁分組處理
    pages_with_failed = RevisionPage.objects.filter(
        revision=revision,
        blocks__translation_status='failed',
        blocks__translation_retry_count__lt=MAX_RETRY_COUNT
    ).distinct()

    success_count = 0
    failed_count = 0

    for page in pages_with_failed:
        blocks = list(page.blocks.filter(
            translation_status='failed',
            translation_retry_count__lt=MAX_RETRY_COUNT
        ))

        if not blocks:
            continue

        # 增加重試次數
        for b in blocks:
            b.translation_retry_count += 1
            b.save(update_fields=['translation_retry_count'])

        # 批量翻譯
        texts = [b.source_text for b in blocks]

        try:
            translations = batch_translate(texts)

            for i, block in enumerate(blocks):
                translation = translations[i] if i < len(translations) else ''

                if translation:
                    block.translated_text = translation
                    block.translation_status = 'done'
                    block.translation_error = None
                    success_count += 1
                else:
                    block.translation_status = 'failed'
                    block.translation_error = 'Empty translation on retry'
                    failed_count += 1

                block.save(update_fields=['translated_text', 'translation_status', 'translation_error', 'updated_at'])

        except Exception as e:
            logger.error(f"Retry batch translation failed: {e}")
            for block in blocks:
                block.translation_status = 'failed'
                block.translation_error = str(e)
                block.save(update_fields=['translation_status', 'translation_error', 'updated_at'])
                failed_count += 1

    return {
        'total': total,
        'success': success_count,
        'failed': failed_count,
    }


def get_translation_progress(revision: TechPackRevision) -> dict:
    """
    獲取翻譯進度

    Returns:
        dict: {
            'total': int,
            'done': int,
            'pending': int,
            'failed': int,
            'skipped': int,
            'progress': int (0-100),
            'pages': [{'page_number': int, 'progress': int, ...}, ...]
        }
    """
    doc_stats = revision.translation_stats

    # 每頁進度
    pages_progress = []
    for page in revision.pages.all().order_by('page_number'):
        page_stats = page.translation_stats
        pages_progress.append({
            'page_id': str(page.id) if hasattr(page, 'id') else page.page_number,
            'page_number': page.page_number,
            **page_stats
        })

    return {
        **doc_stats,
        'pages': pages_progress,
    }
