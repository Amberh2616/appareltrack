'use client';

import { DraftData, DraftTab, DraftIssue } from '@/lib/types/draft';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { getSeverityBadgeClass, generateIssueId } from '@/lib/utils/draftUtils';

interface Props {
  draft: DraftData;
  activeIssueId: string | null;
  activeTab: DraftTab;
  onIssueSelect: (issue: DraftIssue, issueId: string) => void;
  onClose: () => void;
}

export default function IssuesDrawer({
  draft,
  activeIssueId,
  activeTab,
  onIssueSelect,
  onClose,
}: Props) {
  const allIssues = [
    ...draft.issues,
    ...draft.bom.issues,
    ...draft.measurement.issues,
    ...draft.construction.issues,
  ];

  const getSeverityIcon = (severity: 'error' | 'warning' | 'info') => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      case 'info':
        return <Info className="h-4 w-4" />;
    }
  };

  return (
    <div className="border-t bg-white shadow-lg">
      <div className="flex h-64 flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Issues</h3>
            <Badge variant="secondary">{allIssues.length}</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Issues List */}
        <div className="flex-1 overflow-auto p-4">
          {allIssues.length === 0 ? (
            <div className="flex h-full items-center justify-center text-gray-500">
              No issues found
            </div>
          ) : (
            <div className="space-y-2">
              {allIssues.map((issue, index) => {
                const issueId = generateIssueId(issue, index);
                const isActive = issueId === activeIssueId;

                return (
                  <div
                    key={issueId}
                    className={`
                      rounded-lg border p-3 cursor-pointer transition-colors
                      ${isActive ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}
                    `}
                    onClick={() => onIssueSelect(issue, issueId)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Severity Icon */}
                      <div
                        className={`
                          mt-0.5 rounded p-1
                          ${
                            issue.severity === 'error'
                              ? 'bg-red-100 text-red-600'
                              : issue.severity === 'warning'
                              ? 'bg-yellow-100 text-yellow-600'
                              : 'bg-blue-100 text-blue-600'
                          }
                        `}
                      >
                        {getSeverityIcon(issue.severity)}
                      </div>

                      {/* Issue Content */}
                      <div className="flex-1 space-y-1">
                        {/* Target & Type */}
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {issue.target}
                          </Badge>
                          {issue.item_number !== undefined && (
                            <span className="text-xs text-gray-500">
                              Item #{issue.item_number}
                            </span>
                          )}
                          {issue.point_code && (
                            <span className="text-xs text-gray-500">
                              Point {issue.point_code}
                            </span>
                          )}
                          {issue.step_number !== undefined && (
                            <span className="text-xs text-gray-500">
                              Step #{issue.step_number}
                            </span>
                          )}
                        </div>

                        {/* Message */}
                        <p className="text-sm text-gray-900">{issue.message}</p>

                        {/* Suggested Fix */}
                        {issue.suggested_fix && (
                          <p className="text-xs text-gray-600">
                            💡 {issue.suggested_fix}
                          </p>
                        )}

                        {/* Evidence Snippet */}
                        {issue.evidence && (
                          <p className="text-xs text-gray-500">
                            📄 Page {issue.evidence.page}: "{issue.evidence.text_snippet}"
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
