# Tech Pack 完整流程分析報告

**日期：** 2026-01-07
**狀態：** ✅ P0 流程中斷已修復
**修復版本：** v2.0

---

## 🎉 修復摘要（2026-01-07）

**問題：** 提取完成後，用戶無法導航到 P0 審校界面

**解決方案：**
1. ✅ 後端：添加 `tech_pack_revision` FK 到 `UploadedDocument`
2. ✅ 後端：API 返回 `tech_pack_revision_id`
3. ✅ 前端：提取完成後自動導航到 P0 審校界面
4. ✅ Migration：`0004_add_tech_pack_revision_to_uploaded_document`

**影響：** 用戶現在可以完整走完整個翻譯工作流

---

## 📋 探查結果總結

### ✅ 已實現的環節

| 階段 | 功能 | URL/API | 狀態 |
|------|------|---------|------|
| **階段 1：上傳與分類** | 上傳頁面 | `/dashboard/upload` | ✅ 完整 |
| | 上傳 API | `POST /api/v2/uploaded-documents/` | ✅ 完整 |
| | 處理頁面 | `/dashboard/documents/{id}/processing` | ✅ 完整 |
| | 分類 API | `POST /api/v2/uploaded-documents/{id}/classify/` | ✅ 完整 |
| **階段 2：AI 提取** | 審查頁面 | `/dashboard/documents/{id}/review` | ✅ 完整 |
| | 提取 API | `POST /api/v2/uploaded-documents/{id}/extract/` | ✅ 完整 |
| | 創建 Revision | TechPackRevision + DraftBlocks | ✅ 完整 |
| | 批量翻譯 | batch_translate() | ✅ 完整 |
| **階段 3：人工審校** | P0 審校界面 | `/dashboard/revisions/{id}/review` | ✅ 完整 |
| | Block 編輯 API | `PATCH /api/v2/draft-blocks/{id}/` | ✅ 完整 |
| | Revision 批准 | `POST /api/v2/revisions/{id}/approve/` | ✅ 完整 |

### ❌ 缺失的環節

#### ✅ **P0（Critical）：階段 2 → 階段 3 的跳轉** — **已修復**

**原問題：** 提取完成後，用戶停留在 `/dashboard/documents/{id}/review`，沒有導航到 P0 審校界面。

**修復方案：**

##### 1. 後端模型添加 FK（`backend/apps/parsing/models.py`）

```python
class UploadedDocument(models.Model):
    # ... existing fields ...

    # ⚡ 新增：Link to created TechPackRevision
    tech_pack_revision = models.ForeignKey(
        'parsing.Revision',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_documents',
        help_text="Created TechPackRevision for draft review (P0 interface)"
    )
```

##### 2. 後端 API 修改（`backend/apps/parsing/views.py`）

**Extract API（第 537-539 行）：**
```python
# 6. Update document status
doc.style_revision = revision
doc.tech_pack_revision = tech_pack_revision  # ⚡ Save TechPackRevision reference
doc.status = 'extracted'
doc.save(update_fields=['style_revision', 'tech_pack_revision', 'status', 'extraction_errors', 'updated_at'])
```

**Extract API 返回值（第 546 行）：**
```python
response_data['tech_pack_revision_id'] = str(tech_pack_revision.id)  # ⚡ For P0 review navigation
```

**Get Status API（第 326-328 行）：**
```python
# ⚡ Add tech_pack_revision_id if available
if doc.tech_pack_revision:
    response_data['tech_pack_revision_id'] = str(doc.tech_pack_revision.id)
```

##### 3. 前端自動導航（`frontend/app/dashboard/documents/[id]/review/page.tsx`）

**TypeScript 接口（第 27 行）：**
```typescript
interface DocumentStatus {
  // ... existing fields ...
  tech_pack_revision_id?: string  // ⚡ For P0 review navigation
}
```

