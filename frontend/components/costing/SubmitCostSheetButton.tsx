/**
 * Submit CostSheet Button with BOM Gate
 * Decision 2: Disable submit if BOM < 90% verified
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useCostSheetActions } from "@/lib/hooks/useCostSheetActions";
import { BOMStatusBadge } from "./BOMStatusBadge";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SubmitCostSheetButtonProps {
  costSheetVersionId: string;
  onSuccess?: () => void;
}

export function SubmitCostSheetButton({
  costSheetVersionId,
  onSuccess,
}: SubmitCostSheetButtonProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const queryClient = useQueryClient();

  // Fetch allowed actions
  const { data: actions, isLoading } = useCostSheetActions(costSheetVersionId);

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient(
        `/cost-sheet-versions/${costSheetVersionId}/submit/`,
        { method: 'POST' }
      );
      return response;
    },
    onSuccess: () => {
      toast.success("Cost sheet submitted successfully");
      queryClient.invalidateQueries({ queryKey: ["cost-sheet-versions"] });
      queryClient.invalidateQueries({ queryKey: ["cost-sheet-actions", costSheetVersionId] });
      onSuccess?.();
      setShowConfirmDialog(false);
    },
    onError: (error: any) => {
      const errorData = error.response?.data;

      if (errorData?.error === "BOM_NOT_READY") {
        // Show BOM details in error toast
        toast.error("Cannot submit: BOM not ready", {
          description: `BOM verified: ${errorData.bom_verified_count}/${errorData.bom_items_count} (${(errorData.bom_verified_ratio * 100).toFixed(0)}%). Required: ${(errorData.required_threshold * 100).toFixed(0)}%`,
        });
      } else {
        toast.error(errorData?.detail || "Failed to submit cost sheet");
      }
    },
  });

  // Loading state
  if (isLoading) {
    return (
      <Button disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </Button>
    );
  }

  // No actions data
  if (!actions) {
    return null;
  }

  const { can_submit, reasons, bom } = actions;

  // Disabled button with tooltip
  if (!can_submit) {
    const tooltipContent = reasons.includes("BOM_NOT_READY") ? (
      <div className="space-y-2">
        <p>Cannot submit: BOM verification incomplete</p>
        <BOMStatusBadge
          itemsCount={bom.items_count}
          verifiedCount={bom.verified_count}
          verifiedRatio={bom.verified_ratio}
          requiredThreshold={bom.required_threshold}
          showDetails
        />
        <p className="text-xs">Required: {(bom.required_threshold * 100).toFixed(0)}% verified</p>
      </div>
    ) : (
      <p>Cannot submit: {reasons.join(", ")}</p>
    );

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Button disabled className="w-full">
                <Send className="mr-2 h-4 w-4" />
                Submit
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent>{tooltipContent}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Enabled button
  return (
    <>
      <Button
        onClick={() => setShowConfirmDialog(true)}
        disabled={submitMutation.isPending}
        className="w-full"
      >
        {submitMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Submit
          </>
        )}
      </Button>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Cost Sheet?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This will submit the cost sheet for review. Once submitted, you cannot edit the
                usage scenario or cost lines.
              </p>

              <div className="bg-muted p-3 rounded-md space-y-2">
                <p className="text-sm font-medium">BOM Status:</p>
                <BOMStatusBadge
                  itemsCount={bom.items_count}
                  verifiedCount={bom.verified_count}
                  verifiedRatio={bom.verified_ratio}
                  requiredThreshold={bom.required_threshold}
                  showDetails
                />
              </div>

              <p className="text-sm">Are you sure you want to continue?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? "Submitting..." : "Confirm Submit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
