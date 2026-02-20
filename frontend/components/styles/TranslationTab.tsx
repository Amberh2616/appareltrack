"use client";

import { useState } from "react";
import Link from "next/link";
import { Languages, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  translateDocument,
  retryFailedTranslations,
} from "@/lib/api/translation";
import type { TranslationProgress } from "@/lib/api/style-detail";

interface TranslationTabProps {
  translation: TranslationProgress;
  techPackRevisionId: string | null;
}

export function TranslationTab({
  translation,
  techPackRevisionId,
}: TranslationTabProps) {
  const [translating, setTranslating] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!techPackRevisionId || translation.total === 0) {
    return (
      <div className="text-center py-12">
        <Languages className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500">
          No translation blocks available. Upload and extract a Tech Pack first.
        </p>
      </div>
    );
  }

  const handleTranslateAll = async () => {
    setTranslating(true);
    setMessage(null);
    try {
      const result = await translateDocument(techPackRevisionId, {
        mode: "missing_only",
      });
      if ("task_id" in result) {
        setMessage("Translation started in background.");
      } else {
        setMessage(
          `Translated ${result.success} blocks. ${result.failed} failed.`
        );
      }
    } catch {
      setMessage("Translation failed. Please try again.");
    } finally {
      setTranslating(false);
    }
  };

  const handleRetryFailed = async () => {
    setRetrying(true);
    setMessage(null);
    try {
      const result = await retryFailedTranslations(techPackRevisionId);
      if ("task_id" in result) {
        setMessage("Retry started in background.");
      } else {
        setMessage(
          `Retried: ${result.success} succeeded, ${result.failed} still failed.`
        );
      }
    } catch {
      setMessage("Retry failed. Please try again.");
    } finally {
      setRetrying(false);
    }
  };

  const tr = translation;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600 font-medium">
            Translation Progress
          </span>
          <span className="text-slate-500">
            {tr.done}/{tr.total} ({tr.progress}%)
          </span>
        </div>
        <Progress value={tr.progress} className="h-2" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Done" value={tr.done} color="text-green-600" />
        <StatCard label="Pending" value={tr.pending} color="text-amber-600" />
        <StatCard label="Failed" value={tr.failed} color="text-red-600" />
        <StatCard label="Skipped" value={tr.skipped} color="text-slate-400" />
      </div>

      {/* Message */}
      {message && (
        <p className="text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded">
          {message}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {tr.pending > 0 && (
          <Button
            size="sm"
            onClick={handleTranslateAll}
            disabled={translating}
            className="gap-1"
          >
            <Languages className="w-4 h-4" />
            {translating ? "Translating..." : "Translate All"}
          </Button>
        )}

        {tr.failed > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleRetryFailed}
            disabled={retrying}
            className="gap-1"
          >
            <RefreshCw className="w-4 h-4" />
            {retrying ? "Retrying..." : "Retry Failed"}
          </Button>
        )}

        <Link href={`/dashboard/revisions/${techPackRevisionId}/review`}>
          <Button variant="outline" size="sm" className="gap-1">
            Open Translation Editor
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
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-slate-50 rounded-md px-3 py-2 text-center">
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
