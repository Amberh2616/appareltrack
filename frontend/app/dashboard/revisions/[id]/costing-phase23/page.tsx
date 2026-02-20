"use client";

/**
 * Costing Page - Phase 2-3
 * Three-Layer Architecture: BOM → Usage → Costing
 *
 * Displays:
 * - CostingVersionsTimeline (Sample/Bulk tabs with version cards)
 * - CostingDetailDrawer (opened when clicking a version)
 * - CreateCostSheetDialog (opened when clicking "New Version")
 */

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getRevision } from '@/lib/api/styles';
import { CostingVersionsTimeline } from '@/components/costing/CostingVersionsTimeline';
import { CreateCostSheetDialog } from '@/components/costing/CostingDialogs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Package, Ruler, DollarSign, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import { ReadinessWarningBanner } from '@/components/styles/ReadinessWarningBanner';
import { StyleBreadcrumb } from '@/components/styles/StyleBreadcrumb';

export default function CostingPhase23Page() {
  const params = useParams();
  const revisionId = params.id as string;

  // Fetch revision to get style_id
  const { data: revision, isLoading, error } = useQuery({
    queryKey: ['revision', revisionId],
    queryFn: () => getRevision(revisionId),
    enabled: !!revisionId,
  });

  const styleId = revision?.style;  // style is UUID string

  // Fetch style info for breadcrumb
  const { data: styleData } = useQuery({
    queryKey: ['style-info-costing', styleId],
    queryFn: () => apiClient<any>(`/styles/${styleId}/`),
    enabled: !!styleId,
  });

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-3 text-muted-foreground">Loading revision...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !styleId) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            Failed to load revision
          </h2>
          <p className="text-red-600">
            {error instanceof Error ? error.message : 'Revision not found or missing style information'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/dashboard/costing">
              <Button variant="ghost" size="sm" className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                返回列表
              </Button>
            </Link>
            <div className="h-4 w-px bg-border" />
            <Link href={`/dashboard/revisions/${revisionId}/bom`}>
              <Button variant="ghost" size="sm" className="gap-1">
                <Package className="h-4 w-4" />
                BOM 物料
              </Button>
            </Link>
            <Link href={`/dashboard/revisions/${revisionId}/spec`}>
              <Button variant="ghost" size="sm" className="gap-1">
                <Ruler className="h-4 w-4" />
                Spec 尺寸
              </Button>
            </Link>
            {styleId && (
              <>
                <div className="h-4 w-px bg-border" />
                <Link href={`/dashboard/styles/${styleId}`}>
                  <Button variant="ghost" size="sm" className="gap-1 text-blue-600 hover:text-blue-700">
                    <LayoutDashboard className="h-4 w-4" />
                    Style Center
                  </Button>
                </Link>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <DollarSign className="h-6 w-6 text-green-600" />
            <div>
              <h1 className="text-2xl font-bold">報價 Costing</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Revision: {revision.revision_label} - 管理樣衣與大貨報價
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Breadcrumb + Readiness Warning Banner */}
      {styleData?.id && (
        <StyleBreadcrumb styleId={styleData.id} styleNumber={styleData.style_number} currentPage="Costing" />
      )}
      <ReadinessWarningBanner styleId={styleId} />

      {/* Version Timeline (handles Sample/Bulk tabs internally) */}
      <CostingVersionsTimeline
        styleId={styleId}
        onCreateNew={(costingType) => {
          setIsCreateDialogOpen(true);
        }}
      />

      {/* Create Dialog (triggered by "New Version" button in Timeline) */}
      <CreateCostSheetDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        styleId={styleId}
      />
    </div>
  );
}
