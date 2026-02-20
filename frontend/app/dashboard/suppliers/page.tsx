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
  Filter,
  MoreHorizontal,
  Pencil,
  Trash2,
  Building2,
  Phone,
  Mail,
} from "lucide-react";

import { useSuppliers, useDeleteSupplier } from "@/lib/hooks/useSuppliers";
import type { Supplier, SupplierType } from "@/lib/types/supplier";
import { SUPPLIER_TYPE_OPTIONS } from "@/lib/types/supplier";
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
import { SupplierFormDialog } from "./supplier-form-dialog";

// Supplier type badge colors
const supplierTypeColors: Record<SupplierType, string> = {
  fabric: "bg-blue-100 text-blue-800",
  trim: "bg-green-100 text-green-800",
  label: "bg-purple-100 text-purple-800",
  packaging: "bg-orange-100 text-orange-800",
  factory: "bg-red-100 text-red-800",
};

function SupplierTypeBadge({ type }: { type: SupplierType }) {
  const option = SUPPLIER_TYPE_OPTIONS.find((o) => o.value === type);
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${supplierTypeColors[type] || "bg-gray-100 text-gray-800"}`}>
      {option?.label_zh || type}
    </span>
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

export default function SuppliersPage() {
  const [search, setSearch] = useState("");
  const [supplierType, setSupplierType] = useState("");
  const [isActive, setIsActive] = useState<boolean | undefined>(undefined);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [page, setPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Fetch suppliers
  const { data, isLoading, isError } = useSuppliers({
    page,
    page_size: 25,
    search: search || undefined,
    supplier_type: supplierType || undefined,
    is_active: isActive,
  });

  const deleteSupplier = useDeleteSupplier();

  // Table columns
  const columns = useMemo<ColumnDef<Supplier>[]>(() => [
    {
      accessorKey: "name",
      header: "Name / Code",
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-slate-900">{row.original.name}</div>
          {row.original.supplier_code && (
            <div className="text-xs text-slate-500 font-mono">
              {row.original.supplier_code}
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "supplier_type",
      header: "Type",
      cell: ({ row }) => (
        <SupplierTypeBadge type={row.getValue("supplier_type") as SupplierType} />
      ),
    },
    {
      accessorKey: "contact_person",
      header: "Contact",
      cell: ({ row }) => (
        <div className="space-y-1">
          {row.original.contact_person && (
            <div className="flex items-center gap-1 text-sm">
              <Building2 className="h-3 w-3 text-slate-400" />
              {row.original.contact_person}
            </div>
          )}
          {row.original.phone && (
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Phone className="h-3 w-3" />
              {row.original.phone}
            </div>
          )}
          {row.original.email && (
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Mail className="h-3 w-3" />
              {row.original.email}
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "payment_terms",
      header: "Payment Terms",
      cell: ({ row }) => row.original.payment_terms || "-",
    },
    {
      accessorKey: "lead_time_days",
      header: "Lead Time",
      cell: ({ row }) =>
        row.original.lead_time_days
          ? `${row.original.lead_time_days} days`
          : "-",
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? "approved" : "draft"}>
          {row.original.is_active ? "Active" : "Inactive"}
        </Badge>
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
                setEditingSupplier(row.original);
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
      await deleteSupplier.mutateAsync(id);
      setDeleteConfirmId(null);
    } catch (error) {
      console.error("Failed to delete supplier:", error);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingSupplier(null);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Suppliers</h1>
          <p className="text-slate-500 mt-1">
            Manage your supplier database ({data?.count || 0} total)
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Supplier
        </Button>
      </div>

      {/* Filters & Search */}
      <div className="flex items-center gap-4 bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <select
          value={supplierType}
          onChange={(e) => setSupplierType(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-md text-sm"
        >
          <option value="">All Types</option>
          {SUPPLIER_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label_zh}
            </option>
          ))}
        </select>
        <select
          value={isActive === undefined ? "" : isActive ? "true" : "false"}
          onChange={(e) => {
            if (e.target.value === "") setIsActive(undefined);
            else setIsActive(e.target.value === "true");
          }}
          className="px-3 py-2 border border-slate-300 rounded-md text-sm"
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-slate-600">Loading suppliers...</p>
          </div>
        ) : isError ? (
          <div className="p-12 text-center">
            <p className="text-red-600">Failed to load suppliers</p>
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
                      No suppliers found.
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
                suppliers
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
      <SupplierFormDialog
        open={isFormOpen}
        onClose={handleFormClose}
        supplier={editingSupplier}
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
            Are you sure you want to delete this supplier? This action cannot be
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
              disabled={deleteSupplier.isPending}
            >
              {deleteSupplier.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
