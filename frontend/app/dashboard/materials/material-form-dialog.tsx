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
import { useCreateMaterial, useUpdateMaterial } from "@/lib/hooks/useMaterials";
import { useSuppliers } from "@/lib/hooks/useSuppliers";
import type { Material, CreateMaterialPayload, MaterialCategory, MaterialStatus } from "@/lib/types/material";
import { MATERIAL_CATEGORY_OPTIONS, MATERIAL_STATUS_OPTIONS } from "@/lib/types/material";

interface MaterialFormDialogProps {
  open: boolean;
  onClose: () => void;
  material?: Material | null;
}

interface FormData {
  article_no: string;
  name: string;
  name_zh: string;
  description: string;
  category: MaterialCategory;
  supplier: string;
  color: string;
  color_code: string;
  composition: string;
  weight: string;
  width: string;
  unit: string;
  unit_price: string;
  currency: string;
  moq: string;
  lead_time_days: string;
  wastage_rate: string;
  status: MaterialStatus;
  is_active: boolean;
  notes: string;
}

export function MaterialFormDialog({
  open,
  onClose,
  material,
}: MaterialFormDialogProps) {
  const isEditing = !!material;
  const createMaterial = useCreateMaterial();
  const updateMaterial = useUpdateMaterial();
  const { data: suppliersData } = useSuppliers({ page_size: 100, is_active: true });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      article_no: "",
      name: "",
      name_zh: "",
      description: "",
      category: "fabric",
      supplier: "",
      color: "",
      color_code: "",
      composition: "",
      weight: "",
      width: "",
      unit: "yards",
      unit_price: "",
      currency: "USD",
      moq: "",
      lead_time_days: "",
      wastage_rate: "5.00",
      status: "active",
      is_active: true,
      notes: "",
    },
  });

  // Reset form when material changes
  useEffect(() => {
    if (material) {
      reset({
        article_no: material.article_no,
        name: material.name,
        name_zh: material.name_zh || "",
        description: material.description || "",
        category: material.category,
        supplier: material.supplier || "",
        color: material.color || "",
        color_code: material.color_code || "",
        composition: material.composition || "",
        weight: material.weight || "",
        width: material.width || "",
        unit: material.unit || "yards",
        unit_price: material.unit_price || "",
        currency: material.currency || "USD",
        moq: material.moq?.toString() || "",
        lead_time_days: material.lead_time_days?.toString() || "",
        wastage_rate: material.wastage_rate || "5.00",
        status: material.status,
        is_active: material.is_active,
        notes: material.notes || "",
      });
    } else {
      reset({
        article_no: "",
        name: "",
        name_zh: "",
        description: "",
        category: "fabric",
        supplier: "",
        color: "",
        color_code: "",
        composition: "",
        weight: "",
        width: "",
        unit: "yards",
        unit_price: "",
        currency: "USD",
        moq: "",
        lead_time_days: "",
        wastage_rate: "5.00",
        status: "active",
        is_active: true,
        notes: "",
      });
    }
  }, [material, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      const payload: CreateMaterialPayload = {
        article_no: data.article_no,
        name: data.name,
        name_zh: data.name_zh || undefined,
        description: data.description || undefined,
        category: data.category,
        supplier: data.supplier || undefined,
        color: data.color || undefined,
        color_code: data.color_code || undefined,
        composition: data.composition || undefined,
        weight: data.weight || undefined,
        width: data.width || undefined,
        unit: data.unit || undefined,
        unit_price: data.unit_price || undefined,
        currency: data.currency || undefined,
        moq: data.moq ? parseInt(data.moq) : undefined,
        lead_time_days: data.lead_time_days ? parseInt(data.lead_time_days) : undefined,
        wastage_rate: data.wastage_rate || undefined,
        status: data.status,
        notes: data.notes || undefined,
      };

      if (isEditing && material) {
        await updateMaterial.mutateAsync({
          id: material.id,
          data: { ...payload, is_active: data.is_active },
        });
      } else {
        await createMaterial.mutateAsync(payload);
      }

      onClose();
    } catch (error) {
      console.error("Failed to save material:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Material" : "New Material"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="article_no">
                Article No. <span className="text-red-500">*</span>
              </Label>
              <Input
                id="article_no"
                {...register("article_no", { required: "Article No. is required" })}
                placeholder="e.g. NF-2024-001"
              />
              {errors.article_no && (
                <p className="text-xs text-red-500">{errors.article_no.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">
                Name (EN) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                {...register("name", { required: "Name is required" })}
                placeholder="Material name"
              />
              {errors.name && (
                <p className="text-xs text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name_zh">Name (ZH)</Label>
              <Input
                id="name_zh"
                {...register("name_zh")}
                placeholder="物料名稱"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">
                Category <span className="text-red-500">*</span>
              </Label>
              <select
                id="category"
                {...register("category", { required: true })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              >
                {MATERIAL_CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label_zh} ({opt.label})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier</Label>
              <select
                id="supplier"
                {...register("supplier")}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              >
                <option value="">-- Select Supplier --</option>
                {suppliersData?.results?.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                {...register("status")}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              >
                {MATERIAL_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label_zh}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Specifications */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-slate-700 mb-4">
              Specifications
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  {...register("color")}
                  placeholder="e.g. Black"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="color_code">Color Code</Label>
                <Input
                  id="color_code"
                  {...register("color_code")}
                  placeholder="e.g. BLK001"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="composition">Composition</Label>
                <Input
                  id="composition"
                  {...register("composition")}
                  placeholder="e.g. 80% Nylon, 20% Spandex"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight">Weight</Label>
                <Input
                  id="weight"
                  {...register("weight")}
                  placeholder="e.g. 180 GSM"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="width">Width</Label>
                <Input
                  id="width"
                  {...register("width")}
                  placeholder="e.g. 150 cm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <select
                  id="unit"
                  {...register("unit")}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                >
                  <option value="yards">Yards</option>
                  <option value="meters">Meters</option>
                  <option value="pcs">Pieces</option>
                  <option value="kg">Kilograms</option>
                  <option value="rolls">Rolls</option>
                </select>
              </div>
            </div>
          </div>

          {/* Pricing & Lead Time */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-slate-700 mb-4">
              Pricing & Lead Time
            </h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unit_price">Unit Price</Label>
                <Input
                  id="unit_price"
                  type="number"
                  step="0.01"
                  {...register("unit_price")}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <select
                  id="currency"
                  {...register("currency")}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                >
                  <option value="USD">USD</option>
                  <option value="TWD">TWD</option>
                  <option value="CNY">CNY</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="moq">MOQ</Label>
                <Input
                  id="moq"
                  type="number"
                  {...register("moq")}
                  placeholder="Minimum Order Quantity"
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

              <div className="space-y-2">
                <Label htmlFor="wastage_rate">Wastage Rate (%)</Label>
                <Input
                  id="wastage_rate"
                  type="number"
                  step="0.01"
                  {...register("wastage_rate")}
                  placeholder="5.00"
                />
              </div>
            </div>
          </div>

          {/* Description & Notes */}
          <div className="border-t pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...register("description")}
                  placeholder="Material description..."
                  rows={3}
                />
              </div>

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
                ? "Update Material"
                : "Create Material"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
