# BOM 三階段串通設計

**狀態：** ✅ 已完成 (2026-01-13)
**關聯 Phase：** P19

---

## 問題分析

現有 BOMItem 模型有 `consumption_maturity` 欄位，但：
1. 只有一個 `consumption` 欄位存儲當前值
2. 沒有記錄各階段的歷史用量
3. UsageLine 和 MaterialRequirement 複製用量但不回寫

## 設計方案：BOMItem 用量演進

### 新增欄位到 BOMItem

```python
# BOMItem 用量三階段
consumption              # 當前用量（向後兼容）
consumption_maturity     # 成熟度狀態（已有）

# 新增：各階段用量記錄
pre_estimate_value       # 預估用量（工廠經驗值）
confirmed_value          # 確認用量（Marker Report / 樣衣實際）
locked_value             # 鎖定用量（大貨確認後不可改）

# 用量變更追蹤
consumption_history      # JSONField: 記錄每次變更
last_consumption_update  # 最後更新時間
```

### 用量演進流程

```
【Phase 1: 開發階段】
BOMItem 創建
├── consumption = AI 提取值 (或 0)
├── consumption_maturity = 'unknown'
└── pre_estimate_value = NULL

         │ 工廠填寫預估
         ↓

【Phase 2: 樣衣階段 - Run 1-3】
BOMItem 更新
├── pre_estimate_value = 工廠經驗值 (e.g., 0.82 yd)
├── consumption_maturity = 'pre_estimate'
└── UsageLine.consumption = pre_estimate_value

         │ Marker Report 確認
         ↓

【Phase 2: 樣衣階段 - 確認】
BOMItem 更新
├── confirmed_value = Marker 實際值 (e.g., 0.78 yd)
├── consumption_maturity = 'confirmed'
└── UsageLine.consumption = confirmed_value

         │ 大貨報價確認
         ↓

【Phase 3: 大貨階段】
BOMItem 更新
├── locked_value = confirmed_value (鎖定)
├── consumption_maturity = 'locked'
├── 不可再修改 ❌
└── MaterialRequirement.consumption_per_piece = locked_value
```

### API 設計

```
# 更新預估用量
PATCH /api/v2/style-revisions/{id}/bom/{item_id}/
Body: { "pre_estimate_value": "0.82" }
→ 自動設置 consumption_maturity = 'pre_estimate'
→ 自動同步到關聯的 UsageLine

# 確認用量
POST /api/v2/style-revisions/{id}/bom/{item_id}/confirm-consumption/
Body: { "confirmed_value": "0.78", "source": "marker_report" }
→ 設置 consumption_maturity = 'confirmed'
→ 同步到所有關聯 UsageLine

# 鎖定用量（大貨報價確認時）
POST /api/v2/style-revisions/{id}/bom/{item_id}/lock-consumption/
→ locked_value = confirmed_value
→ consumption_maturity = 'locked'
→ 之後不可修改
```

### 數據同步規則

| 操作 | BOMItem 變化 | UsageLine 變化 | MaterialRequirement 變化 |
|------|--------------|----------------|-------------------------|
| 設置預估 | pre_estimate_value ← 值 | consumption ← 值 | - |
| 確認用量 | confirmed_value ← 值 | consumption ← 值 | - |
| 鎖定用量 | locked_value ← confirmed | consumption ← locked | consumption_per_piece ← locked |
| MRP 計算 | - | - | 使用 locked_value 計算 |

### 前端 UI 變化

#### BOM 編輯頁面 (`/dashboard/revisions/{id}/bom`)

