/**
 * Costing Dialogs - Phase 2-3
 *
 * Three dialogs for costing workflow:
 * 1. CreateCostSheetDialog - Create new version
 * 2. CloneCostSheetDialog - Clone existing version
 * 3. EditSummaryDialog - Edit summary fields (labor, overhead, margin)
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

import {
  useCreateCostSheetVersion,
  useCloneCostSheetVersion,
  useUpdateCostSheetSummary,
  // P18: Sample → Bulk
  useCreateBulkQuote,
  useAcceptCostSheetVersion,
} from '@/lib/hooks/useCostingPhase23';
import type {
  CreateCostSheetPayload,
  CloneCostSheetPayload,
  UpdateCostSheetSummaryPayload,
  CostingType,
} from '@/types/costing-phase23';
import type { CreateBulkQuotePayload } from '@/lib/api/costing-phase23';

// ========================================
// 1. Create Cost Sheet Dialog
// ========================================

export interface CreateCostSheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  styleId: string;
  usageScenarioId?: string; // Optional pre-selected scenario
}

export function CreateCostSheetDialog({
  open,
  onOpenChange,
  styleId,
  usageScenarioId,
}: CreateCostSheetDialogProps) {
  const form = useForm<CreateCostSheetPayload>({
    defaultValues: {
      style_id: styleId,
      costing_type: 'sample',
      usage_scenario_id: usageScenarioId || '',
      labor_cost: '10.00',
      overhead_cost: '5.00',
      margin_pct: '30.00',
      change_reason: '',
    },
  });

  const createMutation = useCreateCostSheetVersion(styleId);

  const onSubmit = async (data: CreateCostSheetPayload) => {
    try {
      await createMutation.mutateAsync(data);
      onOpenChange(false);
      form.reset();
    } catch (err) {
      console.error('Create failed:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Costing Version</DialogTitle>
          <DialogDescription>
            Generate a new cost sheet from a usage scenario
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Costing Type */}
          <div>
            <Label htmlFor="costing_type">Costing Type</Label>
            <Select
              value={form.watch('costing_type')}
              onValueChange={(value) => form.setValue('costing_type', value as CostingType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sample">Sample</SelectItem>
                <SelectItem value="bulk">Bulk</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Usage Scenario (TODO: should be a searchable dropdown) */}
          <div>
            <Label htmlFor="usage_scenario_id">Usage Scenario ID</Label>
            <Input
              id="usage_scenario_id"
              {...form.register('usage_scenario_id', { required: true })}
              placeholder="e.g., uuid-here"
            />
            <p className="text-xs text-gray-500 mt-1">
              Select a usage scenario to snapshot
            </p>
          </div>

          {/* Labor Cost */}
          <div>
            <Label htmlFor="labor_cost">Labor Cost ($)</Label>
            <Input
              id="labor_cost"
              type="number"
              step="0.01"
              {...form.register('labor_cost')}
            />
          </div>

          {/* Overhead Cost */}
          <div>
            <Label htmlFor="overhead_cost">Overhead Cost ($)</Label>
            <Input
              id="overhead_cost"
              type="number"
              step="0.01"
              {...form.register('overhead_cost')}
            />
          </div>

          {/* Margin % */}
          <div>
            <Label htmlFor="margin_pct">Margin (%)</Label>
            <Input
              id="margin_pct"
              type="number"
              step="0.1"
              {...form.register('margin_pct')}
            />
          </div>

          {/* Change Reason */}
          <div>
            <Label htmlFor="change_reason">Change Reason</Label>
            <Textarea
              id="change_reason"
              {...form.register('change_reason')}
              placeholder="e.g., Initial costing for Q1 2025"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Version
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ========================================
// 2. Clone Cost Sheet Dialog
// ========================================

export interface CloneCostSheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  styleId: string;
  costSheetId: string;
}

