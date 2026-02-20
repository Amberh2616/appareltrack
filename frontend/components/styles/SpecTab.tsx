"use client";

import Link from "next/link";
import { Ruler, ExternalLink, CheckCircle, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMeasurements } from "@/lib/hooks/useMeasurement";

interface SpecTabProps {
  revisionId: string | null;
  specSummary: { total: number; verified: number; translated: number };
  onBatchVerify: () => void;
  isBatchVerifying: boolean;
}

export function SpecTab({
  revisionId,
  specSummary,
  onBatchVerify,
  isBatchVerifying,
}: SpecTabProps) {
  const { data: specData, isLoading } = useMeasurements(revisionId ?? "");

  if (!revisionId || specSummary.total === 0) {
    return (
      <div className="text-center py-12">
        <Ruler className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500">
          No measurements. Upload and extract a Spec document first.
        </p>
      </div>
    );
  }

  const items = specData?.results ?? [];

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total" value={specSummary.total} />
        <StatCard
          label="Verified"
          value={specSummary.verified}
          color={
            specSummary.verified === specSummary.total
              ? "text-green-600"
              : "text-amber-600"
          }
        />
        <StatCard label="Translated" value={specSummary.translated} />
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
                <th className="pb-2 font-medium">Point Name</th>
                <th className="pb-2 font-medium">Code</th>
                <th className="pb-2 font-medium text-right">Tol +</th>
                <th className="pb-2 font-medium text-right">Tol -</th>
                <th className="pb-2 font-medium">Unit</th>
                <th className="pb-2 font-medium text-center w-16">Verified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="py-2 pr-3">
                    <div className="truncate max-w-[200px]">
                      {item.point_name}
                    </div>
                    {item.point_name_zh && (
                      <div className="text-xs text-slate-400 truncate max-w-[200px]">
                        {item.point_name_zh}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs text-slate-500">
                    {item.point_code || "-"}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono text-xs">
                    {item.tolerance_plus ? `+${item.tolerance_plus}` : "-"}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono text-xs">
                    {item.tolerance_minus ? `-${item.tolerance_minus}` : "-"}
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
        {specSummary.verified < specSummary.total && (
          <Button
            size="sm"
            onClick={onBatchVerify}
            disabled={isBatchVerifying}
          >
            {isBatchVerifying ? "Verifying..." : "Batch Verify All"}
          </Button>
        )}

        <Link href={`/dashboard/revisions/${revisionId}/spec`}>
          <Button variant="outline" size="sm" className="gap-1">
            Edit Spec
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
