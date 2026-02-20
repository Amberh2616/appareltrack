"use client";

/**
 * Enhanced Styles List Page
 * Shows readiness status for each style (Tech Pack, BOM/Spec, Sample/MWO)
 */

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Search, Plus, Check, Clock, Minus, FileText } from "lucide-react";

import { useStyles } from "@/lib/hooks/useStyles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReadinessSummary, StyleListItemWithReadiness } from "@/lib/api/style-detail";

// Readiness cell helpers
function TechPackCell({ readiness }: { readiness: ReadinessSummary }) {
  if (!readiness?.has_tech_pack) {
    return <span className="text-slate-300"><Minus className="w-4 h-4" /></span>;
  }
  if (readiness.tech_pack_progress >= 95) {
    return <span className="text-green-600"><Check className="w-4 h-4" /></span>;
  }
  return (
    <span className="text-amber-500 text-xs font-medium">
      {readiness.tech_pack_progress}%
    </span>
  );
}

function BOMSpecCell({ total, verified }: { total: number; verified: number }) {
  if (total === 0) {
    return <span className="text-slate-300"><Minus className="w-4 h-4" /></span>;
  }
  const color =
    verified === total
      ? "text-green-600"
      : verified > 0
      ? "text-amber-600"
      : "text-slate-400";
  return <span className={`text-xs font-medium ${color}`}>{verified}/{total}</span>;
}

function SampleMWOCell({ readiness }: { readiness: ReadinessSummary }) {
  if (!readiness?.has_sample_request) {
    return <span className="text-slate-300"><Minus className="w-4 h-4" /></span>;
  }
  if (readiness.mwo_status === "issued") {
    return <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200">MWO Issued</Badge>;
  }
  if (readiness.mwo_status === "draft") {
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0">MWO Draft</Badge>;
  }
  return <Badge variant="outline" className="text-[10px] px-1.5 py-0">Sample</Badge>;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export default function StylesPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "ready" | "incomplete">("all");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isError } = useStyles({
    page,
    page_size: 100,
    search: debouncedSearch || undefined,
    ordering: sorting[0]
      ? `${sorting[0].desc ? "-" : ""}${sorting[0].id}`
      : "-created_at",
  });

  // Type-cast results since the backend now returns readiness
  const results = (data?.results || []) as unknown as StyleListItemWithReadiness[];

  // Client-side filter for readiness
  const filtered = useMemo(() => results.filter((s) => {
    if (filter === "all") return true;
    const r = s.readiness;
    if (!r) return filter === "incomplete";
    const isReady =
      r.has_tech_pack &&
      r.bom_total > 0 &&
      r.bom_verified === r.bom_total &&
      r.spec_total > 0 &&
      r.spec_verified === r.spec_total;
    return filter === "ready" ? isReady : !isReady;
  }), [results, filter]);

  const columns = useMemo<ColumnDef<StyleListItemWithReadiness>[]>(() => [
    {
      accessorKey: "style_number",
      header: "Style #",
      cell: ({ row }) => (
        <Link
          href={`/dashboard/styles/${row.original.id}`}
          className="font-medium text-blue-600 hover:underline"
        >
          {row.getValue("style_number")}
        </Link>
      ),
    },
    {
      accessorKey: "style_name",
      header: "Name",
      cell: ({ row }) => (
        <span className="text-sm truncate max-w-[200px] block">
          {row.getValue("style_name") || "-"}
        </span>
      ),
    },
    {
      accessorKey: "brand_name",
      header: "Brand",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.brand_name || row.original.customer || "-"}</span>
      ),
    },
    {
      accessorKey: "season",
      header: "Season",
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.getValue("season") || "-"}</span>
      ),
    },
    {
      id: "tech_pack",
      header: "Tech Pack",
      cell: ({ row }) => <TechPackCell readiness={row.original.readiness} />,
    },
    {
      id: "bom",
      header: "BOM",
      cell: ({ row }) => (
        <BOMSpecCell
          total={row.original.readiness?.bom_total || 0}
          verified={row.original.readiness?.bom_verified || 0}
        />
      ),
    },
    {
      id: "spec",
      header: "Spec",
      cell: ({ row }) => (
        <BOMSpecCell
          total={row.original.readiness?.spec_total || 0}
          verified={row.original.readiness?.spec_verified || 0}
        />
      ),
    },
    {
      id: "sample_mwo",
      header: "Sample/MWO",
      cell: ({ row }) => <SampleMWOCell readiness={row.original.readiness} />,
    },
    {
      accessorKey: "current_revision_label",
      header: "Rev",
      cell: ({ row }) => (
        <span className="text-xs text-slate-500">
          {row.getValue("current_revision_label") || "-"}
        </span>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Created",
      cell: ({ row }) => (
        <span className="text-xs text-slate-500">
          {formatDate(row.getValue("created_at"))}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Link href={`/dashboard/styles/${row.original.id}`}>
          <Button variant="ghost" size="sm" className="text-xs">
            View
          </Button>
        </Link>
      ),
    },
  ], []);

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Styles</h1>
          <p className="text-slate-500 text-sm mt-1">
            {data?.count || 0} styles total
          </p>
        </div>
        <Link href="/dashboard/upload">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Upload New
          </Button>
        </Link>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search style number, name, brand..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10"
          />
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(["all", "ready", "incomplete"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === f
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {f === "all" ? "All" : f === "ready" ? "Ready" : "Incomplete"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" />
            <p className="mt-4 text-slate-500 text-sm">Loading styles...</p>
          </div>
        ) : isError ? (
          <div className="p-12 text-center">
            <p className="text-red-600">Failed to load styles</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="text-xs">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-slate-50">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-2.5">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center text-slate-500"
                    >
                      No styles found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {(data?.count || 0) > 50 && (
              <div className="flex items-center justify-between px-6 py-3 border-t">
                <span className="text-xs text-slate-500">
                  Page {page} of {Math.ceil((data?.count || 0) / 50)}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!data?.next}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
