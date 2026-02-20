"""
BOM Translator Service
批量翻译 BOMItem 的 material_name → material_name_zh
"""

import logging
from django.utils import timezone
from apps.styles.models import BOMItem
from apps.parsing.utils.translate import batch_translate

logger = logging.getLogger(__name__)


def translate_bom_items(revision_id: str = None, force: bool = False) -> dict:
    """
    批量翻译 BOMItem 的 material_name → material_name_zh

    Args:
        revision_id: 指定 revision，None 表示全部
        force: True 强制重新翻译（即使已有中文）

    Returns:
        dict: {"translated": 10, "skipped": 5, "errors": []}
    """
    # 查询需要翻译的 BOMItem
    queryset = BOMItem.objects.all()

    if revision_id:
        queryset = queryset.filter(revision_id=revision_id)

    if not force:
        # 只翻译 material_name_zh 为空的
        queryset = queryset.filter(material_name_zh='')

    items = list(queryset)

    if not items:
        logger.info("No BOMItems to translate")
        return {"translated": 0, "skipped": 0, "errors": []}

    logger.info(f"Translating {len(items)} BOMItems...")

    # 收集唯一的物料名（去重，节省 API 调用）
    unique_names = list(set(item.material_name for item in items if item.material_name))

    if not unique_names:
        return {"translated": 0, "skipped": len(items), "errors": []}

    logger.info(f"Unique material names: {len(unique_names)}")

    # 批量翻译
    try:
        translations = batch_translate(unique_names)

        # 建立翻译映射
        translation_map = {}
        for i, name in enumerate(unique_names):
            if i < len(translations) and translations[i]:
                translation_map[name] = translations[i]

        logger.info(f"Translation map: {translation_map}")

        # 更新 BOMItem
        translated_count = 0
        skipped_count = 0
        errors = []

        for item in items:
            try:
                if item.material_name in translation_map:
                    item.material_name_zh = translation_map[item.material_name]
                    item.translated_at = timezone.now()
                    item.translated_by = "ai:gpt-4o-mini"
                    item.save(update_fields=['material_name_zh', 'translated_at', 'translated_by'])
                    translated_count += 1
                else:
                    skipped_count += 1
            except Exception as e:
                errors.append(f"BOMItem {item.id}: {str(e)}")

        logger.info(f"Translation completed: {translated_count} translated, {skipped_count} skipped")

        return {
            "translated": translated_count,
            "skipped": skipped_count,
            "errors": errors,
            "translation_map": translation_map
        }

    except Exception as e:
        logger.error(f"Batch translation failed: {e}")
        return {
            "translated": 0,
            "skipped": len(items),
            "errors": [str(e)]
        }


def translate_single_bom_item(item_id: str) -> dict:
    """
    翻译单个 BOMItem
    """
    try:
        item = BOMItem.objects.get(id=item_id)

        if not item.material_name:
            return {"success": False, "error": "material_name is empty"}

        translations = batch_translate([item.material_name])

        if translations and translations[0]:
            item.material_name_zh = translations[0]
            item.translated_at = timezone.now()
            item.translated_by = "ai:gpt-4o-mini"
            item.save(update_fields=['material_name_zh', 'translated_at', 'translated_by'])

            return {
                "success": True,
                "material_name": item.material_name,
                "material_name_zh": item.material_name_zh
            }
        else:
            return {"success": False, "error": "Translation returned empty"}

    except BOMItem.DoesNotExist:
        return {"success": False, "error": f"BOMItem {item_id} not found"}
    except Exception as e:
        return {"success": False, "error": str(e)}
