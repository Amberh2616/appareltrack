'use client';

import { useQuery } from '@tanstack/react-query';
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
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Package,
  Cog,
  DollarSign,
  FileText,
  ShoppingCart,
} from 'lucide-react';
import { fetchMWOPrecheck } from '@/lib/api/samples';
import type { KanbanRunItem } from '@/lib/api/samples';

interface MWOPrecheckDialogProps {
  run: KanbanRunItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SEVERITY_CONFIG = {
  error: {
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'destructive' as const,
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'secondary' as const,
  },
  info: {
    icon: Info,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badge: 'outline' as const,
  },
};

const TYPE_ICONS = {
  bom: Package,
  operations: Cog,
  costing: DollarSign,
  status: FileText,
  po: ShoppingCart,
};

export function MWOPrecheckDialog({
  run,
  open,
  onOpenChange,
}: MWOPrecheckDialogProps) {
  // Fetch precheck data
  const { data, isLoading, error } = useQuery({
    queryKey: ['mwo-precheck', run?.id],
    queryFn: () => fetchMWOPrecheck(run!.id),
    enabled: open && !!run,
  });

  if (!run) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            MWO 預檢 Pre-check
          </DialogTitle>
          <DialogDescription>
            檢查 {run.style?.style_number || 'Unknown'} Run #{run.run_no} 是否準備好生成 MWO
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">檢查中...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              檢查失敗：{error instanceof Error ? error.message : '未知錯誤'}
            </div>
          ) : data ? (
            <div className="space-y-4">
              {/* Ready Status */}
              <div
                className={`flex items-center gap-3 p-4 rounded-lg border ${
                  data.ready
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                {data.ready ? (
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                ) : (
                  <XCircle className="w-8 h-8 text-red-500" />
                )}
                <div>
                  <p className="font-semibold text-lg">
                    {data.ready ? '準備就緒 Ready' : '尚未就緒 Not Ready'}
                  </p>
                  <p className="text-sm text-gray-600">
                    當前狀態: {data.current_status}
                  </p>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Package className="w-4 h-4" />
                    <span className="text-sm">BOM 物料</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">
                    {data.summary.bom_count}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Cog className="w-4 h-4" />
                    <span className="text-sm">工序</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">
                    {data.summary.operations_count}
                  </p>
                </div>
              </div>

              {/* Issues List */}
              {data.issues.length > 0 ? (
                <div className="space-y-2">
                  <p className="font-medium text-gray-700">
                    檢查項目 ({data.issues.length})
                  </p>
                  {data.issues.map((issue, idx) => {
                    const config = SEVERITY_CONFIG[issue.severity];
                    const TypeIcon = TYPE_ICONS[issue.type] || Info;
                    const SeverityIcon = config.icon;

                    return (
                      <div
                        key={idx}
                        className={`flex items-start gap-3 p-3 rounded-lg border ${config.bg} ${config.border}`}
                      >
                        <SeverityIcon
                          className={`w-5 h-5 shrink-0 mt-0.5 ${config.color}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <TypeIcon className="w-4 h-4 text-gray-500" />
                            <Badge variant={config.badge} className="text-xs">
                              {issue.type.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium">{issue.message_zh}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {issue.message}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="font-medium text-green-700">所有檢查項目通過！</p>
                  <p className="text-sm text-green-600">可以安全生成 MWO</p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            關閉
          </Button>
          {data?.ready && (
            <Button
              className="bg-blue-500 hover:bg-blue-600"
              onClick={() => onOpenChange(false)}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              確認可生成
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
