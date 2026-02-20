# Tech Pack 翻译 → MWO 导出完整流程检查清单

## 完整流程应该是：

```
┌─────────────────────────────────────────────────────────────┐
│ 阶段 1：上传与分类                                           │
├─────────────────────────────────────────────────────────────┤
│ 1.1 用户上传 PDF                                            │
│ 1.2 AI 分类：tech_pack / bom / measurement                  │
│     → UploadedDocument.classification_result                │
│ 1.3 显示分类结果，用户确认                                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 阶段 2：AI 提取 (Tech Pack → Blocks)                        │
├─────────────────────────────────────────────────────────────┤
│ 2.1 创建 Revision (TechPackRevision)                        │
│ 2.2 AI 解析每一页 → 提取文字                                 │
│     - pdfplumber 提取文字层                                  │
│     - smart_merge_words 智能合并（避免切太细）               │
│ 2.3 AI 翻译（OpenAI）                                        │
│ 2.4 创建 DraftBlock 记录：                                   │
│     - source_text (英文)                                     │
│     - translated_text (AI 机翻)                              │
│     - edited_text (null，待人工修正)                         │
│     - bbox (位置)                                            │
│ 2.5 状态：Revision.status = "reviewing"                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 阶段 3：人工审校翻译 (P0 界面) ⭐ 核心                       │
├─────────────────────────────────────────────────────────────┤
│ URL: /dashboard/revisions/[id]/review                       │
│                                                              │
│ 界面：                                                       │
│ ┌───────────────────┬──────────────────────┐               │
│ │ 左：PDF 预览      │ 右：Blocks 列表      │               │
│ │ + 双语叠层        │                      │               │
│ │                   │ Block #1:            │               │
│ │ [PDF 显示]        │ EN: FABRIC           │               │
│ │                   │ ZH: [布料] ← 可编辑  │               │
│ │                   │ [保存]               │               │
│ │                   │                      │               │
│ │                   │ Block #2:            │               │
│ │                   │ EN: 100% Cotton      │               │
│ │                   │ ZH: [100% 棉] ← 可编辑│              │
│ └───────────────────┴──────────────────────┘               │
│                                                              │
│ 用户操作：                                                   │
│ 1. 逐个检查 blocks 翻译                                      │
│ 2. 修正 edited_text                                          │
│ 3. PATCH /api/v2/draft-blocks/{id}/                         │
│    → 保存到 DraftBlock.edited_text                          │
│    → 自动设置 status = "edited"                              │
│                                                              │
│ 完成后：点击 "Approve Revision"                              │
│ → Revision.status = "completed"                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 阶段 4：导出 MWO (整合翻译)                                  │
├─────────────────────────────────────────────────────────────┤
│ 前提：Revision.status = "completed"                         │
│                                                              │
│ MWO.pdf 包含：                                               │
│ 1. Tech Pack 翻译页面（方案 B：右侧列表）                   │
│    - 读取 DraftBlock.edited_text (优先) 或 translated_text  │
│ 2. BOM 翻译页面                                              │
│    - 读取 BOMItem.material_name_zh                           │
│ 3. Spec 翻译页面                                             │
│    - 读取 Measurement.point_name_zh                          │
│                                                              │
│ API: GET /api/v2/sample-runs/{id}/export-mwo-complete-pdf/  │
└─────────────────────────────────────────────────────────────┘
```

---

## 检查清单：每个阶段是否完成？

### ✅ 阶段 1：上传与分类
- [ ] URL: `/dashboard/upload` 或其他？
- [ ] AI 分类功能是否完成？
- [ ] 分类结果存储在 `UploadedDocument.classification_result`？

### ❓ 阶段 2：AI 提取
- [ ] Tech Pack 上传后，是否自动创建 Revision？
- [ ] 是否自动提取并创建 DraftBlock？
- [ ] 使用 `smart_merge_words` 避免切太细？
- [ ] API: 哪个端点触发 AI 提取？

### ✅ 阶段 3：人工审校
- [x] URL: `/dashboard/revisions/[id]/review` ✅ 已存在
- [x] API: `PATCH /api/v2/draft-blocks/{id}/` ✅ 已存在
- [ ] **问题：阶段 2 和阶段 3 是否连接？**
  - 上传 Tech Pack 后，用户如何进入 review 界面？

### ❌ 阶段 4：导出 MWO
- [ ] 导出功能未实现
- [ ] 需要等阶段 3 完成后才能做

---

## 关键问题：

### Q1: 上传 Tech Pack 后的流程是什么？
```
用户上传 PDF
  ↓
AI 分类 (UploadedDocument)
  ↓
??? 如何触发 AI 提取 ???
  ↓
创建 Revision + DraftBlocks
  ↓
用户进入 /dashboard/revisions/[id]/review
```

**缺失环节：** 如何从 UploadedDocument 到 Revision？

### Q2: BOM 和 Spec 的翻译是否也有编辑界面？
- BOM 翻译在哪里编辑？
- Spec 翻译在哪里编辑？

---

## 我需要您告诉我：

1. **阶段 1 的 URL 是什么？** 上传文件的页面
2. **阶段 2 是否已实现？** AI 提取 blocks 的功能
3. **从上传到 review 界面的完整路径是什么？**
4. **BOM/Spec 的翻译编辑界面在哪里？**

**请您告诉我哪些已经做了，哪些还没做，我好补齐缺失的部分！**
