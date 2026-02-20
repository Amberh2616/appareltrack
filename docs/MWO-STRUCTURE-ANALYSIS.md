# MWO 結構分析（基於真實樣品製單）

**參考文檔：** `d:/沙美那資料/製單-全/SP25 LW5GS2S P2_樣品製單.pdf`

## 真實 MWO（加工指導書）包含的內容

### 1. Header 基本資訊（Page 1）
```
- 客戶（Customer）: LuLulemon
- 自編單號（Internal Order No）: SP25 LW5GS2S P2
- 交貨日期（Delivery Date）: 2024/1/22
- 數量（Quantity）: 5
- 款號（Style Number）: LW5GS2S
- 版號（Version/Pattern No）: K5199
- 款式名稱（Style Name）: YOGA ALIGN 25 CORE GRAPHIC...
- 制單人（Merchandiser）: 楊月霞
- 款式圖樣（Style Image）
```

### 2. 加工注意事項（Page 2）
```
** 作工說明：請看附頁作工圖示說明

** 注意事項：
1. 請務必先調整好車線密度及鬆緊度！
2. 注意每個車縫部位的縫線張力...
3. 請在所有的結尾重疊處加單車回針...
...

** 車縫線種規定：
- 四針六線併縫(SPI 18): 腰側縫/ 前後襠縫/ 內長/ 跨下接縫
- 四線拷克(SPI 16): 腰圍接縫
- 三針五線爬網(SPI 18): 腰圍接縫/褲口
- 窄針爬網(SPI 18): 袋口
- *襠底回針規定= 回針位置統一回在併縫的第二道

** 面料注意事項：
所有面料 - 請依照布卡做為大貨 "正面" 使用面.

** P1/P2 樣評語：
2024/01/05 P1評語 HY...
```

### 3. 尺寸表（Size Spec Sheet）（Page 3）
```
Code | 項目/搭配/尺碼 | 公差 | 0 | 2 | 4 | 6 | 8 | 10 | 12 | 14 | 16 | 18 | 20
-----|----------------|------|---|---|---|---|---|----|----|----|----|----|----|
L163C| 外側長-腰頂量  | 3/4  | 33 1/4
L253A| 總襠長         | 1/2  | 21 1/4 | 22 | 22 3/4 | ...
L21A | 前襠長         | 1/4  | 8 1/2 | 8 7/8 | 9 1/4 | ...
L14C | 腰圍-整圈      | 1/2  | 17 3/4 | 19 1/4 | 21 1/4 | ...
...
```

### 4. 搭配表（Material/Color Combination）（Page 4-5）
```
配色表                                    顏色代碼
#RT1904031-前腿接片/後腿接片              0001 (BLACK) (黑色)
#RT1904031-前腰接片/後腰接片              0001 (BLACK) (黑色)
#RT1903050-襠底片                         0001 (BLACK) (黑色)
#R20403099-前腰左側內貼口袋布             0001 (BLACK) (黑色)
#E011303-透明板帶: 1/4" CLEAR             CLEAR (透明)
#T00185N-反光銀LOGO標                     SILVER (銀)
#2925180-EPIC Tex18/Tkt180 包心線         C9760 (BLACK) (黑色)
...
```

### 5. 布料清單（Fabric List）（Page 6）
```
1. 儒鴻#RT1904031/0001/81% NYLON 19% LYCRA@ ELASTANE
   -W:46" -WT:238g/Yd
   BLACK

2. 儒鴻#RT1903050/0001/81% NYLON 19% LYCRA@ ELASTANE
   -W:46" -WT:238g/Yd
   BLACK

3. 儒鴻#R20403099/0001/56% POLYESTER 33% COOLMAX@ POLYESTER 11% LYCRA@ ELASTANE
   -W:60" -WT:210g/Yd
```

