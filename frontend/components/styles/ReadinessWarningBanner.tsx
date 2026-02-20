'use client';

import Link from 'next/link';
import { useStyleReadiness } from '@/lib/hooks/useStyleDetail';
import { AlertTriangle, CheckCircle2, LayoutDashboard } from 'lucide-react';

interface ReadinessWarningBannerProps {
  styleId: string | undefined;
}

export function ReadinessWarningBanner({ styleId }: ReadinessWarningBannerProps) {
  const { data: readiness, isLoading } = useStyleReadiness(styleId);

  if (isLoading || !readiness || !styleId) return null;

  const overall = readiness.overall_readiness;
  const isReady = overall >= 100;

  const bomLabel = `BOM ${readiness.bom.verified}/${readiness.bom.total} verified`;
  const specLabel = `Spec ${readiness.spec.verified}/${readiness.spec.total} verified`;
  const translationLabel = readiness.translation.total > 0
    ? `Translation ${readiness.translation.progress}%`
    : null;

  return (
    <div
      className={`flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm ${
        isReady
          ? 'bg-green-50 border-green-200 text-green-800'
          : 'bg-amber-50 border-amber-200 text-amber-800'
      }`}
    >
      <div className="flex items-center gap-3">
        {isReady ? (
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
        )}
        <span className="font-medium">
          Readiness {overall}%
        </span>
        <span className="text-xs opacity-75">|</span>
        <span className="text-xs">{bomLabel}</span>
        <span className="text-xs opacity-75">|</span>
        <span className="text-xs">{specLabel}</span>
        {translationLabel && (
          <>
            <span className="text-xs opacity-75">|</span>
            <span className="text-xs">{translationLabel}</span>
          </>
        )}
      </div>
      <Link
        href={`/dashboard/styles/${styleId}`}
        className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
          isReady
            ? 'bg-green-100 hover:bg-green-200 text-green-700'
            : 'bg-amber-100 hover:bg-amber-200 text-amber-700'
        }`}
      >
        <LayoutDashboard className="h-3.5 w-3.5" />
        Style Center
      </Link>
    </div>
  );
}
