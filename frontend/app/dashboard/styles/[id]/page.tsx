"use client";

import { use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Languages,
  Package,
  Ruler,
  Scissors,
  Download,
  Upload,
  ExternalLink,
} from "lucide-react";

import {
  useStyleReadiness,
  useBatchVerifyBOM,
  useBatchVerifySpec,
} from "@/lib/hooks/useStyleDetail";
import { ReadinessBar } from "@/components/styles/ReadinessBar";
import { StepCard } from "@/components/styles/StepCard";
import { DownloadsSection } from "@/components/styles/DownloadsSection";
import { DocumentsTab } from "@/components/styles/DocumentsTab";
import { TranslationTab } from "@/components/styles/TranslationTab";
import { BOMTab } from "@/components/styles/BOMTab";
import { SpecTab } from "@/components/styles/SpecTab";
import { SampleTab } from "@/components/styles/SampleTab";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function StyleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: readiness, isLoading, isError } = useStyleReadiness(id);

  const batchVerifyBOM = useBatchVerifyBOM(readiness?.revision_id ?? undefined);
  const batchVerifySpec = useBatchVerifySpec(
    readiness?.revision_id ?? undefined
  );

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/dashboard/styles">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="w-4 h-4" />
              Back to Styles
            </Button>
          </Link>
        </div>
        <div className="flex items-center justify-center py-24">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" />
          <span className="ml-3 text-slate-500">Loading style details...</span>
        </div>
      </div>
    );
  }

  if (isError || !readiness) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/dashboard/styles">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="w-4 h-4" />
              Back to Styles
            </Button>
          </Link>
        </div>
        <div className="text-center py-24">
          <p className="text-red-600 font-medium">
            Failed to load style details
          </p>
          <p className="text-slate-500 text-sm mt-2">
            The style may not exist or the server is unavailable.
          </p>
        </div>
      </div>
    );
  }

  const r = readiness;
  const hasTechPack = Boolean(r.tech_pack_revision_id);
  const bomReady = r.bom.total > 0 && r.bom.verified === r.bom.total;
  const specReady = r.spec.total > 0 && r.spec.verified === r.spec.total;

  // --- Step statuses ---
  const techPackStatus = hasTechPack ? "done" : "none";
  const translationStatus =
    !r.translation || r.translation.total === 0
      ? "none"
      : r.translation.progress >= 95
      ? "done"
      : "partial";
  const bomStatus =
    r.bom.total === 0 ? "none" : bomReady ? "done" : "partial";
  const specStatus =
    r.spec.total === 0 ? "none" : specReady ? "done" : "partial";
  const sampleStatus = !r.sample_request
    ? "none"
    : r.sample_run?.mwo_status === "issued"
    ? "done"
    : "partial";

  // --- Event handlers ---
  const handleBatchVerifyBOM = () => {
    batchVerifyBOM.mutate(undefined, {
      onSuccess: (data) => {
        toast.success(`${data.verified_count} items verified`);
      },
      onError: () => toast.error("BOM verification failed"),
    });
  };

  const handleBatchVerifySpec = () => {
    batchVerifySpec.mutate(undefined, {
      onSuccess: (data) => {
        toast.success(`${data.verified_count} items verified`);
      },
      onError: () => toast.error("Spec verification failed"),
    });
  };

  // Tech Pack summary
  const techPackSummary = hasTechPack
    ? `${r.documents?.length || 0} file${(r.documents?.length || 0) > 1 ? "s" : ""} uploaded`
    : "No Tech Pack uploaded";

  // Translation summary
  const translationSummary =
    !r.translation || r.translation.total === 0
      ? "No blocks to translate"
      : `${r.translation.progress}% (${r.translation.done}/${r.translation.total})`;

  // BOM summary
  const bomSummary =
    r.bom.total === 0
      ? "No BOM items"
      : `${r.bom.verified}/${r.bom.total} verified`;

  // Spec summary
  const specSummary =
    r.spec.total === 0
      ? "No measurements"
      : `${r.spec.verified}/${r.spec.total} verified`;

  // Sample summary
  const sampleSummary = !r.sample_request
    ? "No sample request"
    : formatStatus(r.sample_request.status);

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      {/* Back link */}
      <Link href="/dashboard/styles">
        <Button variant="ghost" size="sm" className="gap-1 -ml-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Styles
        </Button>
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {r.style_number}
            {r.style_name ? ` - ${r.style_name}` : ""}
          </h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
            {r.brand_name && <span>Brand: {r.brand_name}</span>}
            {r.season && <span>Season: {r.season}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {r.revision_label && (
            <Badge variant="outline" className="text-xs">
              Rev {r.revision_label}
            </Badge>
          )}
          {r.revision_status && (
            <Badge
              variant={
                r.revision_status === "approved" ? "default" : "outline"
              }
              className="text-xs"
            >
              {r.revision_status}
            </Badge>
          )}
        </div>
      </div>

      {/* Readiness Bar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Overall Readiness</CardTitle>
        </CardHeader>
        <CardContent>
          <ReadinessBar value={r.overall_readiness} />
        </CardContent>
      </Card>

      {/* ========== STEPPER ========== */}
      <div className="space-y-3">
        {/* Step 1: Tech Pack */}
        <StepCard
          step={1}
          title="Tech Pack"
          icon={<FileText className="w-4 h-4" />}
          status={techPackStatus as any}
          summary={techPackSummary}
          actions={
            <Link href={`/dashboard/upload?style_id=${id}`}>
              <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
                <Upload className="w-3 h-3" />
                Upload
              </Button>
            </Link>
          }
        >
          <DocumentsTab documents={r.documents} styleId={id} />
        </StepCard>

        {/* Step 2: Translation */}
        <StepCard
          step={2}
          title="Translation"
          icon={<Languages className="w-4 h-4" />}
          status={translationStatus as any}
          summary={translationSummary}
          actions={
            r.tech_pack_revision_id ? (
              <Link
                href={`/dashboard/revisions/${r.tech_pack_revision_id}/review`}
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 h-7 text-xs"
                >
                  Review
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </Link>
            ) : undefined
          }
        >
          <TranslationTab
            translation={r.translation}
            techPackRevisionId={r.tech_pack_revision_id}
          />
        </StepCard>

        {/* Step 3: BOM */}
        <StepCard
          step={3}
          title="BOM"
          icon={<Package className="w-4 h-4" />}
          status={bomStatus as any}
          summary={bomSummary}
          actions={
            <div className="flex items-center gap-1.5">
              {bomStatus === "partial" && r.revision_id && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={handleBatchVerifyBOM}
                  disabled={batchVerifyBOM.isPending}
                >
                  {batchVerifyBOM.isPending ? "Verifying..." : "Verify All"}
                </Button>
              )}
              {r.revision_id && (
                <Link href={`/dashboard/revisions/${r.revision_id}/bom`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 h-7 text-xs"
                  >
                    Edit
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </Link>
              )}
            </div>
          }
        >
          <BOMTab
            revisionId={r.revision_id}
            bomSummary={r.bom}
            onBatchVerify={handleBatchVerifyBOM}
            isBatchVerifying={batchVerifyBOM.isPending}
          />
        </StepCard>

        {/* Step 4: Spec */}
        <StepCard
          step={4}
          title="Spec"
          icon={<Ruler className="w-4 h-4" />}
          status={specStatus as any}
          summary={specSummary}
          actions={
            <div className="flex items-center gap-1.5">
              {specStatus === "partial" && r.revision_id && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={handleBatchVerifySpec}
                  disabled={batchVerifySpec.isPending}
                >
                  {batchVerifySpec.isPending ? "Verifying..." : "Verify All"}
                </Button>
              )}
              {r.revision_id && (
                <Link href={`/dashboard/revisions/${r.revision_id}/spec`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 h-7 text-xs"
                  >
                    Edit
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </Link>
              )}
            </div>
          }
        >
          <SpecTab
            revisionId={r.revision_id}
            specSummary={r.spec}
            onBatchVerify={handleBatchVerifySpec}
            isBatchVerifying={batchVerifySpec.isPending}
          />
        </StepCard>

        {/* Step 5: Sample & MWO */}
        <StepCard
          step={5}
          title="Sample & MWO"
          icon={<Scissors className="w-4 h-4" />}
          status={sampleStatus as any}
          summary={sampleSummary}
          defaultExpanded={true}
          actions={
            r.sample_request ? (
              <Link
                href={`/dashboard/samples/kanban?style=${r.style_number}`}
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 h-7 text-xs"
                >
                  Kanban
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </Link>
            ) : undefined
          }
        >
          <SampleTab readiness={r} />
        </StepCard>

        {/* Step 6: Downloads (only when there are runs with MWO) */}
        {r.sample_run?.mwo_status && (
          <StepCard
            step={6}
            title="Downloads"
            icon={<Download className="w-4 h-4" />}
            status={r.sample_run.mwo_status === "issued" ? "done" : "partial"}
            summary={
              r.sample_run.mwo_status === "issued"
                ? "MWO issued — ready to download"
                : "MWO draft — issue first"
            }
            defaultExpanded={r.sample_run.mwo_status === "issued"}
          >
            <DownloadsSection
              runId={r.sample_run.id}
              styleNumber={r.style_number}
              runNo={r.sample_run.run_no}
              mwoStatus={r.sample_run.mwo_status}
            />
          </StepCard>
        )}
      </div>
    </div>
  );
}
