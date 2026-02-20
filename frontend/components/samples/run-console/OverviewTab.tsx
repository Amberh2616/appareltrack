/**
 * Overview Tab Component
 * Displays run details, status timeline, and summary of related resources
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  SampleRun,
  T2POForSample,
  SampleMWO,
  SampleActuals,
  SampleRunStatusLabels,
  SampleRunTypeLabels,
} from '@/types/samples';
import { Calendar, Package, FileText, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface OverviewTabProps {
  run: SampleRun;
  t2pos: T2POForSample[];
  mwos: SampleMWO[];
  actuals?: SampleActuals;
}

export function OverviewTab({ run, t2pos, mwos, actuals }: OverviewTabProps) {
  // Calculate progress based on status
  const getStatusProgress = (status: string) => {
    const progressMap: Record<string, number> = {
      draft: 10,
      materials_planning: 20,
      po_drafted: 30,
      po_issued: 40,
      mwo_drafted: 50,
      mwo_issued: 60,
      in_progress: 75,
      sample_done: 90,
      actuals_recorded: 95,
      costing_generated: 100,
      quoted: 100,
      accepted: 100,
      revise_needed: 50,
      cancelled: 0,
    };
    return progressMap[status] || 0;
  };

  const progress = getStatusProgress(run.status);

  // Get issued T2POs count
  const issuedT2POsCount = t2pos.filter((po) => po.status === 'issued' || po.status === 'confirmed').length;
  const issuedMWOsCount = mwos.filter((mwo) => mwo.status === 'issued' || mwo.status === 'in_progress').length;

  return (
    <div className="space-y-6">
      {/* Run Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Run Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Basic Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Run Type</div>
              <div className="text-sm mt-1">{SampleRunTypeLabels[run.run_type]}</div>
            </div>

            <div>
              <div className="text-sm font-medium text-muted-foreground">Quantity</div>
              <div className="text-sm mt-1 flex items-center gap-1">
                <Package className="h-3.5 w-3.5" />
                {run.quantity} pcs
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-muted-foreground">Target Due Date</div>
              <div className="text-sm mt-1 flex items-center gap-1">
                {run.target_due_date ? (
                  <>
                    <Calendar className="h-3.5 w-3.5" />
                    {format(new Date(run.target_due_date), 'MMM dd, yyyy')}
                  </>
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-muted-foreground">Status</div>
              <div className="text-sm mt-1">
                <Badge>{SampleRunStatusLabels[run.status]}</Badge>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <Separator />
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Created At</div>
              <div className="mt-1">{format(new Date(run.created_at), 'MMM dd, yyyy HH:mm')}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Last Updated</div>
              <div className="mt-1">{format(new Date(run.updated_at), 'MMM dd, yyyy HH:mm')}</div>
            </div>
          </div>

          {/* Notes */}
          {run.notes && (
            <>
              <Separator />
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">Notes</div>
                <p className="text-sm">{run.notes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Status Timeline Card */}
      <Card>
        <CardHeader>
          <CardTitle>Status Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm text-muted-foreground">{progress}%</span>
            </div>
            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Timeline Steps (with real timestamps from status_timestamps) */}
          <div className="space-y-3">
            {[
              { key: 'materials_planning', label: 'Materials Planning', threshold: 20 },
              { key: 'po_issued', label: 'PO Issued', threshold: 40, altKeys: ['po_drafted'] },
              { key: 'mwo_issued', label: 'MWO Issued', threshold: 60, altKeys: ['mwo_drafted'] },
              { key: 'in_progress', label: 'In Production', threshold: 75 },
              { key: 'sample_done', label: 'Sample Done', threshold: 90 },
              { key: 'actuals_recorded', label: 'Actuals Recorded', threshold: 95 },
            ].map((step) => {
              const ts = run.status_timestamps;
              const timestamp = ts?.[step.key]
                || step.altKeys?.map(k => ts?.[k]).find(Boolean)
                || undefined;
              return (
                <TimelineStep
                  key={step.key}
                  label={step.label}
                  completed={progress >= step.threshold}
                  active={run.status === step.key || (step.altKeys?.includes(run.status) ?? false)}
                  timestamp={timestamp}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Related Resources Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Related Resources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* T2POs */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-sm font-medium">T2 Purchase Orders</div>
                <div className="text-2xl font-bold mt-1">{t2pos.length}</div>
                {issuedT2POsCount > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {issuedT2POsCount} issued
                  </div>
                )}
              </div>
            </div>

            {/* MWOs */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <Package className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-sm font-medium">Manufacturing Orders</div>
                <div className="text-2xl font-bold mt-1">{mwos.length}</div>
                {issuedMWOsCount > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {issuedMWOsCount} issued
                  </div>
                )}
              </div>
            </div>

            {/* Actuals */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                {actuals ? (
                  <CheckCircle2 className="h-5 w-5 text-purple-600" />
                ) : (
                  <Clock className="h-5 w-5 text-purple-400" />
                )}
              </div>
              <div>
                <div className="text-sm font-medium">Actual Costs</div>
                <div className="text-2xl font-bold mt-1">
                  {actuals ? '✓' : '-'}
                </div>
                {actuals && actuals.recorded_at && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Recorded {format(new Date(actuals.recorded_at), 'MMM dd')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Timeline Step Component
interface TimelineStepProps {
  label: string;
  completed: boolean;
  active: boolean;
  timestamp?: string;
}

function TimelineStep({ label, completed, active, timestamp }: TimelineStepProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center ${
          completed
            ? 'bg-blue-500 text-white'
            : active
              ? 'bg-blue-100 border-2 border-blue-500'
              : 'bg-gray-200'
        }`}
      >
        {completed && <CheckCircle2 className="h-4 w-4" />}
        {active && !completed && <Clock className="h-4 w-4 text-blue-500" />}
      </div>
      <div className="flex-1 flex items-center justify-between">
        <span
          className={`text-sm ${
            completed || active ? 'font-medium' : 'text-muted-foreground'
          }`}
        >
          {label}
        </span>
        {timestamp && (
          <span className="text-xs text-muted-foreground">
            {format(new Date(timestamp), 'MMM dd, HH:mm')}
          </span>
        )}
      </div>
    </div>
  );
}
