"use client";

import { useState, useRef, useMemo } from "react";
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
  CheckCircle,
  Calculator,
  FileText,
  Package,
  Eye,
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import {
  useProductionOrders,
  useDeleteProductionOrder,
  useConfirmProductionOrder,
  useCalculateMRP,
  useGeneratePO,
  useProductionOrderStats,
  useImportProductionOrdersExcel,
} from "@/lib/hooks/useProductionOrders";
import type { ImportExcelResponse } from "@/lib/api/production-orders";
import type { ProductionOrder, ProductionOrderStatus } from "@/lib/types/production-order";
import { PRODUCTION_ORDER_STATUS_OPTIONS } from "@/lib/types/production-order";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProductionOrderFormDialog } from "./production-order-form-dialog";
import Link from "next/link";

function StatusBadge({ status }: { status: ProductionOrderStatus }) {
  const statusColors: Record<ProductionOrderStatus, string> = {
    draft: "bg-gray-100 text-gray-800",
    confirmed: "bg-blue-100 text-blue-800",
    materials_ordered: "bg-purple-100 text-purple-800",
    in_production: "bg-yellow-100 text-yellow-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };
  const option = PRODUCTION_ORDER_STATUS_OPTIONS.find((o) => o.value === status);
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}>
      {option?.label_zh || status}
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

function formatCurrency(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

export default function ProductionOrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [page, setPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<ProductionOrder | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportExcelResponse | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch data
  const { data, isLoading, isError } = useProductionOrders({
    page,
    page_size: 25,
    search: search || undefined,
    status: statusFilter || undefined,
  });

  const { data: statsData } = useProductionOrderStats();

  // Mutations
  const deleteOrder = useDeleteProductionOrder();
  const confirmOrder = useConfirmProductionOrder();
  const calculateMRP = useCalculateMRP();
  const generatePO = useGeneratePO();
  const importExcel = useImportProductionOrdersExcel();

  // Handle Excel import
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const result = await importExcel.mutateAsync(file);
      setImportResult(result);
    } catch (error: unknown) {
      // Extract error message from API error response
      let errorMessage = "Import failed";
      if (error && typeof error === "object") {
        if ("message" in error && typeof error.message === "string") {
          errorMessage = error.message;
        } else if ("error" in error && typeof error.error === "string") {
          errorMessage = error.error;
        }
      }
      setImportResult({
        success: false,
        message: errorMessage,
        created: [],
        errors: [{ row: 0, error: errorMessage }],
        total_rows_processed: 0,
      });
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDownloadTemplate = () => {
    window.open("/api/v2/production-orders/template/", "_blank");
  };

  // Table columns
  const columns = useMemo<ColumnDef<ProductionOrder>[]>(() => [
    {
      accessorKey: "order_number",
      header: "Order Number",
      cell: ({ row }) => (
        <Link
          href={`/dashboard/production-orders/${row.original.id}`}
          className="font-mono text-sm font-medium text-blue-600 hover:underline"
        >
          {row.getValue("order_number")}
        </Link>
      ),
    },
    {
      accessorKey: "po_number",
      header: "Customer PO",
      cell: ({ row }) => (
        <span className="text-sm text-slate-600">{row.getValue("po_number")}</span>
      ),
    },
    {
      accessorKey: "customer",
      header: "Customer",
      cell: ({ row }) => row.getValue("customer"),
    },
    {
      accessorKey: "style_number",
      header: "Style",
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.style_number || "-"}</span>
      ),
    },
    {
      accessorKey: "total_quantity",
      header: "Quantity",
      cell: ({ row }) => (
        <span className="font-medium">{formatNumber(row.getValue("total_quantity"))}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.getValue("status") as ProductionOrderStatus} />,
    },
    {
      accessorKey: "delivery_date",
      header: "Delivery Date",
      cell: ({ row }) => formatDate(row.getValue("delivery_date")),
    },
    {
      accessorKey: "total_amount",
      header: "Total Amount",
      cell: ({ row }) => formatCurrency(row.getValue("total_amount")),
    },
    {
      accessorKey: "mrp_calculated",
      header: "MRP",
      cell: ({ row }) => (
        <span className={`text-xs ${row.original.mrp_calculated ? "text-green-600" : "text-slate-400"}`}>
          {row.original.mrp_calculated ? "Calculated" : "Pending"}
        </span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const order = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/production-orders/${order.id}`}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setEditingOrder(order);
                  setIsFormOpen(true);
                }}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Confirm action */}
              {order.status === "draft" && (
                <DropdownMenuItem
                  onClick={() => confirmOrder.mutate(order.id)}
                  disabled={confirmOrder.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm Order
                </DropdownMenuItem>
              )}

              {/* MRP Calculation */}
              {order.status === "confirmed" && !order.mrp_calculated && (
                <DropdownMenuItem
                  onClick={() => calculateMRP.mutate({ id: order.id })}
                  disabled={calculateMRP.isPending}
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  Calculate MRP
                </DropdownMenuItem>
              )}

              {/* Generate PO */}
              {order.mrp_calculated && order.status === "confirmed" && (
                <DropdownMenuItem
                  onClick={() => generatePO.mutate({ id: order.id })}
                  disabled={generatePO.isPending}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Generate PO
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => setDeleteConfirmId(order.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
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
      await deleteOrder.mutateAsync(id);
      setDeleteConfirmId(null);
    } catch (error) {
      console.error("Failed to delete order:", error);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingOrder(null);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx,.xls"
        className="hidden"
      />

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="h-8 w-8" />
            Production Orders
          </h1>
          <p className="text-slate-500 mt-1">
            Manage bulk production orders ({data?.count || 0} total)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleImportClick} disabled={isImporting}>
            <Upload className="w-4 h-4 mr-2" />
            {isImporting ? "Importing..." : "Import Excel"}
          </Button>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Order
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {statsData && (
        <div className="grid grid-cols-6 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-slate-900">{statsData.total}</div>
            <div className="text-sm text-slate-500">Total Orders</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-gray-600">
              {statsData.by_status?.draft || 0}
            </div>
            <div className="text-sm text-slate-500">Draft</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-blue-600">
              {statsData.by_status?.confirmed || 0}
            </div>
            <div className="text-sm text-slate-500">Confirmed</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-yellow-600">
              {statsData.by_status?.in_production || 0}
            </div>
            <div className="text-sm text-slate-500">In Production</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-green-600">
              {statsData.by_status?.completed || 0}
            </div>
            <div className="text-sm text-slate-500">Completed</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-slate-900">
              {formatNumber(statsData.total_quantity)}
            </div>
            <div className="text-sm text-slate-500">Total Qty</div>
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex items-center gap-4 bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by order number, customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-md text-sm"
        >
          <option value="">All Status</option>
          {PRODUCTION_ORDER_STATUS_OPTIONS.map((opt) => (
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
            <p className="mt-4 text-slate-600">Loading production orders...</p>
          </div>
        ) : isError ? (
          <div className="p-12 text-center">
            <p className="text-red-600">Failed to load production orders</p>
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
                          : flexRender(header.column.columnDef.header, header.getContext())}
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
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No production orders found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <div className="text-sm text-slate-500">
                Showing {(page - 1) * 25 + 1} to {Math.min(page * 25, data?.count || 0)} of{" "}
                {data?.count || 0} orders
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
      <ProductionOrderFormDialog
        open={isFormOpen}
        onClose={handleFormClose}
        productionOrder={editingOrder}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <p className="text-slate-600">
            Are you sure you want to delete this production order? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={deleteOrder.isPending}
            >
              {deleteOrder.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Result Dialog */}
      <Dialog open={!!importResult} onOpenChange={() => setImportResult(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {importResult?.created && importResult.created.length > 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              Import Result
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-lg font-medium">{importResult?.message}</p>
              <p className="text-sm text-slate-500 mt-1">
                Processed {importResult?.total_rows_processed} rows
              </p>
            </div>

            {/* Created Orders */}
            {importResult?.created && importResult.created.length > 0 && (
              <div>
                <h4 className="font-medium text-green-700 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Successfully Created ({importResult.created.length})
                </h4>
                <div className="bg-green-50 rounded-lg border border-green-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-green-100">
                      <tr>
                        <th className="px-3 py-2 text-left">Row</th>
                        <th className="px-3 py-2 text-left">Order #</th>
                        <th className="px-3 py-2 text-left">PO #</th>
                        <th className="px-3 py-2 text-left">Customer</th>
                        <th className="px-3 py-2 text-left">Style</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.created.map((order) => (
                        <tr key={order.id} className="border-t border-green-200">
                          <td className="px-3 py-2">{order.row}</td>
                          <td className="px-3 py-2 font-mono">{order.order_number}</td>
                          <td className="px-3 py-2">{order.po_number}</td>
                          <td className="px-3 py-2">{order.customer}</td>
                          <td className="px-3 py-2">{order.style_number}</td>
                          <td className="px-3 py-2 text-right">{formatNumber(order.total_quantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Errors */}
            {importResult?.errors && importResult.errors.length > 0 && (
              <div>
                <h4 className="font-medium text-red-700 mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Errors ({importResult.errors.length})
                </h4>
                <div className="bg-red-50 rounded-lg border border-red-200 p-3 space-y-2">
                  {importResult.errors.map((err, idx) => (
                    <div key={idx} className="text-sm">
                      <span className="font-medium">Row {err.row}:</span>{" "}
                      <span className="text-red-600">{err.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end mt-4">
            <Button onClick={() => setImportResult(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
