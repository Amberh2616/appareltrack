"""
Demo 數據生成腳本
生成 10+ Styles 和 30+ SampleRuns 用於展示
"""

import os
import sys
import django
from datetime import datetime, timedelta
from decimal import Decimal
import random

# Django setup
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from apps.styles.models import Style, StyleRevision, BOMItem, ConstructionStep
from apps.samples.models import (
    SampleRequest, SampleRun, SampleRunStatus,
    SampleMWO, SampleCostEstimate, T2POForSample
)
from apps.core.models import Organization
from apps.samples.services.auto_generation import create_with_initial_run
from django.contrib.auth import get_user_model

User = get_user_model()

# 真實 Styles 數據（基於 demo_data/techpacks/ 中的實際 Tech Pack PDFs）
# 這些款式都有對應的真實 Tech Pack 文檔
DEMO_STYLES = [
    # 已存在的款式（補充更多 SampleRuns）
    {
        "style_number": "LW1FLWS",
        "style_name": "Nulu Spaghetti Cami Contrast Neckline Tank with Bra",
        "brand": "Lululemon",
        "season": "SP25",
    },
    {
        "style_number": "LW1FLPS",
        "style_name": "Nulu Cami Tank",
        "brand": "Lululemon",
        "season": "SP25",
    },
    {
        "style_number": "LW1FCSS",
        "style_name": "Define Jacket",  # Energy Bra 改為 Define Jacket（根據現有數據）
        "brand": "Lululemon",
        "season": "FA24",
    },
    # 新款式（來自 Tech Pack PDFs）
    {
        "style_number": "LW1DKES",
        "style_name": "Wunder Train High-Rise Tight 25\"",
        "brand": "Lululemon",
        "season": "WI24",
    },
    {
        "style_number": "LW5GS2S",
        "style_name": "Swiftly Tech Short Sleeve 2.0",
        "brand": "Lululemon",
        "season": "SS25",
    },
    {
        "style_number": "LM7B24S",
        "style_name": "Pace Breaker Short 7\" Lined",
        "brand": "Lululemon",
        "season": "WI25",
    },
    {
        "style_number": "LM7BC4S",
        "style_name": "Pace Breaker 5\" LL White",
        "brand": "Lululemon",
        "season": "SS25",
    },
    {
        "style_number": "LM7BI5S",
        "style_name": "Pace Breaker Iridescent 7\" LL",
        "brand": "Lululemon",
        "season": "SP24",
    },
    {
        "style_number": "LM7BPSS",
        "style_name": "Zeroed In 5\" LL Special Edition Crinkle",
        "brand": "Lululemon",
        "season": "WI25",
    },
    {
        "style_number": "LM3EXOS",
        "style_name": "ABC Pant Classic",
        "brand": "Lululemon",
        "season": "WI24",
    },
    {
        "style_number": "LM5ARES",
        "style_name": "Soft Jersey Tapered Pant",
        "brand": "Lululemon",
        "season": "SS25",
    },
    {
        "style_number": "LM5BBJS",
        "style_name": "Soft Jersey Jogger",
        "brand": "Lululemon",
        "season": "SS25",
    },
]

# Run Types 分布
RUN_TYPES = ["proto", "fit", "sales", "photo"]
RUN_TYPE_WEIGHTS = [0.3, 0.3, 0.25, 0.15]  # Proto 和 Fit 最多

# Priority 分布
PRIORITIES = ["urgent", "normal", "low"]
PRIORITY_WEIGHTS = [0.2, 0.6, 0.2]

