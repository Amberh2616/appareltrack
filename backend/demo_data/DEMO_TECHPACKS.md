# Demo Tech Pack Files

**用途**：Draft Review UI 開發的真實測試資料

## 檔案清單

### 1. SP25 Nulu Cami Tank (LW1FLPS)
- **路徑**: `d:/沙美那資料/LW1FCSS-NEW/SP25 Nulu Cami Tank .pdf`
- **大小**: 8.6 MB
- **頁數**: 8 頁
- **內容**:
  - Page 1: 技術線稿圖（前/後/側）
  - Page 2: Fabric & Trims Legend（面料圖例 + 中英混合）
  - Page 3: Stitch Legend（車縫圖例）
  - Page 4-5: Front/Back 詳細說明（圖 + 箭頭註解 + 中英文）
  - Page 6-7: Details（細節圖 + 實物照片）

### 2. LW1FLWS - Nulu Spaghetti Cami
- **路徑**: `d:/沙美那資料/LW1FCSS-NEW/Spring2025_APACNuluSpaghettiCamiContrastNecklineTankwithBraBRLycraLW1FLWS_SabrinaFashionIndustrialCorporation_2024-Mar2.pdf`
- **大小**: 5.7 MB
- **頁數**: 8 頁
- **內容**:
  - Page 1: Cover Page（基本資料）
  - Page 2-6: BOM Material Color Report（物料表，含中文翻譯）
    - fabric（面料）
    - trim（輔料）
    - labels（標籤）
    - packaging（包裝）
    - finishing（後整理）
  - Page 7-8: Measurement Set（尺寸表，XXS-XL 數據）

## 關鍵特徵（UI 設計參考）

### 圖文混合程度
- ✅ 技術線稿 + 箭頭註解
- ✅ 表格內中英混合
- ✅ 實物照片（bra cup, elastic samples）
- ✅ Reference images

### 多語言混雜
- 英文為主
- 關鍵欄位有中文翻譯（BOM 用途說明）
- 中文例子：`S:前接片/後接片/領和袖襯肩帶滾邊布`

### 表格結構
- **BOM 表**：15+ 欄位
  - Standard Placement
  - Supplier Article #
  - Material Status
  - Material（中英文）
  - Supplier
  - Usage
  - BOM UOM
  - Price Per Unit
  - Total
  - 顏色欄位（0024-WHT/BLK, 069827-PKHZ/WHT）

- **Measurement 表**：20+ 測量點
  - XXS, XS, S, M, L, XL 各尺寸數據
  - Criticality（Critical / Reference Only）
  - Tolerance (+/-)
  - HTM Instruction（測量說明）

## Draft Review UI 需求（基於真實資料）

### Left Pane: PDF Viewer
- 必須保留圖片位置（技術線稿不可動）
- 支援 zoom / pan
- Evidence bbox overlay（可點擊高亮）

### Right Pane: Draft Review
#### BOM Tab
- 15+ 欄位的可編輯表格
- 中英文翻譯對照
- Evidence 連結（點擊跳到對應 PDF 頁面）

#### Measurement Tab
- 尺寸矩陣（XXS-XL）
- 顯示 Tolerance
- 顯示測量說明

#### Translation View
- 原文 ⇄ 中文對照
- 保留段落與頁碼對齊
- 可編輯中文翻譯

---

**更新日期**: 2025-12-21
**用於**: Sprint 1 - Draft Review UI 開發
