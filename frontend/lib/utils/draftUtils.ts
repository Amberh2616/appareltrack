/**
 * Draft Review Utility Functions
 */

import {
  DraftIssue,
  IssueTarget,
  ConfidenceLevel,
  DraftTab,
  DraftData,
} from '@/lib/types/draft';

// ===== Resolve Issue to UI Target =====
export function resolveIssueTarget(issue: DraftIssue): IssueTarget | null {
  switch (issue.target) {
    case 'bom':
      if (issue.item_number !== undefined) {
        return {
          tab: 'bom',
          rowKey: issue.item_number,
          fieldKey: issue.field,
          evidence: issue.evidence,
        };
      }
      break;

    case 'measurement':
      if (issue.point_code) {
        return {
          tab: 'measurement',
          rowKey: issue.point_code,
          fieldKey: issue.field,
          evidence: issue.evidence,
        };
      }
      break;

    case 'construction':
      if (issue.step_number !== undefined) {
        return {
          tab: 'construction',
          rowKey: issue.step_number,
          fieldKey: issue.field,
          evidence: issue.evidence,
        };
      }
      break;

    case 'global':
      return null; // No specific target
  }

  return null;
}

// ===== Confidence Level Helpers =====
export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.8) {
    return { value: confidence, label: 'high', color: 'green' };
  } else if (confidence >= 0.6) {
    return { value: confidence, label: 'medium', color: 'yellow' };
  } else {
    return { value: confidence, label: 'low', color: 'red' };
  }
}

export function getConfidenceColor(confidence: number): string {
  const level = getConfidenceLevel(confidence);
  return {
    green: 'text-green-600 bg-green-50',
    yellow: 'text-yellow-600 bg-yellow-50',
    red: 'text-red-600 bg-red-50',
  }[level.color];
}

// ===== Issue Filtering =====
export function getIssuesByTab(draft: DraftData, tab: DraftTab): DraftIssue[] {
  const targetIssues =
    tab === 'bom'
      ? draft.bom.issues
      : tab === 'measurement'
      ? draft.measurement.issues
      : draft.construction.issues;

  const globalIssues = draft.issues.filter((issue) => issue.target === tab);

  return [...targetIssues, ...globalIssues];
}

export function getErrorCount(issues: DraftIssue[]): number {
  return issues.filter((i) => i.severity === 'error').length;
}

export function getWarningCount(issues: DraftIssue[]): number {
  return issues.filter((i) => i.severity === 'warning').length;
}

// ===== Missing Fields Detection =====
export function getMissingFields(
  item: any,
  requiredFields: string[]
): string[] {
  return requiredFields.filter((field) => {
    const value = item[field];
    return value === null || value === undefined || value === '';
  });
}

// ===== Evidence Text =====
export function formatEvidence(
  evidence: { page: number; text_snippet: string } | undefined
): string {
  if (!evidence) return 'No evidence';
  return `Page ${evidence.page}: "${evidence.text_snippet}"`;
}

// ===== Issue ID Generator =====
export function generateIssueId(issue: DraftIssue, index: number): string {
  const parts = [
    issue.target,
    issue.item_number,
    issue.point_code,
    issue.step_number,
    issue.field,
    index,
  ].filter(Boolean);
  return parts.join('-');
}

// ===== Issue Severity Badge =====
export function getSeverityBadgeClass(severity: 'error' | 'warning' | 'info'): string {
  return {
    error: 'bg-red-100 text-red-800 border-red-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
  }[severity];
}

// ===== Approval Gating Check =====
export function canApprove(draft: DraftData): {
  allowed: boolean;
  reason?: string;
} {
  const allIssues = [
    ...draft.issues,
    ...draft.bom.issues,
    ...draft.measurement.issues,
    ...draft.construction.issues,
  ];

  const errorCount = getErrorCount(allIssues);

  if (errorCount > 0) {
    return {
      allowed: false,
      reason: `Cannot approve: ${errorCount} error(s) must be resolved`,
    };
  }

  return { allowed: true };
}
