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
import { Package, FileText, Search } from "lucide-react";
import { apiClient } from "@/lib/api/client";

interface StyleItem {
  id: string;
  style_number: string;
  style_name: string;
  season: string;
  customer: string;
  current_revision_label: string | null;
  current_revision_status: string | null;
  revision_count: number;
  created_at: string;
}

interface StyleDetail {
  id: string;
  style_number: string;
  style_name: string;
  revisions: {
    id: string;
    revision_no: number;
    revision_label: string;
    status: string;
  }[];
}

// API to get styles list
async function fetchStylesList(search: string): Promise<StyleItem[]> {
  const params = new URLSearchParams({ page_size: "200" });
  if (search) params.set("search", search);
  return apiClient<StyleItem[]>(`/styles/?${params}`);
}

// API to get style detail with revisions
async function fetchStyleDetail(styleId: string): Promise<StyleDetail | null> {
  try {
    return await apiClient<StyleDetail>(`/styles/${styleId}/`);
  } catch (e) {
    console.error(`Error fetching style detail for ${styleId}:`, e);
    return null;
  }
}

export default function BOMOverviewPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [styleRevisions, setStyleRevisions] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: stylesData, isLoading, error } = useQuery({
    queryKey: ["styles-list", debouncedSearch],
    queryFn: () => fetchStylesList(debouncedSearch),
  });

  const styles = useMemo(() => stylesData || [], [stylesData]);

  // Fetch revision IDs for each style
  useEffect(() => {
    const fetchRevisions = async () => {
      const newRevisions: Record<string, string> = {};
      for (const style of styles) {
        const detail = await fetchStyleDetail(style.id);
        if (detail && detail.revisions && detail.revisions.length > 0) {
          // Get the latest revision (first in array)
          const latestRevision = detail.revisions[0];
          newRevisions[style.id] = latestRevision.id;
        }
      }
      setStyleRevisions(newRevisions);
    };

    if (styles.length > 0) {
      fetchRevisions();
    }
  }, [styles]);

  const filteredStyles = styles;

  if (isLoading && !stylesData) {
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
            <Package className="h-6 w-6" />
            BOM 物料管理
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理所有款式的物料清單、用量與翻譯
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              有 BOM 資料
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {Object.keys(styleRevisions).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              已連結版本
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {filteredStyles.filter(s => styleRevisions[s.id]).length}
            </div>
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

      {/* Styles Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">款號</TableHead>
              <TableHead>款式名稱</TableHead>
              <TableHead className="text-center">季節</TableHead>
              <TableHead className="text-center">客戶</TableHead>
              <TableHead className="text-center">版本狀態</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStyles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {search ? "無符合搜尋條件的款式" : "尚無款式資料"}
                </TableCell>
              </TableRow>
            ) : (
              filteredStyles.map((style) => {
                const revisionId = styleRevisions[style.id];

                return (
                  <TableRow key={style.id}>
                    <TableCell className="font-medium">{style.style_number}</TableCell>
                    <TableCell className="text-muted-foreground">{style.style_name}</TableCell>
                    <TableCell className="text-center">
                      {style.season || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      {style.customer || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      {style.current_revision_label ? (
                        <Badge variant="outline">
                          {style.current_revision_label}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {revisionId ? (
                        <Link href={`/dashboard/revisions/${revisionId}/bom`}>
                          <Button variant="outline" size="sm">
                            <FileText className="h-4 w-4 mr-1" />
                            BOM
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
