/**
 * Actuals Tab Component
 * Record and display actual costs and usage data
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SampleRun, SampleActuals } from '@/types/samples';
import { useUpdateSampleActuals } from '@/lib/hooks/useSamples';
import { Save, AlertCircle, CheckCircle2, Loader2, DollarSign, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface ActualsTabProps {
  run: SampleRun;
  actuals?: SampleActuals;
  isLoading?: boolean;
}

export function ActualsTab({ run, actuals, isLoading }: ActualsTabProps) {
  const updateActualsMutation = useUpdateSampleActuals(run.id);

  // Form state
  const [formData, setFormData] = useState({
    labor_minutes: actuals?.labor_minutes || 0,
    labor_cost: actuals?.labor_cost || 0,
    overhead_cost: actuals?.overhead_cost || 0,
    shipping_cost: actuals?.shipping_cost || 0,
    rework_cost: actuals?.rework_cost || 0,
    waste_pct_actual: actuals?.waste_pct_actual || 0,
    issues_notes: actuals?.issues_notes || '',
  });

  // Update form when actuals data changes
  useEffect(() => {
    if (actuals) {
      setFormData({
        labor_minutes: actuals.labor_minutes || 0,
        labor_cost: actuals.labor_cost || 0,
        overhead_cost: actuals.overhead_cost || 0,
        shipping_cost: actuals.shipping_cost || 0,
        rework_cost: actuals.rework_cost || 0,
        waste_pct_actual: actuals.waste_pct_actual || 0,
        issues_notes: actuals.issues_notes || '',
      });
    }
  }, [actuals]);

  // Handle input change
  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Handle save
  const handleSave = async () => {
    if (!actuals?.id) {
      alert('No actuals record found. Cannot update.');
      return;
    }

    try {
      await updateActualsMutation.mutateAsync({
        id: actuals.id,
        payload: formData,
      });
      alert('Actual costs updated successfully');
    } catch (error) {
      alert('Failed to update actual costs');
    }
  };

  // Calculate total actual cost
  const totalActualCost =
    (formData.labor_cost || 0) +
    (formData.overhead_cost || 0) +
    (formData.shipping_cost || 0) +
    (formData.rework_cost || 0);

  // Check if sample is done
  const canRecordActuals =
    run.status === 'sample_done' ||
    run.status === 'actuals_recorded' ||
    run.status === 'costing_generated';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Alert */}
      {!canRecordActuals ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Actuals can only be recorded after the sample is marked as done. Current status:{' '}
            <strong>{run.status}</strong>
          </AlertDescription>
        </Alert>
      ) : actuals ? (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Actuals recorded by {actuals.recorded_by || 'Unknown'} on{' '}
            {actuals.recorded_at
              ? format(new Date(actuals.recorded_at), 'MMM dd, yyyy HH:mm')
              : 'Unknown date'}
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Actual Costs Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Actual Costs</CardTitle>
            {actuals && (
              <Button
                onClick={handleSave}
                disabled={!canRecordActuals || updateActualsMutation.isPending}
                size="sm"
              >
                {updateActualsMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Changes
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Labor Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4" />
              Labor
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="labor_minutes">Labor Minutes</Label>
                <Input
                  id="labor_minutes"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.labor_minutes || ''}
                  onChange={(e) => handleInputChange('labor_minutes', parseFloat(e.target.value) || 0)}
                  disabled={!canRecordActuals}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="labor_cost">Labor Cost ($)</Label>
                <Input
                  id="labor_cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.labor_cost || ''}
                  onChange={(e) => handleInputChange('labor_cost', parseFloat(e.target.value) || 0)}
                  disabled={!canRecordActuals}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Other Costs Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="h-4 w-4" />
              Other Costs
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="overhead_cost">Overhead Cost ($)</Label>
                <Input
                  id="overhead_cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.overhead_cost || ''}
                  onChange={(e) => handleInputChange('overhead_cost', parseFloat(e.target.value) || 0)}
                  disabled={!canRecordActuals}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shipping_cost">Shipping Cost ($)</Label>
                <Input
                  id="shipping_cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.shipping_cost || ''}
                  onChange={(e) => handleInputChange('shipping_cost', parseFloat(e.target.value) || 0)}
                  disabled={!canRecordActuals}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rework_cost">Rework Cost ($)</Label>
                <Input
                  id="rework_cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.rework_cost || ''}
                  onChange={(e) => handleInputChange('rework_cost', parseFloat(e.target.value) || 0)}
                  disabled={!canRecordActuals}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="waste_pct_actual">Actual Waste %</Label>
                <Input
                  id="waste_pct_actual"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.waste_pct_actual || ''}
                  onChange={(e) => handleInputChange('waste_pct_actual', parseFloat(e.target.value) || 0)}
                  disabled={!canRecordActuals}
                  placeholder="0.0"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Total Summary */}
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-900">Total Actual Cost</span>
              <span className="text-2xl font-bold text-blue-700">
                ${totalActualCost.toFixed(2)}
              </span>
            </div>
            <div className="text-xs text-blue-600 mt-1">
              Per piece: ${(totalActualCost / (run.quantity || 1)).toFixed(2)}
            </div>
          </div>

          <Separator />

          {/* Issues Notes */}
          <div className="space-y-2">
            <Label htmlFor="issues_notes">Issues / Notes</Label>
            <Textarea
              id="issues_notes"
              value={formData.issues_notes || ''}
              onChange={(e) => handleInputChange('issues_notes', e.target.value)}
              disabled={!canRecordActuals}
              placeholder="Record any issues, quality problems, or other notes..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actual Usage (Future Enhancement) */}
      <Card>
        <CardHeader>
          <CardTitle>Actual Material Usage</CardTitle>
        </CardHeader>
        <CardContent>
          {run.actual_usage ? (
            <div className="space-y-2">
              <div className="text-sm">
                Actual usage scenario ID: <code className="text-xs">{run.actual_usage}</code>
              </div>
              <p className="text-sm text-muted-foreground">
                This records the actual material consumption during production.
              </p>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-8">
              <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No actual usage data recorded yet.</p>
              <p className="text-xs mt-1">Future enhancement: Record actual material usage here.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
