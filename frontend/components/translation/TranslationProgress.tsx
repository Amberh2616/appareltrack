'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTranslationProgress,
  translateDocument,
  translatePage,
  retryFailedTranslations,
  TranslationProgress as TranslationProgressType,
} from '@/lib/api/translation';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Loader2,
  Languages,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TranslationProgressProps {
  revisionId: string;
  className?: string;
  /** 是否顯示每頁進度 */
  showPageDetails?: boolean;
  /** 自動刷新間隔（毫秒），0 表示不自動刷新 */
  refreshInterval?: number;
}

export function TranslationProgressCard({
  revisionId,
  className,
  showPageDetails = true,
  refreshInterval = 0,
}: TranslationProgressProps) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);

  // 獲取翻譯進度
  const { data: progress, isLoading, refetch } = useQuery({
    queryKey: ['translation-progress', revisionId],
    queryFn: () => getTranslationProgress(revisionId),
    refetchInterval: refreshInterval > 0 ? refreshInterval : false,
  });

  // 翻譯整份文件
  const translateAllMutation = useMutation({
    mutationFn: () => translateDocument(revisionId, { mode: 'missing_only' }),
    onSuccess: (result) => {
      if ('task_id' in result) {
        toast.info('Translation started in background');
      } else {
        toast.success(`Translated ${result.success} blocks`);
      }
      queryClient.invalidateQueries({ queryKey: ['translation-progress', revisionId] });
      queryClient.invalidateQueries({ queryKey: ['draft', revisionId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 重試失敗
  const retryMutation = useMutation({
    mutationFn: () => retryFailedTranslations(revisionId),
    onSuccess: (result) => {
      if ('task_id' in result) {
        toast.info('Retry started in background');
      } else {
        toast.success(`Retried ${result.total} blocks, ${result.success} succeeded`);
      }
      queryClient.invalidateQueries({ queryKey: ['translation-progress', revisionId] });
      queryClient.invalidateQueries({ queryKey: ['draft', revisionId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 翻譯單頁
  const translatePageMutation = useMutation({
    mutationFn: (pageNumber: number) => translatePage(revisionId, pageNumber),
    onSuccess: (result, pageNumber) => {
      if ('task_id' in result) {
        toast.info(`Page ${pageNumber} translation started`);
      } else {
        toast.success(`Page ${pageNumber}: ${result.success} blocks translated`);
      }
      queryClient.invalidateQueries({ queryKey: ['translation-progress', revisionId] });
      queryClient.invalidateQueries({ queryKey: ['draft', revisionId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  if (!progress) {
    return null;
  }

  const { total, done, pending, failed, skipped, translating, progress: progressPercent, pages } = progress;
  const isTranslating = translating > 0;
  const hasFailed = failed > 0;
  const isComplete = pending === 0 && failed === 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Languages className="h-5 w-5" />
            Translation Progress
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 進度條 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">
              {done + skipped} / {total} blocks
            </span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* 狀態 Badges */}
        <div className="flex flex-wrap gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className="text-green-600 border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {done} done
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Translated blocks</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {pending > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="text-amber-600 border-amber-200">
                    <Clock className="h-3 w-3 mr-1" />
                    {pending} pending
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Waiting for translation</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {translating > 0 && (
            <Badge variant="outline" className="text-blue-600 border-blue-200">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              {translating} translating
            </Badge>
          )}

          {failed > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="text-red-600 border-red-200">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {failed} failed
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Click retry to attempt again</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {skipped > 0 && (
            <Badge variant="outline" className="text-slate-400">
              {skipped} skipped
            </Badge>
          )}
        </div>

        {/* 操作按鈕 */}
        <div className="flex gap-2">
          {pending > 0 && (
            <Button
              onClick={() => translateAllMutation.mutate()}
              disabled={translateAllMutation.isPending || isTranslating}
              size="sm"
            >
              {translateAllMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Languages className="h-4 w-4 mr-2" />
              )}
              Translate All ({pending})
            </Button>
          )}

          {hasFailed && (
            <Button
              variant="outline"
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending}
              size="sm"
            >
              {retryMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Retry Failed ({failed})
            </Button>
          )}

          {isComplete && (
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
              <CheckCircle className="h-3 w-3 mr-1" />
              Translation Complete
            </Badge>
          )}
        </div>

        {/* 每頁進度（可展開） */}
        {showPageDetails && pages && pages.length > 0 && (
          <div className="pt-2 border-t">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              Page details ({pages.length} pages)
            </button>

            {isExpanded && (
              <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                {pages.map((page) => (
                  <div
                    key={page.page_number}
                    className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Page {page.page_number}</span>
                      <span className="text-slate-500">
                        {page.done}/{page.total}
                      </span>
                      {page.failed > 0 && (
                        <Badge variant="outline" className="text-red-500 text-xs">
                          {page.failed} failed
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={page.progress} className="w-20 h-1.5" />
                      {page.pending > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => translatePageMutation.mutate(page.page_number)}
                          disabled={translatePageMutation.isPending}
                        >
                          <Languages className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact translation button for inline use
 */
export function TranslateButton({
  revisionId,
  pageNumber,
  className,
}: {
  revisionId: string;
  pageNumber?: number;
  className?: string;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      pageNumber
        ? translatePage(revisionId, pageNumber)
        : translateDocument(revisionId, { mode: 'missing_only' }),
    onSuccess: () => {
      toast.success(pageNumber ? `Page ${pageNumber} translated` : 'Translation started');
      queryClient.invalidateQueries({ queryKey: ['translation-progress', revisionId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className={className}
    >
      {mutation.isPending ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Languages className="h-4 w-4 mr-2" />
      )}
      {pageNumber ? `Translate Page ${pageNumber}` : 'Translate All'}
    </Button>
  );
}
