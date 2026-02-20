'use client';

import { BOMItemDraft, DraftIssue, Evidence, TableSelection } from '@/lib/types/draft';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, ExternalLink } from 'lucide-react';
import { getConfidenceColor, getMissingFields } from '@/lib/utils/draftUtils';

interface Props {
  items: BOMItemDraft[];
  issues: DraftIssue[];
  selection: TableSelection | null;
  onEvidenceClick: (evidence: Evidence) => void;
  onSelectionChange: (selection: TableSelection | null) => void;
}

export default function BOMTable({
  items,
  issues,
  selection,
  onEvidenceClick,
  onSelectionChange,
}: Props) {
  const requiredFields = ['supplier', 'consumption'];

  const getIssuesForItem = (itemNumber: number) => {
    return issues.filter((issue) => issue.item_number === itemNumber);
  };

  const isSelected = (itemNumber: number) => {
    return selection?.tab === 'bom' && selection?.rowKey === itemNumber;
  };

  return (
    <div className="p-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Material Code</TableHead>
            <TableHead>Color</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Consumption</TableHead>
            <TableHead className="w-24">Confidence</TableHead>
            <TableHead className="w-20">Evidence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const itemIssues = getIssuesForItem(item.item_number);
            const missingFields = getMissingFields(item, requiredFields);
            const selected = isSelected(item.item_number);
            const avgConfidence =
              Object.values(item.field_confidence).reduce((a, b) => a + b, 0) /
              Object.values(item.field_confidence).length;

            return (
              <TableRow
                key={item.item_number}
                className={`
                  ${selected ? 'bg-blue-50 ring-2 ring-blue-600' : ''}
                  ${itemIssues.some((i) => i.severity === 'error') ? 'bg-red-50' : ''}
                  hover:bg-gray-50 cursor-pointer
                `}
                onClick={() =>
                  onSelectionChange({
                    tab: 'bom',
                    rowKey: item.item_number,
                  })
                }
              >
                <TableCell className="font-medium">{item.item_number}</TableCell>
                <TableCell>
                  <Badge variant="outline">{item.category}</Badge>
                </TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {item.description}
                  {itemIssues.length > 0 && (
                    <AlertCircle className="ml-2 inline h-4 w-4 text-red-600" />
                  )}
                </TableCell>
                <TableCell>{item.material_code}</TableCell>
                <TableCell>{item.color}</TableCell>
                <TableCell>
                  {item.supplier ? (
                    item.supplier
                  ) : (
                    <span className="text-red-600">Missing</span>
                  )}
                </TableCell>
                <TableCell>
                  {item.consumption !== null ? (
                    `${item.consumption} ${item.uom}`
                  ) : (
                    <span className="text-red-600">Missing</span>
                  )}
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-block rounded px-2 py-1 text-xs font-medium ${getConfidenceColor(
                      avgConfidence
                    )}`}
                  >
                    {(avgConfidence * 100).toFixed(0)}%
                  </span>
                </TableCell>
                <TableCell>
                  {item.evidence && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEvidenceClick(item.evidence);
                      }}
                      title={`Page ${item.evidence.page}`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {items.length === 0 && (
        <div className="py-12 text-center text-gray-500">
          No BOM items found
        </div>
      )}
    </div>
  );
}
