"""
Django management command: 使用 Vision LLM 提取 Page 7 圖形標註
"""

from django.core.management.base import BaseCommand
from apps.parsing.models_blocks import Revision
from apps.parsing.utils.vision_extract import extract_text_from_pdf_page_vision
from apps.parsing.utils.translate import machine_translate


class Command(BaseCommand):
    help = 'Extract annotations from Page 7 using Vision LLM'

    def handle(self, *args, **options):
        revision_id = 'd3be25b0-01e5-4e3d-afe8-ca9578f1ebb2'
        revision = Revision.objects.get(id=revision_id)
        pdf_path = revision.file.path

        self.stdout.write("\n🔍 使用 GPT-4o Vision 提取 Page 7 圖形標註...")
        self.stdout.write("")

        try:
            # 提取文字
            extracted = extract_text_from_pdf_page_vision(pdf_path, page_number=7)

            self.stdout.write(f"✅ 提取到 {len(extracted)} 個文字塊")
            self.stdout.write("")

            # 顯示結果
            for i, block in enumerate(extracted, 1):
                text = block.get('text', '')
                block_type = block.get('type', 'unknown')

                # 檢查是否包含我們要找的關鍵字
                is_target = any(kw in text.lower() for kw in ['logo placed', 'fro', 'mid', 'hem', 'size m'])

                marker = "⭐" if is_target else "  "

                self.stdout.write(f"{marker}{i:2d}. [{block_type:12s}] {text}")

                # 如果是目標文字，立即翻譯
                if is_target:
                    try:
                        translation = machine_translate(text)
                        self.stdout.write(f"       → {translation}")
                    except Exception as e:
                        self.stdout.write(f"       ✗ 翻譯失敗: {e}")

                self.stdout.write("")

            # 統計
            annotations = [b for b in extracted if b.get('type') in ['annotation', 'dimension', 'callout']]
            self.stdout.write(self.style.SUCCESS(
                f"\n📊 統計: 總計 {len(extracted)} 塊, 其中標註/尺寸 {len(annotations)} 塊"
            ))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"\n❌ 錯誤: {str(e)}"))
            import traceback
            self.stdout.write(traceback.format_exc())
