"use client";

import { useState } from "react";
import { useUpdateBOMItem } from "@/lib/hooks/useBom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { BOMItem } from "@/lib/types/bom";

interface BOMEditDrawerProps {
  item: BOMItem;
  revisionId: string;
  open: boolean;
  onClose: () => void;
}

export function BOMEditDrawer({ item, revisionId, open, onClose }: BOMEditDrawerProps) {
  const [formData, setFormData] = useState({
    supplier_article_no: item.supplier_article_no || "",
    material_status: item.material_status || "",
    leadtime_days: item.leadtime_days?.toString() || "",
    consumption: item.consumption || "",
    unit_price: item.unit_price || "",
    wastage_rate: item.wastage_rate || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState("");
  const updateMutation = useUpdateBOMItem(revisionId);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate leadtime_days
    if (formData.leadtime_days) {
      const num = parseInt(formData.leadtime_days);
      if (isNaN(num) || num < 0 || num > 999) {
        newErrors.leadtime_days = "交期必須是 0-999 的整數";
      }
    }

    // Validate consumption
    if (formData.consumption) {
      const num = parseFloat(formData.consumption);
      if (isNaN(num) || num < 0) {
        newErrors.consumption = "用量必須是正數";
      }
    }

    // Validate unit_price
    if (formData.unit_price) {
      const num = parseFloat(formData.unit_price);
      if (isNaN(num) || num < 0) {
        newErrors.unit_price = "單價必須是正數";
      }
    }

    // Validate wastage_rate
    if (formData.wastage_rate) {
      const num = parseFloat(formData.wastage_rate);
      if (isNaN(num) || num < 0 || num > 100) {
        newErrors.wastage_rate = "損耗率必須是 0-100";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    try {
      await updateMutation.mutateAsync({
        itemId: item.id,
        data: {
          supplier_article_no: formData.supplier_article_no || undefined,
          material_status: formData.material_status || undefined,
          leadtime_days: formData.leadtime_days ? parseInt(formData.leadtime_days) : undefined,
          consumption: formData.consumption || undefined,
          unit_price: formData.unit_price || undefined,
          wastage_rate: formData.wastage_rate || undefined,
        },
      });

      setSuccessMessage("儲存成功！");
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      setErrors({ _general: (error as Error).message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>編輯 BOM 項目</DialogTitle>
          <DialogDescription>
            物料：{item.material_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Success message */}
          {successMessage && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
              {successMessage}
            </div>
          )}

          {/* Error message */}
          {errors._general && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              {errors._general}
            </div>
          )}

          {/* Read-only info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <div className="text-xs text-muted-foreground">物料名稱</div>
              <div className="text-sm font-medium">{item.material_name}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">供應商</div>
              <div className="text-sm font-medium">{item.supplier}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">分類</div>
              <Badge variant="outline">{item.category_display}</Badge>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">單位</div>
              <div className="text-sm font-medium">{item.unit}</div>
            </div>
          </div>

          {/* Editable fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supplier_article_no">供應商物料編號</Label>
              <Input
                id="supplier_article_no"
                value={formData.supplier_article_no}
                onChange={(e) => handleChange("supplier_article_no", e.target.value)}
                placeholder="例如：RT17110 36"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="material_status">物料狀態</Label>
              <Input
                id="material_status"
                value={formData.material_status}
                onChange={(e) => handleChange("material_status", e.target.value)}
                placeholder="例如：Approved"
              />
              <div className="text-xs text-muted-foreground">
                常用狀態：Approved, Approved with Limitations, Pending Approval, Rejected
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="consumption">用量</Label>
                <Input
                  id="consumption"
                  value={formData.consumption}
                  onChange={(e) => handleChange("consumption", e.target.value)}
                  placeholder="0.5000"
                />
                {errors.consumption && (
                  <div className="text-xs text-red-500">{errors.consumption}</div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="wastage_rate">損耗率 (%)</Label>
                <Input
                  id="wastage_rate"
                  value={formData.wastage_rate}
                  onChange={(e) => handleChange("wastage_rate", e.target.value)}
                  placeholder="5.00"
                />
                {errors.wastage_rate && (
                  <div className="text-xs text-red-500">{errors.wastage_rate}</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unit_price">單價 ($)</Label>
                <Input
                  id="unit_price"
                  value={formData.unit_price}
                  onChange={(e) => handleChange("unit_price", e.target.value)}
                  placeholder="6.40"
                />
                {errors.unit_price && (
                  <div className="text-xs text-red-500">{errors.unit_price}</div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="leadtime_days">交期 (天數)</Label>
                <Input
                  id="leadtime_days"
                  value={formData.leadtime_days}
                  onChange={(e) => handleChange("leadtime_days", e.target.value)}
                  placeholder="72"
                />
                {errors.leadtime_days && (
                  <div className="text-xs text-red-500">{errors.leadtime_days}</div>
                )}
              </div>
            </div>
          </div>

          {/* Additional info */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-xs text-blue-900 space-y-1">
              <div>
                <strong>用量成熟度：</strong>
                <Badge variant="outline" className="ml-2">
                  {item.consumption_maturity_display}
                </Badge>
              </div>
              {item.ai_confidence !== null && (
                <div>
                  <strong>AI 信心度：</strong> {(item.ai_confidence * 100).toFixed(1)}%
                </div>
              )}
              <div>
                <strong>已驗證：</strong> {item.is_verified ? "是" : "否"}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "儲存中..." : "儲存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
