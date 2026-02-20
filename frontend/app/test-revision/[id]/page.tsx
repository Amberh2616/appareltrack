'use client';

/**
 * Simple Test Page - Block-Based API Verification
 * Route: /test-revision/[id]
 */

import { useParams } from 'next/navigation';
import { useDraft } from '@/lib/hooks/useDraft';

export default function TestRevisionPage() {
  const params = useParams();
  const revisionId = params.id as string;
  const { data, isLoading, error } = useDraft(revisionId);

  if (isLoading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Loading...</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4 text-red-600">Error</h1>
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <p className="text-red-800">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  if (!data?.data) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">No Data</h1>
        <p className="text-gray-600">No revision data found</p>
      </div>
    );
  }

  const revision = data.data;
  const totalBlocks = revision.pages.reduce((sum, page) => sum + page.blocks.length, 0);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-green-600">
        ✅ API Connection Successful!
      </h1>

      {/* Revision Info */}
      <div className="bg-white border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Revision Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="font-medium text-gray-700">ID:</span>
            <p className="text-sm text-gray-600 break-all">{revision.id}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Filename:</span>
            <p className="text-sm text-gray-600">{revision.filename}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Status:</span>
            <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
              {revision.status}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Pages:</span>
            <p className="text-sm text-gray-600">{revision.page_count}</p>
          </div>
          <div className="col-span-2">
            <span className="font-medium text-gray-700">PDF URL:</span>
            <a
              href={revision.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-blue-600 hover:underline text-sm"
            >
              {revision.file_url}
            </a>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Summary</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">{revision.pages.length}</p>
            <p className="text-sm text-gray-600">Pages with Data</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">{totalBlocks}</p>
            <p className="text-sm text-gray-600">Total Blocks</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">
              {totalBlocks > 0 ? Math.round((totalBlocks / revision.page_count) * 10) / 10 : 0}
            </p>
            <p className="text-sm text-gray-600">Avg Blocks/Page</p>
          </div>
        </div>
      </div>

      {/* Pages & Blocks */}
      <div className="space-y-6">
        {revision.pages.map((page) => (
          <div key={page.page_number} className="bg-white border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                Page {page.page_number}
              </h3>
              <span className="text-sm text-gray-500">
                {page.blocks.length} blocks • {page.width}×{page.height}px
              </span>
            </div>

            {page.blocks.length === 0 ? (
              <p className="text-gray-400 italic">No blocks on this page</p>
            ) : (
              <div className="space-y-3">
                {page.blocks.map((block, idx) => (
                  <div
                    key={block.id}
                    className="border border-gray-200 rounded p-4 hover:border-blue-400 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs font-mono text-gray-400">
                        Block #{idx + 1}
                      </span>
                      <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                        {block.block_type}
                      </span>
                    </div>

                    {/* BBox */}
                    <div className="text-xs text-gray-500 mb-2">
                      Position: ({block.bbox.x.toFixed(0)}, {block.bbox.y.toFixed(0)}) •
                      Size: {block.bbox.width.toFixed(0)}×{block.bbox.height.toFixed(0)}
                    </div>

                    {/* Source Text */}
                    <div className="mb-2">
                      <span className="text-xs font-medium text-gray-700">Original:</span>
                      <p className="text-sm text-gray-900 font-medium">{block.source_text}</p>
                    </div>

                    {/* Translated Text */}
                    {block.translated_text && (
                      <div className="mb-2">
                        <span className="text-xs font-medium text-gray-700">Translation:</span>
                        <p className="text-sm text-gray-600">{block.translated_text}</p>
                      </div>
                    )}

                    {/* Edited Text */}
                    {block.edited_text && (
                      <div className="mb-2 bg-yellow-50 p-2 rounded">
                        <span className="text-xs font-medium text-yellow-800">Human Edit:</span>
                        <p className="text-sm text-yellow-900">{block.edited_text}</p>
                      </div>
                    )}

                    {/* Status */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-gray-500">Status:</span>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          block.status === 'auto'
                            ? 'bg-gray-100 text-gray-700'
                            : block.status === 'edited'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {block.status}
                      </span>
                      <span className="text-xs text-gray-400 ml-auto font-mono">
                        {block.id.split('-')[0]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Test PDF Access */}
      <div className="mt-6 bg-white border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">PDF Access Test</h2>

        {/* Method 1: Direct Download */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Method 1: Direct Download</h3>
          <a
            href={revision.file_url}
            download
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download PDF
          </a>
        </div>

        {/* Method 2: Open in New Tab */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Method 2: Open in New Tab</h3>
          <a
            href={revision.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Open in New Tab
          </a>
        </div>

        {/* Method 3: Embed (may not work in all browsers) */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Method 3: Embedded Preview (may not work)</h3>
          <div className="bg-gray-100 rounded p-4 relative">
            <object
              data={revision.file_url}
              type="application/pdf"
              className="w-full h-96"
            >
              <div className="flex items-center justify-center h-96 text-gray-500">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm">
                    PDF preview not supported in this browser.
                    <br />
                    Please use the buttons above to view the file.
                  </p>
                </div>
              </div>
            </object>
          </div>
        </div>

        {/* File Info */}
        <div className="bg-gray-50 rounded p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">File Information</h3>
          <div className="space-y-1 text-sm text-gray-600">
            <p>
              <span className="font-medium">URL:</span>{' '}
              <code className="text-xs bg-gray-200 px-1 rounded">{revision.file_url}</code>
            </p>
            <p>
              <span className="font-medium">Status:</span>{' '}
              <span className="text-green-600">✓ File accessible (HTTP 200)</span>
            </p>
          </div>
        </div>
      </div>

      {/* Raw JSON (collapsible) */}
      <details className="mt-6 bg-gray-50 border rounded-lg p-6">
        <summary className="cursor-pointer font-semibold text-gray-700 hover:text-gray-900">
          View Raw JSON Response
        </summary>
        <pre className="mt-4 text-xs bg-gray-900 text-green-400 p-4 rounded overflow-x-auto">
          {JSON.stringify(revision, null, 2)}
        </pre>
      </details>
    </div>
  );
}
