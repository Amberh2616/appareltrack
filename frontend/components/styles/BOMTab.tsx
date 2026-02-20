"use client";

import Link from "next/link";
import { Package, ExternalLink, CheckCircle, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBOMItems } from "@/lib/hooks/useBom";

interface BOMTabProps {
  revisionId: string | null;
  bomSummary: { total: number; verified: number; translated: number };
  onBatchVerify: () => void;
  isBatchVerifying: boolean;
}

const categoryColor: Record<string, string> = {
  fabric: "bg-blue-100 text-blue-700",
  trim: "bg-purple-100 text-purple-700",
  packaging: "bg-amber-100 text-amber-700",
  label: "bg-green-100 text-green-700",
};

export function BOMTab({
  revisionId,
  bomSummary,
  onBatchVerify,
  isBatchVerifying,
}: BOMTabProps) {
  const { data: bomData, isLoading } = useBOMItems(revisionId ?? "");

  if (!revisionId || bomSummary.total === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500">
          No BOM items. Upload and extract a BOM document first.
        </p>
      </div>
    );
  }

  const items = bomData?.results ?? [];

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total" value={bomSummary.total} />
        <StatCard
          label="Verified"
          value={bomSummary.verified}
          color={
            bomSummary.verified === bomSummary.total
              ? "text-green-600"
              : "text-amber-600"
          }
        />
        <StatCard label="Translated" value={bomSummary.translated} />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="pb-2 font-medium w-8">#</th>
                <th className="pb-2 font-medium">Material</th>
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 font-medium text-right">Usage</th>
                <th className="pb-2 font-medium">Unit</th>
                <th className="pb-2 font-medium text-center w-16">Verified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="py-2 text-slate-400">
                    {item.item_number}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="truncate max-w-[220px]">
                      {item.material_name}
                    </div>
                    {item.material_name_zh && (
                      <div className="text-xs text-slate-400 truncate max-w-[220px]">
                        {item.material_name_zh}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        categoryColor[item.category] ??
                        "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {item.category_display || item.category}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right font-mono text-xs">
                    {item.current_consumption ?? item.consumption ?? "-"}
                  </td>
                  <td className="py-2 pr-3 text-slate-500">{item.unit}</td>
                  <td className="py-2 text-center">
                    {item.is_verified ? (
                      <CheckCircle className="w-4 h-4 text-green-500 inline" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-300 inline" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {bomSummary.verified < bomSummary.total && (
          <Button
            size="sm"
            onClick={onBatchVerify}
            disabled={isBatchVerifying}
          >
            {isBatchVerifying ? "Verifying..." : "Batch Verify All"}
          </Button>
        )}

        <Link href={`/dashboard/revisions/${revisionId}/bom`}>
          <Button variant="outline" size="sm" className="gap-1">
            Edit BOM
            <ExternalLink className="w-3 h-3" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = "text-slate-700",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="bg-slate-50 rounded-md px-3 py-2 text-center">
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
