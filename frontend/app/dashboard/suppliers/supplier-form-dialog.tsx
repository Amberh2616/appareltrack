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
import { useCreateSupplier, useUpdateSupplier } from "@/lib/hooks/useSuppliers";
import type { Supplier, CreateSupplierPayload, SupplierType } from "@/lib/types/supplier";
import { SUPPLIER_TYPE_OPTIONS } from "@/lib/types/supplier";

interface SupplierFormDialogProps {
  open: boolean;
  onClose: () => void;
  supplier?: Supplier | null;
}

interface FormData {
  name: string;
  supplier_code: string;
  supplier_type: SupplierType;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  payment_terms: string;
  lead_time_days: string;
  notes: string;
  is_active: boolean;
}

export function SupplierFormDialog({
  open,
  onClose,
  supplier,
}: SupplierFormDialogProps) {
  const isEditing = !!supplier;
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      name: "",
      supplier_code: "",
      supplier_type: "fabric",
      contact_person: "",
      email: "",
      phone: "",
      address: "",
      payment_terms: "",
      lead_time_days: "",
      notes: "",
      is_active: true,
    },
  });

  // Reset form when supplier changes
  useEffect(() => {
    if (supplier) {
      reset({
        name: supplier.name,
        supplier_code: supplier.supplier_code || "",
        supplier_type: supplier.supplier_type,
        contact_person: supplier.contact_person || "",
        email: supplier.email || "",
        phone: supplier.phone || "",
        address: supplier.address || "",
        payment_terms: supplier.payment_terms || "",
        lead_time_days: supplier.lead_time_days?.toString() || "",
        notes: supplier.notes || "",
        is_active: supplier.is_active,
      });
    } else {
      reset({
        name: "",
        supplier_code: "",
        supplier_type: "fabric",
        contact_person: "",
        email: "",
        phone: "",
        address: "",
        payment_terms: "",
        lead_time_days: "",
        notes: "",
        is_active: true,
      });
    }
  }, [supplier, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      const payload: CreateSupplierPayload = {
        name: data.name,
        supplier_code: data.supplier_code || undefined,
        supplier_type: data.supplier_type,
        contact_person: data.contact_person || undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        payment_terms: data.payment_terms || undefined,
        lead_time_days: data.lead_time_days
          ? parseInt(data.lead_time_days)
          : undefined,
        notes: data.notes || undefined,
      };

      if (isEditing && supplier) {
        await updateSupplier.mutateAsync({
          id: supplier.id,
          data: { ...payload, is_active: data.is_active },
        });
      } else {
        await createSupplier.mutateAsync(payload);
      }

      onClose();
    } catch (error) {
      console.error("Failed to save supplier:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Supplier" : "New Supplier"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                {...register("name", { required: "Name is required" })}
                placeholder="Supplier name"
              />
              {errors.name && (
                <p className="text-xs text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier_code">Supplier Code</Label>
              <Input
                id="supplier_code"
                {...register("supplier_code")}
                placeholder="e.g. SUP-001"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier_type">
                Type <span className="text-red-500">*</span>
              </Label>
              <select
                id="supplier_type"
                {...register("supplier_type", { required: true })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              >
                {SUPPLIER_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label_zh} ({opt.label})
                  </option>
                ))}
              </select>
            </div>

            {isEditing && (
              <div className="space-y-2">
                <Label htmlFor="is_active">Status</Label>
                <select
                  id="is_active"
                  {...register("is_active")}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            )}
          </div>

          {/* Contact Info */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-slate-700 mb-4">
              Contact Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_person">Contact Person</Label>
                <Input
                  id="contact_person"
                  {...register("contact_person")}
                  placeholder="Contact name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  {...register("phone")}
                  placeholder="Phone number"
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...register("email")}
                  placeholder="email@example.com"
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  {...register("address")}
                  placeholder="Full address"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Business Terms */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-slate-700 mb-4">
              Business Terms
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="payment_terms">Payment Terms</Label>
                <Input
                  id="payment_terms"
                  {...register("payment_terms")}
                  placeholder="e.g. Net 30"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lead_time_days">Lead Time (days)</Label>
                <Input
                  id="lead_time_days"
                  type="number"
                  {...register("lead_time_days")}
                  placeholder="e.g. 14"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                {...register("notes")}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
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
                ? "Update Supplier"
                : "Create Supplier"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
