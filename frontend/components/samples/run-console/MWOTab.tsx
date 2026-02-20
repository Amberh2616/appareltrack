/**
 * MWO Tab Component
 * Displays Manufacturing Work Orders with BOM and Construction snapshots
 */

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SampleRun, SampleMWO } from '@/types/samples';
import { FileText, Plus, Eye, Send, Loader2, Package, Wrench, Download } from 'lucide-react';
import { format } from 'date-fns';
import {
  transitionSampleRun,
  exportMWOCompletePDF,
  downloadBlob,
} from '@/lib/api/samples';

interface MWOTabProps {
  run: SampleRun;
  mwos: SampleMWO[];
  isLoading?: boolean;
}

export function MWOTab({ run, mwos, isLoading }: MWOTabProps) {
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [selectedMWO, setSelectedMWO] = useState<SampleMWO | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [action, setAction] = useState<'generate' | 'issue' | 'download' | null>(null);
  const queryClient = useQueryClient();

  // Get status badge variant
  const getStatusVariant = (status: string) => {
    if (status === 'issued' || status === 'in_progress' || status === 'completed') return 'default';
    if (status === 'draft') return 'secondary';
    if (status === 'cancelled') return 'destructive';
    return 'outline';
  };

  // Handle generate MWO
  const handleGenerateMWO = async () => {
    try {
      setAction('generate');
      await transitionSampleRun(run.id, 'generate_mwo');
      await queryClient.invalidateQueries({ queryKey: ['sample-mwos', { sample_run_id: run.id }] });
      await queryClient.invalidateQueries({ queryKey: ['sample-run', run.id] });
    } catch (err: any) {
      alert(err?.message || '生成 MWO 失敗，請確認已完成 BOM/Spec 資料');
    } finally {
      setIsGenerateDialogOpen(false);
      setAction(null);
    }
  };

  // Handle issue MWO
  const handleIssueMWO = async () => {
    try {
      setAction('issue');
      await transitionSampleRun(run.id, 'issue_mwo');
      await queryClient.invalidateQueries({ queryKey: ['sample-mwos', { sample_run_id: run.id }] });
      await queryClient.invalidateQueries({ queryKey: ['sample-run', run.id] });
    } catch (err: any) {
      alert(err?.message || '發出 MWO 失敗，請確認狀態為 Draft');
    } finally {
      setAction(null);
    }
  };

  const handleDownloadComplete = async () => {
    try {
      setAction('download');
      const blob = await exportMWOCompletePDF(run.id, true);
      downloadBlob(blob, `MWO_${run.style?.style_number || 'style'}_Run${run.run_no}.pdf`);
    } catch (err: any) {
      alert(err?.message || '下載 MWO 失敗');
    } finally {
      setAction(null);
    }
  };

  // Handle view MWO details
  const handleViewMWO = (mwo: SampleMWO) => {
    setSelectedMWO(mwo);
    setIsViewDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* MWO List Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Manufacturing Work Orders</CardTitle>
            <Button
              onClick={() => setIsGenerateDialogOpen(true)}
              size="sm"
              disabled={action === 'generate'}
            >
              <Plus className="mr-2 h-4 w-4" />
              {action === 'generate' ? 'Generating...' : 'Generate MWO'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : mwos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wrench className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No manufacturing work orders yet</p>
              <p className="text-sm mt-1">Generate an MWO to start production planning</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>MWO No</TableHead>
                  <TableHead>Factory</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mwos.map((mwo) => (
                  <TableRow key={mwo.id}>
                    <TableCell className="font-medium">
                      {mwo.mwo_no || `Draft v${mwo.version_no}`}
                    </TableCell>
                    <TableCell>{mwo.factory_name}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(mwo.status)}>
                        {mwo.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {mwo.start_date ? format(new Date(mwo.start_date), 'MMM dd, yyyy') : '-'}
                    </TableCell>
                    <TableCell>
                      {mwo.due_date ? format(new Date(mwo.due_date), 'MMM dd, yyyy') : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleViewMWO(mwo)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {mwo.status === 'draft' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleIssueMWO}
                            disabled={action === 'issue'}
                          >
                            <Send className="mr-2 h-4 w-4" />
                            {action === 'issue' ? 'Issuing...' : 'Issue'}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleDownloadComplete}
                          disabled={action === 'download'}
                          title="Download complete MWO (Tech Pack + BOM + Spec)"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Generate MWO Dialog */}
      <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Manufacturing Work Order</DialogTitle>
            <DialogDescription>
              Create a new MWO with snapshots of BOM, Construction, and QC data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-sm">
              <p className="font-medium mb-2">This will create an MWO with:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>BOM snapshot (materials needed)</li>
                <li>Construction snapshot (step-by-step instructions)</li>
                <li>QC snapshot (quality checkpoints)</li>
                <li>Quantity: {run.quantity} pcs</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGenerateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerateMWO} disabled={action === 'generate'}>
              {action === 'generate' ? 'Generating...' : 'Generate MWO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View MWO Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>MWO Details</DialogTitle>
            <DialogDescription>
              {selectedMWO?.mwo_no || `Draft Version ${selectedMWO?.version_no}`}
            </DialogDescription>
          </DialogHeader>
          {selectedMWO && (
            <div className="space-y-4">
              {/* Summary Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Factory</div>
                  <div className="font-medium">{selectedMWO.factory_name}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <Badge variant={getStatusVariant(selectedMWO.status)}>
                    {selectedMWO.status.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <div className="text-muted-foreground">Start Date</div>
                  <div className="font-medium">
                    {selectedMWO.start_date
                      ? format(new Date(selectedMWO.start_date), 'MMM dd, yyyy')
                      : 'Not set'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Due Date</div>
                  <div className="font-medium">
                    {selectedMWO.due_date
                      ? format(new Date(selectedMWO.due_date), 'MMM dd, yyyy')
                      : 'Not set'}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Snapshots Tabs */}
              <Tabs defaultValue="bom">
                <TabsList>
                  <TabsTrigger value="bom">BOM Snapshot</TabsTrigger>
                  <TabsTrigger value="construction">Construction</TabsTrigger>
                  <TabsTrigger value="qc">QC Points</TabsTrigger>
                </TabsList>

                <TabsContent value="bom" className="space-y-2">
                  {selectedMWO.bom_snapshot_json && Array.isArray(selectedMWO.bom_snapshot_json) ? (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Material</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Consumption</TableHead>
                            <TableHead>Unit Price</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedMWO.bom_snapshot_json.map((item: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{item.material_name}</TableCell>
                              <TableCell>{item.category}</TableCell>
                              <TableCell>
                                {item.consumption} {item.uom}
                              </TableCell>
                              <TableCell>${item.unit_price != null ? Number(item.unit_price).toFixed(2) : '0.00'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                      No BOM snapshot data
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="construction" className="space-y-2">
                  {selectedMWO.construction_snapshot_json &&
                  Array.isArray(selectedMWO.construction_snapshot_json) ? (
                    <div className="space-y-3">
                      {selectedMWO.construction_snapshot_json.map((step: any, idx: number) => (
                        <div
                          key={idx}
                          className="border rounded-lg p-3 hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-700">
                              {step.step_number || idx + 1}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-sm">{step.section}</div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {step.description}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                      No construction snapshot data
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="qc" className="space-y-2">
                  {selectedMWO.qc_snapshot_json ? (
                    <div className="border rounded-lg p-4">
                      <pre className="text-xs overflow-auto">
                        {JSON.stringify(selectedMWO.qc_snapshot_json, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                      No QC snapshot data
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              {/* Notes */}
              {selectedMWO.notes && (
                <>
                  <Separator />
                  <div>
                    <div className="text-sm font-medium mb-2">Notes</div>
                    <p className="text-sm text-muted-foreground">{selectedMWO.notes}</p>
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
