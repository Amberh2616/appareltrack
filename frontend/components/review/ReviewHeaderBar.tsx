'use client';

import { DraftData } from '@/lib/types/draft';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getErrorCount, getWarningCount, canApprove } from '@/lib/utils/draftUtils';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  revisionId: string;
  draft: DraftData;
  onToggleIssues: () => void;
  issuesOpen: boolean;
}

export default function ReviewHeaderBar({
  revisionId,
  draft,
  onToggleIssues,
  issuesOpen,
}: Props) {
  const allIssues = [
    ...draft.issues,
    ...draft.bom.issues,
    ...draft.measurement.issues,
    ...draft.construction.issues,
  ];

  const errorCount = getErrorCount(allIssues);
  const warningCount = getWarningCount(allIssues);
  const { allowed, reason } = canApprove(draft);

  return (
    <div className="flex items-center justify-between border-b bg-white px-6 py-4 shadow-sm">
      {/* Left: Revision Info */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Draft Review
        </h1>
        <p className="text-sm text-gray-500">Revision: {revisionId}</p>
      </div>

      {/* Center: Issue Summary */}
      <div className="flex gap-3">
        {errorCount > 0 && (
          <Badge variant="destructive" className="flex gap-1">
            <AlertCircle className="h-3 w-3" />
            {errorCount} Error{errorCount > 1 ? 's' : ''}
          </Badge>
        )}
        {warningCount > 0 && (
          <Badge variant="secondary" className="flex gap-1 bg-yellow-100 text-yellow-800">
            <AlertCircle className="h-3 w-3" />
            {warningCount} Warning{warningCount > 1 ? 's' : ''}
          </Badge>
        )}
        {errorCount === 0 && warningCount === 0 && (
          <Badge variant="default" className="flex gap-1 bg-green-100 text-green-800">
            <CheckCircle2 className="h-3 w-3" />
            No Issues
          </Badge>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleIssues}
        >
          {issuesOpen ? <ChevronDown className="mr-1 h-4 w-4" /> : <ChevronUp className="mr-1 h-4 w-4" />}
          Issues
        </Button>

        <Button
          variant="default"
          size="sm"
          disabled={!allowed}
          title={reason}
        >
          <CheckCircle2 className="mr-1 h-4 w-4" />
          Approve
        </Button>
      </div>
    </div>
  );
}
