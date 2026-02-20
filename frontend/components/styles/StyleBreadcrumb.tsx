"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface StyleBreadcrumbProps {
  styleId: string;
  styleNumber: string;
  currentPage: "BOM" | "Spec" | "Costing" | "Translation";
}

export function StyleBreadcrumb({
  styleId,
  styleNumber,
  currentPage,
}: StyleBreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-slate-500">
      <Link
        href="/dashboard/styles"
        className="hover:text-slate-800 transition-colors"
      >
        Styles
      </Link>
      <ChevronRight className="w-3.5 h-3.5 shrink-0" />
      <Link
        href={`/dashboard/styles/${styleId}`}
        className="hover:text-slate-800 transition-colors font-medium text-slate-700"
      >
        {styleNumber}
      </Link>
      <ChevronRight className="w-3.5 h-3.5 shrink-0" />
      <span className="text-slate-800 font-medium">{currentPage}</span>
    </nav>
  );
}