export function CloneCostSheetDialog({
  open,
  onOpenChange,
  styleId,
  costSheetId,
}: CloneCostSheetDialogProps) {
  const form = useForm<CloneCostSheetPayload>({
    defaultValues: {
      change_reason: '',
    },
  });

  const cloneMutation = useCloneCostSheetVersion(styleId);

  const onSubmit = async (data: CloneCostSheetPayload) => {
    try {
      await cloneMutation.mutateAsync({ costSheetId, payload: data });
      onOpenChange(false);
      form.reset();
    } catch (err) {
      console.error('Clone failed:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Clone Costing Version</DialogTitle>
          <DialogDescription>
            Create a new version based on the current one
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* New Usage Scenario (Optional) */}
          <div>
            <Label htmlFor="usage_scenario_id">New Usage Scenario (Optional)</Label>
            <Input
              id="usage_scenario_id"
              {...form.register('usage_scenario_id')}
              placeholder="Leave blank to use same scenario"
            />
          </div>

          {/* Labor Cost Override */}
          <div>
            <Label htmlFor="labor_cost">Labor Cost (Optional)</Label>
            <Input
              id="labor_cost"
              type="number"
              step="0.01"
              {...form.register('labor_cost')}
              placeholder="Leave blank to keep current"
            />
          </div>

          {/* Overhead Cost Override */}
          <div>
            <Label htmlFor="overhead_cost">Overhead Cost (Optional)</Label>
            <Input
              id="overhead_cost"
              type="number"
              step="0.01"
              {...form.register('overhead_cost')}
              placeholder="Leave blank to keep current"
            />
          </div>

          {/* Margin % Override */}
          <div>
            <Label htmlFor="margin_pct">Margin % (Optional)</Label>
            <Input
              id="margin_pct"
              type="number"
              step="0.1"
              {...form.register('margin_pct')}
              placeholder="Leave blank to keep current"
            />
          </div>

          {/* Change Reason */}
          <div>
            <Label htmlFor="change_reason">Change Reason *</Label>
            <Textarea
              id="change_reason"
              {...form.register('change_reason', { required: true })}
              placeholder="e.g., Client requested margin adjustment"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={cloneMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={cloneMutation.isPending}>
              {cloneMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Clone Version
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ========================================
// 3. Edit Summary Dialog
// ========================================

export interface EditSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  styleId: string;
  costSheetId: string;
  initialValues?: {
    labor_cost?: string;
    overhead_cost?: string;
    freight_cost?: string;
    packing_cost?: string;
    margin_pct?: string;
  };
}

export function EditSummaryDialog({
  open,
  onOpenChange,
  styleId,
  costSheetId,
  initialValues,
}: EditSummaryDialogProps) {
  const form = useForm<UpdateCostSheetSummaryPayload>({
    defaultValues: initialValues || {},
  });

  const updateMutation = useUpdateCostSheetSummary(styleId);

  // Update form when initialValues change
  useEffect(() => {
    if (initialValues) {
      form.reset(initialValues);
    }
  }, [initialValues, form]);

  const onSubmit = async (data: UpdateCostSheetSummaryPayload) => {
    try {
      await updateMutation.mutateAsync({ costSheetId, payload: data });
      onOpenChange(false);
    } catch (err) {
      console.error('Update failed:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Cost Summary</DialogTitle>
          <DialogDescription>
            Update summary fields (Draft only)
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Labor Cost */}
          <div>
            <Label htmlFor="labor_cost">Labor Cost ($)</Label>
            <Input
              id="labor_cost"
              type="number"
              step="0.01"
              {...form.register('labor_cost')}
            />
          </div>

          {/* Overhead Cost */}
          <div>
            <Label htmlFor="overhead_cost">Overhead Cost ($)</Label>
            <Input
              id="overhead_cost"
              type="number"
              step="0.01"
              {...form.register('overhead_cost')}
            />
          </div>

          {/* Freight Cost */}
          <div>
            <Label htmlFor="freight_cost">Freight Cost ($)</Label>
            <Input
              id="freight_cost"
              type="number"
              step="0.01"
              {...form.register('freight_cost')}
            />
          </div>

          {/* Packing Cost */}
          <div>
            <Label htmlFor="packing_cost">Packing Cost ($)</Label>
            <Input
              id="packing_cost"
              type="number"
              step="0.01"
              {...form.register('packing_cost')}
            />
          </div>

          {/* Margin % */}
          <div>
            <Label htmlFor="margin_pct">Margin (%)</Label>
            <Input
              id="margin_pct"
              type="number"
              step="0.1"
              {...form.register('margin_pct')}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ========================================
// 4. P18: Create Bulk Quote Dialog
// ========================================

export interface CreateBulkQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  styleId: string;
  sampleCostSheetId: string;
  sampleVersion?: number;
  onSuccess?: () => void;
}

export function CreateBulkQuoteDialog({
  open,
  onOpenChange,
  styleId,
  sampleCostSheetId,
  sampleVersion,
  onSuccess,
}: CreateBulkQuoteDialogProps) {
  const form = useForm<CreateBulkQuotePayload>({
    defaultValues: {
      expected_quantity: 1000,
      copy_labor_overhead: true,
      change_reason: '',
    },
  });

  const createBulkQuoteMutation = useCreateBulkQuote(styleId);

  const onSubmit = async (data: CreateBulkQuotePayload) => {
    try {
      await createBulkQuoteMutation.mutateAsync({
        sampleCostSheetId,
        payload: data,
      });
      onOpenChange(false);
      form.reset();
      onSuccess?.();
    } catch (err) {
      console.error('Create Bulk Quote failed:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Bulk Quote</DialogTitle>
          <DialogDescription>
            Create a bulk production quote from Sample Costing v{sampleVersion || '?'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Expected Quantity */}
          <div>
            <Label htmlFor="expected_quantity">Expected Production Quantity</Label>
            <Input
              id="expected_quantity"
              type="number"
              min="1"
              {...form.register('expected_quantity', { valueAsNumber: true })}
            />
            <p className="text-xs text-gray-500 mt-1">
              Used for volume-based pricing adjustments
            </p>
          </div>

          {/* Copy Labor/Overhead */}
          <div className="flex items-center gap-2">
            <input
              id="copy_labor_overhead"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300"
              {...form.register('copy_labor_overhead')}
            />
            <Label htmlFor="copy_labor_overhead" className="font-normal">
              Copy labor and overhead costs from sample
            </Label>
          </div>

          {/* Change Reason */}
          <div>
            <Label htmlFor="change_reason">Notes / Change Reason</Label>
            <Textarea
              id="change_reason"
              {...form.register('change_reason')}
              placeholder="e.g., Bulk quote for PO #12345"
              rows={2}
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm">
            <p className="text-blue-800">
              This will create a new <strong>Bulk</strong> costing version linked to the
              accepted Sample quote. You can then adjust prices for production volume.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createBulkQuoteMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createBulkQuoteMutation.isPending}>
              {createBulkQuoteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Bulk Quote
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
