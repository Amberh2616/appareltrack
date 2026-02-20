'use client';

import { ConstructionStepDraft, DraftIssue, Evidence, TableSelection } from '@/lib/types/draft';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import { getConfidenceColor } from '@/lib/utils/draftUtils';

interface Props {
  steps: ConstructionStepDraft[];
  issues: DraftIssue[];
  selection: TableSelection | null;
  onEvidenceClick: (evidence: Evidence) => void;
  onSelectionChange: (selection: TableSelection | null) => void;
}

export default function ConstructionTable({
  steps,
  issues,
  selection,
  onEvidenceClick,
  onSelectionChange,
}: Props) {
  const isSelected = (stepNumber: number) => {
    return selection?.tab === 'construction' && selection?.rowKey === stepNumber;
  };

  return (
    <div className="p-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Step Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Machine</TableHead>
            <TableHead className="w-24">Confidence</TableHead>
            <TableHead className="w-20">Evidence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {steps.map((step) => {
            const selected = isSelected(step.step_number);
            const avgConfidence =
              Object.values(step.field_confidence).reduce((a, b) => a + b, 0) /
              Object.values(step.field_confidence).length;

            return (
              <TableRow
                key={step.step_number}
                className={`
                  ${selected ? 'bg-blue-50 ring-2 ring-blue-600' : ''}
                  hover:bg-gray-50 cursor-pointer
                `}
                onClick={() =>
                  onSelectionChange({
                    tab: 'construction',
                    rowKey: step.step_number,
                  })
                }
              >
                <TableCell className="font-medium">{step.step_number}</TableCell>
                <TableCell className="font-medium">{step.step_name}</TableCell>
                <TableCell className="max-w-[300px] text-sm text-gray-700">
                  {step.description}
                </TableCell>
                <TableCell>
                  {step.machine_type && (
                    <Badge variant="outline">{step.machine_type}</Badge>
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
                  {step.evidence && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEvidenceClick(step.evidence);
                      }}
                      title={`Page ${step.evidence.page}`}
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

      {steps.length === 0 && (
        <div className="py-12 text-center text-gray-500">
          No construction steps found
        </div>
      )}
    </div>
  );
}
