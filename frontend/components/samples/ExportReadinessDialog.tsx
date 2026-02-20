'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  ExternalLink,
  FileDown,
  Loader2,
} from 'lucide-react';
import { fetchExportReadiness, exportMWOCompletePDF } from '@/lib/api/samples';
import type { ExportReadinessCheck } from '@/lib/api/samples';

interface ExportReadinessDialogProps {
  runId: string;
  runLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusIcons = {
  ok: <CheckCircle className="w-5 h-5 text-green-500" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
  error: <XCircle className="w-5 h-5 text-red-500" />,
};

const statusColors = {
  ok: 'text-green-700 bg-green-50',
  warning: 'text-yellow-700 bg-yellow-50',
  error: 'text-red-700 bg-red-50',
};

export function ExportReadinessDialog({
  runId,
  runLabel,
  open,
  onOpenChange,
}: ExportReadinessDialogProps) {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['export-readiness', runId],
    queryFn: () => fetchExportReadiness(runId),
    enabled: open,
  });

  const handleExport = async (force: boolean = false) => {
    if (!data?.can_export && !force) return;

    setIsExporting(true);
    try {
      const blob = await exportMWOCompletePDF(runId, true);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MWO_${runLabel}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onOpenChange(false);
    } catch (err) {
      console.error('Export failed:', err);
      alert('匯出失敗：' + (err instanceof Error ? err.message : '未知錯誤'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleGoToFix = () => {
    if (data?.first_action_url) {
      onOpenChange(false);
      router.push(data.first_action_url);
    }
  };

  const getProgressColor = (completeness: number) => {
    if (completeness >= 75) return 'bg-green-500';
    if (completeness >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>MWO 匯出預檢</DialogTitle>
          <DialogDescription>
            檢查 {runLabel} 的資料完整性
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">檢查中...</span>
          </div>
        ) : error ? (
          <div className="py-4 text-center text-red-500">
            檢查失敗：{error instanceof Error ? error.message : '未知錯誤'}
          </div>
        ) : data ? (
          <>
            {/* 檢查項目列表 */}
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {data.checks.map((check: ExportReadinessCheck) => (
                <div
                  key={check.item}
                  className={`flex items-start gap-3 p-3 rounded-lg ${statusColors[check.status]}`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {statusIcons[check.status]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">
                      {check.item_zh} ({check.item})
                    </div>
                    <div className="text-sm opacity-80">{check.message}</div>
                    {check.details && (
                      <div className="text-sm mt-1 opacity-70">{check.details}</div>
                    )}
                  </div>
                  {check.action_url && check.status !== 'ok' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0"
                      onClick={() => {
                        onOpenChange(false);
                        router.push(check.action_url!);
                      }}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* 完整度進度條 */}
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">完整度</span>
                <span className={data.completeness >= 75 ? 'text-green-600' : data.completeness >= 50 ? 'text-yellow-600' : 'text-red-600'}>
                  {data.completeness}%
                </span>
              </div>
              <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`absolute left-0 top-0 h-full transition-all ${getProgressColor(data.completeness)}`}
                  style={{ width: `${data.completeness}%` }}
                />
              </div>
              <p className="text-sm text-gray-500">{data.recommendation}</p>
            </div>
          </>
        ) : null}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>

          {data?.first_action_url && data.completeness < 100 && (
            <Button variant="secondary" onClick={handleGoToFix}>
              前往補全
            </Button>
          )}

          {data?.completeness !== undefined && data.completeness < 75 && data.can_export && (
            <Button
              variant="outline"
              onClick={() => handleExport(true)}
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  匯出中...
                </>
              ) : (
                '仍要匯出'
              )}
            </Button>
          )}

          <Button
            onClick={() => handleExport(false)}
            disabled={isExporting || !data?.can_export || (data?.completeness ?? 0) < 25}
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                匯出中...
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4 mr-2" />
                匯出 MWO
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
