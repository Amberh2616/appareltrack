"use client";

/**
 * SampleRunCard Component
 * Detailed card view for a single run
 */

import { SampleRun } from '@/types/samples';
import { SampleRunTypeLabels, SampleRunStatusLabels } from '@/types/samples';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  Calendar,
  Package,
  FileText,
  TrendingUp,
  Play,
  Check,
  X,
  Loader2,
  CheckCircle,
  DollarSign,
  ExternalLink,
} from 'lucide-react';

interface SampleRunCardProps {
  run: SampleRun;
  onActionClick?: (action: string) => void;
  isActionLoading?: boolean;
}

export function SampleRunCard({ run, onActionClick, isActionLoading }: SampleRunCardProps) {
  // Available actions based on status (simplified - actual logic in backend)
  const getAvailableActions = () => {
    const actions: { label: string; action: string; variant?: any; icon?: string }[] = [];

    if (run.status === 'draft') {
      // 「確認樣衣」按鈕 - 開始物料規劃
      actions.push({ label: '確認樣衣', action: 'submit', variant: 'default', icon: 'confirm' });
    }
    if (run.status === 'materials_planning') {
      actions.push({ label: '開始執行', action: 'start_execution', variant: 'default' });
    }
    if (run.status === 'in_progress') {
      actions.push({ label: '完成', action: 'complete', variant: 'default' });
    }
    if (['draft', 'materials_planning'].includes(run.status)) {
      actions.push({ label: '取消', action: 'cancel', variant: 'destructive' });
    }

    return actions;
  };

  const actions = getAvailableActions();

  // 檢查是否已生成文件
  const hasMWO = run.mwos && run.mwos.length > 0;
  const hasCosting = !!run.costing_version || !!run.guidance_usage;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl">
              Run #{run.run_no} - {SampleRunTypeLabels[run.run_type]}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Created {format(new Date(run.created_at), 'MMM dd, yyyy')}
            </p>
          </div>

          <Badge
            variant={
              run.status === 'accepted'
                ? 'default'
                : run.status === 'cancelled' || run.status === 'revise_needed'
                  ? 'destructive'
                  : run.status === 'draft'
                    ? 'secondary'
                    : 'outline'
            }
          >
            {SampleRunStatusLabels[run.status]}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Key Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Quantity</div>
              <div className="text-sm text-muted-foreground">{run.quantity} pcs</div>
            </div>
          </div>

          {run.target_due_date && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Target Due Date</div>
                <div className="text-sm text-muted-foreground">
                  {format(new Date(run.target_due_date), 'MMM dd, yyyy')}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        {run.notes && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-medium">Notes</div>
            </div>
            <p className="text-sm text-muted-foreground pl-6">{run.notes}</p>
          </div>
        )}

        {/* 已生成文件狀態 - P18 樣衣流程 */}
        <div className="border-t pt-4">
          <div className="text-sm font-medium mb-3">已生成文件</div>
          <div className="grid grid-cols-2 gap-3">
            {/* MWO 狀態 */}
            <div className={`rounded-lg p-3 ${hasMWO ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
              <div className="flex items-center gap-2">
                {hasMWO ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <FileText className="h-4 w-4 text-gray-400" />
                )}
                <span className={`text-sm font-medium ${hasMWO ? 'text-green-700' : 'text-gray-500'}`}>
                  MWO 製造工單
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-6">
                {hasMWO ? `已生成 ${run.mwos?.length} 份` : '待確認後生成'}
              </p>
            </div>

            {/* Costing 狀態 */}
            <div className={`rounded-lg p-3 ${hasCosting ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
              <div className="flex items-center gap-2">
                {hasCosting ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <DollarSign className="h-4 w-4 text-gray-400" />
                )}
                <span className={`text-sm font-medium ${hasCosting ? 'text-green-700' : 'text-gray-500'}`}>
                  報價單
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-6">
                {hasCosting ? '已生成' : '待確認後生成'}
              </p>
            </div>
          </div>

          {/* 包含的資料來源 */}
          {(hasMWO || hasCosting) && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-xs font-medium text-blue-700 mb-2">已整合資料：</div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs bg-white">
                  Tech Pack
                </Badge>
                <Badge variant="outline" className="text-xs bg-white">
                  BOM 物料表
                </Badge>
                <Badge variant="outline" className="text-xs bg-white">
                  Spec 尺寸表
                </Badge>
              </div>
            </div>
          )}
        </div>

        {/* Linked Resources */}
        <div className="border-t pt-4">
          <div className="text-sm font-medium mb-3">關聯資源</div>
          <div className="space-y-2 text-sm text-muted-foreground">
            {run.guidance_usage && (
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span>用量指南: {run.guidance_usage.slice(0, 8)}...</span>
              </div>
            )}
            {run.actual_usage && (
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span>實際用量: {run.actual_usage.slice(0, 8)}...</span>
              </div>
            )}
            {run.costing_version && (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>報價版本: {run.costing_version.slice(0, 8)}...</span>
              </div>
            )}
            {run.t2pos && run.t2pos.length > 0 && (
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                <span>T2 採購單: {run.t2pos.length} 張</span>
              </div>
            )}
            {run.mwos && run.mwos.length > 0 && (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>MWO: {run.mwos.length} 份</span>
              </div>
            )}
            {!run.guidance_usage &&
              !run.actual_usage &&
              !run.costing_version &&
              (!run.t2pos || run.t2pos.length === 0) &&
              (!run.mwos || run.mwos.length === 0) && (
                <div className="text-muted-foreground italic">尚無關聯資源</div>
              )}
          </div>
        </div>

        {/* Actions */}
        {actions.length > 0 && (
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 flex-wrap">
              {actions.map((action) => (
                <Button
                  key={action.action}
                  variant={action.variant || 'outline'}
                  size="sm"
                  onClick={() => onActionClick?.(action.action)}
                  disabled={isActionLoading}
                  className={action.icon === 'confirm' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                >
                  {isActionLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  {action.icon === 'confirm' && <CheckCircle className="mr-2 h-3.5 w-3.5" />}
                  {action.action === 'start_execution' && <Play className="mr-2 h-3.5 w-3.5" />}
                  {action.action === 'complete' && <Check className="mr-2 h-3.5 w-3.5" />}
                  {action.action === 'cancel' && <X className="mr-2 h-3.5 w-3.5" />}
                  {action.label}
                </Button>
              ))}
            </div>
            {/* 確認提示 */}
            {run.status === 'draft' && (
              <p className="text-xs text-muted-foreground mt-2">
                點擊「確認樣衣」將開始物料規劃，並生成 MWO 與報價單
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
