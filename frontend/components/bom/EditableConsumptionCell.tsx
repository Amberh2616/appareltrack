"use client";

import { useState, useRef } from "react";
import { useSetPreEstimate, useSetSample, useConfirmConsumption, useLockConsumption } from "@/lib/hooks/useBom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { BOMItem } from "@/lib/types/bom";
import { Check, Loader2, Lock, ChevronDown, Pencil } from "lucide-react";

interface EditableConsumptionCellProps {
  item: BOMItem;
  revisionId: string;
}

export function EditableConsumptionCell({ item, revisionId }: EditableConsumptionCellProps) {
  const [preEstimateValue, setPreEstimateValue] = useState(item.pre_estimate_value || "");
  const [sampleValue, setSampleValue] = useState(item.sample_value || "");
  const [confirmedValue, setConfirmedValue] = useState(item.confirmed_value || "");
  const [lockedValue, setLockedValue] = useState(item.locked_value || "");
  const [isEditing, setIsEditing] = useState(false);
  const [editField, setEditField] = useState<"pre_estimate" | "sample" | "confirmed" | "locked" | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  const setPreEstimateMutation = useSetPreEstimate(revisionId);
  const setSampleMutation = useSetSample(revisionId);
  const confirmConsumptionMutation = useConfirmConsumption(revisionId);
  const lockConsumptionMutation = useLockConsumption(revisionId);

  const handleSavePreEstimate = async () => {
    const numValue = parseFloat(preEstimateValue);
    if (isNaN(numValue) || numValue < 0) {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 2000);
      return;
    }

    setSaveState("saving");
    try {
      await setPreEstimateMutation.mutateAsync({
        itemId: item.id,
        value: preEstimateValue,
      });
      setSaveState("saved");
      setEditField(null);
      setTimeout(() => setSaveState("idle"), 2000);
    } catch (error) {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 2000);
    }
  };

  const handleSaveSample = async () => {
    const numValue = parseFloat(sampleValue);
    if (isNaN(numValue) || numValue < 0) {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 2000);
      return;
    }

    setSaveState("saving");
    try {
      await setSampleMutation.mutateAsync({
        itemId: item.id,
        value: sampleValue,
      });
      setSaveState("saved");
      setEditField(null);
      setTimeout(() => setSaveState("idle"), 2000);
    } catch (error) {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 2000);
    }
  };

  const handleSaveConfirmed = async () => {
    const numValue = parseFloat(confirmedValue);
    if (isNaN(numValue) || numValue < 0) {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 2000);
      return;
    }

    setSaveState("saving");
    try {
      await confirmConsumptionMutation.mutateAsync({
        itemId: item.id,
        value: confirmedValue,
        source: "manual",
      });
      setSaveState("saved");
      setEditField(null);
      setTimeout(() => setSaveState("idle"), 2000);
    } catch (error) {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 2000);
    }
  };

  const handleSaveLocked = async () => {
    const numValue = parseFloat(lockedValue);
    if (isNaN(numValue) || numValue < 0) {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 2000);
      return;
    }

    setSaveState("saving");
    try {
      await lockConsumptionMutation.mutateAsync({
        itemId: item.id,
        value: lockedValue,
      });
      setSaveState("saved");
      setEditField(null);
      setTimeout(() => setSaveState("idle"), 2000);
    } catch (error) {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 2000);
    }
  };

  const isLocked = item.consumption_maturity === "locked";
  const currentValue = item.current_consumption || item.consumption || "0";

  // 計算進度 (0-4)
  const progress = item.locked_value ? 4 : item.confirmed_value ? 3 : item.sample_value ? 2 : item.pre_estimate_value ? 1 : 0;

  // 狀態標籤
  const statusLabel = isLocked ? "已鎖定" : item.confirmed_value ? "已確認" : item.sample_value ? "樣衣" : item.pre_estimate_value ? "預估" : "待設定";

  return (
    <Popover open={isEditing} onOpenChange={setIsEditing}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 px-2 text-sm font-mono hover:bg-slate-100 ${isLocked ? "opacity-75" : ""}`}
          disabled={isLocked}
        >
          <span className="mr-2">{parseFloat(currentValue).toFixed(4)}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
            isLocked ? "bg-slate-200 text-slate-600" :
            progress === 0 ? "bg-slate-100 text-slate-500" :
            "bg-slate-800 text-white"
          }`}>
            {isLocked && <Lock className="h-2.5 w-2.5 inline mr-0.5" />}
            {statusLabel}
          </span>
          {!isLocked && <ChevronDown className="h-3 w-3 ml-1 opacity-40" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        {/* Header */}
        <div className="px-4 py-3 border-b bg-slate-50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-900">用量設定</span>
            <span className="text-xs text-slate-500">{item.unit}</span>
          </div>
          {/* Progress bar - 4 segments */}
          <div className="mt-2 flex gap-1">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  progress >= step ? "bg-slate-800" : "bg-slate-200"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* 原始用量 */}
          <div className="flex items-center justify-between text-sm py-2 border-b">
            <span className="text-slate-500">Tech Pack 原始</span>
            <span className="font-mono text-slate-900">{item.consumption || "-"}</span>
          </div>

          {/* ① 預估用量 */}
          <div className={`border rounded-lg p-3 space-y-2 ${editField === "pre_estimate" ? "ring-2 ring-slate-400" : ""}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">① 預估用量</span>
              {item.pre_estimate_value && <Check className="h-3.5 w-3.5 text-slate-600" />}
            </div>
            {editField === "pre_estimate" ? (
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  type="text"
                  value={preEstimateValue}
                  onChange={(e) => setPreEstimateValue(e.target.value)}
                  className="h-8 text-sm font-mono flex-1"
                  placeholder="輸入數值"
                  autoFocus
                />
                <Button size="sm" onClick={handleSavePreEstimate} disabled={saveState === "saving"}>
                  {saveState === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : "確定"}
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">{item.pre_estimate_value || <span className="text-slate-400">--</span>}</span>
                {!isLocked && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      setPreEstimateValue(item.pre_estimate_value || item.consumption || "");
                      setEditField("pre_estimate");
                    }}
                  >
                    <Pencil className="h-3 w-3 mr-1" />編輯
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* ② 樣衣用量 */}
          <div className={`border rounded-lg p-3 space-y-2 ${editField === "sample" ? "ring-2 ring-slate-400" : ""}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">② 樣衣用量</span>
              {item.sample_value && <Check className="h-3.5 w-3.5 text-slate-600" />}
            </div>
            {editField === "sample" ? (
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={sampleValue}
                  onChange={(e) => setSampleValue(e.target.value)}
                  className="h-8 text-sm font-mono flex-1"
                  placeholder="輸入數值"
                  autoFocus
                />
                <Button size="sm" onClick={handleSaveSample} disabled={saveState === "saving"}>
                  {saveState === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : "確定"}
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">{item.sample_value || <span className="text-slate-400">--</span>}</span>
                {!isLocked && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      setSampleValue(item.sample_value || item.pre_estimate_value || item.consumption || "");
                      setEditField("sample");
                    }}
                  >
                    <Pencil className="h-3 w-3 mr-1" />編輯
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* ③ 確認用量 */}
          <div className={`border rounded-lg p-3 space-y-2 ${editField === "confirmed" ? "ring-2 ring-slate-400" : ""}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">③ 確認用量</span>
              {item.confirmed_value && <Check className="h-3.5 w-3.5 text-slate-600" />}
            </div>
            {editField === "confirmed" ? (
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={confirmedValue}
                  onChange={(e) => setConfirmedValue(e.target.value)}
                  className="h-8 text-sm font-mono flex-1"
                  placeholder="輸入數值"
                  autoFocus
                />
                <Button size="sm" onClick={handleSaveConfirmed} disabled={saveState === "saving"}>
                  {saveState === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : "確定"}
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">{item.confirmed_value || <span className="text-slate-400">--</span>}</span>
                {!isLocked && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      setConfirmedValue(item.confirmed_value || item.sample_value || item.pre_estimate_value || item.consumption || "");
                      setEditField("confirmed");
                    }}
                  >
                    <Pencil className="h-3 w-3 mr-1" />編輯
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* ④ 鎖定用量 */}
          <div className={`border rounded-lg p-3 space-y-2 ${editField === "locked" ? "ring-2 ring-slate-400" : ""} ${isLocked ? "bg-slate-50" : ""}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">④ 鎖定用量</span>
              {isLocked && <Lock className="h-3.5 w-3.5 text-slate-600" />}
            </div>
            {editField === "locked" ? (
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={lockedValue}
                  onChange={(e) => setLockedValue(e.target.value)}
                  className="h-8 text-sm font-mono flex-1"
                  placeholder="輸入數值"
                  autoFocus
                />
                <Button size="sm" onClick={handleSaveLocked} disabled={saveState === "saving"}>
                  {saveState === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Lock className="h-3 w-3 mr-1" />鎖定</>}
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">{item.locked_value || <span className="text-slate-400">--</span>}</span>
                {!isLocked && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      setLockedValue(item.confirmed_value || item.sample_value || item.pre_estimate_value || item.consumption || "");
                      setEditField("locked");
                    }}
                  >
                    <Pencil className="h-3 w-3 mr-1" />編輯
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
