"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreatePurchaseOrder,
  useUpdatePurchaseOrder,
} from "@/lib/hooks/usePurchaseOrders";
import { useSuppliers } from "@/lib/hooks/useSuppliers";
import type { PurchaseOrder, POType, CreatePOPayload } from "@/lib/types/purchase-order";
import { PO_TYPE_OPTIONS } from "@/lib/types/purchase-order";

interface POFormDialogProps {
  open: boolean;
  onClose: () => void;
  purchaseOrder?: PurchaseOrder | null;
}

interface FormData {
  po_number: string;
  po_type: POType;
  supplier: string;
  po_date: string;
  expected_delivery: string;
  notes: string;
}

export function POFormDialog({
  open,
  onClose,
  purchaseOrder,
}: POFormDialogProps) {
  const isEditing = !!purchaseOrder;
  const createPO = useCreatePurchaseOrder();
  const updatePO = useUpdatePurchaseOrder();
  const { data: suppliersData } = useSuppliers({ page_size: 100, is_active: true });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      po_number: "",
      po_type: "production",
      supplier: "",
      po_date: new Date().toISOString().split("T")[0],
      expected_delivery: "",
      notes: "",
    },
  });

  // Reset form when purchaseOrder changes
  useEffect(() => {
    if (open) {
      if (purchaseOrder) {
        reset({
          po_number: purchaseOrder.po_number,
          po_type: purchaseOrder.po_type,
          supplier: purchaseOrder.supplier,
          po_date: purchaseOrder.po_date,
          expected_delivery: purchaseOrder.expected_delivery,
          notes: purchaseOrder.notes || "",
        });
      } else {
        reset({
          po_number: generatePONumber(),
          po_type: "production",
          supplier: "",
          po_date: new Date().toISOString().split("T")[0],
          expected_delivery: "",
          notes: "",
        });
      }
    }
  }, [open, purchaseOrder, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      const payload: CreatePOPayload = {
        po_number: data.po_number,
        po_type: data.po_type,
        supplier: data.supplier,
        po_date: data.po_date,
        expected_delivery: data.expected_delivery,
        notes: data.notes || undefined,
      };

      if (isEditing && purchaseOrder) {
        await updatePO.mutateAsync({
          id: purchaseOrder.id,
          data: payload,
        });
      } else {
        await createPO.mutateAsync(payload);
      }

      onClose();
    } catch (error) {
      console.error("Failed to save PO:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Purchase Order" : "New Purchase Order"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* PO Number */}
          <div className="space-y-2">
            <Label htmlFor="po_number">
              PO Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="po_number"
              {...register("po_number", { required: "PO Number is required" })}
              placeholder="PO-2601-0001"
            />
            {errors.po_number && (
              <p className="text-xs text-red-500">{errors.po_number.message}</p>
            )}
          </div>

          {/* PO Type */}
          <div className="space-y-2">
            <Label htmlFor="po_type">
              PO Type <span className="text-red-500">*</span>
            </Label>
            <select
              id="po_type"
              {...register("po_type", { required: true })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              {PO_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label_zh} ({opt.label})
                </option>
              ))}
            </select>
          </div>

          {/* Supplier */}
          <div className="space-y-2">
            <Label htmlFor="supplier">
              Supplier <span className="text-red-500">*</span>
            </Label>
            <select
              id="supplier"
              {...register("supplier", { required: "Supplier is required" })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">Select supplier...</option>
              {suppliersData?.results?.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.name} ({sup.supplier_code})
                </option>
              ))}
            </select>
            {errors.supplier && (
              <p className="text-xs text-red-500">{errors.supplier.message}</p>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="po_date">
                PO Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="po_date"
                type="date"
                {...register("po_date", { required: "PO Date is required" })}
              />
              {errors.po_date && (
                <p className="text-xs text-red-500">{errors.po_date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="expected_delivery">
                Expected Delivery <span className="text-red-500">*</span>
              </Label>
              <Input
                id="expected_delivery"
                type="date"
                {...register("expected_delivery", { required: "Expected delivery is required" })}
              />
              {errors.expected_delivery && (
                <p className="text-xs text-red-500">{errors.expected_delivery.message}</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Optional notes..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : isEditing
                ? "Update PO"
                : "Create PO"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function generatePONumber(): string {
  const now = new Date();
  const yymm = `${String(now.getFullYear()).slice(-2)}${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `PO-${yymm}-${random}`;
}
