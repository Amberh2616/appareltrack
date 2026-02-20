## Description

实施 Phase 2-3 重构的数据模型和迁移策略，建立三层分离架构的数据基础。

**核心目标：**
- 创建新模型（UsageScenario/Line, CostSheetGroup/Version/Line）
- 执行数据迁移（BOMItem.consumption → UsageLine）
- 验证数据完整性
- 清理旧字段

**架构参考：**
- 📘 完整规格：`docs/PHASE-2-3-IMPLEMENTATION-CHECKLIST.md`
- 三层分离：BOM (WHAT) → Usage (HOW MUCH) → Costing (QUOTE VERSION)

---

## Tasks

### A. Models（新增，不动旧字段）

- [ ] 新增 `UsageScenario` model
  - `revision`, `purpose`, `version_no`, `wastage_pct`, `status`
  - `locked_at`, `locked_first_by_cost_sheet`（audit only）
  - Meta: `unique_together = [('revision', 'purpose', 'version_no')]`
  - Method: `is_locked()` - 推导规则

- [ ] 新增 `UsageLine` model
  - `usage_scenario`, `bom_item`
  - `consumption`, `consumption_unit`, `consumption_status`
  - `wastage_pct_override`, `sort_order`
  - Property: `adjusted_consumption`（即时计算）

- [ ] 新增 `CostSheetGroup` model
  - `style`（绑 Style，不绑 Revision）⭐
  - `created_at`, `updated_at`

- [ ] 新增 `CostSheetVersion` model
  - `cost_sheet_group`, `version_no`, `costing_type`
  - Evidence: `techpack_revision`, `usage_scenario` ⭐
  - `labor_cost`, `overhead_cost`, `margin_pct`, etc.
  - `status` (draft/submitted/superseded/accepted/rejected)
  - `superseded_by`, `cloned_from`, `change_reason`

- [ ] 新增 `CostLine` model
  - `cost_sheet_version`
  - Source 追踪: `source_revision_id`, `source_usage_scenario_id`, `source_bom_item_id`, etc.
  - Snapshot: `consumption_snapshot`, `unit_price_snapshot`
  - Adjusted: `consumption_adjusted`, `unit_price_adjusted`
  - Flags: `is_consumption_adjusted`, `is_price_adjusted`
  - `line_cost`

### B. Migration 执行顺序（固定，不可颠倒）

- [ ] **M1: Create Tables**
  - `python manage.py makemigrations parsing --name add_usage_scenario_models`
  - 只建新表，不修改旧表

- [ ] **M2: Data Migration - BOMItem.consumption → UsageLine**
  - `python manage.py makemigrations parsing --name migrate_consumption_to_usage_lines --empty`
  - 针对每个 revision:
    - 创建 `UsageScenario(purpose='bulk_quote', version_no=1, status='draft')`
    - 对该 revision 的所有 BOMItem 创建 UsageLine:
      - `consumption = old_bom_item.consumption`（若无则 0）
      - `consumption_unit = bom_item.unit`
      - `consumption_status = 'estimated'`
  - Bulk create（性能优化）

- [ ] **M3: Data Migration - Old CostSheet → CostSheetVersion**
  - `python manage.py makemigrations parsing --name migrate_old_cost_sheets --empty`
  - 对每个 style: `get_or_create CostSheetGroup(style)`
  - 对旧 cost sheet:
    - 创建 `CostSheetVersion v1`（costing_type mapping）
    - Evidence:
      - `techpack_revision = old_sheet.revision`
      - `usage_scenario = (该 revision 的 bulk_quote v1)`
    - 生成 CostLines（快照模式）

- [ ] **M4: Cleanup**
  - `python manage.py makemigrations parsing --name cleanup_old_fields`
  - 移除: `BOMItem.consumption`, `consumption_status`, `wastage_rate`
  - 删除旧模型（如果有）

### C. Migration 验证（必做，避免半套数据）

- [ ] 每个 revision: `UsageLine.count() == BOMItem.count()`（至少在 bulk_quote v1）
- [ ] 每个 CostSheetVersion: `CostLine.count() > 0` 且 totals 可计算
- [ ] 任一数据不符: migration raise error
- [ ] Sandbox DB 测试通过
- [ ] Dev DB 应用成功

---

## Acceptance Criteria

- [ ] 所有新模型创建成功，migrations 无错误
- [ ] 数据迁移完成，验证测试全部通过
- [ ] 旧字段已删除，代码中无引用
- [ ] Django Admin 可正常查看新模型数据
- [ ] 数据一致性检查脚本通过

---

## Notes

**关键风险：**
- Migration 失败导致数据丢失 → **缓解：Sandbox 先测试 + Backup before migrate**
- 数据不一致 → **缓解：强制验证，不符就 raise error**

**测试环境：**
1. Sandbox DB（本地 SQLite 或独立 PostgreSQL）
2. Dev DB
3. 最后才 Production

**Estimated Time:** 8 hours (1 day)
