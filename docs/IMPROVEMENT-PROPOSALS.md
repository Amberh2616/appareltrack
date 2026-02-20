# 系統改善方案

**建立日期：** 2026-01-20
**優先級排序：** P1 > P2 > P3 > P4

---

## 目錄

1. [方案一：狀態回退功能](#方案一狀態回退功能)
2. [方案二：甘特圖拖拽調整日期](#方案二甘特圖拖拽調整日期)
3. [方案三：MWO 匯出智能提示](#方案三mwo-匯出智能提示)
4. [方案四：批量操作支援混合狀態](#方案四批量操作支援混合狀態)
5. [實施優先級建議](#實施優先級建議)

---

## 方案一：狀態回退功能

### 當前限制

```
狀態只能往前推進，無法回退（需重新創建 Run）
```

**現有流程：**
```
Draft → Planning → PO Drafted → ... → Accepted
         ↑
         │ 目前無法回退
         ↓
     需重新建立 Run
```

### 改善方案

#### 方案 A：有限回退（推薦）

允許回退到「安全點」，避免破壞已生成的文件。

**安全回退規則：**

| 當前狀態 | 可回退到 | 條件 |
|---------|---------|------|
| `materials_planning` | `draft` | 無條件 |
| `po_drafted` | `materials_planning` | PO 尚未發送 |
| `mwo_drafted` | `po_issued` | MWO 尚未發出 |
| `in_progress` | `mwo_issued` | 尚無實際記錄 |
| `sample_done` | `in_progress` | 尚無實際記錄 |
| `quoted` | `costing_generated` | 客戶尚未確認 |

**不可回退的情況：**
- `po_issued` → `po_drafted`（PO 已發給供應商）
- `mwo_issued` → `mwo_drafted`（MWO 已發給工廠）
- `accepted`（終態）
- 任何已有「實際數據」的狀態

#### 方案 B：完整回退 + 審計日誌

允許任意回退，但記錄完整審計軌跡。

### 技術實現

**1. 後端修改 `run_transitions.py`**

```python
# 新增回退轉換定義
ROLLBACK_TRANSITIONS = {
    'materials_planning': {
        'rollback_to_draft': 'draft',
    },
    'po_drafted': {
        'rollback_to_planning': 'materials_planning',
    },
    'mwo_drafted': {
        'rollback_to_po_issued': 'po_issued',
    },
    'in_progress': {
        'rollback_to_mwo_issued': 'mwo_issued',
    },
    'sample_done': {
        'rollback_to_in_progress': 'in_progress',
    },
    'quoted': {
        'rollback_to_costing': 'costing_generated',
    },
}

# 回退前置條件
ROLLBACK_PREREQUISITES = {
    'rollback_to_planning': lambda run: not run.t2pos.filter(status='issued').exists(),
    'rollback_to_po_issued': lambda run: not run.mwos.filter(status='issued').exists(),
    'rollback_to_mwo_issued': lambda run: not hasattr(run, 'actual_usage'),
    'rollback_to_in_progress': lambda run: not hasattr(run, 'actual_usage'),
}

# 回退副作用（清理）
ROLLBACK_SIDE_EFFECTS = {
    'rollback_to_draft': lambda run: run.usage_scenarios.filter(scenario_type='guidance').delete(),
    'rollback_to_planning': lambda run: run.t2pos.filter(status='draft').delete(),
    'rollback_to_po_issued': lambda run: run.mwos.filter(status='draft').delete(),
}
```

**2. 新增 API 端點**

```python
# views.py
@action(detail=True, methods=['post'], url_path='rollback')
def rollback(self, request, pk=None):
    """回退到指定狀態"""
    run = self.get_object()
    target_status = request.data.get('target_status')
    reason = request.data.get('reason', '')

    result = rollback_sample_run(
        run_id=run.id,
        target_status=target_status,
        actor=request.user,
        reason=reason
    )

    return Response(result)
```

**3. 前端 Kanban 卡片新增回退按鈕**

```tsx
// KanbanCard.tsx
{canRollback && (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm">
        <Undo2 className="w-4 h-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      {allowedRollbacks.map((rb) => (
        <DropdownMenuItem
          key={rb.action}
          onClick={() => handleRollback(rb.action)}
        >
          ← 回退到 {rb.targetLabel}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
)}
```

**4. 審計日誌**

```python
# models.py
class StatusChangeLog(models.Model):
    sample_run = models.ForeignKey(SampleRun, on_delete=models.CASCADE)
    from_status = models.CharField(max_length=50)
    to_status = models.CharField(max_length=50)
    action = models.CharField(max_length=50)  # 'transition' or 'rollback'
    reason = models.TextField(blank=True)
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

### 工作量估計

| 項目 | 工時 |
|------|------|
| 後端狀態機修改 | 4h |
| API 端點 | 2h |
| 審計日誌模型 | 2h |
| 前端回退按鈕 | 3h |
| 測試 | 3h |
| **總計** | **14h** |

### 風險評估

| 風險 | 等級 | 緩解措施 |
|------|------|----------|
| 數據一致性 | 中 | 使用 DB transaction |
| 誤操作 | 低 | 確認對話框 + 原因填寫 |
| 已發送文件 | 高 | 禁止回退已發送狀態 |

---

## 方案二：甘特圖拖拽調整日期

### 當前限制

```
甘特圖僅供查看，不支援拖拽調整日期
```

### 改善方案

#### 功能設計

**支援操作：**

| 操作 | 說明 | 調整欄位 |
|------|------|----------|
| 拖拽整條 | 平移整個時間段 | `created_at` + `target_due_date` |
| 拖拽右端 | 延長/縮短工期 | `target_due_date` |
| 拖拽左端 | 調整開始日期 | `created_at`（僅 Draft 狀態）|

**限制條件：**
- 只有 `draft` 和 `materials_planning` 狀態可調整
- `po_issued` 之後鎖定日期
- 不可將 due_date 設為過去

#### 介面設計

```
┌─────────────────────────────────────────────────────────────────────┐
│ Scheduler                                        [🔒 鎖定模式 | 🔓]│
├─────────────────────────────────────────────────────────────────────┤
│ Style/Run          │ Jan 15 │ Jan 16 │ Jan 17 │ Jan 18 │ Jan 19 │  │
├────────────────────┼────────┴────────┴────────┴────────┴────────┤  │
│ ▼ LW1FLWS          │                                            │  │
│   └─ Run #1        │   [○]═══════════════════════[○]            │  │
│                    │    ↑                         ↑              │  │
│                    │  可拖拽                    可拖拽           │  │
│                    │  開始點                    結束點           │  │
└─────────────────────────────────────────────────────────────────────┘

拖拽時顯示：
┌──────────────────────┐
│ 調整交期              │
│ 原始：2026-01-18     │
│ 新值：2026-01-20     │
│ [取消] [確認]        │
└──────────────────────┘
```

### 技術實現

**1. 後端 API**

```python
# views.py
@action(detail=True, methods=['patch'], url_path='update-dates')
def update_dates(self, request, pk=None):
    """更新 Run 的日期"""
    run = self.get_object()

    # 檢查是否允許調整
    if run.status not in ['draft', 'materials_planning']:
        return Response(
            {'detail': '只有 Draft 或 Planning 狀態可調整日期'},
            status=status.HTTP_400_BAD_REQUEST
        )

    new_due_date = request.data.get('target_due_date')

    if new_due_date:
        due_date = datetime.strptime(new_due_date, '%Y-%m-%d').date()
        if due_date < date.today():
            return Response(
                {'detail': '交期不可設為過去日期'},
                status=status.HTTP_400_BAD_REQUEST
            )
        run.target_due_date = due_date

    run.save()
    return Response({'success': True, 'target_due_date': str(run.target_due_date)})
```

**2. 前端拖拽實現**

使用 `react-dnd` 或 `@dnd-kit/core`：

```tsx
// SchedulerPage.tsx
import { useDrag, useDrop } from 'react-dnd';

function GanttBar({ run, onDateChange }) {
  const [{ isDragging }, drag] = useDrag({
    type: 'GANTT_BAR',
    item: { id: run.id, originalDue: run.target_due_date },
    canDrag: () => ['draft', 'materials_planning'].includes(run.status),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const handleDragEnd = (newDate: Date) => {
    setShowConfirm(true);
    setPendingDate(newDate);
  };

  const confirmChange = async () => {
    await updateRunDates(run.id, { target_due_date: pendingDate });
    onDateChange();
  };

  return (
    <div ref={drag} className={cn('gantt-bar', isDragging && 'opacity-50')}>
      {/* 左側拖拽點 */}
      <div className="drag-handle left" />

      {/* 進度條 */}
      <div className="progress-bar" style={{ backgroundColor: run.color }} />

      {/* 右側拖拽點 */}
      <div className="drag-handle right" />

      {/* 確認對話框 */}
      {showConfirm && (
        <ConfirmDialog
          title="調整交期"
          message={`確定將交期從 ${run.target_due_date} 改為 ${pendingDate}？`}
          onConfirm={confirmChange}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
```

**3. 日期計算工具**

```tsx
// utils/dateCalculation.ts
export function calculateNewDate(
  originalDate: Date,
  pixelOffset: number,
  granularity: 'day' | 'week' | 'month',
  columnWidth: number
): Date {
  const dayOffset = Math.round(pixelOffset / columnWidth);

  const newDate = new Date(originalDate);
  if (granularity === 'day') {
    newDate.setDate(newDate.getDate() + dayOffset);
  } else if (granularity === 'week') {
    newDate.setDate(newDate.getDate() + dayOffset * 7);
  } else {
    newDate.setMonth(newDate.getMonth() + dayOffset);
  }

  return newDate;
}
```

### 工作量估計

| 項目 | 工時 |
|------|------|
| 後端 update-dates API | 2h |
| 前端拖拽基礎設施 | 4h |
| 拖拽手柄 UI | 3h |
| 日期計算邏輯 | 2h |
| 確認對話框 | 2h |
| 視覺反饋（拖拽中狀態）| 2h |
| 測試 | 3h |
| **總計** | **18h** |

### 風險評估

| 風險 | 等級 | 緩解措施 |
|------|------|----------|
| 誤操作 | 中 | 確認對話框 + 可復原 |
| 觸控裝置 | 低 | 長按啟動拖拽 |
| 性能 | 低 | 虛擬化 + 防抖 |

---

## 方案三：MWO 匯出智能提示

### 當前限制

```
匯出完整 MWO 前，需確保 BOM 和 Spec 已填寫完整
```

**現有問題：**
- 用戶不知道缺少什麼
- 匯出後才發現內容不完整
- 沒有預檢機制

### 改善方案

#### 功能設計

**匯出前預檢：**

```
點擊「Complete MWO」
        ↓
    ┌─────────────────────────────────────┐
    │ MWO 匯出預檢                    [✕] │
    ├─────────────────────────────────────┤
    │                                     │
    │ ✅ Tech Pack：已上傳（12頁）        │
    │ ⚠️ BOM：8/12 項已填寫              │
    │    └─ 缺少：裡布、拉鍊頭、主標、洗標│
    │ ❌ Spec：未驗證                     │
    │    └─ 點擊前往驗證 →               │
    │ ✅ 中文翻譯：已完成                 │
    │                                     │
    │ ─────────────────────────────────── │
    │ 完整度：67%                         │
    │ [████████░░░░]                      │
    │                                     │
    │ [取消] [仍要匯出（可能不完整）] [前往補全]│
    └─────────────────────────────────────┘
```

#### 檢查項目

| 檢查項 | 條件 | 狀態 |
|--------|------|------|
| Tech Pack | 有關聯的 PDF | ✅/❌ |
| BOM 物料 | 所有項目有 `confirmed_consumption` | ✅/⚠️/❌ |
| BOM 中文 | 所有項目有 `name_zh` | ✅/⚠️ |
| BOM 驗證 | `is_verified = True` | ✅/❌ |
| Spec 尺寸 | 有 MeasurementItem | ✅/❌ |
| Spec 中文 | 所有項目有 `point_of_measure_zh` | ✅/⚠️ |
| Spec 驗證 | 有已驗證的 Spec | ✅/❌ |
| MWO 已生成 | `run.mwos.exists()` | ✅/❌ |

### 技術實現

**1. 後端預檢 API**

```python
# views.py
@action(detail=True, methods=['get'], url_path='export-readiness')
def export_readiness(self, request, pk=None):
    """檢查 MWO 匯出準備度"""
    run = self.get_object()
    revision = run.revision or run.sample_request.revision

    checks = []

    # 1. Tech Pack 檢查
    techpack = revision.tech_pack_revision if revision else None
    techpack_pages = techpack.draft_blocks.count() if techpack else 0
    checks.append({
        'item': 'Tech Pack',
        'status': 'ok' if techpack_pages > 0 else 'error',
        'message': f'已上傳（{techpack_pages}頁）' if techpack_pages > 0 else '未上傳',
        'action_url': f'/dashboard/upload' if techpack_pages == 0 else None,
    })

    # 2. BOM 檢查
    bom_items = revision.bom_items.all() if revision else []
    bom_total = len(bom_items)
    bom_complete = sum(1 for b in bom_items if b.confirmed_consumption)
    bom_translated = sum(1 for b in bom_items if b.name_zh)
    bom_verified = revision.bom_verified if revision else False

    bom_status = 'ok' if bom_verified and bom_complete == bom_total else (
        'warning' if bom_complete > 0 else 'error'
    )
    missing_bom = [b.name_en for b in bom_items if not b.confirmed_consumption][:4]

    checks.append({
        'item': 'BOM 物料',
        'status': bom_status,
        'message': f'{bom_complete}/{bom_total} 項已填寫',
        'details': f'缺少：{", ".join(missing_bom)}' if missing_bom else None,
        'action_url': f'/dashboard/revisions/{revision.id}/bom' if revision else None,
    })

    # 3. Spec 檢查
    measurements = revision.measurements.all() if revision else []
    spec_total = len(measurements)
    spec_translated = sum(1 for m in measurements if m.point_of_measure_zh)
    spec_verified = revision.spec_verified if revision else False

    spec_status = 'ok' if spec_verified else ('warning' if spec_total > 0 else 'error')

    checks.append({
        'item': 'Spec 尺寸',
        'status': spec_status,
        'message': '已驗證' if spec_verified else (f'{spec_total} 項待驗證' if spec_total > 0 else '未填寫'),
        'action_url': f'/dashboard/revisions/{revision.id}/spec' if revision else None,
    })

    # 4. 中文翻譯檢查
    translation_complete = (bom_translated == bom_total) and (spec_translated == spec_total)
    checks.append({
        'item': '中文翻譯',
        'status': 'ok' if translation_complete else 'warning',
        'message': '已完成' if translation_complete else f'BOM {bom_translated}/{bom_total}, Spec {spec_translated}/{spec_total}',
    })

    # 計算完整度
    weights = {'ok': 1, 'warning': 0.5, 'error': 0}
    completeness = sum(weights[c['status']] for c in checks) / len(checks) * 100

    return Response({
        'checks': checks,
        'completeness': round(completeness),
        'can_export': completeness >= 50,  # 至少 50% 才允許匯出
        'recommendation': '建議先補全 BOM 和 Spec' if completeness < 80 else '準備就緒',
    })
```

**2. 前端預檢對話框**

```tsx
// ExportReadinessDialog.tsx
interface ReadinessCheck {
  item: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  details?: string;
  action_url?: string;
}

function ExportReadinessDialog({ runId, onExport, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['export-readiness', runId],
    queryFn: () => fetchExportReadiness(runId),
  });

  const statusIcon = {
    ok: <CheckCircle className="text-green-500" />,
    warning: <AlertTriangle className="text-yellow-500" />,
    error: <XCircle className="text-red-500" />,
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>MWO 匯出預檢</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {data?.checks.map((check) => (
            <div key={check.item} className="flex items-start gap-3">
              {statusIcon[check.status]}
              <div className="flex-1">
                <div className="font-medium">{check.item}</div>
                <div className="text-sm text-gray-500">{check.message}</div>
                {check.details && (
                  <div className="text-sm text-orange-600">{check.details}</div>
                )}
              </div>
              {check.action_url && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href={check.action_url}>前往 →</Link>
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* 完整度進度條 */}
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-1">
            <span>完整度</span>
            <span>{data?.completeness}%</span>
          </div>
          <Progress value={data?.completeness} />
          <p className="text-sm text-gray-500 mt-1">{data?.recommendation}</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          {data?.completeness < 100 && (
            <Button
              variant="secondary"
              onClick={() => onExport(true)}
              disabled={!data?.can_export}
            >
              仍要匯出
            </Button>
          )}
          <Button onClick={() => onExport(false)} disabled={data?.completeness < 80}>
            匯出完整 MWO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**3. 整合到 Kanban 卡片**

```tsx
// KanbanCard.tsx
const handleCompleteMWOExport = () => {
  // 顯示預檢對話框而非直接匯出
  setShowReadinessDialog(true);
};

const handleConfirmExport = (forceExport: boolean) => {
  if (forceExport) {
    // 記錄用戶選擇強制匯出
    console.log('User chose to export incomplete MWO');
  }
  window.open(`/api/v2/sample-runs/${run.id}/export-mwo-complete-pdf/`, '_blank');
  setShowReadinessDialog(false);
};
```

### 工作量估計

| 項目 | 工時 |
|------|------|
| 後端 export-readiness API | 3h |
| 前端預檢對話框 | 4h |
| 進度條和狀態圖標 | 1h |
| 整合到 Kanban | 1h |
| 測試 | 2h |
| **總計** | **11h** |

### 風險評估

| 風險 | 等級 | 緩解措施 |
|------|------|----------|
| 用戶繞過檢查 | 低 | 仍允許匯出，只是提醒 |
| 檢查項目遺漏 | 低 | 可配置檢查清單 |

---

## 方案四：批量操作支援混合狀態

### 當前限制

```
批量操作時，只有相同狀態的卡片才能一起轉換
```

**現有代碼邏輯：**
```python
statuses = set(run.status for run in runs)
if len(statuses) > 1:
    return Error('All runs must be in the same status')
```

### 改善方案

#### 方案 A：智能分組批量操作（推薦）

自動按狀態分組，分別執行對應動作。

**介面設計：**

```
選中 5 張卡片：
- 2 張 Draft
- 2 張 Materials Planning
- 1 張 PO Drafted

┌─────────────────────────────────────────────────────────┐
│ 批量操作預覽                                        [✕] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 將執行以下操作：                                        │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Draft (2)           → Start Planning               │ │
│ │ • LW1FLWS Run #1                                   │ │
│ │ • LM7B24S Run #1                                   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Materials Planning (2) → Generate T2PO             │ │
│ │ • ABC123 Run #1                                    │ │
│ │ • DEF456 Run #1                                    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ PO Drafted (1)      → Issue T2PO                   │ │
│ │ • GHI789 Run #1                                    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│               [取消] [確認執行 5 項操作]                │
└─────────────────────────────────────────────────────────┘
```

#### 方案 B：自選目標動作

用戶選擇要執行的動作，系統過濾出適用的卡片。

```
選中 5 張卡片
        ↓
選擇動作：[Start Planning ▼]
        ↓
符合條件：2 張 (Draft)
不符合：3 張 (狀態不對)
        ↓
[執行 2 張] [取消]
```

### 技術實現

**1. 後端 API 修改**

```python
# run_transitions.py

def batch_transition_mixed_statuses(
    run_ids: list[str],
    organization=None,
) -> BatchTransitionResult:
    """
    智能批量轉換：按狀態分組，每組執行對應的下一步動作
    """
    runs = SampleRun.objects.filter(id__in=run_ids)
    if organization:
        runs = runs.filter(organization=organization)

    # 按狀態分組
    grouped = defaultdict(list)
    for run in runs:
        grouped[run.status].append(run)

    all_results = []
    total_succeeded = 0
    total_failed = 0

    for status, status_runs in grouped.items():
        # 獲取該狀態的下一步動作
        available_actions = STATE_TRANSITIONS.get(status, {})
        if not available_actions:
            # 終態，無法轉換
            for run in status_runs:
                all_results.append({
                    'run_id': str(run.id),
                    'success': False,
                    'error': f'No available action for status {status}',
                })
                total_failed += 1
            continue

        # 取第一個可用動作（通常只有一個）
        action = list(available_actions.keys())[0]

        # 執行該組的批量轉換
        result = batch_transition_sample_runs(
            run_ids=[str(r.id) for r in status_runs],
            action=action,
            organization=organization,
        )

        all_results.extend(result.results)
        total_succeeded += result.succeeded
        total_failed += result.failed

    return BatchTransitionResult(
        total=len(run_ids),
        succeeded=total_succeeded,
        failed=total_failed,
        results=all_results,
        errors=[r for r in all_results if not r.get('success')],
    )
```

**2. 新增 API 端點**

```python
# views.py
@action(detail=False, methods=['post'], url_path='batch-transition-smart')
def batch_transition_smart(self, request):
    """智能批量轉換（支援混合狀態）"""
    run_ids = request.data.get('run_ids', [])

    if not run_ids:
        return Response({'detail': 'run_ids is required'}, status=400)

    result = batch_transition_mixed_statuses(
        run_ids=run_ids,
        organization=getattr(request, 'organization', None),
    )

    status_code = 200 if result.failed == 0 else (
        207 if result.succeeded > 0 else 400
    )

    return Response({
        'total': result.total,
        'succeeded': result.succeeded,
        'failed': result.failed,
        'results': result.results,
        'grouped_actions': _group_results_by_action(result.results),
    }, status=status_code)

def _group_results_by_action(results):
    """按動作分組結果"""
    grouped = defaultdict(list)
    for r in results:
        action = r.get('action', 'unknown')
        grouped[action].append(r)
    return dict(grouped)
```

**3. 前端預覽對話框**

```tsx
// BatchTransitionDialog.tsx
function BatchTransitionDialog({ selectedRuns, onConfirm, onClose }) {
  // 按狀態分組
  const groupedRuns = useMemo(() => {
    const groups: Record<string, typeof selectedRuns> = {};
    selectedRuns.forEach((run) => {
      if (!groups[run.status]) {
        groups[run.status] = [];
      }
      groups[run.status].push(run);
    });
    return groups;
  }, [selectedRuns]);

  // 獲取每個狀態的下一步動作
  const statusActions = {
    draft: { action: 'start_materials_planning', label: 'Start Planning' },
    materials_planning: { action: 'generate_t2po', label: 'Generate T2PO' },
    po_drafted: { action: 'issue_t2po', label: 'Issue T2PO' },
    // ... 其他狀態
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>批量操作預覽</DialogTitle>
          <DialogDescription>
            將對 {selectedRuns.length} 張卡片執行以下操作
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {Object.entries(groupedRuns).map(([status, runs]) => {
            const actionInfo = statusActions[status];
            return (
              <Card key={status}>
                <CardHeader className="py-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">
                      {STATUS_LABELS[status]} ({runs.length})
                    </span>
                    <Badge variant="outline">
                      → {actionInfo?.label || '無可用動作'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="py-2">
                  <ul className="text-sm text-gray-600 space-y-1">
                    {runs.slice(0, 3).map((run) => (
                      <li key={run.id}>• {run.style_number} Run #{run.run_no}</li>
                    ))}
                    {runs.length > 3 && (
                      <li className="text-gray-400">... 及其他 {runs.length - 3} 項</li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={() => onConfirm('smart')}>
            確認執行 {selectedRuns.length} 項操作
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**4. Kanban 頁面整合**

```tsx
// KanbanPage.tsx
const handleBatchOperation = async () => {
  if (selectedRuns.size === 0) return;

  const runs = Array.from(selectedRuns).map(id => runData.find(r => r.id === id));
  const statuses = new Set(runs.map(r => r.status));

  if (statuses.size === 1) {
    // 單一狀態，使用原有邏輯
    setShowBatchConfirm(true);
  } else {
    // 混合狀態，使用智能批量
    setShowSmartBatchDialog(true);
  }
};

const executeSmartBatch = async () => {
  const result = await batchTransitionSmart(Array.from(selectedRuns));

  toast({
    title: '批量操作完成',
    description: `成功 ${result.succeeded} 項，失敗 ${result.failed} 項`,
    variant: result.failed > 0 ? 'warning' : 'success',
  });

  setSelectedRuns(new Set());
  queryClient.invalidateQueries(['kanban-runs']);
};
```

### 工作量估計

| 項目 | 工時 |
|------|------|
| 後端 batch-transition-smart API | 3h |
| 分組邏輯 | 2h |
| 前端預覽對話框 | 4h |
| 結果展示 UI | 2h |
| Kanban 整合 | 2h |
| 測試 | 2h |
| **總計** | **15h** |

### 風險評估

| 風險 | 等級 | 緩解措施 |
|------|------|----------|
| 部分失敗 | 中 | 清楚顯示成功/失敗數 |
| 誤操作 | 低 | 預覽對話框確認 |
| 順序問題 | 低 | 無依賴關係時可並行 |

---

## 實施優先級建議

| 排序 | 方案 | 工時 | 價值 | 建議 |
|------|------|------|------|------|
| **P1** | 方案三：MWO 匯出智能提示 | 11h | 高 | **優先實施** - 減少錯誤匯出 |
| **P2** | 方案四：批量混合狀態 | 15h | 高 | 次優先 - 提升批量效率 |
| **P3** | 方案一：狀態回退 | 14h | 中 | 常見需求但風險較高 |
| **P4** | 方案二：甘特圖拖拽 | 18h | 中 | 錦上添花功能 |

### 總工時估計

| 方案 | 工時 |
|------|------|
| 全部實施 | 58h（約 7-8 個工作日）|
| P1 + P2 | 26h（約 3-4 個工作日）|
| 僅 P1 | 11h（約 1.5 個工作日）|

### 建議實施順序

```
Phase 1（本週）
├── P1: MWO 匯出智能提示 ← 最快見效
│
Phase 2（下週）
├── P4: 批量混合狀態操作
│
Phase 3（視需求）
├── P3: 狀態回退功能
├── P2: 甘特圖拖拽
```

---

## 附錄：相關文件

| 文件 | 說明 |
|------|------|
| `backend/apps/samples/services/run_transitions.py` | 狀態機核心 |
| `backend/apps/samples/views.py` | API ViewSet |
| `frontend/app/dashboard/samples/kanban/page.tsx` | Kanban 頁面 |
| `frontend/app/dashboard/scheduler/page.tsx` | 甘特圖頁面 |

---

**文件結束**
