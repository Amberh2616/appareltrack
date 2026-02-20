# Tech Pack 翻译整合到 MWO 方案

## 目标
将 Tech Pack 的双语翻译（blocks 数据）整合到 MWO.pdf 导出中

## 当前状况
- ✅ Tech Pack 有 blocks 翻译数据（TechPackRevision → pages → blocks）
- ✅ 用户可以修正翻译（edited_text）
- ✅ 已有 `techpack_pdf_export.py` 可生成双语 PDF
- ❌ 但 MWO 导出没有整合 Tech Pack 翻译

## 方案设计

### 方案 A：MWO = 多个独立 PDF 打包到 ZIP

```
MWO_Package/
├── 1_TechPack_翻译.pdf      ← 双栏对照（方案 C）
├── 2_BOM.pdf                ← P3 已有
├── 3_Estimate.pdf           ← P3 已有
└── 4_T2PO.pdf               ← P3 已有
```

**优点：**
- 最简单，不改现有代码
- 每个文件独立，易维护

**缺点：**
- 不是单一 PDF

---

### 方案 B：MWO = 单一合并 PDF ⭐ 推荐

```
MWO.pdf
├── Page 1-5: Tech Pack 双栏对照（左原文 | 右翻译）
├── Page 6: BOM 表格（双语表头）
├── Page 7: Estimate
└── Page 8: T2 PO
```

**优点：**
- 单一文件，工厂易于使用
- 专业性强

**缺点：**
- 需要合并多个 PDF

---

## 推荐实现：方案 B（单一 PDF）

### 技术栈
- **PyMuPDF** (不用 Pillow，避免乱码)
- 方案 C：双栏对照

### 实现步骤

#### 1. 修改 `apps/samples/services/pdf_export.py`

新增 `MWOCompletePDFExporter` 类：

```python
class MWOCompletePDFExporter:
    """完整的 MWO PDF（含 Tech Pack 翻译）"""

    def export(self, mwo):
        output_pdf = fitz.open()

        # 1. 插入 Tech Pack 翻译页面（双栏对照）
        self._append_techpack_translation(output_pdf, mwo)

        # 2. 插入 BOM 页面（使用 PyMuPDF 绘制表格）
        self._append_bom_page(output_pdf, mwo)

        # 3. 插入 Estimate 页面
        self._append_estimate_page(output_pdf, mwo)

        # 4. 插入 T2 PO 页面
        self._append_po_page(output_pdf, mwo)

        return output_pdf.tobytes()
```

#### 2. Tech Pack 翻译部分

```python
def _append_techpack_translation(self, output_pdf, mwo):
    """
    添加 Tech Pack 双栏对照页面
    从 mwo.sample_run.style_revision 获取 Tech Pack 数据
    """
    # 获取 TechPackRevision
    revision = self._get_techpack_revision(mwo)
    if not revision:
        return

    # 打开原始 Tech Pack PDF
    src_pdf = fitz.open(revision.file.path)

    # 处理每一页
    for page_data in revision.pages.all().order_by('page_number'):
        # 创建双倍宽页面
        orig_page = src_pdf[page_data.page_number - 1]
        orig_w = orig_page.rect.width
        orig_h = orig_page.rect.height

        new_page = output_pdf.new_page(width=orig_w * 2, height=orig_h)

        # 左边：原始 PDF
        new_page.show_pdf_page(
            fitz.Rect(0, 0, orig_w, orig_h),
            src_pdf,
            page_data.page_number - 1
        )

        # 中间分隔线
        new_page.draw_line((orig_w, 0), (orig_w, orig_h), width=2)

        # 右边：blocks 翻译
        self._draw_translation_panel(new_page, page_data, orig_w, orig_h)

    src_pdf.close()

def _draw_translation_panel(self, page, page_data, orig_w, orig_h):
    """在右侧绘制翻译"""
    right_x = orig_w + 30
    y = 40

    # 标题
    page.insert_text(
        (right_x, y),
        f"中文翻译 - 第 {page_data.page_number} 页",
        fontname="china-ss",
        fontsize=18
    )
    y += 40

    # blocks 翻译
    blocks = page_data.blocks.all().order_by('bbox_y', 'bbox_x')
    for block in blocks:
        # 优先使用 edited_text，否则用 translated_text
        zh_text = block.edited_text or block.translated_text
        if not zh_text:
            continue

        # 英文原文（灰色）
        page.insert_text(
            (right_x, y),
            f"EN: {block.text[:50]}",
            fontname="helv",
            fontsize=11,
            color=(0.4, 0.4, 0.4)
        )
        y += 22

        # 中文翻译
        page.insert_text(
            (right_x, y),
            zh_text,
            fontname="china-ss",
            fontsize=14
        )
        y += 30
```

