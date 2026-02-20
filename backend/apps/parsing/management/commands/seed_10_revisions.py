# backend/apps/parsing/management/commands/seed_10_revisions.py
"""
批次建立 10 個測試 Revision，模擬真實「一次審 10-50 份」的場景
"""
import uuid
from django.core.management.base import BaseCommand
from apps.parsing.models_blocks import Revision, RevisionPage, DraftBlock


SAMPLE_TECH_PACKS = [
    {
        "filename": "SP25-Nulu-Align-Tank.pdf",
        "blocks": [
            {"text": "neckline binding with encased elastic", "bbox": (100, 100, 300, 20)},
            {"text": "armhole binding with lettuce edge", "bbox": (100, 150, 280, 18)},
            {"text": "internal shelf bra with removable cups", "bbox": (100, 200, 320, 20)},
            {"text": "hem binding with encased elastic", "bbox": (100, 250, 260, 18)},
            {"text": "built-in shelf bra layer", "bbox": (100, 300, 240, 18)},
        ],
    },
    {
        "filename": "SP25-Luxtreme-Wunder-Train-HR-Tight.pdf",
        "blocks": [
            {"text": "waistband with interior drawcord", "bbox": (110, 110, 290, 20)},
            {"text": "side pockets with hidden zipper", "bbox": (110, 160, 280, 18)},
            {"text": "gusset with flat seam construction", "bbox": (110, 210, 300, 20)},
            {"text": "ankle binding with reflective detail", "bbox": (110, 260, 310, 18)},
            {"text": "center back zippered pocket", "bbox": (110, 310, 270, 18)},
        ],
    },
    {
        "filename": "SP25-Nulu-Define-Jacket.pdf",
        "blocks": [
            {"text": "collar stand with snap closure", "bbox": (95, 95, 280, 20)},
            {"text": "front zipper with chin guard", "bbox": (95, 145, 270, 18)},
            {"text": "thumbhole cuffs with binding", "bbox": (95, 195, 260, 18)},
            {"text": "side seam pockets with zipper", "bbox": (95, 245, 280, 20)},
            {"text": "hem with interior drawcord", "bbox": (95, 295, 250, 18)},
        ],
    },
    {
        "filename": "SP25-Everlux-Fast-And-Free-Short.pdf",
        "blocks": [
            {"text": "waistband with continuous drawcord", "bbox": (105, 105, 310, 20)},
            {"text": "side pockets with mesh liner", "bbox": (105, 155, 280, 18)},
            {"text": "back zippered pocket with reflective logo", "bbox": (105, 205, 340, 20)},
            {"text": "brief liner with flat seam", "bbox": (105, 255, 260, 18)},
            {"text": "hem with raw cut edge", "bbox": (105, 305, 240, 18)},
        ],
    },
    {
        "filename": "SP25-SmoothCover-Energy-Bra.pdf",
        "blocks": [
            {"text": "neckline binding with encased elastic", "bbox": (100, 100, 300, 20)},
            {"text": "underband with power mesh backing", "bbox": (100, 150, 310, 18)},
            {"text": "straps with adjustable slider", "bbox": (100, 200, 270, 18)},
            {"text": "back closure with hook and eye", "bbox": (100, 250, 300, 20)},
            {"text": "removable cups with pocket", "bbox": (100, 300, 270, 18)},
        ],
    },
    {
        "filename": "SP25-Luon-Scuba-Hoodie.pdf",
        "blocks": [
            {"text": "hood with drawcord and metal eyelets", "bbox": (90, 90, 320, 20)},
            {"text": "front zipper with logo puller", "bbox": (90, 140, 280, 18)},
            {"text": "kangaroo pocket with rib trim", "bbox": (90, 190, 290, 18)},
            {"text": "cuffs with thumbholes", "bbox": (90, 240, 230, 18)},
            {"text": "hem with interior drawcord", "bbox": (90, 290, 260, 18)},
        ],
    },
    {
        "filename": "SP25-Swift-Speed-HR-Tight.pdf",
        "blocks": [
            {"text": "waistband with perforated ventilation", "bbox": (110, 110, 320, 20)},
            {"text": "side pockets with bonded seam", "bbox": (110, 160, 290, 18)},
            {"text": "reflective details at calf", "bbox": (110, 210, 270, 18)},
            {"text": "gusset with seamless construction", "bbox": (110, 260, 310, 20)},
            {"text": "ankle zippers with reflective pull", "bbox": (110, 310, 300, 18)},
        ],
    },
    {
        "filename": "SP25-Nulu-Align-HR-Pant.pdf",
        "blocks": [
            {"text": "waistband with hidden pocket", "bbox": (100, 100, 280, 20)},
            {"text": "side pockets with drop-in design", "bbox": (100, 150, 300, 18)},
            {"text": "gusset with flat seam", "bbox": (100, 200, 240, 18)},
            {"text": "hem with raw cut edge", "bbox": (100, 250, 230, 18)},
            {"text": "continuous drawcord at waist", "bbox": (100, 300, 280, 20)},
        ],
    },
    {
        "filename": "SP25-Everlux-Invigorate-HR-Tight.pdf",
        "blocks": [
            {"text": "waistband with interior key pocket", "bbox": (105, 105, 310, 20)},
            {"text": "side pockets with mesh backing", "bbox": (105, 155, 290, 18)},
            {"text": "back waistband pocket with zipper", "bbox": (105, 205, 310, 20)},
            {"text": "gusset with bonded construction", "bbox": (105, 255, 300, 18)},
            {"text": "ankle with reflective logo", "bbox": (105, 305, 270, 18)},
        ],
    },
    {
        "filename": "SP25-Luxtreme-Wunder-Under-HR-Tight.pdf",
        "blocks": [
            {"text": "waistband with hidden zipper pocket", "bbox": (100, 100, 310, 20)},
            {"text": "side seams with contrast piping", "bbox": (100, 150, 290, 18)},
            {"text": "gusset with flat lock seam", "bbox": (100, 200, 270, 18)},
            {"text": "ankle with logo heat transfer", "bbox": (100, 250, 290, 20)},
            {"text": "continuous drawcord at waist interior", "bbox": (100, 300, 330, 18)},
        ],
    },
]


