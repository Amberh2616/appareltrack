## Description

实现 Phase 2-3 的 Frontend Costing UI，包含版本时间线、详情抽屉、Inline Edit、Submit Workflow。

**核心目标：**
- Costing Versions Timeline（v1 → v2 → v3 卡片）
- Costing Detail Drawer/Page（含 inline edit）
- 调整标记（⚠️ icon, Δ% column）
- Submit workflow（Draft → Submitted 锁定）

**架构参考：**
- 📘 完整规格：`docs/PHASE-2-3-IMPLEMENTATION-CHECKLIST.md`
- UI 最小可用：先让用户能工作，再优化体验

**Dependencies:** Issue #2 (Day 2 完成后才能开始)

---

## Tasks

### A. Costing Versions Timeline

**组件：** `frontend/components/costing/CostingVersionsTimeline.tsx`

- [ ] 数据源：`GET /api/v2/styles/{style_id}/cost-sheets/?costing_type=sample|bulk`

- [ ] 版本卡片显示：
  - version_no / status / unit_price（大字）
  - evidence（techpack_revision + usage_scenario）
  - created_at / change_reason
  - status badge（Draft/Submitted/Superseded/Accepted）

- [ ] 动作按钮：
  - New Version（打开 create dialog）
  - Clone（打开 clone dialog）
  - Open Detail（打开 detail drawer）

- [ ] UI 状态：
  - Draft: 蓝色边框
  - Submitted: 绿色边框
  - Superseded: 灰色 + 显示 "superseded by v{X}"

### B. Costing Detail Drawer/Page

**组件：** `frontend/components/costing/CostingDetailDrawer.tsx`

- [ ] 数据源：`GET /api/v2/cost-sheets/{id}/`

- [ ] Header：
  - Version info（v{X}, status, evidence）
  - Created by / Created at

- [ ] Cost Lines Table（TanStack Table）
  - Columns:
    - Material（name + name_zh）
    - Category
    - Snapshot（consumption + unit）
    - Adjusted（inline edit，Draft only）⭐
    - Δ%（delta percentage, 红色/绿色）⭐
    - Unit Price（inline edit，Draft only）
    - Line Cost
    - Adjustment Reason
  - 调整标记：⚠️ icon（is_*_adjusted = true）
  - Inline edit 组件（debounced，optimistic updates）

- [ ] Summary Card（可编辑，Draft only）
  - Material Cost（auto, read-only）
  - Labor / Overhead / Freight / Packing（editable）
  - Margin %（editable）
  - **Unit Price（大字，auto）**

- [ ] Actions：
  - Save Summary（PATCH /api/v2/cost-sheets/{id}/）
  - Submit（POST /api/v2/cost-sheets/{id}/submit/）
  - Clone（打开 clone dialog）

### C. Inline Edit 组件

**组件：** `frontend/components/costing/InlineEditCell.tsx`

- [ ] Props: `value`, `onSave`, `disabled`, `format`（number/currency）

- [ ] 行为：
  - 单击进入编辑模式
  - 输入时 debounce（500ms）
  - 失焦自动保存
  - 显示 loading / saved / error 状态

- [ ] UI：
  - Draft: 蓝色虚线边框（hover）
  - Submitted: 灰色，禁止点击

### D. Dialogs

**Create New Version Dialog**

- [ ] Form fields:
  - Costing Type（Sample / Bulk）
  - Usage Scenario（dropdown，只显示 draft 或 locked）
  - Labor / Overhead / Margin（可选，默认值）
  - Change Reason

- [ ] Submit: `POST /api/v2/styles/{style_id}/cost-sheets/`

**Clone Version Dialog**

- [ ] Form fields:
  - New Usage Scenario（可选）
  - Change Reason

- [ ] Submit: `POST /api/v2/cost-sheets/{id}/clone/`

**Edit Summary Dialog**

- [ ] Form fields:
  - Labor / Overhead / Freight / Packing / Margin

- [ ] Submit: `PATCH /api/v2/cost-sheets/{id}/`

### E. React Query Hooks

- [ ] `useCostSheets(styleId, costingType)` - 版本列表
- [ ] `useCostSheet(costSheetId)` - 单一详情
- [ ] `useCreateCostSheet()` - 创建版本
- [ ] `useCloneCostSheet()` - Clone 版本
- [ ] `useSubmitCostSheet()` - Submit
- [ ] `useUpdateCostSheetSummary()` - 更新 summary
- [ ] `useUpdateCostLine()` - 更新 cost line

### F. TypeScript Types

- [ ] `CostSheetVersion`
- [ ] `CostLine`
- [ ] `UsageScenario`（基本信息）
- [ ] `CreateCostSheetPayload`
- [ ] `CloneCostSheetPayload`
- [ ] `UpdateCostLinePatch`

---

## Acceptance Criteria

- [ ] Timeline 显示所有版本（v1/v2/v3）
- [ ] Detail drawer 正常打开，显示完整数据
- [ ] Draft 状态可 inline edit（consumption/price）
- [ ] 调整过的行显示 ⚠️ 和 Δ%
- [ ] Submit 后版本锁定，所有编辑禁用
- [ ] Reload 后状态保持（submitted 仍是 read-only）
- [ ] Optimistic updates 正常工作
- [ ] 所有 React Query 缓存正常（无重复请求）

---

## Notes

**关键风险：**
- Inline edit 性能问题 → **缓解：debounce + optimistic updates**
- 状态同步问题 → **缓解：React Query invalidation 策略明确**
- Submitted 后仍可编辑 → **缓解：前端 disabled 检查 + 后端 403 双重保护**

**Estimated Time:** 8 hours (1 day)
