"use client";

import Link from "next/link";
import { FileText, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StyleDocument } from "@/lib/api/style-detail";

interface DocumentsTabProps {
  documents: StyleDocument[];
  styleId?: string;
}

const fileTypeBadge: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  tech_pack: { label: "Tech Pack", variant: "default" },
  bom_only: { label: "BOM", variant: "secondary" },
  mixed: { label: "Mixed", variant: "outline" },
};

export function DocumentsTab({ documents, styleId }: DocumentsTabProps) {
  const uploadHref = styleId
    ? `/dashboard/upload?style_id=${styleId}`
    : "/dashboard/upload";
  if (!documents || documents.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500 mb-4">No documents yet</p>
        <Link href={uploadHref}>
          <Button size="sm" className="gap-1">
            <Upload className="w-4 h-4" />
            Upload Tech Pack
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="pb-2 font-medium">Filename</th>
              <th className="pb-2 font-medium">Type</th>
              <th className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {documents.map((doc) => {
              const ft = fileTypeBadge[doc.file_type] ?? {
                label: doc.file_type,
                variant: "outline" as const,
              };
              return (
                <tr key={doc.id} className="hover:bg-slate-50">
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[300px]">{doc.filename}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4">
                    <Badge variant={ft.variant} className="text-xs">
                      {ft.label}
                    </Badge>
                  </td>
                  <td className="py-2.5">
                    <span className="capitalize text-slate-600">
                      {doc.status?.replace(/_/g, " ") || "uploaded"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="pt-2">
        <Link href={uploadHref}>
          <Button variant="outline" size="sm" className="gap-1">
            <Upload className="w-4 h-4" />
            Upload More
          </Button>
        </Link>
      </div>
    </div>
  );
}
