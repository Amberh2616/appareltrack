"use client";

import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Package,
} from "lucide-react";

import { useMaterials, useDeleteMaterial } from "@/lib/hooks/useMaterials";
import { useSuppliers } from "@/lib/hooks/useSuppliers";
import type { Material, MaterialCategory, MaterialStatus } from "@/lib/types/material";
import { MATERIAL_CATEGORY_OPTIONS, MATERIAL_STATUS_OPTIONS } from "@/lib/types/material";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MaterialFormDialog } from "./material-form-dialog";

// Category badge colors
const categoryColors: Record<MaterialCategory, string> = {
  fabric: "bg-blue-100 text-blue-800",
  trim: "bg-green-100 text-green-800",
  label: "bg-purple-100 text-purple-800",
  packaging: "bg-orange-100 text-orange-800",
};

// Status badge variants
const statusVariants: Record<MaterialStatus, "approved" | "draft" | "parsing" | "rejected"> = {
  active: "approved",
  pending_approval: "parsing",
  approved: "approved",
  discontinued: "rejected",
};

function CategoryBadge({ category }: { category: MaterialCategory }) {
  const option = MATERIAL_CATEGORY_OPTIONS.find((o) => o.value === category);
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${categoryColors[category] || "bg-gray-100 text-gray-800"}`}>
      {option?.label_zh || category}
    </span>
  );
}

function StatusBadge({ status }: { status: MaterialStatus }) {
  const option = MATERIAL_STATUS_OPTIONS.find((o) => o.value === status);
  return (
    <Badge variant={statusVariants[status] || "draft"}>
      {option?.label_zh || status}
    </Badge>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export default function MaterialsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [status, setStatus] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [page, setPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Fetch materials
  const { data, isLoading, isError } = useMaterials({
    page,
    page_size: 25,
    search: search || undefined,
    category: category || undefined,
    supplier: supplierId || undefined,
    status: status || undefined,
  });

  // Fetch suppliers for filter dropdown
  const { data: suppliersData } = useSuppliers({ page_size: 100 });

  const deleteMaterial = useDeleteMaterial();

  // Table columns
  const columns = useMemo<ColumnDef<Material>[]>(() => [
    {
      accessorKey: "article_no",
      header: "Article No.",
      cell: ({ row }) => (
        <div className="font-mono text-sm font-medium">{row.getValue("article_no")}</div>
      ),
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-slate-900">{row.original.name}</div>
          {row.original.name_zh && (
            <div className="text-xs text-slate-500">{row.original.name_zh}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => (
        <CategoryBadge category={row.getValue("category") as MaterialCategory} />
      ),
    },
    {
      accessorKey: "supplier_name",
      header: "Supplier",
      cell: ({ row }) => row.original.supplier_name || "-",
    },
    {
      accessorKey: "color",
      header: "Color",
      cell: ({ row }) => (
        <div>
          {row.original.color || "-"}
          {row.original.color_code && (
            <span className="text-xs text-slate-400 ml-1">({row.original.color_code})</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "unit_price",
      header: "Unit Price",
      cell: ({ row }) =>
        row.original.unit_price
          ? `${row.original.currency} ${row.original.unit_price}/${row.original.unit}`
          : "-",
    },
    {
      accessorKey: "lead_time_days",
      header: "Lead Time",
      cell: ({ row }) =>
        row.original.lead_time_days ? `${row.original.lead_time_days} days` : "-",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge status={row.getValue("status") as MaterialStatus} />
      ),
    },
    {
      accessorKey: "updated_at",
      header: "Updated",
      cell: ({ row }) => (
        <span className="text-xs text-slate-500">
          {formatDate(row.getValue("updated_at"))}
        </span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setEditingMaterial(row.original);
                setIsFormOpen(true);
              }}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-600"
              onClick={() => setDeleteConfirmId(row.original.id)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], []);

  const table = useReactTable({
    data: data?.results || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  const handleDelete = async (id: string) => {
    try {
      await deleteMaterial.mutateAsync(id);
      setDeleteConfirmId(null);
    } catch (error) {
      console.error("Failed to delete material:", error);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingMaterial(null);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="h-8 w-8" />
            Materials
          </h1>
          <p className="text-slate-500 mt-1">
            Manage your material master data ({data?.count || 0} total)
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Material
        </Button>
      </div>

      {/* Filters & Search */}
      <div className="flex items-center gap-4 bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by article no., name, color..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-md text-sm"
        >
          <option value="">All Categories</option>
          {MATERIAL_CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label_zh}
            </option>
          ))}
        </select>
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-md text-sm"
        >
          <option value="">All Suppliers</option>
          {suppliersData?.results?.map((sup) => (
            <option key={sup.id} value={sup.id}>
              {sup.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-md text-sm"
        >
          <option value="">All Status</option>
          {MATERIAL_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label_zh}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-slate-600">Loading materials...</p>
          </div>
        ) : isError ? (
          <div className="p-12 text-center">
            <p className="text-red-600">Failed to load materials</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
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
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
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
                      className="h-24 text-center"
                    >
                      No materials found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <div className="text-sm text-slate-500">
                Showing {((page - 1) * 25) + 1} to{" "}
                {Math.min(page * 25, data?.count || 0)} of {data?.count || 0}{" "}
                materials
              </div>
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
          </>
        )}
      </div>

      {/* Create/Edit Form Dialog */}
      <MaterialFormDialog
        open={isFormOpen}
        onClose={handleFormClose}
        material={editingMaterial}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={() => setDeleteConfirmId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <p className="text-slate-600">
            Are you sure you want to delete this material? This action cannot be
            undone.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={deleteMaterial.isPending}
            >
              {deleteMaterial.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
