"""
Measurement Translator Service
批量翻譯 Measurement 的 point_name → point_name_zh
"""

import logging
from django.utils import timezone
from apps.styles.models import Measurement
from apps.parsing.utils.translate import batch_translate

logger = logging.getLogger(__name__)


def translate_measurements(revision_id: str = None, force: bool = False) -> dict:
    """
    批量翻譯 Measurement 的 point_name → point_name_zh

    Args:
        revision_id: 指定 revision，None 表示全部
        force: True 強制重新翻譯（即使已有中文）

    Returns:
        dict: {"translated": 10, "skipped": 5, "errors": []}
    """
    # 查詢需要翻譯的 Measurement
    queryset = Measurement.objects.all()

    if revision_id:
        queryset = queryset.filter(revision_id=revision_id)

    if not force:
        # 只翻譯 point_name_zh 為空的
        queryset = queryset.filter(point_name_zh='')

    items = list(queryset)

    if not items:
        logger.info("No Measurements to translate")
        return {"translated": 0, "skipped": 0, "errors": []}

    logger.info(f"Translating {len(items)} Measurements...")

    # 收集唯一的尺寸點名（去重，節省 API 調用）
    unique_names = list(set(item.point_name for item in items if item.point_name))

    if not unique_names:
        return {"translated": 0, "skipped": len(items), "errors": []}

    logger.info(f"Unique point names: {len(unique_names)}")

    # 批量翻譯
    try:
        translations = batch_translate(unique_names)

        # 建立翻譯映射
        translation_map = {}
        for i, name in enumerate(unique_names):
            if i < len(translations) and translations[i]:
                translation_map[name] = translations[i]

        logger.info(f"Translation map: {translation_map}")

        # 更新 Measurement
        translated_count = 0
        skipped_count = 0
        errors = []

        for item in items:
            try:
                if item.point_name in translation_map:
                    item.point_name_zh = translation_map[item.point_name]
                    item.save(update_fields=['point_name_zh'])
                    translated_count += 1
                else:
                    skipped_count += 1
            except Exception as e:
                errors.append(f"Measurement {item.id}: {str(e)}")

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


def translate_single_measurement(item_id: str) -> dict:
    """
    翻譯單個 Measurement
    """
    try:
        item = Measurement.objects.get(id=item_id)

        if not item.point_name:
            return {"success": False, "error": "point_name is empty"}

        translations = batch_translate([item.point_name])

        if translations and translations[0]:
            item.point_name_zh = translations[0]
            item.save(update_fields=['point_name_zh'])

            return {
                "success": True,
                "point_name": item.point_name,
                "point_name_zh": item.point_name_zh
            }
        else:
            return {"success": False, "error": "Translation returned empty"}

    except Measurement.DoesNotExist:
        return {"success": False, "error": f"Measurement {item_id} not found"}
    except Exception as e:
        return {"success": False, "error": str(e)}