**輪詢邏輯（第 105-110 行）：**
```typescript
if (statusData.status === 'extracted' || statusData.status === 'completed') {
  clearInterval(pollInterval)
  setIsExtracting(false)
  setIsCompleted(true)
  setStatus(statusData)

  // ⚡ Auto-navigate to P0 review interface
  if (statusData.tech_pack_revision_id) {
    setTimeout(() => {
      router.push(`/dashboard/revisions/${statusData.tech_pack_revision_id}/review`)
    }, 2000)  // Wait 2 seconds to show success message
  }
}
```

**成功消息更新（第 312-314 行）：**
```typescript
<p className="text-sm mt-1">
  {status?.tech_pack_revision_id
    ? 'Redirecting to Tech Pack translation review interface...'
    : 'Data has been successfully extracted. Ready to create Sample Request.'}
</p>
```

##### 4. Migration

```bash
# Created migration
backend/apps/parsing/migrations/0004_add_tech_pack_revision_to_uploaded_document.py

# Applied successfully
python manage.py migrate parsing
```

**修復結果：** ✅ 用戶現在可以完整走完上傳 → 分類 → 提取 → P0 審校的完整流程

---

#### 🟠 **P1（Important）：BOM/Spec 缺少中文翻譯編輯界面**

**問題：** BOM 和 Measurement 有 `*_zh` 翻譯欄位，但前端未提供編輯界面。

**現有欄位：**
```python
# backend/apps/styles/models.py
class BOMItem:
    material_name_zh = models.CharField(max_length=200, blank=True)  # ✅ 欄位存在

class Measurement:
    point_name_zh = models.CharField(max_length=100, blank=True)  # ✅ 欄位存在
```

**現有界面：**
- BOM 編輯頁：`/dashboard/revisions/{id}/bom` ✅ 存在
- BOM 欄位：只顯示 `material_name`（英文），無 `material_name_zh` 編輯
- Measurement 編輯頁：❓ 未找到

**影響：**
即使 Tech Pack 翻譯完成，BOM 和 Spec 的中文翻譯無法編輯，MWO 匯出時缺少這些翻譯。

---

## 🔍 完整流程圖（修復後）

