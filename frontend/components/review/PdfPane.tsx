'use client';

import { Evidence } from '@/lib/types/draft';
import { FileText } from 'lucide-react';

interface Props {
  revisionId: string;
  activeEvidence: Evidence | null;
}

export default function PdfPane({ revisionId, activeEvidence }: Props) {
  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Toolbar */}
      <div className="border-b bg-white px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">Tech Pack PDF</span>
          </div>
          {activeEvidence && (
            <span className="text-xs text-blue-600">
              Page {activeEvidence.page}
            </span>
          )}
        </div>
      </div>

      {/* PDF Viewer Placeholder */}
      <div className="flex-1 overflow-auto p-4">
        <div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white">
          <div className="text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">
              PDF Viewer
            </p>
            {activeEvidence && (
              <div className="mt-4 max-w-md rounded-lg bg-blue-50 p-3 text-left">
                <p className="text-xs font-medium text-blue-900">Evidence:</p>
                <p className="mt-1 text-xs text-blue-700">
                  "{activeEvidence.text_snippet}"
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
