"use client";

/**
 * Sample Request Detail Page
 * Phase 3-1: Sample Request System MVP
 *
 * Displays:
 * - Request overview (brand, type, status, etc.)
 * - Run timeline (list of all runs)
 * - Actions (create new run, update request status)
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  useSampleRequest,
  useSampleRuns,
  useCreateSampleRun,
  useUpdateSampleRequest,
  useSubmitSampleRun,
  useStartExecutionSampleRun,
  useCompleteSampleRun,
  useCancelSampleRun,
  useCreateNextRun,
} from '@/lib/hooks/useSamples';
import type { CreateSampleRunPayload, UpdateSampleRequestPayload } from '@/types/samples';
import {
  SampleRequestTypeLabels,
  SampleRequestStatusLabels,
  PriorityLabels,
} from '@/types/samples';
import { SampleRunTimeline } from '@/components/samples/SampleRunTimeline';
import { SampleRunCard } from '@/components/samples/SampleRunCard';
import { CreateSampleRunDialog } from '@/components/samples/CreateSampleRunDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ArrowLeft, Plus, Calendar, Package, AlertCircle, FileText, Ruler, CheckCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { apiClient, API_BASE_URL } from '@/lib/api/client';

// 取得 StyleRevision 詳細資訊
interface StyleRevisionInfo {
  id: string;
  revision_label: string;
  style_number: string | null;
  style_name: string | null;
  style_id: string | null;
  bom_count: number;
  measurement_count: number;
}

async function fetchRevisionInfo(revisionId: string): Promise<StyleRevisionInfo | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/style-revisions/${revisionId}/`);
    if (!response.ok) return null;
    const data = await response.json();
    const revData = data.data || data;
    return {
      id: revData.id,
      revision_label: revData.revision_label || 'v1',
      style_number: revData.style_number || revData.style?.style_number || null,
      style_name: revData.style_name || revData.style?.style_name || null,
      style_id: revData.style || revData.style_id || null,
      bom_count: revData.bom_count || 0,
      measurement_count: revData.measurement_count || 0,
    };
  } catch {
    return null;
  }
}

export default function SampleRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = params.requestId as string;

  const [isCreateRunDialogOpen, setIsCreateRunDialogOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [isRunSheetOpen, setIsRunSheetOpen] = useState(false);
  const [revisionInfo, setRevisionInfo] = useState<StyleRevisionInfo | null>(null);

  // Fetch request and runs
  const { data: request, isLoading: isLoadingRequest, error: requestError } = useSampleRequest(requestId);
  const { data: runs = [], isLoading: isLoadingRuns } = useSampleRuns({ sample_request_id: requestId });

  // 載入關聯的 StyleRevision 資訊
  useEffect(() => {
    if (request?.revision) {
      fetchRevisionInfo(request.revision).then(setRevisionInfo);
    }
  }, [request?.revision]);

  // Mutations
  const createRunMutation = useCreateSampleRun(requestId);
  const updateRequestMutation = useUpdateSampleRequest();
  const submitRunMutation = useSubmitSampleRun(requestId);
  const startExecutionMutation = useStartExecutionSampleRun(requestId);
  const completeRunMutation = useCompleteSampleRun(requestId);
  const cancelRunMutation = useCancelSampleRun(requestId);
  const createNextRunMutation = useCreateNextRun(requestId);

  // 創建下一輪 handler（多輪 Fit Sample 支援）
  const handleCreateNextRun = async () => {
    try {
      const result = await createNextRunMutation.mutateAsync({});
      alert(`✅ 已創建 Run #${result.sample_run.run_no}！`);
    } catch (err: any) {
      console.error('Failed to create next run:', err);
      alert(`❌ 創建失敗：${err?.message || '未知錯誤'}`);
    }
  };

  // 檢查是否已確認（有 runs）
  const isConfirmed = runs.length > 0;

  // 計算下一輪號碼
  const maxRunNo = runs.length > 0 ? Math.max(...runs.map(r => r.run_no || 1)) : 0;
  const nextRunNo = maxRunNo + 1;

  // Loading state
  if (isLoadingRequest) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-3 text-muted-foreground">Loading sample request...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (requestError || !request) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/dashboard/samples">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to List
            </Button>
          </Link>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            Failed to load sample request
          </h2>
          <p className="text-red-600">
            {requestError instanceof Error ? requestError.message : 'Request not found'}
          </p>
        </div>
      </div>
    );
  }

  // Handle run creation
  const handleCreateRun = async (payload: CreateSampleRunPayload) => {
    try {
      await createRunMutation.mutateAsync(payload);
      setIsCreateRunDialogOpen(false);
    } catch (err) {
      console.error('Failed to create run:', err);
    }
  };

  // Handle run click
  const handleRunClick = (run: any) => {
    setSelectedRunId(run.id);
    setIsRunSheetOpen(true);
  };

  // Handle status change
  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateRequestMutation.mutateAsync({
        id: requestId,
        payload: { status: newStatus as any },
      });
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // Handle run action
  const handleRunAction = async (action: string) => {
    if (!selectedRunId) return;

    try {
      switch (action) {
        case 'submit':
          await submitRunMutation.mutateAsync({ id: selectedRunId });
          alert('✅ 確認成功！Run 已進入物料規劃階段。');
          break;
        case 'start_execution':
          await startExecutionMutation.mutateAsync({ id: selectedRunId });
          alert('✅ 已開始執行！Run 進入生產中。');
          break;
        case 'complete':
          await completeRunMutation.mutateAsync({ id: selectedRunId });
          alert('✅ 已完成！Run 標記為完成。');
          break;
        case 'cancel':
          await cancelRunMutation.mutateAsync({ id: selectedRunId });
          alert('⚠️ 已取消！Run 已被取消。');
          break;
      }
      // Refresh selected run
      setIsRunSheetOpen(false);
      setSelectedRunId(null);
    } catch (err) {
      console.error('Failed to execute action:', err);
      alert(`❌ 操作失敗: ${(err as Error).message}`);
    }
  };

  const selectedRun = runs.find((r) => r.id === selectedRunId);
  const isActionLoading =
    submitRunMutation.isPending ||
    startExecutionMutation.isPending ||
    completeRunMutation.isPending ||
    cancelRunMutation.isPending;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/samples">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to List
          </Button>
        </Link>

        <div className="flex-1">
          <h1 className="text-3xl font-bold">Sample Request Detail</h1>
          <p className="text-muted-foreground mt-1">
            {SampleRequestTypeLabels[request.request_type]} - {request.brand_name || 'N/A'}
          </p>
        </div>

        {/* 多輪 Fit Sample 支援：創建下一輪按鈕 */}
        {isConfirmed && (
          <Button
            onClick={handleCreateNextRun}
            disabled={createNextRunMutation.isPending}
            variant="outline"
            className="border-blue-500 text-blue-600 hover:bg-blue-50"
          >
            {createNextRunMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                創建中...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                創建下一輪 (Run #{nextRunNo})
              </>
            )}
          </Button>
        )}

        <Button onClick={() => setIsCreateRunDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Run
        </Button>
      </div>

      {/* 關聯款式資訊 - Tech Pack/BOM/Spec 來源 */}
      {revisionInfo && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              關聯款式資料
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 款式資訊 */}
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <div className="text-xs text-muted-foreground">款號</div>
                <div className="text-lg font-bold text-blue-700">
                  {revisionInfo.style_number || 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">款式名稱</div>
                <div className="text-sm">{revisionInfo.style_name || 'N/A'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">版本</div>
                <Badge variant="outline">{revisionInfo.revision_label}</Badge>
              </div>
            </div>

            {/* 資料來源狀態 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg p-3 bg-white border">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Tech Pack</span>
                </div>
                <p className="text-xs text-muted-foreground">已關聯</p>
              </div>
              <Link href={`/dashboard/revisions/${revisionInfo.id}/bom`}>
                <div className="rounded-lg p-3 bg-white border hover:border-blue-400 cursor-pointer transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">BOM 物料表</span>
                  </div>
                  <p className="text-xs text-blue-600">點擊查看 →</p>
                </div>
              </Link>
              <Link href={`/dashboard/revisions/${revisionInfo.id}/spec`}>
                <div className="rounded-lg p-3 bg-white border hover:border-blue-400 cursor-pointer transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <Ruler className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Spec 尺寸表</span>
                  </div>
                  <p className="text-xs text-blue-600">點擊查看 →</p>
                </div>
              </Link>
            </div>

            {!isConfirmed && (
              <div className="text-xs text-muted-foreground bg-white/60 p-2 rounded">
                💡 請到 Kanban 進行樣衣流程，系統會在正確狀態下生成 MWO 與報價單。
              </div>
            )}
            {isConfirmed && (
              <div className="text-xs text-green-700 bg-green-50 p-2 rounded border border-green-200">
                ✓ 已建立 Sample Run，請到 Kanban 繼續後續流程。
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Kanban CTA */}
      {revisionInfo && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-blue-800">下一步</h3>
                <p className="text-sm text-blue-700 mt-1">
                  在 Kanban 中依狀態推進、生成 MWO 與報價單
                </p>
              </div>
              <Link href="/dashboard/samples/kanban">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8">
                  前往 Kanban
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Request Overview */}
      <Card>
        <CardHeader>
          <CardTitle>請求資訊</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status and Priority */}
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <div className="text-sm font-medium mb-1">Status</div>
              <Select
                value={request.status}
                onValueChange={handleStatusChange}
                disabled={updateRequestMutation.isPending}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="text-sm font-medium mb-1">Priority</div>
              <Badge
                variant={
                  request.priority === 'urgent'
                    ? 'destructive'
                    : request.priority === 'normal'
                      ? 'default'
                      : 'secondary'
                }
              >
                {PriorityLabels[request.priority]}
              </Badge>
            </div>

            {request.need_quote_first && (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span>Requires Quote Approval</span>
              </div>
            )}
          </div>

          {/* Key Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Brand</div>
              <div className="text-sm mt-1">{request.brand_name || 'N/A'}</div>
            </div>

            <div>
              <div className="text-sm font-medium text-muted-foreground">Type</div>
              <div className="text-sm mt-1">
                {SampleRequestTypeLabels[request.request_type]}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-muted-foreground">Quantity</div>
              <div className="text-sm mt-1 flex items-center gap-1">
                <Package className="h-3.5 w-3.5" />
                {request.quantity_requested} pcs
              </div>
            </div>

            {request.due_date && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Due Date</div>
                <div className="text-sm mt-1 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(new Date(request.due_date), 'MMM dd, yyyy')}
                </div>
              </div>
            )}
          </div>

          {/* Purpose */}
          {request.purpose && (
            <div className="pt-4 border-t">
              <div className="text-sm font-medium text-muted-foreground mb-2">Purpose</div>
              <p className="text-sm">{request.purpose}</p>
            </div>
          )}

          {/* Notes */}
          {(request.notes_internal || request.notes_customer) && (
            <div className="pt-4 border-t space-y-3">
              {request.notes_internal && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    Internal Notes
                  </div>
                  <p className="text-sm text-muted-foreground">{request.notes_internal}</p>
                </div>
              )}
              {request.notes_customer && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    Customer Notes
                  </div>
                  <p className="text-sm text-muted-foreground">{request.notes_customer}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Runs Timeline */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Sample Runs</h2>
          {isLoadingRuns && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        <SampleRunTimeline runs={runs} onRunClick={handleRunClick} />
      </div>

      {/* Create Run Dialog */}
      <CreateSampleRunDialog
        open={isCreateRunDialogOpen}
        onOpenChange={setIsCreateRunDialogOpen}
        sampleRequestId={requestId}
        onCreate={handleCreateRun}
        isCreating={createRunMutation.isPending}
      />

      {/* Run Detail Sheet */}
      <Sheet open={isRunSheetOpen} onOpenChange={setIsRunSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Run Details</SheetTitle>
          </SheetHeader>

          <div className="mt-6">
            {selectedRun && (
              <SampleRunCard
                run={selectedRun}
                onActionClick={handleRunAction}
                isActionLoading={isActionLoading}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