# Status 分布（模擬真實工作流）
STATUS_DISTRIBUTION = {
    SampleRunStatus.DRAFT: 0.15,
    SampleRunStatus.MATERIALS_PLANNING: 0.1,
    SampleRunStatus.PO_DRAFTED: 0.1,
    SampleRunStatus.PO_ISSUED: 0.08,
    SampleRunStatus.MWO_DRAFTED: 0.08,
    SampleRunStatus.MWO_ISSUED: 0.07,
    SampleRunStatus.IN_PROGRESS: 0.12,
    SampleRunStatus.SAMPLE_DONE: 0.1,
    SampleRunStatus.ACTUALS_RECORDED: 0.08,
    SampleRunStatus.COSTING_GENERATED: 0.07,
    SampleRunStatus.QUOTED: 0.03,
    SampleRunStatus.ACCEPTED: 0.02,
}


def get_or_create_organization():
    """獲取或創建測試組織"""
    org, created = Organization.objects.get_or_create(
        name="Sabrina Fashion Industrial Corp.",
        defaults={
            "ai_budget_monthly": Decimal("1000.00"),
        }
    )
    if created:
        print(f"✅ Created organization: {org.name}")
    else:
        print(f"ℹ️  Using existing organization: {org.name}")
    return org


def create_style(org, style_data):
    """創建 Style 和 Revision"""
    style, created = Style.objects.get_or_create(
        organization=org,
        style_number=style_data["style_number"],
        defaults={
            "style_name": style_data["style_name"],
            "season": style_data.get("season", "SS25"),
            "customer": style_data.get("brand", "Lululemon"),
        }
    )

    if created:
        print(f"  ✅ Created Style: {style.style_number}")
    else:
        print(f"  ℹ️  Style already exists: {style.style_number}")

    # 創建 Revision A（如果不存在）
    revision, rev_created = StyleRevision.objects.get_or_create(
        organization=org,
        style=style,
        revision_label="Rev A",
        defaults={
            "status": "draft",
        }
    )

    # 檢查是否需要創建 BOM（即使 Revision 已存在）
    existing_bom_count = BOMItem.objects.filter(revision=revision).count()

    if existing_bom_count == 0:
        # 創建基本 BOM（3-5 items）
        bom_items = [
            {
                "material_name": "Nulu Fabric",
                "unit": "yard",
                "unit_price": Decimal("12.50"),
                "category": "fabric",
                "consumption": Decimal("1.5"),
            },
            {
                "material_name": "Elastic Band",
                "unit": "meter",
                "unit_price": Decimal("0.80"),
                "category": "trim",
                "consumption": Decimal("0.5"),
            },
            {
                "material_name": "Care Label",
                "unit": "pcs",
                "unit_price": Decimal("0.05"),
                "category": "label",
                "consumption": Decimal("1.0"),
            },
        ]

        if "Legging" in style_data["style_name"] or "Pant" in style_data["style_name"]:
            bom_items.append({
                "material_name": "Drawcord",
                "unit": "meter",
                "unit_price": Decimal("0.30"),
                "category": "trim",
                "consumption": Decimal("0.8"),
            })

        for idx, item_data in enumerate(bom_items, 1):
            BOMItem.objects.create(
                organization=org,
                revision=revision,
                item_number=idx,
                is_verified=True,  # ← 關鍵修復
                translation_status='confirmed',  # ← 必須設定才能被 snapshot
                **item_data,
            )

        print(f"    └─ Created {len(bom_items)} BOM items")
    else:
        print(f"    └─ Revision A already has {existing_bom_count} BOM items")

    # 檢查是否需要創建 Construction Steps（獨立檢查）
    existing_construction_count = ConstructionStep.objects.filter(revision=revision).count()

    if existing_construction_count == 0:
        # 創建基本 Construction Steps
        ConstructionStep.objects.create(
            organization=org,
            revision=revision,
            step_number=1,
            description="Cut main fabric according to pattern",
            stitch_type="",
            machine_type="cutting",
            is_verified=True,  # ← 關鍵修復
            translation_status='confirmed',  # ← 必須設定才能被 snapshot
        )
        ConstructionStep.objects.create(
            organization=org,
            revision=revision,
            step_number=2,
            description="Sew side seams and inseams",
            stitch_type="lock stitch",
            machine_type="single needle",
            is_verified=True,  # ← 關鍵修復
            translation_status='confirmed',  # ← 必須設定才能被 snapshot
        )
        ConstructionStep.objects.create(
            organization=org,
            revision=revision,
            step_number=3,
            description="Attach elastic waistband",
            stitch_type="cover stitch",
            machine_type="cover seam",
            is_verified=True,  # ← 關鍵修復
            translation_status='confirmed',  # ← 必須設定才能被 snapshot
        )

        print(f"    └─ Created 3 Construction steps")
    else:
        print(f"    └─ Revision A already has {existing_construction_count} Construction steps")

    return style, revision


