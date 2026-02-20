"use client";

import { useState, useEffect } from "react";
import { useUpdateBOMItem, useTranslateBOMItem } from "@/lib/hooks/useBom";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { BOMItem } from "@/lib/types/bom";

interface BOMTranslationDrawerProps {
  item: BOMItem;
  revisionId: string;
  open: boolean;
  onClose: () => void;
}

export function BOMTranslationDrawer({ item, revisionId, open, onClose }: BOMTranslationDrawerProps) {
  const [formData, setFormData] = useState({
    material_name_zh: item.material_name_zh || "",
    description_zh: item.description_zh || "",
  });

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const updateMutation = useUpdateBOMItem(revisionId);
  const translateMutation = useTranslateBOMItem(revisionId);

  // Reset form when item changes
  useEffect(() => {
    setFormData({
      material_name_zh: item.material_name_zh || "",
      description_zh: item.description_zh || "",
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
          material_name_zh: formData.material_name_zh || undefined,
          description_zh: formData.description_zh || undefined,
          translation_status: formData.material_name_zh ? "confirmed" : "pending",
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
          material_name_zh: formData.material_name_zh || undefined,
          description_zh: formData.description_zh || undefined,
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>翻譯 BOM 物料名稱</DialogTitle>
          <DialogDescription>
            將物料名稱翻譯成中文，供工廠使用
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
              <div className="text-xs text-muted-foreground">物料名稱</div>
              <div className="text-sm font-medium">{item.material_name}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">供應商</div>
                <div className="text-sm">{item.supplier || "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">分類</div>
                <Badge variant="outline">{item.category_display}</Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">顏色</div>
                <div className="text-sm">{item.color || "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">用途</div>
                <div className="text-sm">
                  {item.placement?.length > 0 ? item.placement.join(", ") : "-"}
                </div>
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
            {item.translated_at && (
              <span className="text-xs text-muted-foreground">
                {new Date(item.translated_at).toLocaleString("zh-TW")}
              </span>
            )}
            {item.translated_by && (
              <span className="text-xs text-muted-foreground">
                ({item.translated_by})
              </span>
            )}
          </div>

          {/* Translation fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="material_name_zh">物料名稱（中文）</Label>
              <div className="flex gap-2">
                <Input
                  id="material_name_zh"
                  value={formData.material_name_zh}
                  onChange={(e) => handleChange("material_name_zh", e.target.value)}
                  placeholder="輸入中文物料名稱..."
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

            <div className="space-y-2">
              <Label htmlFor="description_zh">備註（中文）</Label>
              <Textarea
                id="description_zh"
                value={formData.description_zh}
                onChange={(e) => handleChange("description_zh", e.target.value)}
                placeholder="輸入中文備註（可選）..."
                rows={3}
              />
            </div>
          </div>

          {/* Translation tips */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-900 font-medium mb-2">翻譯提示</div>
            <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
              <li>點擊「AI 翻譯」按鈕可自動翻譯物料名稱</li>
              <li>翻譯結果可以手動修改後再儲存</li>
              <li>點擊「確認翻譯」將狀態標記為已確認</li>
              <li>已確認的翻譯會顯示在 MWO 匯出文件中</li>
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
            disabled={updateMutation.isPending || !formData.material_name_zh}
          >
            {updateMutation.isPending ? "處理中..." : "確認翻譯"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