```
┌─────────────────────────────────────────────────────────────────┐
│ 階段 1：上傳與分類 ✅ 完整實現                                   │
├─────────────────────────────────────────────────────────────────┤
│ 1. /dashboard/upload                                            │
│    └→ 用戶拖放 PDF 文件                                          │
│                                                                 │
│ 2. POST /api/v2/uploaded-documents/                             │
│    └→ 創建 UploadedDocument (status=uploaded)                   │
│    └→ 前端跳轉到 /dashboard/documents/{id}/processing           │
│                                                                 │
│ 3. POST /api/v2/uploaded-documents/{id}/classify/               │
│    └→ GPT-4o Vision 分類每頁（tech_pack/bom/measurement）       │
│    └→ status=classified                                         │
│    └→ 前端跳轉到 /dashboard/documents/{id}/review               │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 階段 2：AI 提取 ✅ 完整實現                                      │
├─────────────────────────────────────────────────────────────────┤
│ 4. /dashboard/documents/{id}/review                             │
│    └→ 顯示分類結果                                               │
│    └→ 用戶點擊 "Confirm & Extract Data" 按鈕                     │
│                                                                 │
│ 5. POST /api/v2/uploaded-documents/{id}/extract/                │
│    ├→ 創建 StyleRevision（用於 BOM/Measurement）                │
│    ├→ 創建 TechPackRevision (Revision)（用於 DraftBlocks）      │
│    ├→ ⚡ 保存 tech_pack_revision FK 到 UploadedDocument         │
│    ├→ 提取 Tech Pack 頁面：                                      │
│    │   ├─ extract_text_from_pdf_page_vision()                   │
│    │   ├─ batch_translate() 批量翻譯                             │
│    │   └─ 創建 DraftBlock (source_text + translated_text)       │
│    ├→ 提取 BOM：extract_bom_from_pages()                        │
│    ├→ 提取 Measurement：extract_measurements_from_page()        │
│    ├→ status=extracted                                          │
│    └→ ⚡ 返回 tech_pack_revision_id                              │
│                                                                 │
│ 6. ✅ 前端輪詢 GET /api/v2/uploaded-documents/{id}/status/      │
│    └→ ⚡ 獲取 tech_pack_revision_id                              │
│    └→ ⚡ 2秒後自動跳轉到 P0 審校界面                             │
└─────────────────────────────────────────────────────────────────┘
                          ↓ ✅ 自動導航
┌─────────────────────────────────────────────────────────────────┐
│ 階段 3：人工審校 ✅ 完整實現且可到達                             │
├─────────────────────────────────────────────────────────────────┤
│ 7. /dashboard/revisions/{tech_pack_revision_id}/review ✅       │
│    ├─ 左側：PDF 預覽 + 雙語疊層                                  │
│    ├─ 右側：Coverage Panel + Block 列表                         │
│    └─ 用戶修正 edited_text                                       │
│                                                                 │
│ 8. PATCH /api/v2/draft-blocks/{id}/                             │
│    └→ 保存 edited_text，status=edited                           │
│                                                                 │
│ 9. POST /api/v2/revisions/{id}/approve/                         │
│    └→ Revision.status=completed                                 │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 階段 4：導出 MWO ❓ 待實現                                       │
├─────────────────────────────────────────────────────────────────┤
│ 10. 讀取翻譯數據：                                               │
│     ├─ DraftBlock.edited_text (優先) or translated_text ✅      │
│     ├─ BOMItem.material_name_zh ⚠️ 無編輯界面                   │
│     └─ Measurement.point_name_zh ⚠️ 無編輯界面                  │
│                                                                 │
│ 11. 生成 MWO.pdf（方案 B：右側翻譯列表）                         │
│     └→ Tech Pack + BOM + Spec 三合一                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 待補齊的環節

### 1. ~~**階段 2 → 階段 3 導航**（P0）~~ — ✅ **已修復**

詳見上方修復方案。

---

### 2. **BOM/Spec 中文翻譯編輯**（P1） — ⚠️ 待實現

**需要實現：**

#### A. BOM 翻譯編輯欄位
```typescript
// frontend/app/dashboard/revisions/[id]/bom/page.tsx
// ⚡ 新增欄位
columnHelper.accessor("material_name_zh", {
  header: "物料名稱（中文）",
  cell: (info) => (
    <EditableTextCell
      value={info.getValue()}
      onSave={(newValue) => updateBOMItem(info.row.original.id, { material_name_zh: newValue })}
    />
  ),
  size: 200,
}),
```

#### B. Measurement 編輯頁面
創建 `/dashboard/revisions/{id}/measurements/page.tsx`，類似 BOM 頁面。

#### C. 後端 API（可能已存在）
檢查是否有 PATCH 端點允許更新這些欄位：
- `PATCH /api/v2/bom-items/{id}/` → 允許 `material_name_zh`
- `PATCH /api/v2/measurements/{id}/` → 允許 `point_name_zh`

---

## 📊 資料關聯圖

```
UploadedDocument (P4 新增)
├─ file: PDF 檔案
├─ classification_result: {file_type, pages[]}
├─ status: uploaded → classifying → classified → extracting → extracted
├─ style_revision: FK to StyleRevision ✅ 已有
└─ tech_pack_revision: FK to Revision ❌ 缺失（推薦方案 B）

    ↓ extract() 創建

StyleRevision (用於 BOM/Measurement)
├─ BOMItem[]
│  ├─ material_name ✅ 英文
│  └─ material_name_zh ⚠️ 有欄位，無編輯界面
└─ Measurement[]
   ├─ point_name ✅ 英文
   └─ point_name_zh ⚠️ 有欄位，無編輯界面

Revision (TechPackRevision，用於 DraftBlocks)
└─ RevisionPage[]
   └─ DraftBlock[]
      ├─ source_text ✅ 英文（locked）
      ├─ translated_text ✅ AI 機翻
      ├─ edited_text ✅ 人工修正
      └─ status: auto → edited → approved
