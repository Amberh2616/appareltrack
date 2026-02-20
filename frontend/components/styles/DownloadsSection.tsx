"use client";

import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  exportMWOCompletePDF,
  exportEstimatePDF,
  exportMWO,
  exportEstimate,
  downloadBlob,
} from "@/lib/api/samples";

interface DownloadsSectionProps {
  runId: string;
  styleNumber: string;
  runNo: number;
  mwoStatus: string | null;
}

export function DownloadsSection({
  runId,
  styleNumber,
  runNo,
  mwoStatus,
}: DownloadsSectionProps) {
  const [downloadingMwoPdf, setDownloadingMwoPdf] = useState(false);
  const [downloadingMwoExcel, setDownloadingMwoExcel] = useState(false);
  const [downloadingQuotePdf, setDownloadingQuotePdf] = useState(false);
  const [downloadingQuoteExcel, setDownloadingQuoteExcel] = useState(false);

  if (!mwoStatus) return null;

  const handleDownload = async (
    fetcher: () => Promise<Blob>,
    filename: string,
    setLoading: (v: boolean) => void
  ) => {
    setLoading(true);
    try {
      const blob = await fetcher();
      downloadBlob(blob, filename);
      toast.success(`Downloaded ${filename}`);
    } catch (err) {
      toast.error("Download failed");
    } finally {
      setLoading(false);
    }
  };

  const prefix = `${styleNumber}_Run${runNo}`;

  return (
    <div className="space-y-3">
      {/* MWO Downloads */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-600 w-14 shrink-0">MWO:</span>
        <Button
          variant="outline"
          size="sm"
          className="gap-1 h-7 text-xs"
          disabled={downloadingMwoPdf}
          onClick={() =>
            handleDownload(
              () => exportMWOCompletePDF(runId),
              `${prefix}_MWO.pdf`,
              setDownloadingMwoPdf
            )
          }
        >
          {downloadingMwoPdf ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <FileText className="w-3 h-3" />
          )}
          PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1 h-7 text-xs"
          disabled={downloadingMwoExcel}
          onClick={() =>
            handleDownload(
              () => exportMWO(runId),
              `${prefix}_MWO.xlsx`,
              setDownloadingMwoExcel
            )
          }
        >
          {downloadingMwoExcel ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Download className="w-3 h-3" />
          )}
          Excel
        </Button>
      </div>

      {/* Quote Downloads */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-600 w-14 shrink-0">Quote:</span>
        <Button
          variant="outline"
          size="sm"
          className="gap-1 h-7 text-xs"
          disabled={downloadingQuotePdf}
          onClick={() =>
            handleDownload(
              () => exportEstimatePDF(runId),
              `${prefix}_Quote.pdf`,
              setDownloadingQuotePdf
            )
          }
        >
          {downloadingQuotePdf ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <FileText className="w-3 h-3" />
          )}
          PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1 h-7 text-xs"
          disabled={downloadingQuoteExcel}
          onClick={() =>
            handleDownload(
              () => exportEstimate(runId),
              `${prefix}_Quote.xlsx`,
              setDownloadingQuoteExcel
            )
          }
        >
          {downloadingQuoteExcel ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Download className="w-3 h-3" />
          )}
          Excel
        </Button>
      </div>
    </div>
  );
}
