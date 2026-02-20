"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calculator,
  FileText,
  CheckCircle,
  Package,
  Calendar,
  DollarSign,
  Layers,
  RefreshCcw,
  Eye,
  Send,
  ExternalLink,
  Clock,
  Truck,
} from "lucide-react";

import {
  useProductionOrder,
  useCalculateMRP,
  useConfirmProductionOrder,
  useRequirementsSummary,
  useReviewMaterialRequirement,
  useUnreviewMaterialRequirement,
  useGeneratePOFromMaterialRequirement,
} from "@/lib/hooks/useProductionOrders";
import type {
  ProductionOrderStatus,
  MaterialRequirement,
} from "@/lib/types/production-order";
import { PRODUCTION_ORDER_STATUS_OPTIONS } from "@/lib/types/production-order";
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
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[status]}`}>
      {option?.label_zh || status}
    </span>
  );
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

function formatDecimal(num: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(num);
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProductionOrderDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const { data: order, isLoading, isError } = useProductionOrder(id);
  const { data: summary } = useRequirementsSummary(id);

  const confirmOrder = useConfirmProductionOrder();
  const calculateMRP = useCalculateMRP();
  const reviewMR = useReviewMaterialRequirement(id);
  const unreviewMR = useUnreviewMaterialRequirement(id);
  const generatePO = useGeneratePOFromMaterialRequirement(id);

  // Sheet state
  const [selectedMR, setSelectedMR] = useState<MaterialRequirement | null>(null);
  const [reviewForm, setReviewForm] = useState({
    quantity: "",
    unit_price: "",
    notes: "",
    required_date: "",
    expected_delivery: "",
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <span className="ml-4 text-slate-600">Loading production order...</span>
        </div>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-red-600">Failed to load production order</p>
          <Button variant="outline" className="mt-4" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const handleConfirm = async () => {
    try {
      await confirmOrder.mutateAsync(id);
    } catch (error) {
      console.error("Failed to confirm order:", error);
    }
  };

  const handleCalculateMRP = async () => {
    try {
      await calculateMRP.mutateAsync({ id });
    } catch (error) {
      console.error("Failed to calculate MRP:", error);
    }
  };

  const openReviewSheet = (mr: MaterialRequirement) => {
    setSelectedMR(mr);
    setReviewForm({
      quantity: String(mr.order_quantity_needed || 0),
      unit_price: String(mr.unit_price || 0),
      notes: mr.review_notes || "",
      required_date: mr.required_date || order.delivery_date || "",
      expected_delivery: mr.expected_delivery || "",
    });
  };

  const handleReview = async () => {
    if (!selectedMR) return;
    try {
      await reviewMR.mutateAsync({
        id: selectedMR.id,
        payload: reviewForm,
      });
      setSelectedMR(null);
    } catch (error) {
      console.error("Failed to review:", error);
    }
  };

  const handleUnreview = async (mrId: string) => {
    try {
      await unreviewMR.mutateAsync(mrId);
    } catch (error) {
      console.error("Failed to unreview:", error);
    }
  };

  const handleGeneratePO = async (mrId: string) => {
    try {
      const result = await generatePO.mutateAsync(mrId);
      alert(`採購單 ${result.purchase_order.po_number} 已生成`);
    } catch (error) {
      console.error("Failed to generate PO:", error);
    }
  };

  // Count reviewed items
  const reviewedCount = order.material_requirements?.filter((mr) => mr.is_reviewed).length || 0;
  const totalCount = order.material_requirements?.length || 0;
  const orderedCount = order.material_requirements?.filter((mr) => mr.status === "ordered").length || 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/production-orders">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-6 h-6" />
              {order.order_number}
            </h1>
            <p className="text-slate-500">Customer PO: {order.po_number}</p>
          </div>
          <StatusBadge status={order.status} />
        </div>

        <div className="flex items-center gap-2">
          {order.status === "draft" && (
            <Button onClick={handleConfirm} disabled={confirmOrder.isPending}>
              <CheckCircle className="w-4 h-4 mr-2" />
              {confirmOrder.isPending ? "Confirming..." : "Confirm Order"}
            </Button>
          )}

          {order.status === "confirmed" && !order.mrp_calculated && (
            <Button onClick={handleCalculateMRP} disabled={calculateMRP.isPending}>
              <Calculator className="w-4 h-4 mr-2" />
              {calculateMRP.isPending ? "Calculating..." : "Calculate MRP"}
            </Button>
          )}

          {order.status === "confirmed" && order.mrp_calculated && (
            <Button
              variant="outline"
              onClick={handleCalculateMRP}
              disabled={calculateMRP.isPending}
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              Recalculate
            </Button>
          )}
        </div>
      </div>

      {/* Order Info Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
            <Package className="w-4 h-4" />
            Customer
          </div>
          <div className="font-semibold">{order.customer}</div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
            <Layers className="w-4 h-4" />
            Total Quantity
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {formatNumber(order.total_quantity)}
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
            <DollarSign className="w-4 h-4" />
            Total Amount
          </div>
          <div className="text-xl font-bold">{formatCurrency(order.total_amount)}</div>
          <div className="text-sm text-slate-500">@ {formatCurrency(order.unit_price)}/pc</div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
            <Calendar className="w-4 h-4" />
            Delivery Date
          </div>
          <div className="font-semibold">{formatDate(order.delivery_date)}</div>
        </div>
      </div>

      {/* Size Breakdown */}
      <div className="bg-white rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-3">Size Breakdown</h2>
        <div className="flex flex-wrap gap-4">
          {Object.entries(order.size_breakdown).map(([size, qty]) => (
            <div key={size} className="bg-slate-50 rounded-lg px-4 py-2 text-center">
              <div className="text-sm text-slate-500">{size}</div>
              <div className="text-lg font-bold">{formatNumber(qty)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Material Requirements Progress */}
      {order.mrp_calculated && (
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">物料需求審核進度</h2>
            <div className="text-sm text-slate-500">
              已審核 {reviewedCount}/{totalCount} | 已下單 {orderedCount}/{totalCount}
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-blue-600 h-4 rounded-full transition-all"
              style={{ width: `${totalCount > 0 ? (orderedCount / totalCount) * 100 : 0}%` }}
            ></div>
          </div>
          <div className="flex gap-4 mt-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-300"></div>
              <span>待審核</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span>已審核待下單</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-600"></div>
              <span>已下單</span>
            </div>
          </div>
        </div>
      )}

      {/* Material Requirements Table */}
      {order.material_requirements && order.material_requirements.length > 0 && (
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">
              物料需求清單 ({order.material_requirements.length})
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              點擊「審核」按鈕確認數量和單價，審核後可生成採購單
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Material / Supplier</TableHead>
                <TableHead className="text-right">需求量</TableHead>
                <TableHead className="text-right">單價</TableHead>
                <TableHead>需求日期</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead className="text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.material_requirements.map((req: MaterialRequirement) => (
                <TableRow
                  key={req.id}
                  className={
                    req.status === "ordered"
                      ? "bg-blue-50"
                      : req.is_reviewed
                      ? "bg-yellow-50"
                      : ""
                  }
                >
                  <TableCell>
                    <span className="px-2 py-1 bg-slate-100 rounded text-xs font-medium">
                      {req.category}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{req.material_name}</div>
                    {req.material_name_zh && (
                      <div className="text-sm text-slate-500">{req.material_name_zh}</div>
                    )}
                    <div className="text-xs text-slate-400">{req.supplier || "-"}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="font-mono font-medium">
                      {formatDecimal(req.reviewed_quantity || req.order_quantity_needed)} {req.unit}
                    </div>
                    <div className="text-xs text-slate-500">
                      (毛需求: {formatDecimal(req.total_requirement)})
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ${formatDecimal(req.reviewed_unit_price || req.unit_price || 0)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {formatDate(req.required_date)}
                    </div>
                    {req.expected_delivery && (
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Truck className="w-3 h-3" />
                        {formatDate(req.expected_delivery)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {req.status === "ordered" ? (
                      <div>
                        <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          已下單
                        </span>
                        {req.purchase_order_info && (
                          <Link
                            href={`/dashboard/purchase-orders/${req.purchase_order_info.id}`}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
                          >
                            {req.purchase_order_info.po_number}
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    ) : req.is_reviewed ? (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                        已審核
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        待審核
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      {req.status !== "ordered" && (
                        <>
                          {!req.is_reviewed ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openReviewSheet(req)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              審核
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUnreview(req.id)}
                                disabled={unreviewMR.isPending}
                              >
                                取消
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleGeneratePO(req.id)}
                                disabled={generatePO.isPending}
                              >
                                <Send className="w-4 h-4 mr-1" />
                                下採購單
                              </Button>
                            </>
                          )}
                        </>
                      )}
                      {req.status === "ordered" && req.purchase_order_info && (
                        <Link href={`/dashboard/purchase-orders/${req.purchase_order_info.id}`}>
                          <Button variant="outline" size="sm">
                            <FileText className="w-4 h-4 mr-1" />
                            查看 PO
                          </Button>
                        </Link>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Notes */}
      {order.notes && (
        <div className="bg-white rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Notes</h2>
          <p className="text-slate-600 whitespace-pre-wrap">{order.notes}</p>
        </div>
      )}

      {/* Review Sheet */}
      <Sheet open={!!selectedMR} onOpenChange={(open) => !open && setSelectedMR(null)}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>審核物料需求</SheetTitle>
            <SheetDescription>
              確認採購數量、單價和交期後，可生成採購單
            </SheetDescription>
          </SheetHeader>

          {selectedMR && (
            <div className="space-y-6 mt-6">
              {/* Material Info */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="font-semibold text-lg">{selectedMR.material_name}</h3>
                {selectedMR.material_name_zh && (
                  <p className="text-slate-600">{selectedMR.material_name_zh}</p>
                )}
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-500">Category:</span>{" "}
                    <span className="font-medium">{selectedMR.category}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Supplier:</span>{" "}
                    <span className="font-medium">{selectedMR.supplier || "-"}</span>
                  </div>
                </div>
              </div>

              {/* MRP Calculation */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">MRP 計算明細</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-700">訂單數量:</span>
                    <span className="font-mono">{formatNumber(selectedMR.order_quantity)} pcs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">單件用量:</span>
                    <span className="font-mono">
                      {formatDecimal(selectedMR.consumption_per_piece)} {selectedMR.unit}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">損耗率:</span>
                    <span className="font-mono">{selectedMR.wastage_pct}%</span>
                  </div>
                  <hr className="border-blue-200 my-2" />
                  <div className="flex justify-between">
                    <span className="text-blue-700">毛需求:</span>
                    <span className="font-mono">{formatDecimal(selectedMR.gross_requirement)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">損耗量:</span>
                    <span className="font-mono">{formatDecimal(selectedMR.wastage_quantity)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className="text-blue-800">總需求:</span>
                    <span className="font-mono text-blue-900">
                      {formatDecimal(selectedMR.total_requirement)} {selectedMR.unit}
                    </span>
                  </div>
                </div>
              </div>

              {/* Editable Fields */}
              <div className="space-y-4">
                <div>
                  <Label>採購數量 ({selectedMR.unit})</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={reviewForm.quantity}
                    onChange={(e) =>
                      setReviewForm({ ...reviewForm, quantity: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label>單價 (USD)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={reviewForm.unit_price}
                    onChange={(e) =>
                      setReviewForm({ ...reviewForm, unit_price: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label>物料需求日期</Label>
                  <Input
                    type="date"
                    value={reviewForm.required_date}
                    onChange={(e) =>
                      setReviewForm({ ...reviewForm, required_date: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label>預計交期</Label>
                  <Input
                    type="date"
                    value={reviewForm.expected_delivery}
                    onChange={(e) =>
                      setReviewForm({ ...reviewForm, expected_delivery: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label>備註</Label>
                  <Textarea
                    value={reviewForm.notes}
                    onChange={(e) =>
                      setReviewForm({ ...reviewForm, notes: e.target.value })
                    }
                    placeholder="審核備註..."
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelectedMR(null)}
                >
                  取消
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleReview}
                  disabled={reviewMR.isPending}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {reviewMR.isPending ? "處理中..." : "確認審核"}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