### 6. 副料清單（Trim List）（Page 6） ← **核心 BOM！**
```
項目                                          | 單件用量 | 單位 | 總用量 | 供應商
---------------------------------------------|---------|------|--------|----------
#E011303-透明板帶: 1/4" CLEAR MOBILON        | 0.220   | YD   | 1.10   | 佶城
#T00185N-反光銀LOGO標                        | 1.000   | PC   | 5.00   | 登威(依田)
#25HLUPBSTK02-單件袋 條碼貼紙                | 1.000   | PC   | 5.00   | 艾利丹尼森
#LU-POLY10-單件袋-Polybag 12"X10            | 1.000   | PC   | 5.00   | MAINETTI
#MPPS-2525-防霉紙-LDPE 25CM X 25CM          | 1.000   | PC   | 5.00   | MICRO-PAK
#LHT-WWMT-001-吊牌                           | 1.000   | PC   | 5.00   | 艾利丹尼森
#RFID225-RFID 條碼貼紙                       | 1.000   | PC   | 5.00   | 艾利丹尼森
#022209-1-2" 精距型細排釘                    | 1.000   | PC   | 5.00   | 千聲
#2925180-EPIC Tex18/Tkt180 包心線           | 5.640   | M    | 28.20  | 高士台灣
#5H43140-GRAMAX HL Tex21/Tkt140 蓬鬆線      | 109.570 | M    | 547.85 | 上海高士
#F7A5140-SEAMSOFT AS Tex24/Tkt140           | 57.120  | M    | 285.60 | 高士
...
```

### 7. 配色尺碼表（Color/Size Breakdown）（Page 7）
```
顏色/尺寸 | 0 | 2 | 4 | 6 | 8 | 10 | 12 | 14 | 16 | 18 | 20 | 數量
---------|---|---|---|---|---|----|----|----|----|----|----|-----
#0001 黑色 | 0 | 0 | 0 | 0 | 1 |  0 |  0 |  0 |  0 |  0 |  0 | 1
PO#LA SAMPLE 交期:2024/1/22

#0001 黑色 | 0 | 0 | 0 | 0 | 4 |  0 |  0 |  0 |  0 |  0 |  0 | 4
PO#P2 SAMPLE 交期:2024/1/22
```

### 8. 商標洗標包裝（Labels & Packaging）（Page 7）
```
商標洗標：
1. 熱轉印LOGO標位置@後腰接片正中處
   -接片水平和垂直置中處, 量到標中間

2. CC LABLE洗標位置@車於穿者後中腰接縫左邊,
   車單針回針固定上端.

3. 熱轉印尺寸標位置@穿者左側腰頭內貼口袋內
   -垂直居中位置
   -距袋口邊橫向2"處,量到標中間

4. 白色大吊卡:在吊卡背面貼一張WWMT+RFID電腦貼紙,
   用2"白色子彈釘在穿者左側腰接縫上.

包裝方式：
1. 單件入一單件袋(Poly Bag),規定件數入一大放水袋再入外箱.
2. 除非另有說明,每個紙箱上均需註明"單品(SKU)"或"單色單碼".
3. 紙箱規格為Standard Box 101 - B 200 - 24" x 15.5" x 13"
4. 紙箱的總重量不得超過23kg.
5. 每件需放一張防霉紙 25 x 25cm
```

---

## 目前系統 MWO 的問題

### 現有 `SampleMWO` Model 欄位：
```python
- mwo_no: MWO-2601-000001
- factory_name: TBD
- status: draft
- bom_snapshot_json: [
    {
      "line_no": 1,
      "material_name": "Nulu Fabric",
      "category": "fabric",
      "consumption": "1.5000",
      "uom": "yard",
      "unit_price": "12.5000",
      "supplier_name": ""
    }
  ]
- construction_snapshot_json: [
    {
      "step_no": 1,
      "description": "Cut main fabric according to pattern",
      "machine_type": "cutting"
    }
  ]
- qc_snapshot_json: {}
```

### 缺少的重要資訊：

**1. Header 資訊（基本資訊）**
- ❌ 款號（Style Number）
- ❌ 款式名稱（Style Name）
- ❌ 客戶（Customer/Brand）
- ❌ 版號（Pattern Version）
- ❌ 顏色（Color）
- ❌ 尺碼（Sizes）
- ❌ 制單人（Merchandiser）

**2. BOM 欄位不完整**
- ❌ 物料編號（Material Code/Article #）
- ❌ 顏色代碼（Color Code）
- ❌ 供應商代碼（Supplier Code）
- ❌ 總用量（Total Consumption）

**3. 製程資訊不完整**
- ❌ 車縫線種（Stitch Type: 四針六線併縫、三針五線爬網）
- ❌ 針距（SPI: Stitches Per Inch）
- ❌ 特殊要求（Special Instructions: 回針規定）

**4. QC 標準完全缺失**
- ❌ 商標位置（Logo Placement）
- ❌ 洗標位置（Care Label Position）
- ❌ 包裝要求（Packaging Requirements）

**5. 其他重要資訊**
- ❌ 加工注意事項（Manufacturing Notes）
- ❌ 尺寸表（Size Spec）
- ❌ 配色尺碼表（Color/Size Breakdown）

---

## 建議改進方案

### 方案 A：擴充 Snapshot JSON（最小改動）

