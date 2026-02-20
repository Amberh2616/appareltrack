'use client';

/**
 * P1: Alerts Panel Component
 *
 * Displays alerts for overdue, due soon, and stale sample runs.
 * Can be used in Dashboard or Kanban pages.
 */

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { fetchAlerts, type Alert } from '@/lib/api/samples';
import { cn } from '@/lib/utils';

// Alert severity colors
const SEVERITY_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  high: { bg: 'bg-red-50', border: 'border-red-200', icon: '🔴' },
  medium: { bg: 'bg-amber-50', border: 'border-amber-200', icon: '🟠' },
  low: { bg: 'bg-gray-50', border: 'border-gray-200', icon: '🟡' },
};

// Alert type labels
const TYPE_LABELS: Record<string, string> = {
  overdue: 'Overdue',
  due_soon: 'Due Soon',
  stale: 'Stale',
};

interface AlertsPanelProps {
  /** Maximum number of alerts to show per category */
  limit?: number;
  /** Show/hide different alert types */
  showOverdue?: boolean;
  showDueSoon?: boolean;
  showStale?: boolean;
  /** Compact mode for smaller display */
  compact?: boolean;
  /** Refresh interval in ms (default: 60000) */
  refreshInterval?: number;
  /** Custom class name */
  className?: string;
}

export function AlertsPanel({
  limit = 10,
  showOverdue = true,
  showDueSoon = true,
  showStale = true,
  compact = false,
  refreshInterval = 60000,
  className,
}: AlertsPanelProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['alerts', { limit, showOverdue, showDueSoon, showStale }],
    queryFn: () =>
      fetchAlerts({
        include_overdue: showOverdue,
        include_due_soon: showDueSoon,
        include_stale: showStale,
        limit,
      }),
    refetchInterval: refreshInterval,
  });

  if (isLoading) {
    return (
      <div className={cn('p-4 bg-gray-50 rounded-lg', className)}>
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-3 py-1">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-4 bg-red-50 border border-red-200 rounded-lg', className)}>
        <p className="text-sm text-red-600">Failed to load alerts</p>
      </div>
    );
  }

  const { alerts = [], summary } = data || { alerts: [], summary: { total: 0, overdue: 0, due_soon: 0, stale: 0 } };

  if (alerts.length === 0) {
    return (
      <div className={cn('p-4 bg-green-50 border border-green-200 rounded-lg', className)}>
        <p className="text-sm text-green-700 flex items-center gap-2">
          <span>✓</span>
          No alerts - all sample runs are on track!
        </p>
      </div>
    );
  }

  return (
    <div className={cn('bg-white border rounded-lg overflow-hidden', className)}>
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">
          Alerts
          <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
            {summary?.total || 0}
          </span>
        </h3>
        <div className="flex gap-3 text-xs">
          {showOverdue && summary?.overdue > 0 && (
            <span className="text-red-600 font-medium">{summary.overdue} overdue</span>
          )}
          {showDueSoon && summary?.due_soon > 0 && (
            <span className="text-amber-600 font-medium">{summary.due_soon} due soon</span>
          )}
          {showStale && summary?.stale > 0 && (
            <span className="text-gray-500">{summary.stale} stale</span>
          )}
        </div>
      </div>

      {/* Alert List */}
      <div className={cn('divide-y', compact ? 'max-h-48' : 'max-h-80', 'overflow-y-auto')}>
        {alerts.map((alert) => (
          <AlertItem key={alert.id} alert={alert} compact={compact} />
        ))}
      </div>

      {/* Footer */}
      {alerts.length >= limit && (
        <div className="px-4 py-2 bg-gray-50 border-t text-center">
          <Link
            href="/dashboard/samples/kanban?view=overdue"
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            View all alerts →
          </Link>
        </div>
      )}
    </div>
  );
}

// Individual Alert Item
function AlertItem({ alert, compact }: { alert: Alert; compact: boolean }) {
  const styles = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.low;

  return (
    <div
      className={cn(
        'px-4 py-3 hover:bg-gray-50 transition-colors',
        styles.bg,
        compact && 'py-2'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <span className="text-sm flex-shrink-0">{styles.icon}</span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded',
                alert.type === 'overdue' && 'bg-red-100 text-red-700',
                alert.type === 'due_soon' && 'bg-amber-100 text-amber-700',
                alert.type === 'stale' && 'bg-gray-100 text-gray-600'
              )}
            >
              {TYPE_LABELS[alert.type]}
            </span>
            <Link
              href={`/dashboard/samples/${alert.request_id}/runs/${alert.run_id}`}
              className="font-medium text-gray-900 hover:text-blue-600 truncate"
            >
              {alert.style_number || 'Unknown Style'}
            </Link>
          </div>
          {!compact && (
            <p className="text-sm text-gray-500 mt-0.5 truncate">{alert.message}</p>
          )}
        </div>

        {/* Action */}
        <Link
          href={`/dashboard/samples/${alert.request_id}/runs/${alert.run_id}`}
          className="text-xs text-blue-600 hover:text-blue-800 flex-shrink-0"
        >
          View
        </Link>
      </div>
    </div>
  );
}

// Summary badge component for use in navigation/headers
export function AlertsBadge({ className }: { className?: string }) {
  const { data } = useQuery({
    queryKey: ['alerts-summary'],
    queryFn: () => fetchAlerts({ limit: 1 }),
    refetchInterval: 60000,
  });

  const total = data?.summary?.total || 0;

  if (total === 0) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full',
        total > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600',
        className
      )}
    >
      {total}
    </span>
  );
}
