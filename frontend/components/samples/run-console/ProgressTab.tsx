/**
 * Progress Tab Component (TRACK-PROGRESS rewrite)
 * Milestones with real timestamps + Transition History table
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  SampleRun,
  SampleRunStatusLabels,
  SampleRunTransitionLog,
} from '@/types/samples';
import { fetchTransitionLogs } from '@/lib/api/samples';
import {
  PlayCircle,
  CheckCircle,
  AlertCircle,
  Clock,
  Package,
  History,
  ArrowRight,
} from 'lucide-react';
import { format } from 'date-fns';

interface ProgressTabProps {
  run: SampleRun;
}

// Milestone definitions
const MILESTONES = [
  { key: 'draft', label: 'Draft Created', icon: Package },
  { key: 'materials_planning', label: 'Materials Planning', icon: Package },
  { key: 'po_drafted', label: 'PO Drafted', icon: Package },
  { key: 'po_issued', label: 'PO Issued', icon: Package },
  { key: 'mwo_drafted', label: 'MWO Drafted', icon: Package },
  { key: 'mwo_issued', label: 'MWO Issued', icon: Package },
  { key: 'in_progress', label: 'In Production', icon: Clock },
  { key: 'sample_done', label: 'Sample Done', icon: CheckCircle },
  { key: 'actuals_recorded', label: 'Actuals Recorded', icon: CheckCircle },
  { key: 'costing_generated', label: 'Costing Generated', icon: CheckCircle },
  { key: 'quoted', label: 'Quoted', icon: CheckCircle },
  { key: 'accepted', label: 'Accepted', icon: CheckCircle },
] as const;

// Status order for progress calculation
const STATUS_ORDER: Record<string, number> = {
  draft: 0,
  materials_planning: 1,
  po_drafted: 2,
  po_issued: 3,
  mwo_drafted: 4,
  mwo_issued: 5,
  in_progress: 6,
  sample_done: 7,
  actuals_recorded: 8,
  costing_generated: 9,
  quoted: 10,
  accepted: 11,
  revise_needed: 5,
  cancelled: -1,
};

export function ProgressTab({ run }: ProgressTabProps) {
  const [isStartDialogOpen, setIsStartDialogOpen] = useState(false);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [logs, setLogs] = useState<SampleRunTransitionLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  // Fetch transition logs
  useEffect(() => {
    let cancelled = false;
    setLogsLoading(true);
    fetchTransitionLogs(run.id)
      .then((data) => {
        if (!cancelled) setLogs(data);
      })
      .catch((err) => {
        console.error('Failed to fetch transition logs:', err);
      })
      .finally(() => {
        if (!cancelled) setLogsLoading(false);
      });
    return () => { cancelled = true; };
  }, [run.id]);

  // Check if actions are available
  const canStartProduction =
    run.status === 'mwo_issued' || run.status === 'po_issued';
  const canMarkDone = run.status === 'in_progress';

  const handleStartProduction = async () => {
    console.log('Start production for run:', run.id, 'Notes:', notes);
    setIsStartDialogOpen(false);
    setNotes('');
  };

  const handleMarkSampleDone = async () => {
    console.log('Mark sample done for run:', run.id, 'Notes:', notes);
    setIsCompleteDialogOpen(false);
    setNotes('');
  };

  const currentOrder = STATUS_ORDER[run.status] ?? -1;
  const ts = run.status_timestamps || {};

  return (
    <div className="space-y-6">
      {/* Milestones Card */}
      <Card>
        <CardHeader>
          <CardTitle>Milestones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {MILESTONES.map((ms) => {
              const msOrder = STATUS_ORDER[ms.key] ?? -1;
              const isCompleted = currentOrder > msOrder && run.status !== 'cancelled';
              const isActive = run.status === ms.key;
              const timestamp = ts[ms.key];

              // Calculate duration to next milestone
              let durationLabel: string | null = null;
              if (timestamp && isCompleted) {
                const nextMs = MILESTONES.find(
                  (m) => (STATUS_ORDER[m.key] ?? -1) > msOrder && ts[m.key]
                );
                if (nextMs && ts[nextMs.key]) {
                  const diffMs = new Date(ts[nextMs.key]).getTime() - new Date(timestamp).getTime();
                  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                  durationLabel = diffDays > 0 ? `${diffDays}d ${diffHours}h` : `${diffHours}h`;
                }
              }

              return (
                <div
                  key={ms.key}
                  className={`flex items-center gap-3 py-2 px-3 rounded-md ${
                    isActive ? 'bg-blue-50 border border-blue-200' : ''
                  }`}
                >
                  {/* Status indicator */}
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isActive
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200'
                    }`}
                  >
                    {isCompleted && <CheckCircle className="h-3.5 w-3.5" />}
                    {isActive && <Clock className="h-3.5 w-3.5" />}
                  </div>

                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-sm ${
                        isCompleted || isActive ? 'font-medium' : 'text-muted-foreground'
                      }`}
                    >
                      {ms.label}
                    </span>
                  </div>

                  {/* Duration badge */}
                  {durationLabel && (
                    <span className="text-[11px] text-gray-400 whitespace-nowrap">
                      {durationLabel}
                    </span>
                  )}

                  {/* Timestamp */}
                  <div className="flex-shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                    {timestamp
                      ? format(new Date(timestamp), 'MMM dd, HH:mm')
                      : isActive
                        ? 'Current'
                        : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Transition History Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Transition History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="text-sm text-muted-foreground text-center py-6">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">
              No transitions recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 py-2 border-b last:border-b-0"
                >
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {log.action === 'rollback' ? (
                      <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
                        <ArrowRight className="h-3.5 w-3.5 text-amber-600 rotate-180" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                        <ArrowRight className="h-3.5 w-3.5 text-blue-600" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[11px]">
                        {SampleRunStatusLabels[log.from_status as keyof typeof SampleRunStatusLabels] || log.from_status}
                      </Badge>
                      <ArrowRight className="h-3 w-3 text-gray-400" />
                      <Badge variant="outline" className="text-[11px]">
                        {SampleRunStatusLabels[log.to_status as keyof typeof SampleRunStatusLabels] || log.to_status}
                      </Badge>
                      <span className="text-[11px] text-gray-500">
                        ({log.action})
                      </span>
                    </div>
                    {log.note && (
                      <p className="text-xs text-muted-foreground mt-1">{log.note}</p>
                    )}
                    <div className="text-[11px] text-gray-400 mt-1">
                      {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm')}
                      {log.actor_name && (
                        <span className="ml-2">by {log.actor_name}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons Card */}
      <Card>
        <CardHeader>
          <CardTitle>Production Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex-1">
              <div className="font-medium">Start Production</div>
              <div className="text-sm text-muted-foreground mt-1">
                Mark that production has started in the factory
              </div>
            </div>
            <Button
              onClick={() => setIsStartDialogOpen(true)}
              disabled={!canStartProduction}
              className="ml-4"
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              Start Production
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex-1">
              <div className="font-medium">Mark Sample Done</div>
              <div className="text-sm text-muted-foreground mt-1">
                Confirm that sample production is complete
              </div>
            </div>
            <Button
              onClick={() => setIsCompleteDialogOpen(true)}
              disabled={!canMarkDone}
              className="ml-4"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark Done
            </Button>
          </div>

          {!canStartProduction && !canMarkDone && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {run.status === 'draft' && 'Complete materials and MWO planning first.'}
                {run.status === 'materials_planning' && 'Issue T2PO to proceed.'}
                {run.status === 'po_drafted' && 'Issue the T2PO to proceed.'}
                {run.status === 'mwo_drafted' && 'Issue the MWO to proceed.'}
                {run.status === 'sample_done' && 'Sample is complete. Record actuals next.'}
                {run.status === 'actuals_recorded' && 'All production steps completed.'}
                {run.status === 'cancelled' && 'This run has been cancelled.'}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Start Production Dialog */}
      <Dialog open={isStartDialogOpen} onOpenChange={setIsStartDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Production</DialogTitle>
            <DialogDescription>
              Mark that production has started for this sample run.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="start-notes">Notes (Optional)</Label>
              <Textarea
                id="start-notes"
                placeholder="Add any notes about production start..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This will update the run status to &quot;In Progress&quot;.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStartDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStartProduction}>
              <PlayCircle className="mr-2 h-4 w-4" />
              Start Production
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Sample Done Dialog */}
      <Dialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Sample Done</DialogTitle>
            <DialogDescription>
              Confirm that sample production is complete.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="complete-notes">Notes (Optional)</Label>
              <Textarea
                id="complete-notes"
                placeholder="Add any notes about completion..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This will update the run status to &quot;Sample Done&quot;. You can record actuals next.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCompleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMarkSampleDone}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