保持現有 Model 結構，增強 snapshot 內容：

```python
# 增強 bom_snapshot_json
{
  "line_no": 1,
  "material_code": "#RT1904031",        # NEW
  "material_name": "Nulu Light Solid",
  "material_name_zh": "Nulu布料",       # NEW
  "category": "fabric",
  "color": "BLACK",                     # NEW
  "color_code": "0001",                 # NEW
  "supplier_name": "儒鴻",              # NEW
  "supplier_code": "RT",                # NEW
  "consumption": "1.5000",
  "total_consumption": "7.5000",        # NEW (consumption × quantity)
  "uom": "yard",
  "unit_price": "12.5000",
  "specifications": "81% NYLON 19% LYCRA, W:46\", WT:238g/Yd"  # NEW
}

# 增強 construction_snapshot_json
{
  "step_no": 1,
  "operation_name": "腰側縫",           # NEW
  "description": "Sew side seams",
  "description_zh": "車縫側邊",        # NEW
  "stitch_type": "四針六線併縫",       # NEW
  "spi": 18,                           # NEW (Stitches Per Inch)
  "machine_type": "Flatlock",
  "special_notes": "襠底回針位置統一回在併縫的第二道"  # NEW
}

# 增強 qc_snapshot_json
{
  "labels": [
    {
      "type": "logo",
      "position": "後腰接片正中處-接片水平和垂直置中處",
      "method": "熱轉印"
    },
    {
      "type": "care_label",
      "position": "穿者後中腰接縫左邊",
      "method": "車單針回針固定上端"
    }
  ],
  "packaging": {
    "polybag": "12\"x10\" (size 0-14), 12\"x12\" (size 16-20)",
    "carton": "Standard Box 101-B 200 - 24\"x15.5\"x13\"",
    "max_weight_kg": 23,
    "anti_mold_paper": "25x25cm"
  },
  "special_requirements": [
    "防盜釦位置：穿者右側腰頭縫線處"
  ]
}
```

### 方案 B：新增 Model 欄位（較大改動）

在 `SampleMWO` Model 新增欄位：

```python
class SampleMWO(models.Model):
    # ... existing fields ...

    # Header Info (NEW)
    style_number = models.CharField(max_length=50, blank=True)
    style_name = models.CharField(max_length=200, blank=True)
    pattern_version = models.CharField(max_length=50, blank=True)
    color_code = models.CharField(max_length=50, blank=True)
    color_name = models.CharField(max_length=100, blank=True)
    customer_brand = models.CharField(max_length=100, blank=True)
    merchandiser = models.CharField(max_length=100, blank=True)

    # Size & Quantity
    size_range_json = models.JSONField(default=dict, blank=True)
    # Example: {"sizes": ["0", "2", "4", "6", "8"], "quantities": [0, 0, 0, 1, 4]}

    # Manufacturing Instructions (NEW)
    special_instructions = models.TextField(blank=True)
    stitch_requirements = models.JSONField(default=list, blank=True)
    # Example: [
    #   {"type": "四針六線併縫", "spi": 18, "usage": "腰側縫/前後襠縫/內長"},
    #   {"type": "三針五線爬網", "spi": 18, "usage": "腰圍接縫/褲口"}
    # ]

    # ... existing snapshot fields ...
```

---

## 建議實施步驟

### Phase 1: 最小可行改進（Demo 用）
1. ✅ 保持現有 Model 結構
2. ✅ 增強 `bom_snapshot_json` - 加入 material_code, color, supplier
3. ✅ 增強 `construction_snapshot_json` - 加入 stitch_type, spi
4. ✅ 填充 `qc_snapshot_json` - 加入 label positions, packaging
5. ✅ 從 SampleRun/StyleRevision 讀取 style_number, color 等資訊

### Phase 2: 完整系統（未來）
1. 新增 Model 欄位（style_number, color_code, size_range_json 等）
2. 建立完整的尺寸表（Size Spec Sheet）Model
3. 建立配色尺碼表（Color/Size Breakdown）功能
4. 整合真實的 Excel/PDF 匯出模板

---

## Demo 展示重點

1. **BOM 清單完整**：
   - 物料編號 + 顏色 + 供應商
   - 單件用量 + 總用量

2. **製程工序詳細**：
   - 車縫線種（四針六線併縫、三針五線爬網）
   - 針距（SPI 18）

3. **QC 標準明確**：
   - 商標洗標位置
   - 包裝規格

4. **可匯出 Excel/PDF**：
   - 格式接近真實樣品製單
