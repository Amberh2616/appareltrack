"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { API_BASE_URL } from "@/lib/api/client";

const API_BASE = API_BASE_URL;

interface Revision {
  id: string;
  filename: string;
  page_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}

async function fetchRevisions(): Promise<Revision[]> {
  const res = await fetch(`${API_BASE}/revisions/`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch revisions");
  const data = await res.json();
  return data.results || data; // Handle paginated or direct array response
}

export default function RevisionsListPage() {
  const { data: revisions, isLoading, error } = useQuery({
    queryKey: ["revisions"],
    queryFn: fetchRevisions,
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">載入中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
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
          <h1 className="text-2xl font-bold">Tech Pack 審稿列表</h1>
          <p className="text-sm text-muted-foreground mt-1">
            批次測試：一次審 10 份 Tech Pack
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-base px-3 py-1">
            共 {revisions?.length || 0} 份
          </Badge>
        </div>
      </div>

      {/* Revisions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {revisions?.map((revision, idx) => (
          <Card key={revision.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground mb-1">
                    #{idx + 1}
                  </div>
                  <div className="font-semibold text-sm truncate" title={revision.filename}>
                    {revision.filename}
                  </div>
                </div>
                <Badge
                  variant={revision.status === "parsed" ? "default" : "secondary"}
                  className="shrink-0"
                >
                  {revision.status}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div>
                  <span className="font-medium">Pages:</span> {revision.page_count}
                </div>
                <div>
                  <span className="font-medium">ID:</span> {revision.id.slice(0, 8)}...
                </div>
              </div>

              <Link href={`/dashboard/revisions/${revision.id}/review`}>
                <Button className="w-full" size="sm">
                  開始審稿 →
                </Button>
              </Link>

              <div className="text-xs text-muted-foreground">
                建立時間：{new Date(revision.created_at).toLocaleString("zh-TW", {
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {!revisions || revisions.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-muted-foreground mb-4">尚無 Tech Pack</div>
          <div className="text-sm text-muted-foreground">
            執行：<code className="bg-muted px-2 py-1 rounded">python manage.py seed_10_revisions</code>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
