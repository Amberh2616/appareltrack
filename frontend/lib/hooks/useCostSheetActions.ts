/**
 * useCostSheetActions Hook
 * Fetches allowed actions for a CostSheetVersion
 *
 * Decision 2: Check can_submit before showing submit button
 */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

interface AllowedActionsResponse {
  success: boolean;
  data: {
    can_submit: boolean;
    can_edit: boolean;
    reasons: string[];
    bom: {
      items_count: number;
      verified_count: number;
      verified_ratio: number;
      required_threshold: number;
    };
  };
}

export function useCostSheetActions(costSheetVersionId: string | undefined) {
  return useQuery({
    queryKey: ["cost-sheet-actions", costSheetVersionId],
    queryFn: async () => {
      if (!costSheetVersionId) throw new Error("Cost sheet version ID is required");

      const response = await apiClient<AllowedActionsResponse>(
        `/cost-sheet-versions/${costSheetVersionId}/allowed-actions/`
      );

      if (!response.success) {
        throw new Error("Failed to fetch allowed actions");
      }

      return response.data;
    },
    enabled: !!costSheetVersionId,
    staleTime: 30000, // 30 seconds
    refetchOnMount: true,
  });
}
