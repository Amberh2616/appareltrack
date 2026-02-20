'use client';

/**
 * P9: Manufacturing Scheduler Dashboard
 * Gantt-style view for tracking sample production progress
 *
 * Features:
 * - Style view (grouped by style) / Run view (flat list)
 * - Day/Week/Month time granularity
 * - Progress bars with status colors
 * - Expand/collapse styles
 * - Search and pagination
 * - P4: Click to edit dates (drag-like UX)
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  fetchSchedulerData,
  updateSampleRunDates,
  type SchedulerFilters,
  type SchedulerStyleItem,
  type SchedulerRunItem,
} from '@/lib/api/samples';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  Calendar,
  LayoutGrid,
  List,
  Edit2,
  Loader2,
} from 'lucide-react';

// Time granularity options
type TimeGranularity = 'day' | 'week' | 'month';

// Status labels for legend
const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  materials_planning: 'Materials',
  po_drafted: 'PO Draft',
  po_issued: 'PO Issued',
  mwo_drafted: 'MWO Draft',
  mwo_issued: 'MWO Issued',
  in_progress: 'In Progress',
  sample_done: 'Sample Done',
  actuals_recorded: 'Actuals',
  costing_generated: 'Costing',
  quoted: 'Quoted',
  accepted: 'Accepted',
};

// Generate date array for timeline
function generateDateRange(startDate: Date, endDate: Date, granularity: TimeGranularity): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    dates.push(new Date(current));

    if (granularity === 'day') {
      current.setDate(current.getDate() + 1);
    } else if (granularity === 'week') {
      current.setDate(current.getDate() + 7);
    } else {
      current.setMonth(current.getMonth() + 1);
    }
  }

  return dates;
}

// Format date for display
function formatDate(date: Date, granularity: TimeGranularity): string {
  if (granularity === 'day') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else if (granularity === 'week') {
    return `W${getWeekNumber(date)}`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }
}

// Get week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Calculate bar position
function calculateBarPosition(
  startDate: string | null,
  dueDate: string | null,
  rangeStart: Date,
  rangeEnd: Date,
  totalDays: number
): { left: number; width: number } | null {
  if (!startDate || !dueDate) return null;

  const start = new Date(startDate);
  const due = new Date(dueDate);
  const rangeStartTime = rangeStart.getTime();
  const rangeDuration = rangeEnd.getTime() - rangeStartTime;

  // Calculate position as percentage
  const startOffset = Math.max(0, (start.getTime() - rangeStartTime) / rangeDuration);
  const endOffset = Math.min(1, (due.getTime() - rangeStartTime) / rangeDuration);

  if (endOffset < 0 || startOffset > 1) return null; // Outside range

  return {
    left: startOffset * 100,
    width: Math.max(2, (endOffset - startOffset) * 100), // Minimum 2% width
  };
}

// P4: Interface for edit dates dialog
interface EditDatesRun {
  id: string;
  runNo: number;
  styleNumber: string;
  startDate: string;
  targetDueDate: string;
}

export default function SchedulerPage() {
  const queryClient = useQueryClient();

  // State
  const [viewType, setViewType] = useState<'style' | 'run'>('style');
  const [granularity, setGranularity] = useState<TimeGranularity>('day');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const [pageSize, setPageSize] = useState(25);
  const [expandedStyles, setExpandedStyles] = useState<Set<string>>(new Set());

  // P4: Edit dates dialog state
  const [editingRun, setEditingRun] = useState<EditDatesRun | null>(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');

  // P4: Update dates mutation
  const updateDatesMutation = useMutation({
    mutationFn: ({ runId, startDate, dueDate }: { runId: string; startDate: string; dueDate: string }) =>
      updateSampleRunDates(runId, {
        start_date: startDate || undefined,
        target_due_date: dueDate || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduler'] });
      setEditingRun(null);
    },
  });

  // P4: Open edit dialog
  const openEditDialog = useCallback((run: SchedulerRunItem, styleNumber: string) => {
    setEditingRun({
      id: run.id,
      runNo: run.run_no,
      styleNumber,
      startDate: run.start_date || '',
      targetDueDate: run.target_due_date || '',
    });
    setEditStartDate(run.start_date || '');
    setEditDueDate(run.target_due_date || '');
  }, []);

  // P4: Handle save dates
  const handleSaveDates = useCallback(() => {
    if (!editingRun) return;
    updateDatesMutation.mutate({
      runId: editingRun.id,
      startDate: editStartDate,
      dueDate: editDueDate,
    });
  }, [editingRun, editStartDate, editDueDate, updateDatesMutation]);

  // Date range state (default: 2 weeks back to 2 weeks ahead)
  const [dateOffset, setDateOffset] = useState(0);
  const dateRange = useMemo(() => {
    const today = new Date();
    let daysOffset = 0;

    if (granularity === 'day') {
      daysOffset = dateOffset * 7; // Move by week
    } else if (granularity === 'week') {
      daysOffset = dateOffset * 28; // Move by 4 weeks
    } else {
      daysOffset = dateOffset * 90; // Move by 3 months
    }

    const start = new Date(today);
    start.setDate(start.getDate() - 14 + daysOffset);
    const end = new Date(today);
    end.setDate(end.getDate() + 14 + daysOffset);

    return { start, end };
  }, [dateOffset, granularity]);

  // Build filters
  const filters: SchedulerFilters = useMemo(() => ({
    view: viewType,
    start_date: dateRange.start.toISOString().split('T')[0],
    end_date: dateRange.end.toISOString().split('T')[0],
    search: debouncedSearch || undefined,
    page,
    page_size: pageSize,
  }), [viewType, dateRange, debouncedSearch, page, pageSize]);

  // Fetch data
  const { data, isLoading, error } = useQuery({
    queryKey: ['scheduler', filters],
    queryFn: () => fetchSchedulerData(filters),
    refetchInterval: 30000,
  });

  // Generate timeline dates
  const timelineDates = useMemo(() => {
    return generateDateRange(dateRange.start, dateRange.end, granularity);
  }, [dateRange, granularity]);

  // Calculate total days for positioning
  const totalDays = useMemo(() => {
    return Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
  }, [dateRange]);

  // Toggle style expansion
  const toggleStyle = useCallback((styleId: string) => {
    setExpandedStyles((prev) => {
      const next = new Set(prev);
      if (next.has(styleId)) {
        next.delete(styleId);
      } else {
        next.add(styleId);
      }
      return next;
    });
  }, []);

  // Expand/collapse all
  const expandAll = useCallback(() => {
    if (data?.styles) {
      setExpandedStyles(new Set(data.styles.map((s) => s.id)));
    }
  }, [data?.styles]);

  const collapseAll = useCallback(() => {
    setExpandedStyles(new Set());
  }, []);

  // Navigate date range
  const goBack = () => setDateOffset((prev) => prev - 1);
  const goForward = () => setDateOffset((prev) => prev + 1);
  const goToday = () => setDateOffset(0);

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error loading scheduler data: {(error as Error).message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manufacturing Scheduler</h1>
          <p className="text-sm text-gray-500">
            {data?.pagination.total_count || 0} {viewType === 'style' ? 'styles' : 'runs'} total
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/samples/kanban"
            className="px-4 py-1.5 text-sm border rounded-md hover:bg-gray-50"
          >
            Kanban View
          </Link>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        {/* Row 1: View and Time Controls */}
        <div className="flex flex-wrap items-center gap-4">
          {/* View Toggle */}
          <div className="flex items-center gap-2 bg-white rounded-lg border p-1">
            <button
              onClick={() => setViewType('style')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors',
                viewType === 'style' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
              )}
            >
              <LayoutGrid className="h-4 w-4" />
              Style
            </button>
            <button
              onClick={() => setViewType('run')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors',
                viewType === 'run' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
              )}
            >
              <List className="h-4 w-4" />
              Run
            </button>
          </div>

          {/* Time Granularity */}
          <div className="flex items-center gap-2 bg-white rounded-lg border p-1">
            {(['day', 'week', 'month'] as TimeGranularity[]).map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md transition-colors capitalize',
                  granularity === g ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
                )}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Date Navigation */}
          <div className="flex items-center gap-1 bg-white rounded-lg border p-1">
            <button
              onClick={goBack}
              className="p-1.5 hover:bg-gray-100 rounded"
              title="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={goToday}
              className="px-3 py-1.5 text-sm hover:bg-gray-100 rounded flex items-center gap-1"
            >
              <Calendar className="h-4 w-4" />
              Today
            </button>
            <button
              onClick={goForward}
              className="p-1.5 hover:bg-gray-100 rounded"
              title="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Date Range Display */}
          <div className="text-sm text-gray-600">
            {dateRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {' - '}
            {dateRange.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>

          {/* Expand/Collapse (only for style view) */}
          {viewType === 'style' && (
            <div className="flex gap-1 ml-auto">
              <button
                onClick={collapseAll}
                className="px-3 py-1.5 text-xs border rounded hover:bg-white"
              >
                Collapse All
              </button>
              <button
                onClick={expandAll}
                className="px-3 py-1.5 text-xs border rounded hover:bg-white"
              >
                Expand All
              </button>
            </div>
          )}
        </div>

        {/* Row 2: Search and Pagination */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search style number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Page Size */}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="px-3 py-2 text-sm border rounded-md bg-white"
          >
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
          </select>

          {/* Pagination Info */}
          {data && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>
                Page {data.pagination.page} of {data.pagination.total_pages}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1 border rounded hover:bg-white disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(data.pagination.total_pages, p + 1))}
                  disabled={page === data.pagination.total_pages}
                  className="p-1 border rounded hover:bg-white disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Gantt Chart */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-500">Loading scheduler...</div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          {/* Timeline Header */}
          <div className="flex border-b bg-gray-50">
            {/* Label Column */}
            <div className="w-64 flex-shrink-0 px-4 py-3 font-medium text-sm border-r">
              {viewType === 'style' ? 'Style / Run' : 'Run'}
            </div>
            {/* Timeline Columns */}
            <div className="flex-1 flex">
              {timelineDates.map((date, idx) => {
                const isToday = date.toDateString() === new Date().toDateString();
                return (
                  <div
                    key={idx}
                    className={cn(
                      'flex-1 min-w-[60px] px-2 py-3 text-xs text-center border-r last:border-r-0',
                      isToday && 'bg-blue-50 font-semibold text-blue-700'
                    )}
                  >
                    {formatDate(date, granularity)}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Data Rows */}
          <div className="max-h-[calc(100vh-400px)] overflow-y-auto">
            {viewType === 'style' && data?.styles?.map((style) => (
              <StyleRow
                key={style.id}
                style={style}
                isExpanded={expandedStyles.has(style.id)}
                onToggle={() => toggleStyle(style.id)}
                timelineDates={timelineDates}
                dateRange={dateRange}
                totalDays={totalDays}
                statusColors={data.status_colors}
                onEditDates={openEditDialog}
              />
            ))}

            {viewType === 'run' && data?.runs?.map((run) => (
              <RunRow
                key={run.id}
                run={run}
                styleNumber={run.style?.style_number}
                timelineDates={timelineDates}
                dateRange={dateRange}
                totalDays={totalDays}
                statusColors={data.status_colors}
                onEditDates={(r) => openEditDialog(r, run.style?.style_number || 'Unknown')}
              />
            ))}

            {/* Empty State */}
            {(!data?.styles?.length && !data?.runs?.length) && (
              <div className="p-8 text-center text-gray-500">
                No data found. Try adjusting your search or filters.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="text-xs font-medium text-gray-500 mb-2">Status Legend</div>
        <div className="flex flex-wrap gap-3">
          {data?.status_colors && Object.entries(data.status_colors).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div
                className="w-4 h-3 rounded"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-gray-600">
                {STATUS_LABELS[status] || status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* P4: Edit Dates Dialog */}
      <Dialog open={!!editingRun} onOpenChange={(open) => !open && setEditingRun(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5" />
              調整日期
            </DialogTitle>
            <DialogDescription>
              {editingRun?.styleNumber} Run #{editingRun?.runNo}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">開始日期</Label>
              <Input
                id="start_date"
                type="date"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">截止日期</Label>
              <Input
                id="due_date"
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
              />
            </div>

            {/* Quick shift buttons */}
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="text-xs text-gray-500 w-full">快速調整：</span>
              {[-7, -3, -1, 1, 3, 7].map((days) => (
                <button
                  key={days}
                  onClick={() => {
                    if (editStartDate) {
                      const newStart = new Date(editStartDate);
                      newStart.setDate(newStart.getDate() + days);
                      setEditStartDate(newStart.toISOString().split('T')[0]);
                    }
                    if (editDueDate) {
                      const newDue = new Date(editDueDate);
                      newDue.setDate(newDue.getDate() + days);
                      setEditDueDate(newDue.toISOString().split('T')[0]);
                    }
                  }}
                  className={cn(
                    'px-3 py-1 text-xs rounded border transition-colors',
                    days < 0 ? 'hover:bg-red-50 hover:border-red-200' : 'hover:bg-green-50 hover:border-green-200'
                  )}
                >
                  {days > 0 ? `+${days}` : days} 天
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRun(null)}>
              取消
            </Button>
            <Button
              onClick={handleSaveDates}
              disabled={updateDatesMutation.isPending || (!editStartDate && !editDueDate)}
            >
              {updateDatesMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  儲存中...
                </>
              ) : (
                '儲存'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Style Row Component (expandable)
function StyleRow({
  style,
  isExpanded,
  onToggle,
  timelineDates,
  dateRange,
  totalDays,
  statusColors,
  onEditDates,
}: {
  style: SchedulerStyleItem;
  isExpanded: boolean;
  onToggle: () => void;
  timelineDates: Date[];
  dateRange: { start: Date; end: Date };
  totalDays: number;
  statusColors: Record<string, string>;
  onEditDates: (run: SchedulerRunItem, styleNumber: string) => void;
}) {
  return (
    <>
      {/* Style Summary Row */}
      <div
        className={cn(
          'flex border-b hover:bg-gray-50 cursor-pointer',
          style.is_overdue && 'bg-red-50'
        )}
        onClick={onToggle}
      >
        {/* Label */}
        <div className="w-64 flex-shrink-0 px-4 py-3 border-r flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{style.style_number}</div>
            <div className="text-xs text-gray-500">
              {style.runs_count} run{style.runs_count !== 1 ? 's' : ''}
              {style.is_overdue && <span className="ml-1 text-red-600">Overdue</span>}
            </div>
          </div>
          {/* Progress Badge */}
          <div className="text-xs font-medium text-gray-600">{style.progress}%</div>
        </div>

        {/* Summary Progress Bar */}
        <div className="flex-1 relative flex items-center">
          <div className="absolute inset-x-2 h-6 bg-gray-100 rounded overflow-hidden">
            <div
              className="h-full rounded transition-all"
              style={{
                width: `${style.progress}%`,
                background: `linear-gradient(90deg, ${statusColors.draft} 0%, ${statusColors.in_progress} 50%, ${statusColors.accepted} 100%)`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Expanded Run Rows */}
      {isExpanded && style.runs.map((run) => (
        <RunRow
          key={run.id}
          run={run}
          styleNumber={style.style_number}
          isNested
          timelineDates={timelineDates}
          dateRange={dateRange}
          totalDays={totalDays}
          statusColors={statusColors}
          onEditDates={(r) => onEditDates(r, style.style_number)}
        />
      ))}
    </>
  );
}

// Run Row Component
function RunRow({
  run,
  styleNumber,
  isNested = false,
  timelineDates,
  dateRange,
  totalDays,
  statusColors,
  onEditDates,
}: {
  run: SchedulerRunItem;
  styleNumber?: string | null;
  isNested?: boolean;
  timelineDates: Date[];
  dateRange: { start: Date; end: Date };
  totalDays: number;
  statusColors: Record<string, string>;
  onEditDates?: (run: SchedulerRunItem) => void;
}) {
  const barPosition = calculateBarPosition(
    run.start_date,
    run.target_due_date,
    dateRange.start,
    dateRange.end,
    totalDays
  );

  return (
    <div
      className={cn(
        'flex border-b hover:bg-gray-50',
        isNested && 'bg-gray-50',
        run.is_overdue && 'bg-red-50'
      )}
    >
      {/* Label */}
      <div className={cn('w-64 flex-shrink-0 px-4 py-2 border-r', isNested && 'pl-10')}>
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: run.color }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm truncate">
              {!isNested && styleNumber && (
                <span className="font-medium">{styleNumber} - </span>
              )}
              Run #{run.run_no}
              <span className="ml-1 text-xs text-gray-500">({run.run_type_label})</span>
            </div>
            <div className="text-xs text-gray-500">
              {run.status_label}
              {run.is_overdue && (
                <span className="ml-1 text-red-600 font-medium">
                  {Math.abs(run.days_until_due || 0)}d late
                </span>
              )}
              {!run.is_overdue && run.days_until_due !== null && run.days_until_due <= 3 && run.days_until_due >= 0 && (
                <span className="ml-1 text-amber-600">{run.days_until_due}d left</span>
              )}
            </div>
          </div>
          {/* P4: Edit button */}
          {onEditDates && (
            <button
              onClick={() => onEditDates(run)}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="調整日期"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Timeline with Task Bar */}
      <div className="flex-1 relative flex items-center">
        {/* Grid lines */}
        <div className="absolute inset-0 flex">
          {timelineDates.map((date, idx) => {
            const isToday = date.toDateString() === new Date().toDateString();
            return (
              <div
                key={idx}
                className={cn(
                  'flex-1 min-w-[60px] border-r last:border-r-0',
                  isToday && 'bg-blue-50'
                )}
              />
            );
          })}
        </div>

        {/* Task Bar (clickable to edit dates) */}
        {barPosition && (
          <div
            onClick={onEditDates ? () => onEditDates(run) : undefined}
            className={cn(
              "absolute h-5 rounded shadow-sm flex items-center justify-center text-xs text-white font-medium transition-all",
              onEditDates && "cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-blue-400"
            )}
            style={{
              left: `${barPosition.left}%`,
              width: `${barPosition.width}%`,
              backgroundColor: run.color,
              minWidth: '40px',
            }}
            title={onEditDates ? `${run.status_label} - ${run.progress}% (點擊調整日期)` : `${run.status_label} - ${run.progress}%`}
          >
            {barPosition.width > 8 && `${run.progress}%`}
          </div>
        )}

        {/* Due date marker if no bar position */}
        {!barPosition && run.target_due_date && (
          <div className="absolute inset-x-2 flex items-center">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-xs"
              style={{ backgroundColor: run.color, color: 'white' }}
            >
              Due: {new Date(run.target_due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
