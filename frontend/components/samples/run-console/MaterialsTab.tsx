/**
 * Materials Tab Component
 * Displays guidance usage and T2PO management
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { SampleRun, T2POForSample } from '@/types/samples';
import { FileText, Plus, Eye, Send, Loader2, Package } from 'lucide-react';
import { format } from 'date-fns';

interface MaterialsTabProps {
  run: SampleRun;
  t2pos: T2POForSample[];
  isLoading?: boolean;
}

export function MaterialsTab({ run, t2pos, isLoading }: MaterialsTabProps) {
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [selectedT2PO, setSelectedT2PO] = useState<T2POForSample | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  // Get status badge variant
  const getStatusVariant = (status: string) => {
    if (status === 'issued' || status === 'confirmed' || status === 'delivered') return 'default';
    if (status === 'draft') return 'secondary';
    if (status === 'cancelled') return 'destructive';
    return 'outline';
  };

  // Handle generate T2PO
  const handleGenerateT2PO = async () => {
    // TODO: Call API to generate T2PO
    console.log('Generate T2PO for run:', run.id);
    setIsGenerateDialogOpen(false);
  };

  // Handle issue T2PO
  const handleIssueT2PO = async (t2poId: string) => {
    // TODO: Call API to issue T2PO
    console.log('Issue T2PO:', t2poId);
  };

  // Handle view T2PO details
  const handleViewT2PO = (t2po: T2POForSample) => {
    setSelectedT2PO(t2po);
    setIsViewDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Guidance Usage Card */}
      <Card>
        <CardHeader>
          <CardTitle>Guidance Usage</CardTitle>
        </CardHeader>
        <CardContent>
          {run.guidance_usage ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  Using guidance usage scenario ID: <code className="text-xs">{run.guidance_usage}</code>
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                This defines the expected material consumption for this run.
              </p>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No guidance usage scenario assigned yet. Materials planning pending.
            </div>
          )}
        </CardContent>
      </Card>

      {/* T2PO List Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>T2 Purchase Orders</CardTitle>
            <Button onClick={() => setIsGenerateDialogOpen(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Generate T2PO
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : t2pos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No T2 purchase orders yet</p>
              <p className="text-sm mt-1">Generate a T2PO to start material procurement</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO No</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Delivery Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {t2pos.map((t2po) => (
                  <TableRow key={t2po.id}>
                    <TableCell className="font-medium">
                      {t2po.po_no || `Draft v${t2po.version_no}`}
                    </TableCell>
                    <TableCell>{t2po.supplier_name}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(t2po.status)}>
                        {t2po.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {t2po.currency} {Number(t2po.total_amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {t2po.delivery_date
                        ? format(new Date(t2po.delivery_date), 'MMM dd, yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewT2PO(t2po)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {t2po.status === 'draft' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleIssueT2PO(t2po.id)}
                          >
                            <Send className="mr-2 h-4 w-4" />
                            Issue
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Generate T2PO Dialog */}
      <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate T2 Purchase Order</DialogTitle>
            <DialogDescription>
              Generate a new T2PO based on the guidance usage scenario for this run.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-sm">
              <p className="font-medium mb-2">This will create a T2PO with:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Material lines from guidance usage scenario</li>
                <li>Quantity calculated: consumption × {run.quantity} pcs</li>
                <li>Snapshot of current BOM data (Phase 2)</li>
              </ul>
            </div>
            {!run.guidance_usage && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                Warning: No guidance usage scenario assigned. Please assign one first.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGenerateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerateT2PO} disabled={!run.guidance_usage}>
              Generate T2PO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View T2PO Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>T2PO Details</DialogTitle>
            <DialogDescription>
              {selectedT2PO?.po_no || `Draft Version ${selectedT2PO?.version_no}`}
            </DialogDescription>
          </DialogHeader>
          {selectedT2PO && (
            <div className="space-y-4">
              {/* Summary Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Supplier</div>
                  <div className="font-medium">{selectedT2PO.supplier_name}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <Badge variant={getStatusVariant(selectedT2PO.status)}>
                    {selectedT2PO.status.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <div className="text-muted-foreground">Total Amount</div>
                  <div className="font-medium">
                    {selectedT2PO.currency} {Number(selectedT2PO.total_amount).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Delivery Date</div>
                  <div className="font-medium">
                    {selectedT2PO.delivery_date
                      ? format(new Date(selectedT2PO.delivery_date), 'MMM dd, yyyy')
                      : 'Not set'}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Line Items */}
              <div>
                <div className="text-sm font-medium mb-2">Line Items</div>
                {selectedT2PO.lines && selectedT2PO.lines.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Unit Price</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedT2PO.lines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{line.material_name}</div>
                              {line.supplier_article_no && (
                                <div className="text-xs text-muted-foreground">
                                  {line.supplier_article_no}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {line.quantity_requested} {line.uom}
                          </TableCell>
                          <TableCell>${Number(line.unit_price).toFixed(2)}</TableCell>
                          <TableCell className="font-medium">
                            ${Number(line.line_total).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-sm text-muted-foreground">No line items</div>
                )}
              </div>

              {/* Notes */}
              {selectedT2PO.notes && (
                <>
                  <Separator />
                  <div>
                    <div className="text-sm font-medium mb-2">Notes</div>
                    <p className="text-sm text-muted-foreground">{selectedT2PO.notes}</p>
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