def create_sample_request_with_runs(org, revision, brand_name, num_runs=3):
    """
    使用 P0-1 自動生成服務創建 SampleRequest
    這樣會自動生成第一個 Run + RunBOMLine + RunOperation + MWO + Estimate
    """
    priority = random.choices(PRIORITIES, weights=PRIORITY_WEIGHTS)[0]

    # 設置 due_date（7-30 天後）
    due_days = random.randint(7, 30)
    due_date = datetime.now().date() + timedelta(days=due_days)

    # 準備 payload
    payload = {
        'request_type': 'proto',
        'request_type_custom': '',
        'quantity_requested': 3,
        'priority': priority,
        'due_date': due_date,
        'brand_name': brand_name,
        'need_quote_first': False,
        'notes_internal': 'Auto-generated demo data',
        'notes_customer': '',
    }

    try:
        # 使用 P0-1 自動生成服務
        sample_request, sample_run, documents = create_with_initial_run(
            revision_id=str(revision.id),
            payload=payload,
            user=None,
            skip_validation=True,  # 跳過 BOM 驗證
        )

        print(f"      ✅ Created Request with auto-generated Run #1")
        print(f"         └─ MWO: {documents.get('mwo_no', 'N/A')}")
        print(f"         └─ Estimate: {documents.get('estimate_no', 'N/A')}")

        # 只返回自動生成的 Run #1（完整數據）
        return sample_request, [sample_run]

    except Exception as e:
        print(f"      ❌ Failed to create request: {e}")
        return None, []


def main():
    """主函數"""
    print("\n" + "="*60)
    print("🎯 Fashion Production System - Demo 數據生成")
    print("="*60 + "\n")

    org = get_or_create_organization()
    print(f"📦 Organization: {org.name}\n")

    total_styles = 0
    total_runs = 0

    # 創建 Styles 和 SampleRuns（每個 Style 只創建 1 個 Run）
    for style_data in DEMO_STYLES:
        style, revision = create_style(org, style_data)
        total_styles += 1

        # 每個 Style 創建 1 個 SampleRequest（含 1 個 Run）
        request, runs = create_sample_request_with_runs(org, revision, style_data["brand"], num_runs=1)

        if request and runs:
            total_runs += len(runs)
            print(f"    └─ Created {len(runs)} Run")
        else:
            print(f"    └─ ❌ Failed to create request")

    print("\n" + "="*60)
    print(f"✅ Demo 數據生成完成！")
    print(f"   📊 Styles: {total_styles}")
    print(f"   📊 SampleRuns: {total_runs}")
    print("="*60 + "\n")

    # 顯示狀態分布
    print("📈 Run 狀態分布：")
    status_counts = {}
    for run in SampleRun.objects.all():
        status_counts[run.status] = status_counts.get(run.status, 0) + 1

    for status, count in sorted(status_counts.items()):
        print(f"   {status}: {count}")

    print("\n" + "="*60)
    print("🎉 Demo 數據已就緒！")
    print("   下一步：在 Kanban 看板中測試狀態轉換流程")
    print("   訪問：http://localhost:3000/dashboard/samples/kanban")
    print("="*60 + "\n")


if __name__ == "__main__":
    main()
