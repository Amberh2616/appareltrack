## Description

实现 Phase 2-3 的 Backend Services 和 API 端点，包含完整的 Transaction 保护、403 Guard、版本号并发锁。

**核心目标：**
- 实现 UsageScenarioService + CostingService
- 创建 12+ API endpoints
- 落实 3 条必备规范（R1-R3）
- 编写至少 7 个核心测试

**架构参考：**
- 📘 完整规格：`docs/PHASE-2-3-IMPLEMENTATION-CHECKLIST.md`
- Service 层集中业务逻辑，ViewSet 只负责转发

**Dependencies:** Issue #1 (Day 1 完成后才能开始)

---

## Tasks

### A. 三条必备规范落地（今天一定做）

- [ ] **R1: 状态单一真相**
  - UsageScenario.is_locked() 以推导为准（不用 DB status='locked'）
  - API 返回 `is_locked` 字段

- [ ] **R2: 版本号并发保护**
  - create/clone scenario: `select_for_update()` lock `(revision, purpose)`
  - create/clone cost sheet: `select_for_update()` lock `(cost_sheet_group, costing_type)`
  - version_no 生成在 transaction 内

- [ ] **R3: 禁止 hard delete**
  - API 层不提供 DELETE endpoint（或只允许 admin）
  - 使用 `status='superseded'` 代替删除

### B. Services 实现（集中业务逻辑）

**UsageScenarioService** (`apps/parsing/services/usage_scenario.py`)

- [ ] `create_scenario(revision, purpose, payload)`
  - Transaction + lock
  - 自动生成 version_no
  - 自动创建 UsageLines（从 BOMItem 或复制旧 scenario）
  - 返回 scenario + lines

- [ ] `clone_scenario(scenario_id, overrides)`
  - Transaction + lock
  - 复制所有 UsageLines
  - version_no 自动 +1

- [ ] `update_usage_line(line_id, patch, user)`
  - Guard: `scenario.can_edit()` 否则 403
  - 更新 consumption / consumption_status
  - 设置 confirmed_by, confirmed_at

**CostingService** (`apps/parsing/services/costing.py`)

- [ ] `create_cost_sheet(style, costing_type, techpack_revision, usage_scenario, params)`
  - Transaction + lock
  - get_or_create CostSheetGroup
  - 生成 version_no
  - 生成 CostLines（快照 UsageLines）
  - 计算 totals（DB aggregate）

- [ ] `clone_cost_sheet(cost_sheet_id, new_usage_scenario_id?, change_reason)`
  - Transaction + lock
  - 如果 new_usage_scenario_id: 重新生成 CostLines
  - 否则: 复制 CostLines（含 adjusted 值）

- [ ] `submit_cost_sheet(cost_sheet_id, user)`
  - Transaction（原子操作）
  - status = submitted
  - Supersede previous submitted（可选）
  - Lock usage_scenario（audit: locked_at, locked_first_by）

- [ ] `update_cost_sheet_summary(cost_sheet_id, patch, user)`
  - Guard: can_edit()
  - 更新 labor/overhead/margin
  - 重算 totals

- [ ] `update_cost_line(line_id, patch, user)`
  - Guard: parent.can_edit()
  - 更新 consumption_adjusted / unit_price_adjusted
  - 设置 is_*_adjusted flags
  - 重算 line_cost
  - 触发 parent.recalculate_totals()

### C. API Endpoints（ViewSets）

**UsageScenario Endpoints**

- [ ] `POST /api/v2/revisions/{id}/usage-scenarios/`
  - 调用 UsageScenarioService.create_scenario

- [ ] `GET /api/v2/usage-scenarios/`
  - Query params: revision_id, purpose, status

- [ ] `GET /api/v2/usage-scenarios/{id}/`
  - 含 nested usage_lines

- [ ] `POST /api/v2/usage-scenarios/{id}/clone/`
  - 调用 clone_scenario

- [ ] `PATCH /api/v2/usage-lines/{id}/`
  - 调用 update_usage_line

**CostSheetVersion Endpoints**

- [ ] `GET /api/v2/styles/{style_id}/cost-sheets/`
  - Query params: costing_type, status
  - 返回版本列表

- [ ] `POST /api/v2/styles/{style_id}/cost-sheets/`
  - 调用 create_cost_sheet

- [ ] `GET /api/v2/cost-sheets/{id}/`
  - 含 nested cost_lines

- [ ] `POST /api/v2/cost-sheets/{id}/clone/`
  - 调用 clone_cost_sheet

- [ ] `POST /api/v2/cost-sheets/{id}/submit/`
  - 调用 submit_cost_sheet

- [ ] `PATCH /api/v2/cost-sheets/{id}/`
  - 调用 update_cost_sheet_summary

- [ ] `PATCH /api/v2/cost-lines/{id}/`
  - 调用 update_cost_line

### D. 核心测试（至少 7 个）

- [ ] test_create_usage_scenario_ok
- [ ] test_submit_cost_sheet_locks_version (403 after submit)
- [ ] test_clone_cost_sheet_creates_v2_draft
- [ ] test_same_usage_scenario_locked_when_multiple_cost_sheets_submitted
- [ ] test_update_cost_line_updates_flags_and_totals
- [ ] test_submit_v2_supersedes_v1 (if enabled)
- [ ] test_concurrent_version_no_no_collision (并发测试)

### E. Totals 计算优化

- [ ] `CostLine.save()` 只更新 line_cost（不触发 parent）
- [ ] `CostSheetVersion.recalculate_totals()` 使用 `aggregate(Sum('line_cost'))`
- [ ] Service 层统一调用 recalculate_totals()

---

## Acceptance Criteria

- [ ] 所有 API endpoints 实现并测试通过
- [ ] 3 条必备规范（R1-R3）落实到代码
- [ ] 至少 7 个核心测试通过
- [ ] Transaction 保护正确（并发安全）
- [ ] 403 Guard 正常工作（submitted 后禁止编辑）
- [ ] Totals 计算正确（无浮点误差）

---

## Notes

**关键风险：**
- 并发版本号冲突 → **缓解：select_for_update() + unit test 验证**
- Totals 计算错误 → **缓解：DB aggregate + Decimal quantize + 测试覆盖**
- 循环触发 totals → **缓解：Service 层统一调用，Model save() 不触发 parent**

**Estimated Time:** 8 hours (1 day)