class Command(BaseCommand):
    help = "批次建立 10 個測試 Revision（模擬真實審稿場景）"

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("🚀 開始建立 10 個測試 Revision..."))

        created_ids = []

        for idx, data in enumerate(SAMPLE_TECH_PACKS, start=1):
            filename = data["filename"]

            # 建立 Revision
            revision = Revision.objects.create(
                id=uuid.uuid4(),
                filename=filename,
                page_count=1,
                status="parsed",
            )

            # 建立 Page 4
            page = RevisionPage.objects.create(
                revision=revision,
                page_number=4,
                width=612,
                height=792,
            )

            # 建立 Blocks
            for block_data in data["blocks"]:
                text = block_data["text"]
                bbox = block_data["bbox"]

                # 簡單機翻（實際會用 GPT，這裡先用假資料）
                translated = self._fake_translate(text)

                DraftBlock.objects.create(
                    page=page,
                    block_type="callout",
                    bbox_x=bbox[0],
                    bbox_y=bbox[1],
                    bbox_width=bbox[2],
                    bbox_height=bbox[3],
                    source_text=text,
                    translated_text=translated,
                    edited_text=None,
                    status="auto",
                )

            created_ids.append(str(revision.id))

            self.stdout.write(
                self.style.SUCCESS(
                    f"  ✅ [{idx}/10] {filename} - {len(data['blocks'])} blocks - ID: {revision.id}"
                )
            )

        self.stdout.write(self.style.SUCCESS(f"\n🎉 成功建立 10 個 Revision！\n"))
        self.stdout.write(self.style.WARNING("📋 測試網址：\n"))

        for idx, rev_id in enumerate(created_ids, start=1):
            url = f"http://localhost:3000/dashboard/revisions/{rev_id}/review"
            self.stdout.write(f"  {idx}. {url}")

        self.stdout.write(self.style.WARNING("\n💡 下一步：\n"))
        self.stdout.write("  1. 開啟上面任一網址")
        self.stdout.write("  2. 測試批次審稿流程（一次審 3-5 份）")
        self.stdout.write("  3. 評估：能否重複用於 50 份？")

    def _fake_translate(self, text: str) -> str:
        """簡單假翻譯（實際會用 GPT-4o Mini）"""
        mapping = {
            "neckline": "領口",
            "binding": "包邊",
            "elastic": "鬆緊帶",
            "armhole": "袖籠",
            "lettuce edge": "荷葉邊",
            "shelf bra": "內襯胸墊",
            "removable": "可拆式",
            "cups": "罩杯",
            "hem": "下擺",
            "waistband": "腰帶",
            "drawcord": "抽繩",
            "pocket": "口袋",
            "zipper": "拉鍊",
            "gusset": "三角褲襠",
            "flat seam": "平縫",
            "ankle": "腳踝",
            "reflective": "反光",
            "collar": "領子",
            "snap": "按扣",
            "chin guard": "下巴護檔",
            "thumbhole": "拇指孔",
            "cuff": "袖口",
            "mesh": "網布",
            "liner": "內襯",
            "brief": "三角褲",
            "raw cut": "毛邊",
            "power mesh": "彈力網",
            "strap": "肩帶",
            "adjustable": "可調式",
            "hook and eye": "鉤扣",
            "hood": "帽子",
            "metal eyelet": "金屬扣眼",
            "logo puller": "品牌拉鍊頭",
            "kangaroo": "袋鼠",
            "rib trim": "羅紋滾邊",
            "perforated": "打孔",
            "ventilation": "透氣",
            "bonded": "黏合",
            "seamless": "無縫",
            "hidden": "隱藏式",
            "drop-in": "投入式",
            "continuous": "連續",
            "key": "鑰匙",
            "backing": "背襯",
            "heat transfer": "熱轉印",
            "interior": "內部",
            "contrast piping": "撞色滾邊",
        }

        result = text
        for en, zh in mapping.items():
            result = result.replace(en, zh)

        return result
