"use client";

/**
 * CreateSampleRunDialog Component
 * Dialog for creating a new sample run
 */

import { useState } from 'react';
import { CreateSampleRunPayload, SampleRunType } from '@/types/samples';
import { SampleRunTypeLabels } from '@/types/samples';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface CreateSampleRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sampleRequestId: string;
  onCreate: (payload: CreateSampleRunPayload) => void;
  isCreating: boolean;
}

export function CreateSampleRunDialog({
  open,
  onOpenChange,
  sampleRequestId,
  onCreate,
  isCreating,
}: CreateSampleRunDialogProps) {
  const [formData, setFormData] = useState<CreateSampleRunPayload>({
    sample_request: sampleRequestId,
    run_type: 'proto',
    quantity: 1,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(formData);
  };

  const handleClose = () => {
    if (!isCreating) {
      onOpenChange(false);
      // Reset form
      setFormData({
        sample_request: sampleRequestId,
        run_type: 'proto',
        quantity: 1,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Sample Run</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="run_type">Run Type</Label>
            <Select
              value={formData.run_type}
              onValueChange={(value) =>
                setFormData({ ...formData, run_type: value as SampleRunType })
              }
            >
              <SelectTrigger id="run_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="proto">{SampleRunTypeLabels.proto}</SelectItem>
                <SelectItem value="fit">{SampleRunTypeLabels.fit}</SelectItem>
                <SelectItem value="sales">{SampleRunTypeLabels.sales}</SelectItem>
                <SelectItem value="photo">{SampleRunTypeLabels.photo}</SelectItem>
                <SelectItem value="other">{SampleRunTypeLabels.other}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={formData.quantity}
              onChange={(e) =>
                setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })
              }
            />
          </div>

          <div>
            <Label htmlFor="target_due_date">Target Due Date (Optional)</Label>
            <Input
              id="target_due_date"
              type="date"
              value={formData.target_due_date || ''}
              onChange={(e) =>
                setFormData({ ...formData, target_due_date: e.target.value || undefined })
              }
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes or special instructions..."
              rows={3}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value || undefined })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isCreating}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Run
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
