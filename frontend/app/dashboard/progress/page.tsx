'use client';

/**
 * P18: Unified Progress Dashboard
 * Shows aggregated progress tracking for samples, quotations, procurement, and production
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Shirt,
  Calculator,
  ShoppingCart,
  Factory,
  Package,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { fetchProgressDashboard, type ProgressDashboardResponse, type ProgressAlert } from '@/lib/api/samples';

// Status colors for sample progress
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-400',
  materials_planning: 'bg-amber-400',
  po_drafted: 'bg-orange-500',
  po_issued: 'bg-green-500',
  mwo_drafted: 'bg-blue-500',
  mwo_issued: 'bg-indigo-500',
  in_progress: 'bg-violet-500',
  sample_done: 'bg-cyan-500',
  actuals_recorded: 'bg-teal-500',
  costing_generated: 'bg-emerald-500',
  quoted: 'bg-lime-500',
  accepted: 'bg-green-600',
};

function SummaryCard({
  title,
  icon: Icon,
  total,
  active,
  activeLabel = 'Active',
}: {
  title: string;
  icon: React.ElementType;
  total: number;
  active: number;
  activeLabel?: string;
}) {
  const percentage = total > 0 ? Math.round((active / total) * 100) : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{total}</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-primary">{active}</span>
          <span>{activeLabel}</span>
          {percentage > 0 && (
            <Badge variant="outline" className="ml-auto">
              {percentage}%
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusProgressCard({
  title,
  icon: Icon,
  byStatus,
  colorMap,
}: {
  title: string;
  icon: React.ElementType;
  byStatus: Record<string, { count: number; label: string; color?: string }>;
  colorMap?: Record<string, string>;
}) {
  const entries = Object.entries(byStatus);
  const total = entries.reduce((sum, [, item]) => sum + item.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="secondary" className="ml-auto">
            {total} total
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items</p>
        ) : (
          <div className="space-y-2">
            {entries.map(([status, item]) => {
              const color = item.color || colorMap?.[status] || 'bg-gray-400';
              return (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${color}`} />
                    <span className="text-sm">{item.label}</span>
                  </div>
                  <Badge variant="outline">{item.count}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlertsCard({ alerts }: { alerts: ProgressAlert[] }) {
  if (alerts.length === 0) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <CardTitle className="text-base">All Clear</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No alerts or overdue items.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-base">Alerts ({alerts.length})</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert, index) => (
          <Alert
            key={index}
            variant={alert.type === 'error' ? 'destructive' : 'default'}
            className={alert.type === 'warning' ? 'border-amber-500' : undefined}
          >
            {alert.type === 'error' ? (
              <XCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertTitle className="text-sm font-medium">{alert.title}</AlertTitle>
            <AlertDescription className="text-xs">{alert.description}</AlertDescription>
          </Alert>
        ))}
      </CardContent>
    </Card>
  );
}

function QuotationCard({
  byStatus,
  byType,
  pending,
}: {
  byStatus: Record<string, { count: number; label: string }>;
  byType: { sample: number; bulk: number };
  pending: number;
}) {
  const entries = Object.entries(byStatus);
  const total = entries.reduce((sum, [, item]) => sum + item.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Quotation Progress</CardTitle>
          <Badge variant="secondary" className="ml-auto">
            {total} total
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* By Type */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">By Type</p>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-blue-500" />
              <span className="text-sm">Sample: {byType.sample}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <span className="text-sm">Bulk: {byType.bulk}</span>
            </div>
          </div>
        </div>

        {/* By Status */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">By Status</p>
          <div className="space-y-1">
            {entries.map(([status, item]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm capitalize">{item.label}</span>
                <Badge variant="outline">{item.count}</Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Pending */}
        {pending > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="text-sm text-amber-600 font-medium">
              {pending} pending approval
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ProgressDashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['progress-dashboard'],
    queryFn: () => fetchProgressDashboard({ days_ahead: 14 }),
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <h1 className="text-2xl font-bold">Progress Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load progress dashboard data.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const { summary, sample_progress, quotation_progress, procurement_progress, production_progress, material_progress, alerts, meta } = data;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Progress Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Last updated: {new Date(meta.as_of).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Looking ahead: {meta.days_ahead} days
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          title="Samples"
          icon={Shirt}
          total={summary.total_samples}
          active={summary.active_samples}
        />
        <SummaryCard
          title="Quotations"
          icon={Calculator}
          total={summary.total_quotes}
          active={summary.pending_quotes}
          activeLabel="Pending"
        />
        <SummaryCard
          title="Purchase Orders"
          icon={ShoppingCart}
          total={summary.total_po}
          active={summary.active_po}
        />
        <SummaryCard
          title="Production Orders"
          icon={Factory}
          total={summary.total_prod_orders}
          active={summary.active_prod_orders}
        />
      </div>

      {/* Alerts */}
      <AlertsCard alerts={alerts} />

      {/* Progress Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Sample Progress */}
        <StatusProgressCard
          title="Sample Progress"
          icon={Shirt}
          byStatus={sample_progress.by_status}
          colorMap={STATUS_COLORS}
        />

        {/* Quotation Progress */}
        <QuotationCard
          byStatus={quotation_progress.by_status}
          byType={quotation_progress.by_type}
          pending={quotation_progress.pending}
        />

        {/* Procurement Progress */}
        <StatusProgressCard
          title="Procurement Progress"
          icon={ShoppingCart}
          byStatus={procurement_progress.by_status}
        />

        {/* Production Progress */}
        <StatusProgressCard
          title="Production Progress"
          icon={Factory}
          byStatus={production_progress.by_status}
        />

        {/* Material Requirements */}
        <StatusProgressCard
          title="Material Requirements"
          icon={Package}
          byStatus={material_progress.by_status}
        />
      </div>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Stats</CardTitle>
          <CardDescription>Overview of current status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950">
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-sm font-medium">Overdue</p>
                <p className="text-xl font-bold text-red-600">
                  {sample_progress.overdue + procurement_progress.overdue_deliveries + production_progress.overdue}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950">
              <Clock className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-sm font-medium">Due Soon</p>
                <p className="text-xl font-bold text-amber-600">
                  {sample_progress.due_soon + procurement_progress.due_soon_deliveries}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm font-medium">On Track</p>
                <p className="text-xl font-bold text-green-600">
                  {summary.total_samples - sample_progress.overdue - sample_progress.due_soon}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
