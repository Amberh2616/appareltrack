/**
 * BOM Status Badge
 * Displays BOM verified status with color-coded badge
 *
 * Decision 2: Warning badge when BOM < 90% verified
 */

import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";

interface BOMStatusBadgeProps {
  itemsCount: number;
  verifiedCount: number;
  verifiedRatio: number;
  requiredThreshold?: number;
  showDetails?: boolean;
}

export function BOMStatusBadge({
  itemsCount,
  verifiedCount,
  verifiedRatio,
  requiredThreshold = 0.9,
  showDetails = false,
}: BOMStatusBadgeProps) {
  // No BOM items
  if (itemsCount === 0) {
    return (
      <Badge variant="secondary" className="gap-1">
        <XCircle className="h-3 w-3" />
        No BOM
      </Badge>
    );
  }

  // BOM not ready (<90%)
  if (verifiedRatio < requiredThreshold) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="h-3 w-3" />
        {showDetails ? (
          <>BOM {verifiedCount}/{itemsCount} ({(verifiedRatio * 100).toFixed(0)}%)</>
        ) : (
          <>BOM &lt; 90%</>
        )}
      </Badge>
    );
  }

  // BOM ready (>=90%)
  return (
    <Badge variant="default" className="gap-1 bg-green-600">
      <CheckCircle2 className="h-3 w-3" />
      {showDetails ? (
        <>BOM {verifiedCount}/{itemsCount} ({(verifiedRatio * 100).toFixed(0)}%)</>
      ) : (
        <>BOM Ready</>
      )}
    </Badge>
  );
}
