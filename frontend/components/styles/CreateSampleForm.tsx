"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CreateSampleFormProps {
  revisionId: string;
  bomVerified: number;
  bomTotal: number;
  specVerified: number;
  specTotal: number;
  onSubmit: (data: {
    type: string;
    quantity: number;
    priority: string;
  }) => Promise<void>;
  isSubmitting: boolean;
}

export function CreateSampleForm({
  revisionId,
  bomVerified,
  bomTotal,
  specVerified,
  specTotal,
  onSubmit,
  isSubmitting,
}: CreateSampleFormProps) {
  const [type, setType] = useState("proto");
  const [quantity, setQuantity] = useState(2);
  const [priority, setPriority] = useState("normal");

  const hasWarnings =
    (bomTotal > 0 && bomVerified < bomTotal) ||
    (specTotal > 0 && specVerified < specTotal);

  const handleCreate = async () => {
    await onSubmit({ type, quantity, priority });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-500">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="proto">Proto</SelectItem>
              <SelectItem value="fit">Fit</SelectItem>
              <SelectItem value="sales">Sales</SelectItem>
              <SelectItem value="pp">PP (Pre-production)</SelectItem>
              <SelectItem value="top">TOP</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-slate-500">Quantity</Label>
          <Input
            type="number"
            min={1}
            max={100}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value) || 1)}
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-slate-500">Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {hasWarnings && (
        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded">
          {bomTotal > 0 && bomVerified < bomTotal
            ? `${bomTotal - bomVerified} BOM items not verified. `
            : ""}
          {specTotal > 0 && specVerified < specTotal
            ? `${specTotal - specVerified} Spec items not verified. `
            : ""}
          MWO will still be generated.
        </p>
      )}

      <Button
        onClick={handleCreate}
        disabled={isSubmitting}
        className="w-full"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Creating Sample & Generating MWO...
          </>
        ) : (
          "Create Sample & Generate MWO"
        )}
      </Button>
    </div>
  );
}
