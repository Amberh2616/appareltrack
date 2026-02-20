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
import Link from "next/link";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Send,
  CheckCircle,
  PackageCheck,
  XCircle,
  FileText,
  Eye,
  Factory,
  Truck,
  AlertTriangle,
} from "lucide-react";

import {
  usePurchaseOrders,
  useDeletePurchaseOrder,
  useSendPO,
  useConfirmPO,
  useReceivePO,
  useCancelPO,
  useStartProduction,
  useShipPO,
  usePOStats,
} from "@/lib/hooks/usePurchaseOrders";
import { useSuppliers } from "@/lib/hooks/useSuppliers";
import type { PurchaseOrder, POStatus, POType } from "@/lib/types/purchase-order";
import { PO_STATUS_OPTIONS, PO_TYPE_OPTIONS } from "@/lib/types/purchase-order";
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
import { POFormDialog } from "./po-form-dialog";

function StatusBadge({ status }: { status: POStatus }) {
  const option = PO_STATUS_OPTIONS.find((o) => o.value === status);
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${option?.color || "bg-gray-100 text-gray-800"}`}>
      {option?.label_zh || status}
    </span>
  );
}

function POTypeBadge({ poType }: { poType: POType }) {
  const option = PO_TYPE_OPTIONS.find((o) => o.value === poType);
  return (
    <span className="px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-700">
      {option?.label_zh || poType}
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
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

export default function PurchaseOrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [poType, setPOType] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [page, setPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Fetch data
  const { data, isLoading, isError } = usePurchaseOrders({
    page,
    page_size: 25,
    search: search || undefined,
    status: statusFilter || undefined,
    po_type: poType || undefined,
    supplier: supplierId || undefined,
  });

  const { data: statsData } = usePOStats();
  const { data: suppliersData } = useSuppliers({ page_size: 100, is_active: true });

  // Mutations
  const deletePO = useDeletePurchaseOrder();
  const sendPOMutation = useSendPO();
  const confirmPOMutation = useConfirmPO();
  const receivePOMutation = useReceivePO();
  const cancelPOMutation = useCancelPO();
  const startProductionMutation = useStartProduction();
  const shipPOMutation = useShipPO();

  // Table columns
  const columns = useMemo<ColumnDef<PurchaseOrder>[]>(() => [
    {
      accessorKey: "po_number",
      header: "PO Number",
      cell: ({ row }) => (
        <Link
          href={`/dashboard/purchase-orders/${row.original.id}`}
          className="font-mono text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
        >
          {row.getValue("po_number")}
        </Link>
      ),
    },
    {
      accessorKey: "po_type",
      header: "Type",
      cell: ({ row }) => <POTypeBadge poType={row.getValue("po_type") as POType} />,
    },
    {
      accessorKey: "supplier_name",
      header: "Supplier",
      cell: ({ row }) => row.original.supplier_name || "-",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.getValue("status") as POStatus} />,
    },
    {
      accessorKey: "po_date",
      header: "PO Date",
      cell: ({ row }) => formatDate(row.getValue("po_date")),
    },
    {
      accessorKey: "expected_delivery",
      header: "Expected Delivery",
      cell: ({ row }) => {
        const po = row.original;
        const isOverdue = po.is_overdue;
        const daysOverdue = po.days_overdue || 0;
        return (
          <div className="flex items-center gap-2">
            <span className={isOverdue ? "text-red-600 font-medium" : ""}>
              {formatDate(row.getValue("expected_delivery"))}
            </span>
            {isOverdue && (
              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                Overdue {daysOverdue}d
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "total_amount",
      header: "Total Amount",
      cell: ({ row }) => formatCurrency(row.getValue("total_amount")),
    },
    {
      accessorKey: "lines_count",
      header: "Items",
      cell: ({ row }) => row.original.lines_count || 0,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const po = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/purchase-orders/${po.id}`}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setEditingPO(po);
                  setIsFormOpen(true);
                }}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Status transition actions */}
              {po.status === 'draft' && (
                <DropdownMenuItem
                  onClick={() => sendPOMutation.mutate(po.id)}
                  disabled={sendPOMutation.isPending}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send to Supplier
                </DropdownMenuItem>
              )}
              {po.status === 'sent' && (
                <DropdownMenuItem
                  onClick={() => confirmPOMutation.mutate(po.id)}
                  disabled={confirmPOMutation.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm
                </DropdownMenuItem>
              )}
              {/* P23: New status transitions */}
              {po.status === 'confirmed' && (
                <>
                  <DropdownMenuItem
                    onClick={() => startProductionMutation.mutate(po.id)}
                    disabled={startProductionMutation.isPending}
                  >
                    <Factory className="h-4 w-4 mr-2" />
                    Start Production
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => shipPOMutation.mutate(po.id)}
                    disabled={shipPOMutation.isPending}
                  >
                    <Truck className="h-4 w-4 mr-2" />
                    Mark as Shipped
                  </DropdownMenuItem>
                </>
              )}
              {po.status === 'in_production' && (
                <DropdownMenuItem
                  onClick={() => shipPOMutation.mutate(po.id)}
                  disabled={shipPOMutation.isPending}
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Mark as Shipped
                </DropdownMenuItem>
              )}
              {(po.status === 'confirmed' || po.status === 'in_production' || po.status === 'shipped' || po.status === 'partial_received') && (
                <DropdownMenuItem
                  onClick={() => receivePOMutation.mutate(po.id)}
                  disabled={receivePOMutation.isPending}
                >
                  <PackageCheck className="h-4 w-4 mr-2" />
                  Receive
                </DropdownMenuItem>
              )}
              {!['received', 'cancelled'].includes(po.status) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-orange-600"
                    onClick={() => cancelPOMutation.mutate(po.id)}
                    disabled={cancelPOMutation.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel
                  </DropdownMenuItem>
                </>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => setDeleteConfirmId(po.id)}
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
      await deletePO.mutateAsync(id);
      setDeleteConfirmId(null);
    } catch (error) {
      console.error("Failed to delete PO:", error);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingPO(null);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Purchase Orders
          </h1>
          <p className="text-slate-500 mt-1">
            Manage purchase orders ({data?.count || 0} total)
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New PO
        </Button>
      </div>

      {/* Stats Cards */}
      {statsData && (
        <div className="grid grid-cols-4 lg:grid-cols-8 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-slate-900">{statsData.total}</div>
            <div className="text-sm text-slate-500">Total POs</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-gray-600">{statsData.by_status?.draft || 0}</div>
            <div className="text-sm text-slate-500">Draft</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-blue-600">{statsData.by_status?.sent || 0}</div>
            <div className="text-sm text-slate-500">Sent</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-green-600">{statsData.by_status?.confirmed || 0}</div>
            <div className="text-sm text-slate-500">Confirmed</div>
          </div>
          {/* P23: New status cards */}
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-purple-600">{statsData.by_status?.in_production || 0}</div>
            <div className="text-sm text-slate-500">In Production</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-indigo-600">{statsData.by_status?.shipped || 0}</div>
            <div className="text-sm text-slate-500">Shipped</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-emerald-600">{statsData.by_status?.received || 0}</div>
            <div className="text-sm text-slate-500">Received</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(statsData.total_amount)}</div>
            <div className="text-sm text-slate-500">Total Amount</div>
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex items-center gap-4 bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by PO number or supplier..."
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
          {PO_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label_zh}
            </option>
          ))}
        </select>
        <select
          value={poType}
          onChange={(e) => setPOType(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-md text-sm"
        >
          <option value="">All Types</option>
          {PO_TYPE_OPTIONS.map((opt) => (
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
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-slate-600">Loading purchase orders...</p>
          </div>
        ) : isError ? (
          <div className="p-12 text-center">
            <p className="text-red-600">Failed to load purchase orders</p>
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
                      No purchase orders found.
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
                purchase orders
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
      <POFormDialog
        open={isFormOpen}
        onClose={handleFormClose}
        purchaseOrder={editingPO}
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
            Are you sure you want to delete this purchase order? This action cannot be
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
              disabled={deletePO.isPending}
            >
              {deletePO.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
