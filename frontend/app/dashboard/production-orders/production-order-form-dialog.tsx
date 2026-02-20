"use client";

import { useEffect, useState } from "react";
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
  useCreateProductionOrder,
  useUpdateProductionOrder,
} from "@/lib/hooks/useProductionOrders";
import { useStyles } from "@/lib/hooks/useStyles";
import type { ProductionOrder, CreateProductionOrderPayload, SizeBreakdown } from "@/lib/types/production-order";
import { Plus, X } from "lucide-react";

interface ProductionOrderFormDialogProps {
  open: boolean;
  onClose: () => void;
  productionOrder?: ProductionOrder | null;
}

interface FormData {
  po_number: string;
  order_number: string;
  customer: string;
  customer_po_ref: string;
  style_revision: string;
  unit_price: string;
  currency: string;
  order_date: string;
  delivery_date: string;
  notes: string;
}

const COMMON_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];

export function ProductionOrderFormDialog({
  open,
  onClose,
  productionOrder,
}: ProductionOrderFormDialogProps) {
  const isEditing = !!productionOrder;
  const createOrder = useCreateProductionOrder();
  const updateOrder = useUpdateProductionOrder();
  const { data: stylesData } = useStyles({ page_size: 100 });

  // Size breakdown state
  const [sizeBreakdown, setSizeBreakdown] = useState<SizeBreakdown>({});
  const [customSize, setCustomSize] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      po_number: "",
      order_number: "",
      customer: "",
      customer_po_ref: "",
      style_revision: "",
      unit_price: "",
      currency: "USD",
      order_date: new Date().toISOString().split("T")[0],
      delivery_date: "",
      notes: "",
    },
  });

  const unitPrice = watch("unit_price");

  // Calculate total quantity
  const totalQuantity = Object.values(sizeBreakdown).reduce((sum, qty) => sum + (qty || 0), 0);
  const totalAmount = totalQuantity * (parseFloat(unitPrice) || 0);

  // Reset form when productionOrder changes
  useEffect(() => {
    if (open) {
      if (productionOrder) {
        reset({
          po_number: productionOrder.po_number,
          order_number: productionOrder.order_number,
          customer: productionOrder.customer,
          customer_po_ref: productionOrder.customer_po_ref || "",
          style_revision: productionOrder.style_revision,
          unit_price: productionOrder.unit_price.toString(),
          currency: productionOrder.currency,
          order_date: productionOrder.order_date,
          delivery_date: productionOrder.delivery_date,
          notes: productionOrder.notes || "",
        });
        setSizeBreakdown(productionOrder.size_breakdown || {});
      } else {
        reset({
          po_number: "",
          order_number: generateOrderNumber(),
          customer: "",
          customer_po_ref: "",
          style_revision: "",
          unit_price: "",
          currency: "USD",
          order_date: new Date().toISOString().split("T")[0],
          delivery_date: "",
          notes: "",
        });
        setSizeBreakdown({});
      }
    }
  }, [open, productionOrder, reset]);

  const handleSizeChange = (size: string, value: string) => {
    const qty = parseInt(value) || 0;
    setSizeBreakdown((prev) => ({
      ...prev,
      [size]: qty,
    }));
  };

  const addSize = (size: string) => {
    if (size && !(size in sizeBreakdown)) {
      setSizeBreakdown((prev) => ({
        ...prev,
        [size]: 0,
      }));
    }
  };

  const removeSize = (size: string) => {
    setSizeBreakdown((prev) => {
      const newBreakdown = { ...prev };
      delete newBreakdown[size];
      return newBreakdown;
    });
  };

  const addCustomSize = () => {
    if (customSize.trim()) {
      addSize(customSize.trim().toUpperCase());
      setCustomSize("");
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      const payload: CreateProductionOrderPayload = {
        po_number: data.po_number,
        order_number: data.order_number,
        customer: data.customer,
        customer_po_ref: data.customer_po_ref || undefined,
        style_revision: data.style_revision,
        total_quantity: totalQuantity,
        size_breakdown: sizeBreakdown,
        unit_price: parseFloat(data.unit_price) || 0,
        total_amount: totalAmount,
        currency: data.currency,
        order_date: data.order_date,
        delivery_date: data.delivery_date,
        notes: data.notes || undefined,
      };

      if (isEditing && productionOrder) {
        await updateOrder.mutateAsync({
          id: productionOrder.id,
          data: payload,
        });
      } else {
        await createOrder.mutateAsync(payload);
      }

      onClose();
    } catch (error) {
      console.error("Failed to save order:", error);
    }
  };

  // Get style revisions from styles
  const styleRevisions = stylesData?.results?.flatMap((style) =>
    (style.revisions || []).map((rev) => ({
      id: rev.id,
      label: `${style.style_number} - ${rev.revision_label || "v1"}`,
    }))
  ) || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Production Order" : "New Production Order"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="po_number">
                Customer PO <span className="text-red-500">*</span>
              </Label>
              <Input
                id="po_number"
                {...register("po_number", { required: "Customer PO is required" })}
                placeholder="Customer PO number"
              />
              {errors.po_number && (
                <p className="text-xs text-red-500">{errors.po_number.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="order_number">
                Order Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="order_number"
                {...register("order_number", { required: "Order number is required" })}
                placeholder="PROD-2601-0001"
              />
              {errors.order_number && (
                <p className="text-xs text-red-500">{errors.order_number.message}</p>
              )}
            </div>
          </div>

          {/* Customer */}
          <div className="space-y-2">
            <Label htmlFor="customer">
              Customer <span className="text-red-500">*</span>
            </Label>
            <Input
              id="customer"
              {...register("customer", { required: "Customer is required" })}
              placeholder="Customer name"
            />
            {errors.customer && (
              <p className="text-xs text-red-500">{errors.customer.message}</p>
            )}
          </div>

          {/* Style Revision */}
          <div className="space-y-2">
            <Label htmlFor="style_revision">
              Style <span className="text-red-500">*</span>
            </Label>
            <select
              id="style_revision"
              {...register("style_revision", { required: "Style is required" })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">Select style...</option>
              {styleRevisions.map((rev) => (
                <option key={rev.id} value={rev.id}>
                  {rev.label}
                </option>
              ))}
            </select>
            {errors.style_revision && (
              <p className="text-xs text-red-500">{errors.style_revision.message}</p>
            )}
          </div>

          {/* Size Breakdown */}
          <div className="space-y-2">
            <Label>
              Size Breakdown <span className="text-red-500">*</span>
            </Label>
            <div className="border rounded-lg p-4 space-y-4">
              {/* Common sizes buttons */}
              <div className="flex flex-wrap gap-2">
                {COMMON_SIZES.filter((s) => !(s in sizeBreakdown)).map((size) => (
                  <Button
                    key={size}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addSize(size)}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {size}
                  </Button>
                ))}
              </div>

              {/* Custom size input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Custom size (e.g., 2XL)"
                  value={customSize}
                  onChange={(e) => setCustomSize(e.target.value)}
                  className="w-32"
                />
                <Button type="button" variant="outline" size="sm" onClick={addCustomSize}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Size inputs */}
              {Object.keys(sizeBreakdown).length > 0 ? (
                <div className="grid grid-cols-4 gap-3">
                  {Object.entries(sizeBreakdown).map(([size, qty]) => (
                    <div key={size} className="flex items-center gap-2">
                      <Label className="w-12 text-center font-medium">{size}</Label>
                      <Input
                        type="number"
                        min="0"
                        value={qty}
                        onChange={(e) => handleSizeChange(size, e.target.value)}
                        className="w-20"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSize(size)}
                        className="p-1"
                      >
                        <X className="w-4 h-4 text-slate-400" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Click on sizes above to add them to the breakdown.
                </p>
              )}

              {/* Total */}
              <div className="flex justify-end pt-2 border-t">
                <span className="text-sm font-medium">
                  Total Quantity: <span className="text-lg text-blue-600">{totalQuantity}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit_price">
                Unit Price <span className="text-red-500">*</span>
              </Label>
              <Input
                id="unit_price"
                type="number"
                step="0.01"
                min="0"
                {...register("unit_price", { required: "Unit price is required" })}
                placeholder="0.00"
              />
              {errors.unit_price && (
                <p className="text-xs text-red-500">{errors.unit_price.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                {...register("currency")}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="TWD">TWD</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Total Amount</Label>
              <div className="px-3 py-2 bg-slate-100 rounded-md text-lg font-bold">
                ${totalAmount.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="order_date">
                Order Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="order_date"
                type="date"
                {...register("order_date", { required: "Order date is required" })}
              />
              {errors.order_date && (
                <p className="text-xs text-red-500">{errors.order_date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="delivery_date">
                Delivery Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="delivery_date"
                type="date"
                {...register("delivery_date", { required: "Delivery date is required" })}
              />
              {errors.delivery_date && (
                <p className="text-xs text-red-500">{errors.delivery_date.message}</p>
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
            <Button type="submit" disabled={isSubmitting || totalQuantity === 0}>
              {isSubmitting
                ? "Saving..."
                : isEditing
                ? "Update Order"
                : "Create Order"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function generateOrderNumber(): string {
  const now = new Date();
  const yymm = `${String(now.getFullYear()).slice(-2)}${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `PROD-${yymm}-${random}`;
}
