"use client";

import { useState } from "react";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type StepStatus = "done" | "partial" | "none";

interface StepCardProps {
  step: number;
  title: string;
  icon: React.ReactNode;
  status: StepStatus;
  summary: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  defaultExpanded?: boolean;
}

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "done") {
    return <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />;
  }
  if (status === "partial") {
    return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
  }
  return <XCircle className="w-5 h-5 text-slate-300 shrink-0" />;
}

export function StepCard({
  step,
  title,
  icon,
  status,
  summary,
  actions,
  children,
  defaultExpanded = false,
}: StepCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const borderColor =
    status === "done"
      ? "border-l-green-500"
      : status === "partial"
      ? "border-l-amber-500"
      : "border-l-slate-200";

  return (
    <Card className={`border-l-4 ${borderColor}`}>
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Step number */}
        <span className="text-xs font-bold text-slate-400 w-5 shrink-0">
          {step}
        </span>

        {/* Icon */}
        <span className="text-slate-500 shrink-0">{icon}</span>

        {/* Title + summary */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-800">{title}</span>
            <StatusIcon status={status} />
          </div>
          <p className="text-sm text-slate-500 truncate">{summary}</p>
        </div>

        {/* Actions (stop propagation so clicks don't toggle expand) */}
        {actions && (
          <div
            className="flex items-center gap-2 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}

        {/* Expand toggle */}
        {children && (
          <span className="text-slate-400 shrink-0">
            {expanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </span>
        )}
      </div>

      {expanded && children && (
        <CardContent className="pt-0 pb-4 px-5 ml-8 border-t border-slate-100">
          <div className="pt-4">{children}</div>
        </CardContent>
      )}
    </Card>
  );
}
