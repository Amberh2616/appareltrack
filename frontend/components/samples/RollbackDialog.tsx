'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, RotateCcw, AlertTriangle, ArrowLeft } from 'lucide-react';
import { fetchRollbackTargets, rollbackSampleRun } from '@/lib/api/samples';
import type { KanbanRunItem } from '@/lib/api/samples';

interface RollbackDialogProps {
  run: KanbanRunItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft 草稿',
  materials_planning: 'Planning 物料規劃',
  po_drafted: 'PO Drafted 採購草稿',
  po_issued: 'PO Issued 採購已發',
  mwo_drafted: 'MWO Drafted 製單草稿',
  mwo_issued: 'MWO Issued 製單已發',
  in_progress: 'In Progress 生產中',
  sample_done: 'Sample Done 樣衣完成',
  actuals_recorded: 'Actuals Recorded 實際值已記錄',
  costing_generated: 'Costing Generated 報價已生成',
  quoted: 'Quoted 已報價',
  accepted: 'Accepted 已接受',
  revise_needed: 'Revise Needed 需修改',
  cancelled: 'Cancelled 已取消',
};

export function RollbackDialog({
  run,
  open,
  onOpenChange,
  onSuccess,
}: RollbackDialogProps) {
  const queryClient = useQueryClient();
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedTarget(null);
      setReason('');
    }
  }, [open]);

  // Fetch rollback targets
  const { data: targetsData, isLoading: loadingTargets } = useQuery({
    queryKey: ['rollback-targets', run?.id],
    queryFn: () => fetchRollbackTargets(run!.id),
    enabled: open && !!run,
  });

  // Rollback mutation
  const mutation = useMutation({
    mutationFn: () => {
      if (!run || !selectedTarget) {
        throw new Error('Missing run or target status');
      }
      return rollbackSampleRun(run.id, selectedTarget, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-runs'] });
      queryClient.invalidateQueries({ queryKey: ['kanban-counts'] });
      onOpenChange(false);
      onSuccess();
    },
  });

  const handleConfirm = () => {
    mutation.mutate();
  };

  if (!run) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5" />
            狀態回退
          </DialogTitle>
          <DialogDescription>
            將 {run.style?.style_number || 'Unknown'} Run #{run.run_no} 回退到上一個狀態
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Status */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-500">當前狀態</span>
            <Badge variant="outline" className="font-medium">
              {STATUS_LABELS[run.status] || run.status}
            </Badge>
          </div>

          {/* Rollback Targets */}
          {loadingTargets ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : targetsData?.rollback_targets && targetsData.rollback_targets.length > 0 ? (
            <div className="space-y-2">
              <Label>選擇回退目標</Label>
              <div className="space-y-2">
                {targetsData.rollback_targets.map((target) => (
                  <button
                    key={target}
                    onClick={() => setSelectedTarget(target)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      selectedTarget === target
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ArrowLeft className="w-4 h-4 text-gray-400" />
                      <span className="font-medium">
                        {STATUS_LABELS[target] || target}
                      </span>
                    </div>
                    {selectedTarget === target && (
                      <Badge className="bg-blue-500">已選擇</Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <p className="font-medium text-amber-800">無法回退</p>
                <p className="text-sm text-amber-600">
                  當前狀態 ({STATUS_LABELS[run.status] || run.status}) 無法回退到任何狀態
                </p>
              </div>
            </div>
          )}

          {/* Reason Input */}
          {selectedTarget && (
            <div className="space-y-2">
              <Label htmlFor="reason">回退原因（選填）</Label>
              <Textarea
                id="reason"
                placeholder="請輸入回退原因..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {/* Warning */}
          {selectedTarget && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-amber-700">
                <p className="font-medium">注意：</p>
                <p>回退操作不會刪除已生成的文件（如 MWO、PO），但會記錄在操作日誌中。</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedTarget || mutation.isPending}
            className="bg-amber-500 hover:bg-amber-600"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                處理中...
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4 mr-2" />
                確認回退
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