```

---

## 🎯 Q&A 回答清單問題

### Q1: 上傳 Tech Pack 後的流程是什麼？

```
用戶上傳 PDF
  ↓
POST /api/v2/uploaded-documents/ → 創建 UploadedDocument
  ↓
自動跳轉到 /dashboard/documents/{id}/processing
  ↓
頁面自動觸發 POST /api/v2/uploaded-documents/{id}/classify/
  ↓
AI 分類完成，跳轉到 /dashboard/documents/{id}/review
  ↓
用戶點擊 "Confirm & Extract Data"
  ↓
POST /api/v2/uploaded-documents/{id}/extract/
  ↓
創建 StyleRevision + TechPackRevision + DraftBlocks
  ↓
❌ 缺失：應該跳轉到 /dashboard/revisions/{tech_pack_revision_id}/review
```

### Q2: BOM 和 Spec 的翻譯是否也有編輯界面？

**BOM：**
- 編輯頁面：✅ `/dashboard/revisions/{id}/bom` 存在
- 中文翻譯欄位：⚠️ `material_name_zh` 有欄位，無界面

**Spec（Measurement）：**
- 編輯頁面：❌ 未找到
- 中文翻譯欄位：⚠️ `point_name_zh` 有欄位，無界面

### Q3: 阶段 1 的 URL 是什么？

✅ `/dashboard/upload`

### Q4: 阶段 2 是否已实现？

✅ 已完整實現（`POST /api/v2/uploaded-documents/{id}/extract/`）

但❌ 缺少導航邏輯。

---

## 📝 下一步行動建議

### ~~Phase 1: 修復流程中斷（P0）~~ — ✅ **已完成**

已修復階段 2 → 階段 3 的導航問題。

---

### Phase 2: BOM/Spec 翻譯編輯（P1）

3. **BOM 頁面增加中文欄位**
   - 文件：`frontend/app/dashboard/revisions/[id]/bom/page.tsx`
   - 新增：`material_name_zh` 可編輯欄位

4. **創建 Measurement 編輯頁面**
   - 文件：`frontend/app/dashboard/revisions/[id]/measurements/page.tsx`（新建）
   - 包含：`point_name_zh` 可編輯欄位

### Phase 3: MWO 整合（P2）

5. **實現 MWO 完整匯出**
   - 文件：`backend/apps/samples/services/pdf_export_complete.py`（新建）
   - 整合：Tech Pack（雙欄）+ BOM（雙語表格）+ Spec（雙語表格）

---

## 🔗 相關文件

- ✅ `docs/COMPLETE-FLOW-CHECKLIST.md` - 流程檢查清單
- ✅ `docs/TECH-PACK-MWO-INTEGRATION.md` - MWO 整合設計
- ✅ `generate_mwo_final.py` - 方案 B 實現示例
- ✅ `generate_complete_mwo.py` - 完整 MWO 實現示例

---

## 📊 修改文件清單

| 文件 | 修改內容 | 狀態 |
|------|---------|------|
| `backend/apps/parsing/models.py` | 添加 `tech_pack_revision` FK | ✅ 完成 |
| `backend/apps/parsing/views.py` | Extract API 保存並返回 `tech_pack_revision_id` | ✅ 完成 |
| `backend/apps/parsing/views.py` | Get Status API 返回 `tech_pack_revision_id` | ✅ 完成 |
| `frontend/app/dashboard/documents/[id]/review/page.tsx` | 添加 TypeScript 接口字段 | ✅ 完成 |
| `frontend/app/dashboard/documents/[id]/review/page.tsx` | 添加自動導航邏輯 | ✅ 完成 |
| `frontend/app/dashboard/documents/[id]/review/page.tsx` | 更新成功消息 | ✅ 完成 |
| `backend/apps/parsing/migrations/0004_*.py` | Migration 文件 | ✅ 完成 |

---

**報告完成日期：** 2026-01-07
**探查者：** Claude Sonnet 4.5
**修復者：** Claude Sonnet 4.5
**狀態：** ✅ P0 已修復，P1 待實現
