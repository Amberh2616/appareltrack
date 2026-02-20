'use client';

import { MeasurementPointDraft, DraftIssue, Evidence, TableSelection } from '@/lib/types/draft';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { getConfidenceColor } from '@/lib/utils/draftUtils';

interface Props {
  points: MeasurementPointDraft[];
  issues: DraftIssue[];
  selection: TableSelection | null;
  onEvidenceClick: (evidence: Evidence) => void;
  onSelectionChange: (selection: TableSelection | null) => void;
}

export default function MeasurementTable({
  points,
  issues,
  selection,
  onEvidenceClick,
  onSelectionChange,
}: Props) {
  const sizeNames = points.length > 0 ? Object.keys(points[0].sizes) : [];

  const isSelected = (pointCode: string) => {
    return selection?.tab === 'measurement' && selection?.rowKey === pointCode;
  };

  return (
    <div className="p-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Point Name</TableHead>
            {sizeNames.map((size) => (
              <TableHead key={size} className="text-center">
                {size}
              </TableHead>
            ))}
            <TableHead>Tolerance</TableHead>
            <TableHead className="w-24">Confidence</TableHead>
            <TableHead className="w-20">Evidence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {points.map((point) => {
            const selected = isSelected(point.point_code);
            const avgConfidence =
              Object.values(point.field_confidence).reduce((a, b) => a + b, 0) /
              Object.values(point.field_confidence).length;

            return (
              <TableRow
                key={point.point_code}
                className={`
                  ${selected ? 'bg-blue-50 ring-2 ring-blue-600' : ''}
                  hover:bg-gray-50 cursor-pointer
                `}
                onClick={() =>
                  onSelectionChange({
                    tab: 'measurement',
                    rowKey: point.point_code,
                  })
                }
              >
                <TableCell className="font-mono font-medium">
                  {point.point_code}
                </TableCell>
                <TableCell>{point.point_name}</TableCell>
                {sizeNames.map((size) => (
                  <TableCell key={size} className="text-center font-mono">
                    {point.sizes[size]?.toFixed(1) || '-'}
                  </TableCell>
                ))}
                <TableCell className="text-sm text-gray-600">
                  {point.tolerance || '-'}
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
                  {point.evidence && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEvidenceClick(point.evidence);
                      }}
                      title={`Page ${point.evidence.page}`}
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

      {points.length === 0 && (
        <div className="py-12 text-center text-gray-500">
          No measurement points found
        </div>
      )}
    </div>
  );
}
