"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { useBOMItems, useTranslateBOMBatch, useDeleteBOMItem, useCreateBOMItem } from "@/lib/hooks/useBom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BOMEditDrawer } from "@/components/bom/BOMEditDrawer";
import { BOMTranslationDrawer } from "@/components/bom/BOMTranslationDrawer";
import { EditableConsumptionCell } from "@/components/bom/EditableConsumptionCell";
import type { BOMItem } from "@/lib/types/bom";
import { ArrowUpDown, Languages, Sparkles, Package, ArrowLeft, Trash2, Plus, Ruler, DollarSign, LayoutDashboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { apiClient } from "@/lib/api/client";
import { ReadinessWarningBanner } from "@/components/styles/ReadinessWarningBanner";
import { StyleBreadcrumb } from "@/components/styles/StyleBreadcrumb";

// 取得 Style 資訊（透過 revision → style）
async function fetchStyleInfo(revisionId: string) {
  const revData = await apiClient<any>(`/style-revisions/${revisionId}/`);
  const styleId = revData.style;
  if (!styleId) return null;
  return apiClient<any>(`/styles/${styleId}/`);
}

const columnHelper = createColumnHelper<BOMItem>();

export default function BOMPage() {
  const params = useParams();
  const revisionId = params.id as string;
  const [editingItem, setEditingItem] = useState<BOMItem | null>(null);
  const [translatingItem, setTranslatingItem] = useState<BOMItem | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newItemData, setNewItemData] = useState({
    material_name: "",
    category: "fabric" as "fabric" | "trim" | "packaging" | "label",
    supplier: "",
    unit: "YD",
    consumption: "",
    unit_price: "",
  });

  const { data: bomData, isLoading, error } = useBOMItems(revisionId);
  const translateBatchMutation = useTranslateBOMBatch(revisionId);
  const deleteMutation = useDeleteBOMItem(revisionId);
  const createMutation = useCreateBOMItem(revisionId);

  const handleAddItem = async () => {
    if (!newItemData.material_name.trim()) {
      alert("請輸入物料名稱");
      return;
    }
    try {
      await createMutation.mutateAsync({
        material_name: newItemData.material_name,
        category: newItemData.category,
        supplier: newItemData.supplier || undefined,
        unit: newItemData.unit || "YD",
        consumption: newItemData.consumption || undefined,
        unit_price: newItemData.unit_price || undefined,
      });
      setIsAddDialogOpen(false);
      setNewItemData({
        material_name: "",
        category: "fabric",
        supplier: "",
        unit: "YD",
        consumption: "",
        unit_price: "",
      });
    } catch (err) {
      alert(`新增失敗：${(err as Error).message}`);
    }
  };

  // 取得款式資訊
  const { data: styleData } = useQuery({
    queryKey: ["style-info", revisionId],
    queryFn: () => fetchStyleInfo(revisionId),
    enabled: !!revisionId,
  });

  const styleNumber = styleData?.style_number || "";
  const styleName = styleData?.style_name || "";

  const columns = useMemo(
    () => [
      columnHelper.accessor("item_number", {
        header: "#",
        cell: (info) => (
          <div className="font-medium text-center w-12">{info.getValue()}</div>
        ),
        size: 50,
      }),
      columnHelper.accessor("category_display", {
        header: "分類",
        cell: (info) => (
          <Badge variant="outline" className="text-xs">
            {info.getValue()}
          </Badge>
        ),
        size: 80,
      }),
      columnHelper.accessor("material_name", {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2"
          >
            物料名稱
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: (info) => (
          <div className="max-w-xs truncate" title={info.getValue()}>
            {info.getValue()}
          </div>
        ),
        size: 200,
      }),
      columnHelper.accessor("material_name_zh", {
        header: "中文名稱",
        cell: (info) => {
          const value = info.getValue();
          const status = info.row.original.translation_status;
          return (
            <div className="flex items-center gap-2">
              <span className="text-sm truncate max-w-[120px]" title={value || ""}>
                {value || "-"}
              </span>
              {status === "confirmed" && (
                <Badge variant="default" className="text-[10px] px-1 py-0">
                  已確認
                </Badge>
              )}
            </div>
          );
        },
        size: 150,
      }),
      columnHelper.accessor("supplier", {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2"
          >
            供應商
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: (info) => (
          <div className="max-w-xs truncate text-sm" title={info.getValue()}>
            {info.getValue()}
          </div>
        ),
        size: 150,
      }),
      columnHelper.accessor("supplier_article_no", {
        header: "供應商編號",
        cell: (info) => (
          <div className="text-sm text-muted-foreground">
            {info.getValue() || "-"}
          </div>
        ),
        size: 120,
      }),
      columnHelper.accessor("color", {
        header: "顏色",
        cell: (info) => (
          <div className="text-xs text-muted-foreground truncate max-w-[100px]" title={info.getValue()}>
            {info.getValue() || "-"}
          </div>
        ),
        size: 100,
      }),
      columnHelper.accessor("material_status", {
        header: "狀態",
        cell: (info) => {
          const status = info.getValue();
          return status ? (
            <Badge
              variant={
                status.includes("Approved")
                  ? "default"
                  : status.includes("Rejected")
                  ? "destructive"
                  : "secondary"
              }
              className="text-xs"
            >
              {status}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          );
        },
        size: 130,
      }),
      columnHelper.display({
        id: "consumption",
        header: "用量",
        cell: ({ row }) => (
          <EditableConsumptionCell
            item={row.original}
            revisionId={revisionId}
          />
        ),
        size: 180,
      }),
      columnHelper.accessor("unit", {
        header: "單位",
        cell: (info) => <div className="text-sm">{info.getValue()}</div>,
        size: 60,
      }),
      columnHelper.accessor("unit_price", {
        header: "單價",
        cell: (info) => (
          <div className="text-sm">
            {info.getValue() ? `$${info.getValue()}` : "-"}
          </div>
        ),
        size: 80,
      }),
      columnHelper.accessor("leadtime_days", {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2"
          >
            交期(天)
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: (info) => <div className="text-sm">{info.getValue() || "-"}</div>,
        size: 90,
      }),
      columnHelper.display({
        id: "actions",
        header: "操作",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTranslatingItem(row.original)}
              title="翻譯"
            >
              <Languages className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingItem(row.original)}
              title="編輯"
            >
              編輯
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm(`確定要刪除 "${row.original.material_name}" 嗎？`)) {
                  deleteMutation.mutate(row.original.id);
                }
              }}
              disabled={deleteMutation.isPending}
              title="刪除"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
        size: 150,
      }),
    ],
    [revisionId, deleteMutation]
  );

  const table = useReactTable({
    data: bomData?.results || [],
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
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

  const items = bomData?.results || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/dashboard/bom">
              <Button variant="ghost" size="sm" className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                返回列表
              </Button>
            </Link>
            <div className="h-4 w-px bg-border" />
            <Link href={`/dashboard/revisions/${revisionId}/spec`}>
              <Button variant="ghost" size="sm" className="gap-1">
                <Ruler className="h-4 w-4" />
                Spec 尺寸
              </Button>
            </Link>
            <Link href={`/dashboard/revisions/${revisionId}/costing-phase23`}>
              <Button variant="ghost" size="sm" className="gap-1">
                <DollarSign className="h-4 w-4" />
                報價
              </Button>
            </Link>
            {styleData?.id && (
              <>
                <div className="h-4 w-px bg-border" />
                <Link href={`/dashboard/styles/${styleData.id}`}>
                  <Button variant="ghost" size="sm" className="gap-1 text-blue-600 hover:text-blue-700">
                    <LayoutDashboard className="h-4 w-4" />
                    Style Center
                  </Button>
                </Link>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Package className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold">
                {styleNumber || "載入中..."}
                {styleName && <span className="text-muted-foreground font-normal ml-2">- {styleName}</span>}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                BOM 物料清單 - 管理物料、用量與交期
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            新增物料
          </Button>
          <Button
            variant="outline"
            onClick={() => translateBatchMutation.mutate(false)}
            disabled={translateBatchMutation.isPending}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {translateBatchMutation.isPending ? "翻譯中..." : "AI 批量翻譯"}
          </Button>
          <Badge variant="secondary" className="text-base px-3 py-1">
            共 {items.length} 項
          </Badge>
        </div>
      </div>

      {/* Breadcrumb + Readiness Warning Banner */}
      {styleData?.id && (
        <StyleBreadcrumb styleId={styleData.id} styleNumber={styleData.style_number} currentPage="BOM" />
      )}
      <ReadinessWarningBanner styleId={styleData?.id} />

      {/* Search */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="搜尋物料名稱、供應商..."
          value={globalFilter ?? ""}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b bg-muted/50">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className="px-4 py-3 text-left text-sm font-medium text-muted-foreground"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    無 BOM 資料
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b hover:bg-muted/50 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                        className="px-4 py-3"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Drawer */}
      {editingItem && (
        <BOMEditDrawer
          item={editingItem}
          revisionId={revisionId}
          open={!!editingItem}
          onClose={() => setEditingItem(null)}
        />
      )}

      {/* Translation Drawer */}
      {translatingItem && (
        <BOMTranslationDrawer
          item={translatingItem}
          revisionId={revisionId}
          open={!!translatingItem}
          onClose={() => setTranslatingItem(null)}
        />
      )}

      {/* Add Item Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>新增物料</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="material_name">物料名稱 *</Label>
              <Input
                id="material_name"
                value={newItemData.material_name}
                onChange={(e) => setNewItemData({ ...newItemData, material_name: e.target.value })}
                placeholder="例如：Main Body Fabric"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="category">類別</Label>
                <Select
                  value={newItemData.category}
                  onValueChange={(value: "fabric" | "trim" | "packaging" | "label") =>
                    setNewItemData({ ...newItemData, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fabric">Fabric 面料</SelectItem>
                    <SelectItem value="trim">Trim 輔料</SelectItem>
                    <SelectItem value="packaging">Packaging 包裝</SelectItem>
                    <SelectItem value="label">Label 標籤</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit">單位</Label>
                <Select
                  value={newItemData.unit}
                  onValueChange={(value) => setNewItemData({ ...newItemData, unit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YD">YD (碼)</SelectItem>
                    <SelectItem value="M">M (米)</SelectItem>
                    <SelectItem value="PCS">PCS (件)</SelectItem>
                    <SelectItem value="SET">SET (套)</SelectItem>
                    <SelectItem value="ROLL">ROLL (捲)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplier">供應商</Label>
              <Input
                id="supplier"
                value={newItemData.supplier}
                onChange={(e) => setNewItemData({ ...newItemData, supplier: e.target.value })}
                placeholder="例如：ABC Textile Co."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="consumption">用量</Label>
                <Input
                  id="consumption"
                  type="number"
                  step="0.01"
                  value={newItemData.consumption}
                  onChange={(e) => setNewItemData({ ...newItemData, consumption: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit_price">單價 (USD)</Label>
                <Input
                  id="unit_price"
                  type="number"
                  step="0.01"
                  value={newItemData.unit_price}
                  onChange={(e) => setNewItemData({ ...newItemData, unit_price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAddItem} disabled={createMutation.isPending}>
              {createMutation.isPending ? "新增中..." : "新增"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
