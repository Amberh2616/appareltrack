'use client';

import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRight, CheckCircle, XCircle } from 'lucide-react';
import { batchTransitionSmart } from '@/lib/api/samples';
import type { KanbanRunItem } from '@/lib/api/samples';

interface BatchTransitionDialogProps {
  selectedRuns: KanbanRunItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// 狀態到動作的映射
const STATUS_TO_ACTION: Record<string, { action: string; label: string; labelZh: string }> = {
  draft: { action: 'start_materials_planning', label: 'Start Planning', labelZh: '開始規劃' },
  materials_planning: { action: 'generate_t2po', label: 'Gen T2PO', labelZh: '生成採購單' },
  po_drafted: { action: 'issue_t2po', label: 'Issue PO', labelZh: '發出採購單' },
  po_issued: { action: 'generate_mwo', label: 'Gen MWO', labelZh: '生成製單' },
  mwo_drafted: { action: 'issue_mwo', label: 'Issue MWO', labelZh: '發出製單' },
  mwo_issued: { action: 'start_production', label: 'Start Prod', labelZh: '開始生產' },
  in_progress: { action: 'mark_sample_done', label: 'Done', labelZh: '完成' },
  sample_done: { action: 'record_actuals', label: 'Record', labelZh: '記錄實際' },
  actuals_recorded: { action: 'generate_sample_costing', label: 'Gen Cost', labelZh: '生成報價' },
  costing_generated: { action: 'mark_quoted', label: 'Quote', labelZh: '報價' },
  quoted: { action: 'mark_accepted', label: 'Accept', labelZh: '接受' },
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  materials_planning: 'Planning',
  po_drafted: 'PO Drafted',
  po_issued: 'PO Issued',
  mwo_drafted: 'MWO Drafted',
  mwo_issued: 'MWO Issued',
  in_progress: 'In Progress',
  sample_done: 'Sample Done',
  actuals_recorded: 'Actuals Recorded',
  costing_generated: 'Costing Generated',
  quoted: 'Quoted',
  accepted: 'Accepted',
  cancelled: 'Cancelled',
};

export function BatchTransitionDialog({
  selectedRuns,
  open,
  onOpenChange,
  onSuccess,
}: BatchTransitionDialogProps) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<{
    total: number;
    succeeded: number;
    failed: number;
  } | null>(null);

  // 按狀態分組
  const groupedRuns = useMemo(() => {
    const groups: Record<string, KanbanRunItem[]> = {};
    selectedRuns.forEach((run) => {
      if (!groups[run.status]) {
        groups[run.status] = [];
      }
      groups[run.status].push(run);
    });
    return groups;
  }, [selectedRuns]);

  const mutation = useMutation({
    mutationFn: () => batchTransitionSmart(selectedRuns.map((r) => r.id)),
    onSuccess: (data) => {
      setResult({
        total: data.total,
        succeeded: data.succeeded,
        failed: data.failed,
      });
      queryClient.invalidateQueries({ queryKey: ['kanban-runs'] });
      queryClient.invalidateQueries({ queryKey: ['kanban-counts'] });
    },
  });

  const handleConfirm = () => {
    mutation.mutate();
  };

  const handleClose = () => {
    setResult(null);
    onOpenChange(false);
    if (result && result.succeeded > 0) {
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {result ? '批量操作結果' : '批量操作預覽'}
          </DialogTitle>
          <DialogDescription>
            {result
              ? `已處理 ${result.total} 項操作`
              : `將對 ${selectedRuns.length} 張卡片執行以下操作`}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          // 結果顯示
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-8 py-4">
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mx-auto mb-2">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div className="text-2xl font-bold text-green-600">{result.succeeded}</div>
                <div className="text-sm text-gray-500">成功</div>
              </div>
              {result.failed > 0 && (
                <div className="text-center">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-2">
                    <XCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="text-2xl font-bold text-red-600">{result.failed}</div>
                  <div className="text-sm text-gray-500">失敗</div>
                </div>
              )}
            </div>
          </div>
        ) : (
          // 預覽顯示
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {Object.entries(groupedRuns).map(([status, runs]) => {
              const actionInfo = STATUS_TO_ACTION[status];
              const isTerminal = !actionInfo;

              return (
                <div
                  key={status}
                  className={`p-3 rounded-lg border ${
                    isTerminal ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {STATUS_LABELS[status] || status}
                      </Badge>
                      <span className="text-sm text-gray-500">({runs.length})</span>
                    </div>
                    {actionInfo ? (
                      <div className="flex items-center gap-1 text-sm text-blue-600">
                        <ArrowRight className="w-4 h-4" />
                        <span>{actionInfo.labelZh}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">終態，無法轉換</span>
                    )}
                  </div>
                  <ul className="text-sm text-gray-600 space-y-1 pl-2">
                    {runs.slice(0, 3).map((run) => (
                      <li key={run.id}>
                        • {run.style?.style_number || 'Unknown'} Run #{run.run_no}
                      </li>
                    ))}
                    {runs.length > 3 && (
                      <li className="text-gray-400">... 及其他 {runs.length - 3} 項</li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={handleClose}>關閉</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                取消
              </Button>
              <Button onClick={handleConfirm} disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    處理中...
                  </>
                ) : (
                  `確認執行 ${selectedRuns.length} 項`
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