```
┌─────────────────────────────────────────────────────────────────┐
│ BOM 物料表                                                       │
├─────────────────────────────────────────────────────────────────┤
│ # │ 物料名稱        │ 預估用量  │ 確認用量  │ 鎖定用量  │ 狀態    │
├───┼─────────────────┼───────────┼───────────┼───────────┼─────────┤
│ 1 │ Nulu Fabric     │ [0.82]    │ [0.78]    │ 0.78 🔒   │ locked  │
│ 2 │ Elastic Band    │ [1.20]    │ -         │ -         │ pre_est │
│ 3 │ Thread          │ -         │ -         │ -         │ unknown │
└───┴─────────────────┴───────────┴───────────┴───────────┴─────────┘

[ ] = 可編輯輸入框
🔒 = 已鎖定，不可編輯
```

#### 用量狀態 Badge

| 狀態 | 顯示 | 顏色 |
|------|------|------|
| unknown | 待填寫 | gray |
| pre_estimate | 預估 | blue |
| confirmed | 已確認 | green |
| locked | 已鎖定 | amber |

### Migration 計劃

```python
# backend/apps/styles/migrations/XXXX_add_consumption_stages.py

class Migration(migrations.Migration):
    dependencies = [
        ('styles', 'previous_migration'),
    ]
    operations = [
        migrations.AddField(
            model_name='bomitem',
            name='pre_estimate_value',
            field=models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True),
        ),
        migrations.AddField(
            model_name='bomitem',
            name='confirmed_value',
            field=models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True),
        ),
        migrations.AddField(
            model_name='bomitem',
            name='locked_value',
            field=models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True),
        ),
        migrations.AddField(
            model_name='bomitem',
            name='consumption_history',
            field=models.JSONField(default=list, blank=True),
        ),
    ]
```

### 實作優先級

| 優先級 | 項目 | 說明 |
|--------|------|------|
| P1 | 新增 BOMItem 欄位 | Migration + Model |
| P1 | 更新 BOM API | pre_estimate / confirm / lock |
| P2 | 同步到 UsageLine | Signal 或 Service |
| P2 | 前端 BOM 編輯頁面 | 三欄用量顯示 |
| P3 | 歷史記錄查詢 | consumption_history UI |

## 總結

這個設計讓 BOM 用量在各階段保持連通：

```
BOMItem.pre_estimate_value
         ↓ 確認
BOMItem.confirmed_value
         ↓ 鎖定
BOMItem.locked_value ──→ UsageLine.consumption ──→ CostLineV2
                    └──→ MaterialRequirement.consumption_per_piece
```

**關鍵原則：**
1. BOMItem 是用量的「Single Source of Truth」
2. UsageLine/MaterialRequirement 從 BOMItem 同步，不獨立修改
3. locked 後不可再改，確保報價/採購一致性

---

## 實作完成記錄（2026-01-13）

### 已完成項目

| 項目 | 文件 | 狀態 |
|------|------|------|
| Model 欄位 | `backend/apps/styles/models.py` | ✅ |
| Migration | `0012_add_consumption_stages.py` | ✅ |
| Serializer | `backend/apps/styles/serializers.py` | ✅ |
| API 端點 | `backend/apps/styles/views.py` | ✅ |
| URL 路由 | `backend/apps/styles/urls.py` | ✅ |
| 前端類型 | `frontend/lib/types/bom.ts` | ✅ |
| 前端 API | `frontend/lib/api/bom.ts` | ✅ |
| 前端 Hooks | `frontend/lib/hooks/useBom.ts` | ✅ |
| Popover 組件 | `frontend/components/ui/popover.tsx` | ✅ |
| 用量編輯 Cell | `frontend/components/bom/EditableConsumptionCell.tsx` | ✅ |

### API 測試結果

```bash
# 設定預估用量
POST /api/v2/style-revisions/{id}/bom/{pk}/set-pre-estimate/
Body: {"value": "0.85"}
Response: 200 OK

# 確認用量
POST /api/v2/style-revisions/{id}/bom/{pk}/confirm-consumption/
Body: {"value": "0.82", "source": "marker_report"}
Response: 200 OK

# 鎖定用量
POST /api/v2/style-revisions/{id}/bom/{pk}/lock-consumption/
Response: 200 OK, consumption_maturity = "locked", can_edit_consumption = false
```
