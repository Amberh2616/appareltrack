"use client";

/**
 * SampleRunTimeline Component
 * Displays timeline of all runs for a sample request
 */

import { SampleRun } from '@/types/samples';
import { SampleRunTypeLabels, SampleRunStatusLabels } from '@/types/samples';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { ChevronRight, Calendar, Package } from 'lucide-react';

interface SampleRunTimelineProps {
  runs: SampleRun[];
  onRunClick?: (run: SampleRun) => void;
}

export function SampleRunTimeline({ runs, onRunClick }: SampleRunTimelineProps) {
  if (runs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No runs created yet. Click "New Run" to get started.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {runs.map((run, index) => (
        <div key={run.id} className="relative">
          {/* Timeline connector */}
          {index < runs.length - 1 && (
            <div className="absolute left-[21px] top-16 bottom-0 w-0.5 bg-border" />
          )}

          <Card
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => onRunClick?.(run)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start gap-4">
                {/* Run number badge */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  {run.run_no}
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {SampleRunTypeLabels[run.run_type]}
                    </CardTitle>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>

                  {/* Status and Metadata */}
                  <div className="flex items-center gap-3 flex-wrap">
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

                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Package className="h-3.5 w-3.5" />
                      <span>Qty: {run.quantity}</span>
                    </div>

                    {run.target_due_date && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{format(new Date(run.target_due_date), 'MMM dd, yyyy')}</span>
                      </div>
                    )}
                  </div>

                  {/* Notes preview */}
                  {run.notes && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {run.notes}
                    </p>
                  )}

                  {/* Linked resources */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {run.t2pos && run.t2pos.length > 0 && (
                      <span>T2 POs: {run.t2pos.length}</span>
                    )}
                    {run.mwos && run.mwos.length > 0 && (
                      <span>MWOs: {run.mwos.length}</span>
                    )}
                    {run.costing_version && <span>Costing: Generated</span>}
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>
      ))}
    </div>
  );
}
