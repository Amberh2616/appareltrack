/**
 * CostingVersionsTimeline Component - Phase 2-3
 *
 * Displays all CostSheetVersions as cards in a timeline layout
 * - Filter by costing_type (Sample / Bulk)
 * - Visual status indicators
 * - Click to open detail drawer
 * - Create New Version button
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, FileText, Calendar, User, ArrowRight } from 'lucide-react';

import { useCostSheetVersions } from '@/lib/hooks/useCostingPhase23';
import { CostingDetailDrawer } from './CostingDetailDrawer';
import type { CostSheetVersion, CostingType } from '@/types/costing-phase23';
import { cn } from '@/lib/utils';
import { Link2 } from 'lucide-react';

export interface CostingVersionsTimelineProps {
  styleId: string;
  onCreateNew?: (costingType: CostingType) => void;
}

export function CostingVersionsTimeline({ styleId, onCreateNew }: CostingVersionsTimelineProps) {
  const [selectedType, setSelectedType] = useState<CostingType>('sample');
  const [selectedCostSheetId, setSelectedCostSheetId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Fetch versions filtered by type
  const {
    data: versions,
    isLoading,
    error,
  } = useCostSheetVersions(styleId, { costing_type: selectedType });

  // Status badge styles
  const getStatusBadge = (status: string) => {
    const variants: Record<string, { bg: string; text: string }> = {
      draft: { bg: 'bg-blue-100', text: 'text-blue-800' },
      submitted: { bg: 'bg-green-100', text: 'text-green-800' },
      accepted: { bg: 'bg-purple-100', text: 'text-purple-800' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800' },
      superseded: { bg: 'bg-gray-100', text: 'text-gray-600' },
    };
    return variants[status] || variants.draft;
  };

  // Card border color by status
  const getCardBorderClass = (status: string) => {
    const borders: Record<string, string> = {
      draft: 'border-l-4 border-l-blue-500',
      submitted: 'border-l-4 border-l-green-500',
      accepted: 'border-l-4 border-l-purple-500',
      rejected: 'border-l-4 border-l-red-500',
      superseded: 'border-l-4 border-l-gray-300',
    };
    return borders[status] || borders.draft;
  };

  // Handle card click
  const handleCardClick = (versionId: string) => {
    setSelectedCostSheetId(versionId);
    setIsDrawerOpen(true);
  };

  // Handle create new version
  const handleCreateNew = () => {
    if (onCreateNew) {
      onCreateNew(selectedType);
    }
  };

  // Render version card
  const renderVersionCard = (version: CostSheetVersion) => {
    const statusBadge = getStatusBadge(version.status);
    const borderClass = getCardBorderClass(version.status);

    return (
      <Card
        key={version.id}
        className={cn(
          'cursor-pointer hover:shadow-lg transition-shadow',
          borderClass,
          version.status === 'superseded' && 'opacity-60'
        )}
        onClick={() => handleCardClick(version.id)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">v{version.version_no}</h3>
                <Badge className={cn(statusBadge.bg, statusBadge.text)}>
                  {version.status.toUpperCase()}
                </Badge>
                {version.is_current && (
                  <Badge variant="outline" className="text-xs">
                    CURRENT
                  </Badge>
                )}
              </div>

              {version.change_reason && (
                <p className="text-sm text-gray-600 italic mt-1">
                  "{version.change_reason}"
                </p>
              )}
            </div>

            <div className="text-right">
              <div className="text-3xl font-bold text-blue-600">
                ${parseFloat(version.unit_price).toFixed(2)}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-3 border-t">
          <div className="space-y-2 text-sm">
            {/* Evidence binding */}
            <div className="flex items-center gap-2 text-gray-600">
              <FileText className="h-4 w-4" />
              <span className="text-xs">
                Revision: {version.techpack_revision.substring(0, 8)}...
              </span>
            </div>

            {/* Created info */}
            <div className="flex items-center gap-4 text-gray-600">
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                <span className="text-xs">{version.created_by}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span className="text-xs">
                  {new Date(version.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Submitted info */}
            {version.submitted_at && (
              <div className="text-xs text-green-600">
                Submitted by {version.submitted_by} •{' '}
                {new Date(version.submitted_at).toLocaleDateString()}
              </div>
            )}

            {/* P18: Bulk quote link to Sample */}
            {version.cloned_from && (
              <div className="flex items-center gap-1 text-xs text-purple-600 mt-1">
                <Link2 className="h-3 w-3" />
                <span>From Sample Quote</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header + Tabs */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Costing Versions</h2>
        <Button onClick={handleCreateNew}>
          <Plus className="mr-2 h-4 w-4" />
          New Version
        </Button>
      </div>

      <Tabs value={selectedType} onValueChange={(v) => setSelectedType(v as CostingType)}>
        <TabsList>
          <TabsTrigger value="sample">Sample Costing</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Costing</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedType} className="mt-6">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-600">
              Failed to load costing versions
            </div>
          )}

          {versions && versions.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="mb-4">No {selectedType} costing versions yet</p>
              <Button onClick={handleCreateNew} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Create First Version
              </Button>
            </div>
          )}

          {versions && versions.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {versions
                .sort((a, b) => b.version_no - a.version_no) // Latest first
                .map((version) => renderVersionCard(version))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail Drawer */}
      <CostingDetailDrawer
        costSheetId={selectedCostSheetId}
        styleId={styleId}
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
      />
    </div>
  );
}
