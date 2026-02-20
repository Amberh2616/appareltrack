"use client";

/**
 * Sample Run Console Page
 * Phase 3-1: Sample Request System MVP
 *
 * Full-featured run management console with tabs:
 * - Overview: Run details and timeline
 * - Materials: Guidance usage and T2PO management
 * - MWO: Manufacturing work orders
 * - Progress: Production tracking and status updates
 * - Actuals: Record actual costs and usage
 * - Costing: View costing version (future)
 */

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  useSampleRun,
  useT2POsForSample,
  useSampleMWOs,
  useSampleActualsForRun,
} from '@/lib/hooks/useSamples';
import { SampleRunStatusLabels, SampleRunTypeLabels } from '@/types/samples';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

// Tab components
import { OverviewTab } from '@/components/samples/run-console/OverviewTab';
import { MaterialsTab } from '@/components/samples/run-console/MaterialsTab';
import { MWOTab } from '@/components/samples/run-console/MWOTab';
import { ProgressTab } from '@/components/samples/run-console/ProgressTab';
import { ActualsTab } from '@/components/samples/run-console/ActualsTab';

export default function RunConsolePage() {
  const params = useParams();
  const router = useRouter();
  const requestId = params.requestId as string;
  const runId = params.runId as string;

  const [activeTab, setActiveTab] = useState('overview');

  // Fetch run data
  const { data: run, isLoading: isLoadingRun, error: runError } = useSampleRun(runId);
  const { data: t2pos = [], isLoading: isLoadingT2POs } = useT2POsForSample({ sample_run_id: runId });
  const { data: mwos = [], isLoading: isLoadingMWOs } = useSampleMWOs({ sample_run_id: runId });
  const { data: actuals = [], isLoading: isLoadingActuals } = useSampleActualsForRun({ sample_run_id: runId });

  // Loading state
  if (isLoadingRun) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-3 text-muted-foreground">Loading run console...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (runError || !run) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href={`/dashboard/samples/${requestId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Request
            </Button>
          </Link>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            Failed to load sample run
          </h2>
          <p className="text-red-600">
            {runError instanceof Error ? runError.message : 'Run not found'}
          </p>
        </div>
      </div>
    );
  }

  // Get status color
  const getStatusColor = (status: string) => {
    if (status === 'cancelled') return 'destructive';
    if (status === 'accepted' || status === 'sample_done' || status === 'costing_generated') return 'default';
    if (status === 'revise_needed') return 'secondary';
    return 'outline';
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/samples/${requestId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Request
          </Button>
        </Link>

        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Run #{run.run_no}</h1>
            <Badge variant={getStatusColor(run.status)}>
              {SampleRunStatusLabels[run.status]}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            {SampleRunTypeLabels[run.run_type]} - {run.quantity} pcs
            {run.target_due_date && (
              <span className="ml-2">
                • Due: {format(new Date(run.target_due_date), 'MMM dd, yyyy')}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="materials">
            Materials
            {t2pos.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {t2pos.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="mwo">
            MWO
            {mwos.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {mwos.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="actuals">
            Actuals
            {actuals.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                ✓
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <OverviewTab run={run} t2pos={t2pos} mwos={mwos} actuals={actuals[0]} />
        </TabsContent>

        <TabsContent value="materials" className="space-y-4">
          <MaterialsTab run={run} t2pos={t2pos} isLoading={isLoadingT2POs} />
        </TabsContent>

        <TabsContent value="mwo" className="space-y-4">
          <MWOTab run={run} mwos={mwos} isLoading={isLoadingMWOs} />
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          <ProgressTab run={run} />
        </TabsContent>

        <TabsContent value="actuals" className="space-y-4">
          <ActualsTab run={run} actuals={actuals[0]} isLoading={isLoadingActuals} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
