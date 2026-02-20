## Description

实现 Phase 2-3B 加值功能：版本比较（Compare）和影响检测（Impact Detection）。

**核心目标：**
- 版本比较 UI（显示 v1 vs v2 差异）
- Impact Detection MVP（Rev B 发布时提示受影响的报价）

**架构参考：**
- 📘 完整规格：`docs/PHASE-2-3-IMPLEMENTATION-CHECKLIST.md`（第 5-6 节）

**Dependencies:** Issue #3 (Day 3 完成后才能开始)

**Priority:** Medium（可选，不影响主线）

---

## Tasks

### A. Compare Endpoint + UI

**Backend**

- [ ] `GET /api/v2/cost-sheets/compare/?v1={id1}&v2={id2}`
  - 实现 CostingService.compare_cost_sheets(id1, id2)
  - 返回：
    - summary delta（material_cost, total_cost, unit_price, margin_pct）
    - line_changes（按 material_name 匹配）
    - evidence_changes（techpack_revision, usage_scenario）

**Frontend**

- [ ] Compare Dialog 组件
  - 选择两个版本（dropdown）
  - 显示 summary delta（表格，含差异百分比）
  - 显示 line changes（表格，高亮变化）
  - 颜色标记：红色（增加），绿色（减少）

- [ ] Timeline 添加 Compare 按钮
  - 选择两个版本后打开 Compare Dialog

### B. Impact Detection MVP

**Backend**

**Service:** `apps/parsing/services/impact.py`

- [ ] `detect_bom_changes(prev_rev_id, new_rev_id)`
  - 对比 BOMItem（按 material_name + supplier + color + unit 匹配）
  - 返回：added / removed / modified（只看 unit_price, supplier, leadtime 等字段）

- [ ] `get_affected_cost_sheets(prev_rev_id)`
  - 查询：`techpack_revision == prev_rev AND status in ['submitted', 'accepted']`
  - 返回：impacted cost sheets 列表

- [ ] `generate_impact_report(old_rev_id, new_rev_id)`
  - 整合 BOM changes + affected cost sheets
  - 返回完整报告

**API Endpoint**

- [ ] `GET /api/v2/revisions/{new_rev_id}/impact/`
  - 调用 generate_impact_report
  - 返回：
    - bom_change_summary（added/removed/modified counts）
    - impacted_cost_sheets_count
    - impacted_cost_sheets（前 20 笔）
    - changes_preview（前 20 笔变更）

**Frontend**

- [ ] Revision 页面添加 Impact Alert
  - 显示：`⚠️ This revision affects {X} cost sheets`
  - 点击查看详情（打开 Impact Report Dialog）

- [ ] Impact Report Dialog
  - BOM Changes Summary（表格）
  - Affected Cost Sheets（列表，含链接）
  - Recommendation（建议创建新版本）

---

## Acceptance Criteria

**Compare:**
- [ ] Compare endpoint 正常工作
- [ ] Compare dialog 正确显示差异
- [ ] 差异百分比计算正确
- [ ] 颜色标记清晰（红/绿）

**Impact Detection:**
- [ ] Impact detection endpoint 正常工作
- [ ] BOM changes 统计正确（added/removed/modified）
- [ ] Affected cost sheets 查询正确
- [ ] UI 提示正常显示
- [ ] Impact report dialog 显示完整信息

---

## Notes

**MVP 限制：**
- 只检测 BOMItem 变更（不含 Measurements/Steps）
- 只提示，不自动创建新版本（需要人工决策）
- 前 20 笔变更预览（避免数据量过大）

**未来优化：**
- 支持 Measurements/Steps 变更检测
- 自动建议创建新版本
- 批量更新受影响 cost sheets

**Estimated Time:** 4-6 hours (0.5-1 day)
