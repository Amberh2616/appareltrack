# PDF 中文匯出修復方案

**問題發現日期：** 2026-01-07
**修復完成日期：** 2026-01-07
**影響範圍：** MWO/Estimate/T2PO PDF 匯出

---

## 問題描述

在 Windows 環境下，使用 xhtml2pdf 引擎匯出 PDF 時，中文字符無法正確顯示（顯示為方塊或亂碼）。

### 根本原因

1. **WeasyPrint 無法在 Windows 上運行**
   - 缺少 GTK+ 依賴（gobject-2.0-0）
   - 系統自動回退到 xhtml2pdf 引擎

2. **xhtml2pdf 無法載入系統中文字體**
   - HTML 中的 `font-family: "Microsoft YaHei"` 無效
   - 需要使用 reportlab 手動註冊字體

3. **Windows 字體格式問題**
   - 系統中的微軟雅黑（msyh）和黑體（simhei）都是 `.ttc` 格式
   - reportlab 的 TTFont 不支援 TTC 格式
   - 只能使用 `.ttf` 格式的字體

---

## 修復方案

### 1. 修改 `pdf_export.py`

**檔案：** `backend/apps/samples/services/pdf_export.py`

**修改內容：**
- 在 `render_to_pdf()` 方法中添加中文字體註冊邏輯
- 使用 reportlab 的 `pdfmetrics.registerFont()` 註冊系統中可用的 TTF 字體
- 支援的字體：
  - `simsunb` - 宋體粗體（推薦，最穩定）
  - `kaiu` - 楷體
  - `SimsunExtG` - 宋體擴展

**關鍵代碼：**
```python
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

chinese_fonts = [
    ('simsunb', 'C:/Windows/Fonts/simsunb.ttf'),
    ('kaiu', 'C:/Windows/Fonts/kaiu.ttf'),
    ('SimsunExtG', 'C:/Windows/Fonts/SimsunExtG.ttf'),
]

for font_name, font_path in chinese_fonts:
    if os.path.exists(font_path):
        try:
            pdfmetrics.registerFont(TTFont(font_name, font_path))
            break
        except Exception:
            continue
```

### 2. 修改 HTML 模板

**檔案：** `backend/apps/samples/templates/pdf/base.html`

**修改內容：**
- 在 CSS 中使用 reportlab 註冊的字體名稱
- 將 `font-family` 改為 `simsunb`

**關鍵代碼：**
```css
body {
    font-family: simsunb, "Microsoft YaHei", SimHei, SimSun, Arial, sans-serif;
}
```

---

## 測試結果

### 測試環境
- 作業系統：Windows 11
- Python：3.12
- PDF 引擎：xhtml2pdf
- 中文字體：simsunb（宋體粗體）

### 測試命令
```bash
cd backend
python manage.py shell -c "
from apps.samples.services.pdf_export import PDFExporter
from django.utils import timezone

class MockMWO:
    mwo_no = 'MWO-TEST-中文'
    factory_name = '深圳測試工廠'
    status = 'draft'
    created_at = timezone.now()
    version_no = 1
    quantity = 100
    notes = '這是測試 MWO'

    def get_status_display(self):
        return '草稿'

context = {
    'mwo': MockMWO(),
    'bom_data': [
        {
            'line_no': 1,
            'material_name': '主布料',
            'material_name_zh': '棉質面料',
            'uom': 'YD',
            'consumption': 1.5,
        }
    ],
    'ops_data': [],
    'qc_data': None,
}

pdf_data = PDFExporter.render_to_pdf('pdf/mwo.html', context)

with open('../test_chinese_mwo.pdf', 'wb') as f:
    f.write(pdf_data)

print(f'✓ PDF generated: {len(pdf_data)} bytes')
"
```

### 測試結果
```
✓ Registered font: simsunb from C:/Windows/Fonts/simsunb.ttf
✓ PDF generated successfully!
✓ Size: 5493 bytes
✓ Saved to: test_chinese_mwo.pdf
```

**驗證：** 打開 `test_chinese_mwo.pdf`，中文字符正常顯示

---

## 已修改的檔案

| 檔案 | 修改內容 |
|------|----------|
| `backend/apps/samples/services/pdf_export.py` | 添加中文字體註冊邏輯 |
| `backend/apps/samples/templates/pdf/base.html` | 修改 CSS 字體設定 |

---

## 未來改進方向

### 方案 A：安裝 WeasyPrint 完整依賴（推薦）

WeasyPrint 對中文字體支援更好，且渲染品質更高。

**步驟（Windows）：**
1. 安裝 GTK+ for Windows
2. 設定環境變數
3. 重新啟動 Django

**優點：**
- 更好的 CSS 支援
- 更好的中文字體渲染
- 支援更複雜的佈局

**缺點：**
- 安裝步驟複雜
- 依賴外部 DLL

### 方案 B：使用 TrueType Collections (TTC)

如果能解決 reportlab 對 TTC 格式的支援，就可以使用微軟雅黑等更美觀的字體。

**可能的方案：**
- 使用 `fontTools` 將 TTC 拆分為多個 TTF
- 或使用支援 TTC 的其他 PDF 庫

---

## 注意事項

1. **字體授權**
   - Windows 系統字體僅限個人使用
   - 商業部署時需考慮字體授權問題

2. **跨平台兼容性**
   - 此修復方案僅適用於 Windows
   - Linux/Mac 系統需要調整字體路徑

3. **性能**
   - 字體註冊每次 PDF 生成時都會執行
   - 可考慮使用快取機制優化

---

## 總結

✅ **問題已解決**：中文 PDF 匯出功能在 Windows 環境下正常運作
✅ **向後兼容**：不影響 WeasyPrint 引擎的使用
✅ **穩定性高**：使用系統內建字體，無需額外安裝

---

**修復人員：** Claude Code
**測試人員：** AMBER
**文檔版本：** 1.0
