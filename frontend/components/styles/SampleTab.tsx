"use client";

import {
  Scissors,
  Download,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRunsSummary } from "@/lib/hooks/useSamples";
import {
  useCreateSampleWithMWO,
  useCreateNextRound,
  useIssueMWO,
} from "@/lib/hooks/useStyleDetail";
import { CreateSampleForm } from "@/components/styles/CreateSampleForm";
import { API_BASE_URL } from "@/lib/api/client";
import { toast } from "sonner";
import type { StyleReadiness } from "@/lib/api/style-detail";

interface SampleTabProps {
  readiness: StyleReadiness;
}

const statusVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "outline",
  submitted: "secondary",
  quoted: "secondary",
  pending_approval: "secondary",
  approved: "default",
  completed: "default",
  rejected: "destructive",
  cancelled: "destructive",
  materials: "secondary",
  po_issued: "secondary",
  in_production: "secondary",
  mwo_issued: "default",
};

function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function SampleTab({ readiness: r }: SampleTabProps) {
  const hasSampleRequest = Boolean(r.sample_request);

  const createSampleMutation = useCreateSampleWithMWO();
  const createNextRound = useCreateNextRound(
    r.sample_request?.id ?? undefined
  );
  const issueMWO = useIssueMWO();

  const { data: runsSummary } = useRunsSummary(
    r.sample_request?.id ?? null
  );

  const runs = runsSummary?.runs ?? [];

  // --- Event handlers ---
  const handleCreateSample = async (data: {
    type: string;
    quantity: number;
    priority: string;
  }) => {
    if (!r.revision_id) {
      toast.error("No revision available");
      return;
    }
    createSampleMutation.mutate(
      {
        revisionId: r.revision_id,
        type: data.type,
        quantity: data.quantity,
        priority: data.priority,
      },
      {
        onSuccess: () => {
          toast.success("Sample created, MWO generated!");
        },
        onError: (err) => {
          toast.error(
            `Failed: ${err instanceof Error ? err.message : "Unknown error"}`
          );
        },
      }
    );
  };

  const handleCreateNextRound = () => {
    createNextRound.mutate(undefined, {
      onSuccess: (data) => {
        toast.success(`Run #${data.sample_run.run_no} created with MWO`);
      },
      onError: () => toast.error("Failed to create next round"),
    });
  };

  const handleIssueMWO = (runId: string) => {
    issueMWO.mutate(runId, {
      onSuccess: () => toast.success("MWO issued"),
      onError: () => toast.error("Failed to issue MWO"),
    });
  };

  // --- Situation A: No sample request yet ---
  if (!hasSampleRequest && r.revision_id) {
    return (
      <CreateSampleForm
        revisionId={r.revision_id}
        bomVerified={r.bom.verified}
        bomTotal={r.bom.total}
        specVerified={r.spec.verified}
        specTotal={r.spec.total}
        onSubmit={handleCreateSample}
        isSubmitting={createSampleMutation.isPending}
      />
    );
  }

  if (!hasSampleRequest && !r.revision_id) {
    return (
      <p className="text-sm text-slate-500 py-4">
        Upload and extract a Tech Pack first to create a sample request.
      </p>
    );
  }

  // --- Situation B & C: Has runs ---
  return (
    <div className="space-y-4">
      {/* Runs table */}
      {runs.length === 0 ? (
        <p className="text-sm text-slate-500">No sample runs yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="pb-2 font-medium">Run</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium text-right">Qty</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {runs.map((run) => {
                const isCurrentRun = r.sample_run?.id === run.id;
                const mwoStatus = isCurrentRun
                  ? r.sample_run?.mwo_status
                  : null;
                const mwoId = isCurrentRun
                  ? r.sample_run?.mwo_id
                  : null;
                const canIssueMWO =
                  mwoStatus === "draft" && mwoId;
                const canDownloadMWO =
                  mwoStatus === "issued" && mwoId;

                return (
                  <tr
                    key={run.id}
                    className={`hover:bg-slate-50 ${
                      isCurrentRun ? "bg-blue-50/50" : ""
                    }`}
                  >
                    <td className="py-2.5 pr-3 font-medium">
                      #{run.run_no}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">
                      {run.run_type_label || run.run_type}
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge
                        variant={
                          statusVariant[run.status] ?? "outline"
                        }
                        className="text-xs"
                      >
                        {run.status_label ||
                          formatStatus(run.status)}
                      </Badge>
                      {mwoStatus && (
                        <Badge
                          variant={
                            mwoStatus === "issued"
                              ? "default"
                              : "outline"
                          }
                          className="text-xs ml-1"
                        >
                          MWO {mwoStatus}
                        </Badge>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      {run.quantity}
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-1.5">
                        {canIssueMWO && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() =>
                              handleIssueMWO(run.id)
                            }
                            disabled={issueMWO.isPending}
                          >
                            {issueMWO.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3 h-3" />
                            )}
                            Issue MWO
                          </Button>
                        )}
                        {canDownloadMWO && (
                          <a
                            href={`${API_BASE_URL}/sample-runs/${run.id}/export-mwo-complete-pdf/`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                            >
                              <Download className="w-3 h-3" />
                              MWO PDF
                            </Button>
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Next Round */}
      {runsSummary?.can_create_next_run && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={handleCreateNextRound}
          disabled={createNextRound.isPending}
        >
          {createNextRound.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Scissors className="w-4 h-4" />
          )}
          Create Next Round
        </Button>
      )}
    </div>
  );
}
