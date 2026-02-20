"""
TechPack Translator Service
批量翻译 DraftBlock 的 source_text → translated_text
"""

import logging
from django.utils import timezone
from apps.parsing.models_blocks import DraftBlock, Revision
from apps.parsing.utils.translate import batch_translate

logger = logging.getLogger(__name__)


def translate_draft_blocks(revision_id: str, force: bool = False) -> dict:
    """
    批量翻译 DraftBlock 的 source_text → translated_text

    Args:
        revision_id: TechPack Revision ID
        force: True 强制重新翻译（即使已有翻译）

    Returns:
        dict: {"translated": 10, "skipped": 5, "errors": [], "total": 15}
    """
    try:
        revision = Revision.objects.get(id=revision_id)
    except Revision.DoesNotExist:
        return {
            "translated": 0,
            "skipped": 0,
            "errors": [f"Revision {revision_id} not found"],
            "total": 0
        }

    # 查询需要翻译的 DraftBlock
    queryset = DraftBlock.objects.filter(page__revision=revision)
    total_count = queryset.count()

    if not force:
        # 只翻译 translated_text 为空的
        queryset = queryset.filter(translated_text='')

    blocks = list(queryset)

    if not blocks:
        logger.info(f"No DraftBlocks to translate for revision {revision_id}")
        return {
            "translated": 0,
            "skipped": total_count,
            "errors": [],
            "total": total_count
        }

    logger.info(f"Translating {len(blocks)} DraftBlocks for revision {revision_id}...")

    # 收集唯一的原文（去重，节省 API 调用）
    unique_texts = list(set(block.source_text for block in blocks if block.source_text))

    if not unique_texts:
        return {
            "translated": 0,
            "skipped": len(blocks),
            "errors": [],
            "total": total_count
        }

    logger.info(f"Unique source texts: {len(unique_texts)}")

    # 批量翻译
    try:
        translations = batch_translate(unique_texts)

        # 建立翻译映射
        translation_map = {}
        for i, text in enumerate(unique_texts):
            if i < len(translations) and translations[i]:
                translation_map[text] = translations[i]

        logger.info(f"Translation map size: {len(translation_map)}")

        # 更新 DraftBlock
        translated_count = 0
        skipped_count = 0
        errors = []

        for block in blocks:
            try:
                if block.source_text in translation_map:
                    block.translated_text = translation_map[block.source_text]
                    block.status = 'auto'
                    block.save(update_fields=['translated_text', 'status', 'updated_at'])
                    translated_count += 1
                else:
                    skipped_count += 1
            except Exception as e:
                errors.append(f"DraftBlock {block.id}: {str(e)}")

        logger.info(f"Translation completed: {translated_count} translated, {skipped_count} skipped")

        return {
            "translated": translated_count,
            "skipped": skipped_count + (total_count - len(blocks)),
            "errors": errors,
            "total": total_count
        }

    except Exception as e:
        logger.error(f"Batch translation failed: {e}")
        return {
            "translated": 0,
            "skipped": len(blocks),
            "errors": [str(e)],
            "total": total_count
        }
