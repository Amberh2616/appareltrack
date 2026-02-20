/**
 * CostingDetailDrawer Component - Phase 2-3
 *
 * Displays CostSheetVersion detail with:
 * - Header (version info, status, evidence)
 * - Summary Card (editable for Draft)
 * - Cost Lines Table (TanStack Table with inline edit)
 * - Actions (Save, Submit, Clone)
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2, AlertCircle, AlertTriangle, Copy, Edit, RefreshCw } from 'lucide-react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';

import { InlineEditCell } from './InlineEditCell';
import { SubmitCostSheetButton } from './SubmitCostSheetButton';
import { EditSummaryDialog, CreateBulkQuoteDialog } from './CostingDialogs';
import {
  useCostSheetVersionDetail,
  useUpdateCostLine,
  useAcceptCostSheetVersion,
  useRejectCostSheetVersion,
  useRefreshCostSheetSnapshot,
} from '@/lib/hooks/useCostingPhase23';
import type { CostLineV2 } from '@/types/costing-phase23';
import { cn } from '@/lib/utils';
import { CheckCircle, Package, XCircle } from 'lucide-react';

export interface CostingDetailDrawerProps {
  costSheetId: string | null;
  styleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CostingDetailDrawer({
  costSheetId,
  styleId,
  open,
  onOpenChange,
}: CostingDetailDrawerProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [isEditSummaryOpen, setIsEditSummaryOpen] = useState(false);
  const [isBulkQuoteDialogOpen, setIsBulkQuoteDialogOpen] = useState(false);

  // Fetch cost sheet detail
  const { data: costSheet, isLoading, error } = useCostSheetVersionDetail(costSheetId);

  // Mutations
  const updateLineMutation = useUpdateCostLine(costSheetId || '', styleId);
  const acceptMutation = useAcceptCostSheetVersion(styleId);
  const rejectMutation = useRejectCostSheetVersion(styleId);
  const refreshSnapshotMutation = useRefreshCostSheetSnapshot(styleId);

  // Handle refresh snapshot
  const handleRefreshSnapshot = async () => {
    if (!costSheetId) return;
    if (!window.confirm('確定要從 BOM 重新載入用量和單價嗎？這將覆蓋當前的調整值。')) return;
    try {
      await refreshSnapshotMutation.mutateAsync(costSheetId);
    } catch (err) {
      console.error('Refresh snapshot failed:', err);
      alert('刷新快照失敗：' + (err as Error).message);
    }
  };

  // Handle accept action
  const handleAccept = async () => {
    if (!costSheetId) return;
    try {
      await acceptMutation.mutateAsync(costSheetId);
    } catch (err) {
      console.error('Accept failed:', err);
    }
  };

  // Handle reject action
  const handleReject = async () => {
    if (!costSheetId) return;
    const reason = window.prompt('Enter rejection reason (optional):');
    try {
      await rejectMutation.mutateAsync({ costSheetId, reason: reason || undefined });
    } catch (err) {
      console.error('Reject failed:', err);
    }
  };

  // Determine button visibility
  const canAccept = costSheet?.status === 'submitted';
  const canCreateBulkQuote =
    costSheet?.costing_type === 'sample' &&
    (costSheet?.status === 'accepted' || costSheet?.status === 'submitted');

  // Status badge color
  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      draft: 'bg-blue-100 text-blue-800',
      submitted: 'bg-green-100 text-green-800',
      accepted: 'bg-purple-100 text-purple-800',
      rejected: 'bg-red-100 text-red-800',
      superseded: 'bg-gray-100 text-gray-600',
    };
    return variants[status] || 'bg-gray-100 text-gray-600';
  };

  // Handle cost line update
  const handleUpdateLine = async (lineId: string, field: 'consumption' | 'price', value: string) => {
    const patch =
      field === 'consumption'
        ? { consumption_adjusted: value }
        : { unit_price_adjusted: value };

    if (!costSheetId) return;

    // Pass csId and sId to avoid stale closure issues in mutation callbacks
    await updateLineMutation.mutateAsync({
      lineId,
      patch,
      csId: costSheetId,
      sId: styleId,
    });
  };

  // TanStack Table setup
  const columnHelper = createColumnHelper<CostLineV2>();

  const columns = [
    columnHelper.accessor('material_name', {
      header: 'Material',
      cell: (info) => (
        <div className="min-w-[150px]">
          <div className="font-medium">{info.getValue()}</div>
          {info.row.original.material_name_zh && (
            <div className="text-xs text-gray-500">{info.row.original.material_name_zh}</div>
          )}
        </div>
      ),
    }),
    columnHelper.accessor('category', {
      header: 'Category',
      cell: (info) => (
        <Badge variant="outline" className="capitalize">
          {info.getValue()}
        </Badge>
      ),
    }),
    columnHelper.accessor('consumption_snapshot', {
      header: 'Snapshot',
      cell: (info) => (
        <div className="text-right min-w-[100px]">
          <div className="font-mono text-sm">
            {parseFloat(info.getValue()).toFixed(4)}
          </div>
          <div className="text-xs text-gray-500">{info.row.original.consumption_unit}</div>
        </div>
      ),
    }),
    columnHelper.accessor('consumption_adjusted', {
      header: 'Adjusted',
      cell: (info) => {
        const line = info.row.original;
        const canEdit = costSheet?.can_edit || false;

        return (
          <div className="min-w-[120px]">
            <InlineEditCell
              value={info.getValue()}
              onSave={(newValue) => handleUpdateLine(line.id, 'consumption', newValue)}
              disabled={!canEdit}
              format="number"
            />
          </div>
        );
      },
    }),
    columnHelper.display({
      id: 'delta_pct',
      header: 'Δ%',
      cell: (info) => {
        const pct = info.row.original.delta_consumption_pct;
        if (pct === null || pct === 0) return <span className="text-gray-400">—</span>;

        return (
          <span
            className={cn(
              'font-mono text-sm',
              pct > 0 ? 'text-red-600' : 'text-green-600'
            )}
          >
            {pct > 0 ? '+' : ''}
            {pct.toFixed(2)}%
          </span>
        );
      },
    }),
    columnHelper.accessor('unit_price_adjusted', {
      header: 'Unit Price',
      cell: (info) => {
        const line = info.row.original;
        const canEdit = costSheet?.can_edit || false;

        return (
          <div className="min-w-[100px]">
            <InlineEditCell
              value={info.getValue()}
              onSave={(newValue) => handleUpdateLine(line.id, 'price', newValue)}
              disabled={!canEdit}
              format="currency"
            />
          </div>
        );
      },
    }),
    columnHelper.accessor('line_cost', {
      header: 'Line Cost',
      cell: (info) => (
        <div className="text-right font-semibold min-w-[100px]">
          ${parseFloat(info.getValue()).toFixed(2)}
        </div>
      ),
    }),
    columnHelper.display({
      id: 'adjusted_flag',
      header: '',
      cell: (info) => {
        const line = info.row.original;
        const isAdjusted = line.is_consumption_adjusted || line.is_price_adjusted;

        return isAdjusted ? (
          <span title={line.adjustment_reason || 'Manually adjusted'}>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </span>
        ) : null;
      },
    }),
  ];

  const table = useReactTable({
    data: costSheet?.cost_lines || [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <>
            <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full max-w-full sm:max-w-full overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <AlertCircle className="h-12 w-12 text-red-500" />
              <p className="text-red-600">Failed to load cost sheet detail</p>
            </div>
          )}

          {costSheet && (
            <>
              {/* Header */}
              <SheetHeader className="mb-6">
                <div className="flex items-center justify-between">
                  <SheetTitle>
                    {costSheet.costing_type === 'sample' ? 'Sample' : 'Bulk'} Costing v
                    {costSheet.version_no}
                  </SheetTitle>
                  <Badge className={getStatusBadge(costSheet.status)}>
                    {costSheet.status.toUpperCase()}
                  </Badge>
                </div>
                <SheetDescription>
                  <div className="text-sm space-y-1 mt-2">
                    <div>Created by {costSheet.created_by} • {new Date(costSheet.created_at).toLocaleDateString()}</div>
                    {costSheet.change_reason && (
                      <div className="text-gray-600 italic">"{costSheet.change_reason}"</div>
                    )}
                    {/* P18: Show link to source Sample quote for Bulk */}
                    {costSheet.cloned_from && costSheet.costing_type === 'bulk' && (
                      <div className="flex items-center gap-1 text-purple-600 mt-1">
                        <Package className="h-4 w-4" />
                        <span>Derived from Sample Quote</span>
                      </div>
                    )}
                  </div>
                </SheetDescription>
              </SheetHeader>

              {/* Summary Card */}
              <Card className="mb-6">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base">Cost Summary</CardTitle>
                  {costSheet.can_edit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditSummaryOpen(true)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500">Material Cost</div>
                      <div className="font-semibold text-lg">
                        ${parseFloat(costSheet.material_cost).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Labor</div>
                      <div className="font-semibold">
                        ${parseFloat(costSheet.labor_cost).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Overhead</div>
                      <div className="font-semibold">
                        ${parseFloat(costSheet.overhead_cost).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Margin</div>
                      <div className="font-semibold">{parseFloat(costSheet.margin_pct).toFixed(1)}%</div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <div className="text-gray-500 text-sm">Unit Price</div>
                    <div className="font-bold text-3xl text-blue-600">
                      ${parseFloat(costSheet.unit_price).toFixed(2)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cost Lines Table */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3">Cost Lines ({costSheet.cost_lines.length})</h3>
                <div className="border rounded-md overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <th
                              key={header.id}
                              className="px-3 py-2 text-left font-medium text-gray-600"
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody>
                      {table.getRowModel().rows.map((row) => (
                        <tr key={row.id} className="border-b hover:bg-gray-50">
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className="px-3 py-2">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {/* Submit button (Draft only) */}
                {costSheetId && costSheet?.status === 'draft' && (
                  <SubmitCostSheetButton
                    costSheetVersionId={costSheetId}
                    onSuccess={() => {
                      // Don't close drawer, let user see the new status
                    }}
                  />
                )}

                {/* Refresh Snapshot button (Draft only) */}
                {costSheetId && costSheet?.status === 'draft' && (
                  <Button
                    variant="outline"
                    onClick={handleRefreshSnapshot}
                    disabled={refreshSnapshotMutation.isPending}
                  >
                    {refreshSnapshotMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    刷新快照
                  </Button>
                )}

                {/* Accept button (Submitted only) */}
                {canAccept && (
                  <Button
                    onClick={handleAccept}
                    disabled={acceptMutation.isPending}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {acceptMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="mr-2 h-4 w-4" />
                    )}
                    Accept Quote
                  </Button>
                )}

                {/* Reject button (Submitted only) */}
                {canAccept && (
                  <Button
                    variant="outline"
                    onClick={handleReject}
                    disabled={rejectMutation.isPending}
                    className="border-red-600 text-red-600 hover:bg-red-50"
                  >
                    {rejectMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="mr-2 h-4 w-4" />
                    )}
                    Reject Quote
                  </Button>
                )}

                {/* Create Bulk Quote button (Sample + Accepted/Submitted) */}
                {canCreateBulkQuote && (
                  <Button
                    variant="outline"
                    onClick={() => setIsBulkQuoteDialogOpen(true)}
                    className="border-green-600 text-green-600 hover:bg-green-50"
                  >
                    <Package className="mr-2 h-4 w-4" />
                    Create Bulk Quote
                  </Button>
                )}

                {/* Clone button (always available) */}
                <Button variant="outline" disabled>
                  <Copy className="mr-2 h-4 w-4" />
                  Clone
                </Button>
              </div>

              {/* Status indicator for accepted */}
              {costSheet?.status === 'accepted' && (
                <div className="mt-4 bg-purple-50 border border-purple-200 rounded-md p-3 text-sm text-purple-800">
                  This quote has been <strong>accepted</strong>.
                  {costSheet.costing_type === 'sample' && (
                    <> You can now create a <strong>Bulk Quote</strong> for production.</>
                  )}
                </div>
              )}

              {/* P18: Price Evolution History for Bulk quotes */}
              {costSheet?.costing_type === 'bulk' && costSheet.cloned_from && (
                <Card className="mt-4 border-purple-200 bg-purple-50/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Package className="h-4 w-4 text-purple-600" />
                      Price Evolution: Sample → Bulk
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Source Sample Quote:</span>
                        <span className="font-mono text-xs">
                          {costSheet.cloned_from.substring(0, 8)}...
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Current Bulk Price:</span>
                        <span className="font-bold text-lg text-blue-600">
                          ${parseFloat(costSheet.unit_price).toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2 border-t pt-2">
                        This bulk quote was derived from an accepted sample quote.
                        The pricing may differ based on volume adjustments.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Edit Summary Dialog */}
      {costSheetId && (
        <EditSummaryDialog
          open={isEditSummaryOpen}
          onOpenChange={setIsEditSummaryOpen}
          costSheetId={costSheetId}
          styleId={styleId}
          initialValues={costSheet ? {
            labor_cost: costSheet.labor_cost,
            overhead_cost: costSheet.overhead_cost,
            margin_pct: costSheet.margin_pct,
          } : undefined}
        />
      )}

      {/* P18: Create Bulk Quote Dialog */}
      {costSheetId && (
        <CreateBulkQuoteDialog
          open={isBulkQuoteDialogOpen}
          onOpenChange={setIsBulkQuoteDialogOpen}
          styleId={styleId}
          sampleCostSheetId={costSheetId}
          sampleVersion={costSheet?.version_no}
          onSuccess={() => {
            // Optionally close the drawer or navigate to Bulk tab
            onOpenChange(false);
          }}
        />
      )}
    </>
  );
}
