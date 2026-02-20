"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUploadTechPack } from "@/lib/hooks/useTechPacks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, FileText } from "lucide-react";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadDialog({ open, onOpenChange }: UploadDialogProps) {
  const router = useRouter();
  const uploadMutation = useUploadTechPack();

  const [formData, setFormData] = useState({
    style_number: "",
    style_name: "",
    season: "",
    customer: "",
  });
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      alert("請選擇 PDF 文件");
      return;
    }

    try {
      const result = await uploadMutation.mutateAsync({
        ...formData,
        file,
      });

      // Close dialog
      onOpenChange(false);

      // Reset form
      setFormData({
        style_number: "",
        style_name: "",
        season: "",
        customer: "",
      });
      setFile(null);

      // Show success message
      alert("上傳成功！AI 正在解析中，請等待 5-10 秒...");

      // Navigate to review page
      router.push(`/dashboard/techpacks/${result.id}/review`);
    } catch (error: any) {
      console.error("Upload failed:", error);
      alert(`上傳失敗: ${error.message || "未知錯誤"}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>上傳 Tech Pack</DialogTitle>
          <DialogDescription>
            上傳 PDF 文件後，AI 會自動解析 BOM、Measurements 和 Construction。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Style Number */}
            <div className="grid gap-2">
              <Label htmlFor="style_number">
                款號 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="style_number"
                placeholder="LW1FLPS"
                value={formData.style_number}
                onChange={(e) =>
                  setFormData({ ...formData, style_number: e.target.value })
                }
                required
              />
            </div>

            {/* Style Name */}
            <div className="grid gap-2">
              <Label htmlFor="style_name">
                款式名稱 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="style_name"
                placeholder="Nulu Cami Tank"
                value={formData.style_name}
                onChange={(e) =>
                  setFormData({ ...formData, style_name: e.target.value })
                }
                required
              />
            </div>

            {/* Season */}
            <div className="grid gap-2">
              <Label htmlFor="season">
                季節 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="season"
                placeholder="SP25"
                value={formData.season}
                onChange={(e) =>
                  setFormData({ ...formData, season: e.target.value })
                }
                required
              />
            </div>

            {/* Customer */}
            <div className="grid gap-2">
              <Label htmlFor="customer">客戶（選填）</Label>
              <Input
                id="customer"
                placeholder="Lululemon"
                value={formData.customer}
                onChange={(e) =>
                  setFormData({ ...formData, customer: e.target.value })
                }
              />
            </div>

            {/* File Upload */}
            <div className="grid gap-2">
              <Label htmlFor="file">
                PDF 文件 <span className="text-red-500">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="file"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  required
                  className="cursor-pointer"
                />
              </div>
              {file && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>{file.name}</span>
                  <span className="text-xs">
                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={uploadMutation.isPending}
            >
              取消
            </Button>
            <Button type="submit" disabled={uploadMutation.isPending}>
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  上傳中...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  上傳並解析
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