#### 3. BOM 页面（PyMuPDF 绘制）

```python
def _append_bom_page(self, output_pdf, mwo):
    """添加 BOM 表格页面（双语）"""
    page = output_pdf.new_page(width=842, height=595)  # A4 横向

    # 标题
    page.insert_text((50, 50), "Bill of Materials 物料清单",
                     fontname="china-ss", fontsize=20)

    # 表格数据
    bom_data = mwo.bom_snapshot_json or []

    # 表头
    headers = ["#", "Code", "Material 物料", "UOM", "Unit", "Price", "Supplier"]

    # 使用 PyMuPDF 绘制表格
    y = 100
    col_widths = [30, 80, 200, 50, 60, 60, 150]

    # 表头行
    x = 50
    for i, header in enumerate(headers):
        # 蓝色背景
        page.draw_rect(
            fitz.Rect(x, y, x + col_widths[i], y + 25),
            fill=(0.27, 0.45, 0.77)
        )
        page.insert_text((x + 5, y + 18), header,
                         fontname="china-ss", fontsize=10, color=(1, 1, 1))
        x += col_widths[i]

    y += 30

    # 数据行
    for idx, item in enumerate(bom_data):
        x = 50
        row_data = [
            str(idx + 1),
            item.get('material_code', '-')[:10],
            item.get('material_name', '-')[:30],
            item.get('uom', '-'),
            f"{item.get('consumption', 0):.2f}",
            f"${item.get('unit_price', 0):.2f}",
            item.get('supplier_name', '-')[:15]
        ]

        for i, cell in enumerate(row_data):
            page.draw_rect(
                fitz.Rect(x, y, x + col_widths[i], y + 20),
                color=(0.8, 0.8, 0.8), width=0.5
            )
            page.insert_text((x + 3, y + 15), cell,
                             fontname="china-ss", fontsize=9)
            x += col_widths[i]

        y += 20
```

---

## 数据关联

```
SampleMWO
  ↓
sample_run.style_revision
  ↓
TechPackRevision (如果有上传 Tech Pack)
  ↓
pages → blocks (翻译数据)
```

如果没有 Tech Pack，跳过翻译页面。

---

## API 调用

```python
# 单个 MWO 导出
GET /api/v2/sample-runs/{id}/export-mwo-complete-pdf/

# 批量导出
POST /api/v2/sample-runs/batch-export/
{
    "run_ids": [...],
    "export_types": ["mwo_complete"],
    "format": "pdf"
}
```

---

## 文件结构

```
backend/apps/samples/services/
├── pdf_export.py           # 现有（MWO/Estimate/PO）
├── pdf_export_complete.py  # 新增（完整 MWO）
└── pdf_utils.py            # 新增（PyMuPDF 工具函数）
```

---

## 优先级

1. **P0**：实现 `_append_techpack_translation`（Tech Pack 双栏对照）
2. **P1**：实现 `_append_bom_page`（BOM 表格，PyMuPDF 绘制）
3. **P2**：整合 Estimate 和 PO 页面
4. **P3**：批量导出优化
