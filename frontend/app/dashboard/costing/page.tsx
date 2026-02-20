"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calculator,
  Search,
  ArrowRight,
  DollarSign,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";

interface CostSheetVersion {
  id: string;
  style_number: string;
  version_no: number;
  costing_type: "sample" | "bulk";
  costing_type_display: string;
  status: string;
  status_display: string;
  unit_price: string;
  techpack_revision: string;
  created_at: string;
  submitted_at: string | null;
}

interface StyleWithCosting {
  id: string;
  style_number: string;
  style_name: string;
  revisionId: string | null;
  sampleVersions: CostSheetVersion[];
  bulkVersions: CostSheetVersion[];
}

// API to get all cost sheet versions
async function fetchAllCostSheetVersions(): Promise<CostSheetVersion[]> {
  const data = await apiClient<{ results: CostSheetVersion[] }>(`/cost-sheet-versions/?page_size=500`);
  return (data as any).results || data as any;
}

// API to get styles
async function fetchStyles(search: string): Promise<any[]> {
  const params = new URLSearchParams({ page_size: "200" });
  if (search) params.set("search", search);
  return apiClient<any[]>(`/styles/?${params}`);
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  draft: { icon: <FileText className="h-4 w-4" />, color: "text-blue-600 bg-blue-100" },
  submitted: { icon: <Clock className="h-4 w-4" />, color: "text-amber-600 bg-amber-100" },
  accepted: { icon: <CheckCircle className="h-4 w-4" />, color: "text-green-600 bg-green-100" },
  rejected: { icon: <XCircle className="h-4 w-4" />, color: "text-red-600 bg-red-100" },
};

export default function CostingOverviewPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch all cost sheet versions
  const { data: costSheetVersions, isLoading: loadingVersions, error: errorVersions } = useQuery({
    queryKey: ["all-cost-sheet-versions"],
    queryFn: fetchAllCostSheetVersions,
  });

  // Fetch styles
  const { data: styles, isLoading: loadingStyles, error: errorStyles } = useQuery({
    queryKey: ["styles-for-costing", debouncedSearch],
    queryFn: () => fetchStyles(debouncedSearch),
  });

  const isLoading = loadingVersions || loadingStyles;
  const error = errorVersions || errorStyles;

  // Group versions by style
  const stylesWithCosting: StyleWithCosting[] = useMemo(() => (styles || []).map((style: any) => {
    const versions = (costSheetVersions || []).filter(
      (v) => v.style_number === style.style_number
    );
    return {
      id: style.id,
      style_number: style.style_number,
      style_name: style.style_name,
      revisionId: versions[0]?.techpack_revision || null,
      sampleVersions: versions.filter((v) => v.costing_type === "sample"),
      bulkVersions: versions.filter((v) => v.costing_type === "bulk"),
    };
  }), [styles, costSheetVersions]);

  const filteredStyles = stylesWithCosting;

  // Calculate stats
  const totalSampleVersions = filteredStyles.reduce(
    (acc, s) => acc + s.sampleVersions.length,
    0
  );
  const totalBulkVersions = filteredStyles.reduce(
    (acc, s) => acc + s.bulkVersions.length,
    0
  );
  const acceptedVersions = filteredStyles.reduce(
    (acc, s) =>
      acc +
      s.sampleVersions.filter((v) => v.status === "accepted").length +
      s.bulkVersions.filter((v) => v.status === "accepted").length,
    0
  );

  // Get latest version info
  const getLatestVersion = (versions: CostSheetVersion[]) => {
    if (versions.length === 0) return null;
    return versions.sort((a, b) => b.version_no - a.version_no)[0];
  };

  if (isLoading && !styles) {
    return (
      <div className="p-6">
        <div className="text-muted-foreground">載入中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
          錯誤：{(error as Error).message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6" />
            報價管理 Costing
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理樣衣報價（Sample）與大貨報價（Bulk）
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              款式數量
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredStyles.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              樣衣報價
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalSampleVersions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              大貨報價
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{totalBulkVersions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              已確認
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{acceptedVersions}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜尋款號或名稱..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">款號</TableHead>
              <TableHead>款式名稱</TableHead>
              <TableHead className="text-center">Sample 報價</TableHead>
              <TableHead className="text-center">Bulk 報價</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStyles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  {search ? "無符合搜尋條件的款式" : "尚無報價資料"}
                </TableCell>
              </TableRow>
            ) : (
              filteredStyles.map((style) => {
                const latestSample = getLatestVersion(style.sampleVersions);
                const latestBulk = getLatestVersion(style.bulkVersions);

                return (
                  <TableRow key={style.id}>
                    <TableCell className="font-medium">{style.style_number}</TableCell>
                    <TableCell className="text-muted-foreground">{style.style_name}</TableCell>
                    <TableCell className="text-center">
                      {latestSample ? (
                        <div className="flex items-center justify-center gap-2">
                          <Badge className={STATUS_CONFIG[latestSample.status]?.color || "bg-gray-100"}>
                            {STATUS_CONFIG[latestSample.status]?.icon}
                            <span className="ml-1">v{latestSample.version_no}</span>
                          </Badge>
                          <span className="text-sm font-medium">
                            ${parseFloat(latestSample.unit_price).toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {latestBulk ? (
                        <div className="flex items-center justify-center gap-2">
                          <Badge className={STATUS_CONFIG[latestBulk.status]?.color || "bg-gray-100"}>
                            {STATUS_CONFIG[latestBulk.status]?.icon}
                            <span className="ml-1">v{latestBulk.version_no}</span>
                          </Badge>
                          <span className="text-sm font-medium">
                            ${parseFloat(latestBulk.unit_price).toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {style.revisionId ? (
                        <Link href={`/dashboard/revisions/${style.revisionId}/costing-phase23`}>
                          <Button variant="outline" size="sm">
                            <DollarSign className="h-4 w-4 mr-1" />
                            編輯報價
                            <ArrowRight className="h-4 w-4 ml-1" />
                          </Button>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground text-sm">無版本</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
