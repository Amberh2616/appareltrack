"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Building2,
  Calendar,
  DollarSign,
  Package,
  Send,
  CheckCircle,
  PackageCheck,
  XCircle,
  Download,
  Check,
  X,
  ChevronRight,
  AlertCircle,
  Edit2,
  Factory,
  Truck,
  AlertTriangle,
} from "lucide-react";

import {
  usePurchaseOrder,
  useConfirmPO,
  useReceivePO,
  useCancelPO,
  useStartProduction,
  useShipPO,
  useConfirmAllLines,
  useConfirmPOLine,
  useUnconfirmPOLine,
} from "@/lib/hooks/usePurchaseOrders";
import { SendPOButton } from "@/components/procurement/SendPOButton";
import { getPOPdfUrl } from "@/lib/api/purchase-orders";
import type { POStatus, POType, POLine } from "@/lib/types/purchase-order";
import { PO_STATUS_OPTIONS, PO_TYPE_OPTIONS } from "@/lib/types/purchase-order";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

function StatusBadge({ status }: { status: POStatus }) {
  const option = PO_STATUS_OPTIONS.find((o) => o.value === status);
  return (
    <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${option?.color || "bg-gray-100 text-gray-800"}`}>
      {option?.label_zh || status}
    </span>
  );
}

function POTypeBadge({ poType }: { poType: POType }) {
  const option = PO_TYPE_OPTIONS.find((o) => o.value === poType);
  return (
    <span className="px-3 py-1.5 rounded text-sm font-medium bg-slate-100 text-slate-700">
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

function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return num.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

export default function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: po, isLoading, isError, refetch } = usePurchaseOrder(id);
  const [selectedLine, setSelectedLine] = useState<POLine | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Status mutations
  const confirmPO = useConfirmPO();
  const receivePO = useReceivePO();
  const cancelPO = useCancelPO();
  const startProductionMutation = useStartProduction();
  const shipPOMutation = useShipPO();
  const confirmAllLinesMutation = useConfirmAllLines();
  const confirmLineMutation = useConfirmPOLine(id);
  const unconfirmLineMutation = useUnconfirmPOLine(id);

  const openLineDrawer = (line: POLine) => {
    setSelectedLine(line);
    setEditQuantity(line.quantity);
    setEditPrice(line.unit_price);
    setEditNotes(line.notes || "");
  };

  const closeLineDrawer = () => {
    setSelectedLine(null);
    setEditQuantity("");
    setEditPrice("");
    setEditNotes("");
  };

  const handleConfirmLine = async () => {
    if (!selectedLine) return;

    try {
      await confirmLineMutation.mutateAsync({
        id: selectedLine.id,
        data: {
          quantity: editQuantity,
          unit_price: editPrice,
          notes: editNotes,
        },
      });
      closeLineDrawer();
      refetch();
    } catch (error) {
      console.error("Failed to confirm line:", error);
    }
  };

  const handleUnconfirmLine = async (lineId: string) => {
    try {
      await unconfirmLineMutation.mutateAsync(lineId);
      refetch();
    } catch (error) {
      console.error("Failed to unconfirm line:", error);
    }
  };

  const handleConfirmAllLines = async () => {
    try {
      await confirmAllLinesMutation.mutateAsync(id);
      refetch();
    } catch (error) {
      console.error("Failed to confirm all lines:", error);
    }
  };

  const handleDownloadPdf = () => {
    if (!po?.all_lines_confirmed) {
      alert("請先確認所有物料明細後才能下載 PDF");
      return;
    }
    window.open(getPOPdfUrl(id), '_blank');
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
      </div>
    );
  }

  if (isError || !po) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600">Failed to load purchase order</p>
          <Link href="/dashboard/purchase-orders" className="mt-4 inline-block text-blue-600 hover:underline">
            Back to Purchase Orders
          </Link>
        </div>
      </div>
    );
  }

  const lines = po.lines || [];
  const confirmedCount = po.confirmed_lines_count || 0;
  const totalCount = po.total_lines_count || 0;
  const allConfirmed = po.all_lines_confirmed || false;
  // P23: Overdue info
  const isOverdue = po.is_overdue || false;
  const daysOverdue = po.days_overdue || 0;

  return (
    <div className="p-6 space-y-6">
      {/* P23: Overdue Warning Banner */}
      {isOverdue && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
          <div>
            <div className="font-medium text-red-800">This PO is overdue by {daysOverdue} day{daysOverdue !== 1 ? 's' : ''}</div>
            <div className="text-sm text-red-600">Expected delivery was {formatDate(po.expected_delivery)}</div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/purchase-orders">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <FileText className="h-8 w-8" />
              {po.po_number}
              {isOverdue && (
                <span className="px-2 py-1 rounded text-sm font-medium bg-red-100 text-red-700">
                  Overdue {daysOverdue}d
                </span>
              )}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <POTypeBadge poType={po.po_type} />
              <StatusBadge status={po.status} />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* PDF Download */}
          <Button
            variant="outline"
            onClick={handleDownloadPdf}
            disabled={!allConfirmed}
            title={allConfirmed ? "下載採購單 PDF" : "請先確認所有明細"}
          >
            <Download className="h-4 w-4 mr-2" />
            Download PDF
            {!allConfirmed && <span className="ml-1 text-orange-500">({confirmedCount}/{totalCount})</span>}
          </Button>

          {/* P24: SendPOButton with email dialog */}
          {['draft', 'ready', 'sent'].includes(po.status) && (
            <SendPOButton
              poId={id}
              poNumber={po.po_number}
              supplierName={po.supplier_name || ""}
              supplierEmail={po.supplier_data?.email}
              status={po.status}
              allLinesConfirmed={allConfirmed}
              sentAt={po.sent_at}
              sentToEmail={po.sent_to_email}
              sentCount={po.sent_count}
              onSuccess={() => refetch()}
            />
          )}
          {po.status === 'sent' && (
            <Button
              onClick={() => confirmPO.mutate(id)}
              disabled={confirmPO.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirm
            </Button>
          )}
          {/* P23: New status transition buttons */}
          {po.status === 'confirmed' && (
            <>
              <Button
                onClick={() => startProductionMutation.mutate(id)}
                disabled={startProductionMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Factory className="h-4 w-4 mr-2" />
                Start Production
              </Button>
              <Button
                onClick={() => shipPOMutation.mutate(id)}
                disabled={shipPOMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Truck className="h-4 w-4 mr-2" />
                Mark Shipped
              </Button>
            </>
          )}
          {po.status === 'in_production' && (
            <Button
              onClick={() => shipPOMutation.mutate(id)}
              disabled={shipPOMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Truck className="h-4 w-4 mr-2" />
              Mark Shipped
            </Button>
          )}
          {(po.status === 'confirmed' || po.status === 'in_production' || po.status === 'shipped' || po.status === 'partial_received') && (
            <Button
              onClick={() => receivePO.mutate(id)}
              disabled={receivePO.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <PackageCheck className="h-4 w-4 mr-2" />
              Receive
            </Button>
          )}
          {!['received', 'cancelled'].includes(po.status) && (
            <Button
              variant="outline"
              onClick={() => cancelPO.mutate(id)}
              disabled={cancelPO.isPending}
              className="text-orange-600 border-orange-300 hover:bg-orange-50"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Building2 className="h-4 w-4" />
            <span className="text-sm">Supplier</span>
          </div>
          <div className="font-medium text-slate-900">{po.supplier_name || "-"}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">PO Date</span>
          </div>
          <div className="font-medium text-slate-900">{formatDate(po.po_date)}</div>
        </div>
        <div className={`rounded-lg border p-4 ${isOverdue ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">Expected Delivery</span>
          </div>
          <div className={`font-medium ${isOverdue ? 'text-red-600' : 'text-slate-900'}`}>
            {formatDate(po.expected_delivery)}
            {isOverdue && (
              <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                Overdue {daysOverdue}d
              </span>
            )}
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <DollarSign className="h-4 w-4" />
            <span className="text-sm">Total Amount</span>
          </div>
          <div className="font-bold text-xl text-blue-600">{formatCurrency(po.total_amount)}</div>
        </div>
      </div>

      {/* Confirmation Progress */}
      <div className={`rounded-lg border p-4 ${allConfirmed ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {allConfirmed ? (
              <CheckCircle className="h-6 w-6 text-green-600" />
            ) : (
              <AlertCircle className="h-6 w-6 text-amber-600" />
            )}
            <div>
              <div className="font-medium text-slate-900">
                審核進度: {confirmedCount} / {totalCount}
              </div>
              <div className="text-sm text-slate-600">
                {allConfirmed
                  ? "所有明細已確認，可以下載 PDF 並發送給供應商"
                  : "請審核並確認每筆物料明細"}
              </div>
            </div>
          </div>
          {!allConfirmed && totalCount > 0 && (
            <Button
              onClick={handleConfirmAllLines}
              disabled={confirmAllLinesMutation.isPending}
              variant="outline"
            >
              <Check className="h-4 w-4 mr-2" />
              全部確認
            </Button>
          )}
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${allConfirmed ? 'bg-green-500' : 'bg-amber-500'}`}
            style={{ width: `${totalCount > 0 ? (confirmedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* PO Lines */}
      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <Package className="h-5 w-5 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-900">物料明細</h2>
          <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-sm">
            {totalCount} items
          </span>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>來源</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-center w-24">狀態</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line, index) => (
              <TableRow
                key={line.id}
                className={`cursor-pointer hover:bg-slate-50 ${line.is_confirmed ? 'bg-green-50' : ''}`}
                onClick={() => !line.is_confirmed && openLineDrawer(line)}
              >
                <TableCell className="font-medium text-slate-500">{index + 1}</TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{line.material_name}</div>
                    {line.material_article_no && (
                      <div className="text-xs text-slate-500">{line.material_article_no}</div>
                    )}
                    {line.material_name_zh && (
                      <div className="text-xs text-blue-600">{line.material_name_zh}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {line.source_info ? (
                    <div className="text-sm">
                      <div className="font-medium text-slate-700">{line.source_info.style_number}</div>
                      <div className="text-xs text-slate-500">
                        BOM #{line.source_info.bom_item_number} · {line.source_info.bom_category}
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatNumber(line.quantity)} {line.unit}
                </TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(line.unit_price)}</TableCell>
                <TableCell className="text-right font-mono font-medium">{formatCurrency(line.line_total)}</TableCell>
                <TableCell className="text-center">
                  {line.is_confirmed ? (
                    <div className="flex items-center justify-center gap-1">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                        <Check className="h-3 w-3" />
                        已確認
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnconfirmLine(line.id);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600"
                        title="取消確認"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                      待審核
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {!line.is_confirmed && (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Total Summary */}
        {lines.length > 0 && (
          <div className="px-6 py-4 border-t bg-slate-50 flex justify-end">
            <div className="text-right">
              <span className="text-slate-500 mr-4">Total:</span>
              <span className="text-xl font-bold text-blue-600">{formatCurrency(po.total_amount)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      {po.notes && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-medium text-slate-500 mb-2">Notes</h3>
          <p className="text-slate-700">{po.notes}</p>
        </div>
      )}

      {/* Line Detail Drawer */}
      <Sheet open={!!selectedLine} onOpenChange={() => closeLineDrawer()}>
        <SheetContent className="w-[500px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5" />
              審核物料明細
            </SheetTitle>
          </SheetHeader>

          {selectedLine && (
            <div className="mt-6 space-y-6">
              {/* Material Info */}
              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="text-sm font-medium text-slate-500 mb-2">物料資訊</h4>
                <div className="font-medium text-lg">{selectedLine.material_name}</div>
                {selectedLine.material_name_zh && (
                  <div className="text-blue-600">{selectedLine.material_name_zh}</div>
                )}
                {selectedLine.material_article_no && (
                  <div className="text-sm text-slate-500 mt-1">Article: {selectedLine.material_article_no}</div>
                )}
                {selectedLine.color && (
                  <div className="text-sm text-slate-500">Color: {selectedLine.color}</div>
                )}
              </div>

              {/* Source Info */}
              {selectedLine.source_info && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-700 mb-3">來源追溯</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-500">Style:</span>
                      <span className="ml-2 font-medium">{selectedLine.source_info.style_number}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Revision:</span>
                      <span className="ml-2 font-medium">{selectedLine.source_info.revision_label}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">BOM #:</span>
                      <span className="ml-2 font-medium">{selectedLine.source_info.bom_item_number}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Category:</span>
                      <span className="ml-2 font-medium">{selectedLine.source_info.bom_category}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Production Order:</span>
                      <span className="ml-2 font-medium">{selectedLine.source_info.production_order_number}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* MRP Calculation */}
              {selectedLine.source_info && (
                <div className="p-4 bg-slate-50 rounded-lg">
                  <h4 className="text-sm font-medium text-slate-700 mb-3">MRP 計算明細</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">訂單數量:</span>
                      <span className="font-mono">{formatNumber(selectedLine.source_info.order_quantity)} pcs</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">單件用量:</span>
                      <span className="font-mono">{formatNumber(selectedLine.source_info.consumption_per_piece)} {selectedLine.unit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">毛需求:</span>
                      <span className="font-mono">{formatNumber(selectedLine.source_info.gross_requirement)} {selectedLine.unit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">損耗 ({selectedLine.source_info.wastage_pct}%):</span>
                      <span className="font-mono">+{formatNumber(selectedLine.source_info.wastage_quantity)} {selectedLine.unit}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t font-medium">
                      <span>總需求:</span>
                      <span className="font-mono">{formatNumber(selectedLine.source_info.total_requirement)} {selectedLine.unit}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Editable Fields */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-slate-700">採購數量（可修改）</h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">數量</Label>
                    <div className="flex gap-2">
                      <Input
                        id="quantity"
                        type="number"
                        value={editQuantity}
                        onChange={(e) => setEditQuantity(e.target.value)}
                        className="font-mono"
                      />
                      <span className="flex items-center text-slate-500">{selectedLine.unit}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit_price">單價 (USD)</Label>
                    <Input
                      id="unit_price"
                      type="number"
                      step="0.01"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                </div>

                <div className="p-3 bg-blue-50 rounded-lg text-right">
                  <span className="text-slate-600">小計: </span>
                  <span className="text-xl font-bold text-blue-600">
                    {formatCurrency(parseFloat(editQuantity || "0") * parseFloat(editPrice || "0"))}
                  </span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">備註</Label>
                  <Textarea
                    id="notes"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Optional notes..."
                    rows={3}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <Button variant="outline" className="flex-1" onClick={closeLineDrawer}>
                  取消
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={handleConfirmLine}
                  disabled={confirmLineMutation.isPending}
                >
                  <Check className="h-4 w-4 mr-2" />
                  {confirmLineMutation.isPending ? "確認中..." : "確認此項"}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
