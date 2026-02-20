"use client";

import { useState, useEffect } from "react";
import { useUpdateMeasurement, useTranslateMeasurement } from "@/lib/hooks/useMeasurement";
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
import type { MeasurementItem } from "@/lib/types/measurement";

interface MeasurementTranslationDrawerProps {
  item: MeasurementItem;
  revisionId: string;
  open: boolean;
  onClose: () => void;
}

export function MeasurementTranslationDrawer({
  item,
  revisionId,
  open,
  onClose,
}: MeasurementTranslationDrawerProps) {
  const [formData, setFormData] = useState({
    point_name_zh: item.point_name_zh || "",
  });

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const updateMutation = useUpdateMeasurement(revisionId);
  const translateMutation = useTranslateMeasurement(revisionId);

  // Reset form when item changes
  useEffect(() => {
    setFormData({
      point_name_zh: item.point_name_zh || "",
    });
    setSuccessMessage("");
    setErrorMessage("");
  }, [item]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAutoTranslate = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await translateMutation.mutateAsync(item.id);
      setSuccessMessage("AI 翻譯完成！");
    } catch (error) {
      setErrorMessage((error as Error).message || "AI 翻譯失敗");
    }
  };

  const handleSave = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await updateMutation.mutateAsync({
        itemId: item.id,
        data: {
          point_name_zh: formData.point_name_zh || undefined,
          translation_status: formData.point_name_zh ? "confirmed" : "pending",
        },
      });

      setSuccessMessage("儲存成功！");
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      setErrorMessage((error as Error).message || "儲存失敗");
    }
  };

  const handleConfirmTranslation = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await updateMutation.mutateAsync({
        itemId: item.id,
        data: {
          point_name_zh: formData.point_name_zh || undefined,
          translation_status: "confirmed",
        },
      });

      setSuccessMessage("翻譯已確認！");
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      setErrorMessage((error as Error).message || "確認失敗");
    }
  };

  // Format size values for display
  const formatSizeValues = () => {
    if (!item.values) return "-";
    return Object.entries(item.values)
      .map(([size, value]) => `${size}: ${value}`)
      .join(", ");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>翻譯尺寸點名稱</DialogTitle>
          <DialogDescription>
            將尺寸點名稱翻譯成中文，供工廠使用
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
          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              {errorMessage}
            </div>
          )}

          {/* Original info */}
          <div className="p-4 bg-muted rounded-lg space-y-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">
              原始資料（英文）
            </div>
            <div>
              <div className="text-xs text-muted-foreground">尺寸點名稱</div>
              <div className="text-sm font-medium">{item.point_name}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">編碼</div>
                <div className="text-sm">{item.point_code || "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">單位</div>
                <div className="text-sm">{item.unit || "cm"}</div>
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">尺碼數值</div>
              <div className="text-sm font-mono">{formatSizeValues()}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">公差 (+)</div>
                <div className="text-sm">{item.tolerance_plus}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">公差 (-)</div>
                <div className="text-sm">{item.tolerance_minus}</div>
              </div>
            </div>
          </div>

          {/* Translation status */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">翻譯狀態：</span>
            <Badge
              variant={item.translation_status === "confirmed" ? "default" : "secondary"}
            >
              {item.translation_status === "confirmed" ? "已確認" : "待翻譯"}
            </Badge>
          </div>

          {/* Translation fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="point_name_zh">尺寸點名稱（中文）</Label>
              <div className="flex gap-2">
                <Input
                  id="point_name_zh"
                  value={formData.point_name_zh}
                  onChange={(e) => handleChange("point_name_zh", e.target.value)}
                  placeholder="輸入中文尺寸點名稱..."
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={handleAutoTranslate}
                  disabled={translateMutation.isPending}
                >
                  {translateMutation.isPending ? "翻譯中..." : "AI 翻譯"}
                </Button>
              </div>
            </div>
          </div>

          {/* Translation tips */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-900 font-medium mb-2">翻譯提示</div>
            <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
              <li>點擊「AI 翻譯」按鈕可自動翻譯尺寸點名稱</li>
              <li>翻譯結果可以手動修改後再儲存</li>
              <li>點擊「確認翻譯」將狀態標記為已確認</li>
              <li>已確認的翻譯會顯示在 MWO Spec Sheet 中</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? "儲存中..." : "儲存"}
          </Button>
          <Button
            onClick={handleConfirmTranslation}
            disabled={updateMutation.isPending || !formData.point_name_zh}
          >
            {updateMutation.isPending ? "處理中..." : "確認翻譯"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
