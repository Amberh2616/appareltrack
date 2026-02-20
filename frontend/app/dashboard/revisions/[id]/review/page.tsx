'use client';

/**
 * Block-Based Draft Review Page
 * Route: /dashboard/revisions/[id]/review
 *
 * Features:
 * - Left: PDF + Draggable/Editable Translation Boxes
 * - Right: Collapsible sidebar with Coverage + Block details
 * - Double-click to edit, ✕ to delete
 */

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDraft, useUpdateDraftBlock } from '@/lib/hooks/useDraft';
import { useDebouncedPositionSave, useToggleBlockVisibility } from '@/lib/hooks/useDraftBlockPosition';
import type { DraftBlock as DraftBlockType } from '@/lib/types/revision';
import { approveRevision } from '@/lib/api/approve';
import { CoveragePanel } from '@/components/review/CoveragePanel';
import { TechPackCanvas } from '@/components/review/TechPackCanvas';
import { EditPopup } from '@/components/review/EditPopup';
import { LayoutDashboard } from 'lucide-react';

import { API_BASE_URL, getAccessToken } from '@/lib/api/client';
import { ReadinessWarningBanner } from '@/components/styles/ReadinessWarningBanner';
import { StyleBreadcrumb } from '@/components/styles/StyleBreadcrumb';

const API_BASE = API_BASE_URL;

function authHeaders(): Record<string, string> {
  // 直接讀 storage（比 Zustand in-memory 更可靠，避免 hydration timing 或 token 過期問題）
  try {
    const raw =
      sessionStorage.getItem('auth-storage') ||
      localStorage.getItem('auth-storage');
    const token = raw ? JSON.parse(raw)?.state?.accessToken : null;
    if (token) return { Authorization: `Bearer ${token}` };
  } catch { /* ignore */ }
  // fallback to Zustand
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Resolve styleId from TechPackRevision via uploaded documents
async function resolveStyleIdFromRevision(techPackRevisionId: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/uploaded-documents/?tech_pack_revision=${techPackRevisionId}`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      // Fallback: try fetching all docs and filtering client-side
      const allRes = await fetch(`${API_BASE}/uploaded-documents/`, { headers: authHeaders() });
      if (!allRes.ok) return null;
      const allData = await allRes.json();
      const docs = allData.results || allData;
      const doc = docs.find((d: any) => d.tech_pack_revision_id === techPackRevisionId || d.tech_pack_revision === techPackRevisionId);
      if (!doc?.style_revision) return null;
      const styleRevId = typeof doc.style_revision === 'string' ? doc.style_revision : doc.style_revision_id;
      if (!styleRevId) return null;
      const revRes = await fetch(`${API_BASE}/style-revisions/${styleRevId}/`, { headers: authHeaders() });
      if (!revRes.ok) return null;
      const revData = await revRes.json();
      return revData.data?.style || revData.style || null;
    }
    const data = await res.json();
    const docs = data.results || data;
    if (!docs.length) return null;
    const doc = docs[0];
    const styleRevId = doc.style_revision_id || doc.style_revision;
    if (!styleRevId) return null;
    const revRes = await fetch(`${API_BASE}/style-revisions/${styleRevId}/`, { headers: authHeaders() });
    if (!revRes.ok) return null;
    const revData = await revRes.json();
    return revData.data?.style || revData.style || null;
  } catch {
    return null;
  }
}

export default function DraftReviewPage() {
  const params = useParams();
  const router = useRouter();
  const revisionId = params.id as string;
  const { data, isLoading, error, refetch } = useDraft(revisionId);
  const updateBlock = useUpdateDraftBlock(revisionId);
  const { savePositionNow } = useDebouncedPositionSave(revisionId);
  const toggleVisibility = useToggleBlockVisibility(revisionId);

  // Resolve styleId for Style Center link
  const { data: styleId } = useQuery({
    queryKey: ['style-from-revision', revisionId],
    queryFn: () => resolveStyleIdFromRevision(revisionId),
    enabled: !!revisionId,
    staleTime: Infinity,
  });

  // Fetch style number for breadcrumb
  const { data: styleData } = useQuery({
    queryKey: ['style-info-review', styleId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/styles/${styleId}/`, { headers: authHeaders() });
      if (!res.ok) return null;
      const d = await res.json();
      return d.data || d;
    },
    enabled: !!styleId,
    staleTime: Infinity,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [showOriginalPdf, setShowOriginalPdf] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Edit popup state
  const [editPopupOpen, setEditPopupOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<DraftBlockType | null>(null);

  // Ref for right sidebar scrolling
  const blockListRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading revision...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error Loading Revision</h2>
          <p className="text-red-600">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  if (!data?.data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-gray-600">No revision data found</p>
      </div>
    );
  }

  const revision = data.data;
  const currentPageData = revision.pages.find(p => p.page_number === currentPage);

  // Flatten blocks with page_number included
  const allBlocksWithPage = revision.pages.flatMap(p =>
    p.blocks.map(b => ({ ...b, page_number: p.page_number }))
  );

  // Get page image URL
  const getPageImageUrl = (pageNum: number) => {
    return `${API_BASE}/revisions/${revisionId}/page-image/${pageNum}/?scale=2`;
  };

  // Handle block selection and scroll right sidebar
  const handleBlockSelect = (blockId: string) => {
    setSelectedBlockId(blockId);

    // Scroll right sidebar to the selected block
    if (!sidebarCollapsed && blockRefs.current.has(blockId)) {
      const blockEl = blockRefs.current.get(blockId);
      blockEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handlePositionChange = (blockId: string, x: number, y: number) => {
    savePositionNow(blockId, x, y);
  };

  // Handle double-click to edit
  const handleBlockDoubleClick = (block: DraftBlockType) => {
    setEditingBlock(block);
    setEditPopupOpen(true);
  };

  // Handle delete (hide) block
  const handleBlockDelete = async (blockId: string) => {
    try {
      await toggleVisibility.mutateAsync({ blockId, visible: false });
      setSelectedBlockId(null);
    } catch (error) {
      console.error('Failed to hide block:', error);
      alert('Failed to hide block. Please try again.');
    }
  };

  // Handle restore hidden block
  const handleBlockRestore = async (blockId: string) => {
    try {
      await toggleVisibility.mutateAsync({ blockId, visible: true });
    } catch (error) {
      console.error('Failed to restore block:', error);
      alert('Failed to restore block. Please try again.');
    }
  };

  // Handle edit save from popup
  const handleEditSave = async (text: string) => {
    if (!editingBlock) return;
    try {
      await updateBlock.mutateAsync({
        blockId: editingBlock.id,
        editedText: text,
      });
    } catch (error) {
      console.error('Failed to save block edit:', error);
      throw error;
    }
  };

  // Handle delete from popup
  const handleEditDelete = async () => {
    if (!editingBlock) return;
    await handleBlockDelete(editingBlock.id);
  };

  const handleApprove = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to approve this revision?\n\n' +
      'This will mark it as completed and redirect to Sample Request page.'
    );

    if (!confirmed) return;

    setIsApproving(true);
    try {
      await approveRevision(revisionId);
      alert('Revision approved successfully!\n\nRedirecting to Sample Requests...');
      router.push('/dashboard/samples');
    } catch (error) {
      console.error('Failed to approve revision:', error);
      alert(`Failed to approve revision: ${(error as Error).message}`);
    } finally {
      setIsApproving(false);
    }
  };

  const handleBatchTranslate = async () => {
    setIsTranslating(true);
    try {
      const response = await fetch(`${API_BASE}/revisions/${revisionId}/translate-batch/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ mode: 'all' }),
      });

      if (!response.ok) {
        throw new Error('Translation request failed');
      }

      const result = await response.json();
      alert(`Batch translation completed!\n\nSuccess: ${result.success}\nFailed: ${result.failed}\nTotal: ${result.total}`);
      refetch();
    } catch (error) {
      console.error('Failed to batch translate:', error);
      alert(`Batch translation failed: ${(error as Error).message}`);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleRetryFailed = async () => {
    setIsRetrying(true);
    try {
      const response = await fetch(`${API_BASE}/revisions/${revisionId}/retry-failed/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      });
      if (!response.ok) throw new Error('Retry request failed');
      const result = await response.json();
      alert(`Retry completed!\n\nSuccess: ${result.success}\nTotal: ${result.total}`);
      refetch();
    } catch (error) {
      alert(`Retry failed: ${(error as Error).message}`);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleCreateRequest = async () => {
    const confirmed = window.confirm(
      'Translation completed!\n\n' +
      'Confirm to create Sample Request?\n' +
      'This will generate Run + MWO + Estimate + PO'
    );

    if (!confirmed) return;

    setIsCreatingRequest(true);
    try {
      const docResponse = await fetch(`${API_BASE}/uploaded-documents/`, { headers: authHeaders() });
      if (!docResponse.ok) throw new Error('Failed to fetch documents');

      const docs = await docResponse.json();
      const document = docs.results?.find((doc: any) =>
        doc.tech_pack_revision_id === revisionId
      );

      if (!document || !document.style_revision) {
        throw new Error(
          'Cannot create Sample Request: No BOM/Spec data found.\n\n' +
          'Please ensure the document contains BOM and Measurement data.'
        );
      }

      const response = await fetch(`${API_BASE}/sample-requests/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          revision: document.style_revision,
          request_type: 'proto',
          quantity_requested: 5,
          priority: 'normal',
          brand_name: 'Demo',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create request');
      }

      alert('Sample Request created successfully!\n\nRedirecting to Kanban...');
      window.location.href = '/dashboard/samples/kanban';
    } catch (error) {
      console.error('Failed to create request:', error);
      alert(`Create Request failed:\n\n${(error as Error).message}`);
    } finally {
      setIsCreatingRequest(false);
    }
  };

  const jumpNextMissing = () => {
    const missingBlocks = allBlocksWithPage.filter(b =>
      !((b.edited_text || b.translated_text || "").trim())
    );
    if (missingBlocks.length === 0) return;

    const currentPageMissing = missingBlocks.find(b => b.page_number === currentPage);
    if (currentPageMissing) {
      setSelectedBlockId(currentPageMissing.id);
    } else {
      const firstMissing = missingBlocks[0];
      setCurrentPage(firstMissing.page_number!);
      setSelectedBlockId(firstMissing.id);
    }
  };

  // Calculate coverage
  const totalBlocks = allBlocksWithPage.length;
  const translatedBlocks = allBlocksWithPage.filter(b =>
    (b.edited_text || b.translated_text || "").trim()
  ).length;
  const coveragePercent = totalBlocks > 0 ? Math.round((translatedBlocks / totalBlocks) * 100) : 0;

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Breadcrumb + Banner */}
      {styleData?.id && (
        <div className="px-4 py-1.5 bg-white border-b border-gray-200 flex items-center gap-4">
          <StyleBreadcrumb styleId={styleData.id} styleNumber={styleData.style_number} currentPage="Translation" />
        </div>
      )}
      <ReadinessWarningBanner styleId={styleId || undefined} />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
      {/* Left: PDF Viewer */}
      <div
        className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${
          sidebarCollapsed ? 'flex-1' : 'w-[65%]'
        }`}
      >
        {/* Header */}
        <div className="border-b border-gray-200 px-4 py-2 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold text-gray-900 truncate max-w-[200px]">
              {revision.filename}
            </h1>
            <span
              className={`px-2 py-0.5 text-xs rounded font-medium ${
                (revision.status as string) === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : (revision.status as string) === 'reviewing'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {revision.status}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            {!showOriginalPdf && (
              <>
                <button
                  onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))}
                  disabled={zoomLevel <= 0.5}
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded disabled:opacity-50 hover:bg-gray-200 text-sm font-bold"
                >
                  −
                </button>
                <span className="text-xs text-gray-600 min-w-[40px] text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel(z => Math.min(2, z + 0.25))}
                  disabled={zoomLevel >= 2}
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded disabled:opacity-50 hover:bg-gray-200 text-sm font-bold"
                >
                  +
                </button>

                <span className="border-l border-gray-300 h-5 mx-1"></span>

                {/* Page Navigation */}
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded disabled:opacity-50 hover:bg-gray-200 text-xs"
                >
                  Prev
                </button>
                <span className="text-xs text-gray-600">{currentPage}/{revision.page_count}</span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(revision.page_count, p + 1))}
                  disabled={currentPage === revision.page_count}
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded disabled:opacity-50 hover:bg-gray-200 text-xs"
                >
                  Next
                </button>
              </>
            )}

            <span className="border-l border-gray-300 h-5 mx-1"></span>

            {/* Mode Toggle */}
            <button
              onClick={() => setShowOriginalPdf(!showOriginalPdf)}
              className={`px-2 py-1 text-xs rounded font-medium ${
                showOriginalPdf
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {showOriginalPdf ? 'Show Boxes' : 'PDF Only'}
            </button>

            <span className="border-l border-gray-300 h-5 mx-1"></span>

            {/* Documents Link */}
            <Link
              href="/dashboard/tech-packs"
              className="px-2 py-1 text-xs rounded font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              Documents
            </Link>

            {/* Style Center Link */}
            {styleId && (
              <Link
                href={`/dashboard/styles/${styleId}`}
                className="px-2 py-1 text-xs rounded font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center gap-1"
              >
                <LayoutDashboard className="h-3 w-3" />
                Style Center
              </Link>
            )}

            {/* Expand Sidebar Button - only when collapsed */}
            {sidebarCollapsed && (
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 flex items-center gap-1"
                title="Expand right panel"
              >
                <span>Details</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* PDF Content */}
        <div className="flex-1 overflow-hidden">
          {showOriginalPdf ? (
            revision.file_url ? (
              <iframe
                src={revision.file_url}
                className="w-full h-full border-none"
                title="PDF Preview"
              />
            ) : (
              <div className="flex items-center justify-center bg-gray-200 h-full">
                <p className="text-gray-500">PDF not available</p>
              </div>
            )
          ) : (
            currentPageData ? (
              <TechPackCanvas
                pageImageUrl={getPageImageUrl(currentPage)}
                pageNumber={currentPage}
                pageWidth={currentPageData.width || 612}
                pageHeight={currentPageData.height || 792}
                blocks={currentPageData.blocks}
                selectedBlockId={selectedBlockId}
                onBlockSelect={handleBlockSelect}
                onPositionChange={handlePositionChange}
                onBlockDoubleClick={handleBlockDoubleClick}
                onBlockDelete={handleBlockDelete}
                zoomLevel={zoomLevel}
              />
            ) : (
              <div className="flex items-center justify-center bg-gray-100 h-full">
                <p className="text-gray-500">No page data</p>
              </div>
            )
          )}
        </div>

        {/* Bottom Toolbar - when sidebar is collapsed */}
        {sidebarCollapsed && (
          <div className="border-t border-gray-200 px-4 py-2 bg-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Coverage:</span>
                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full"
                    style={{ width: `${coveragePercent}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-700">{coveragePercent}%</span>
              </div>

              <button
                onClick={handleBatchTranslate}
                disabled={isTranslating || revision.status === 'completed'}
                className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
              >
                {isTranslating && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                AI Translate
              </button>

              <button
                onClick={jumpNextMissing}
                className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200"
              >
                Next Missing
              </button>
            </div>

            <div className="flex items-center gap-2">
              {(revision.status === 'approved' || revision.status === 'completed') ? (
                <button
                  onClick={handleCreateRequest}
                  disabled={isCreatingRequest}
                  className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Create Sample Request
                </button>
              ) : (
                <button
                  onClick={handleApprove}
                  disabled={isApproving}
                  className="px-4 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
                >
                  Approve
                </button>
              )}

              <button
                onClick={() => setSidebarCollapsed(false)}
                className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                title="Expand sidebar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right: Collapsible Sidebar */}
      {!sidebarCollapsed && (
        <div className="w-[35%] flex flex-col overflow-hidden bg-white">
          {/* Sidebar Header with Collapse Button */}
          <div className="border-b border-gray-200 px-4 py-2 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
                title="Collapse sidebar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
              <span className="text-sm font-medium text-gray-700">Details</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{coveragePercent}%</span>
              <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600" style={{ width: `${coveragePercent}%` }} />
              </div>
            </div>
          </div>

          {/* Coverage Panel */}
          <div className="px-3 py-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <button
                onClick={handleBatchTranslate}
                disabled={isTranslating || revision.status === 'completed'}
                className="flex-1 px-3 py-1.5 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {isTranslating && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                {isTranslating ? 'Translating...' : 'AI Batch Translate'}
              </button>
              <button
                onClick={handleRetryFailed}
                disabled={isRetrying || revision.status === 'completed'}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 disabled:opacity-50 flex items-center gap-1"
                title="Retry incomplete translations"
              >
                {isRetrying && <span className="w-3 h-3 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></span>}
                Retry
              </button>
              <button
                onClick={jumpNextMissing}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200"
              >
                Next Missing
              </button>
              <button
                onClick={() => setShowMissingOnly(!showMissingOnly)}
                className={`px-3 py-1.5 text-xs rounded ${
                  showMissingOnly ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {showMissingOnly ? 'Show All' : 'Missing Only'}
              </button>
            </div>
          </div>

          {/* Block List */}
          <div ref={blockListRef} className="flex-1 overflow-auto p-3 space-y-2">
            {/* Hidden Blocks Section */}
            {currentPageData && currentPageData.blocks.filter(b => b.overlay?.visible === false).length > 0 && (
              <div className="mb-3 p-2 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">
                    Hidden ({currentPageData.blocks.filter(b => b.overlay?.visible === false).length})
                  </span>
                </div>
                <div className="space-y-1">
                  {currentPageData.blocks
                    .filter(b => b.overlay?.visible === false)
                    .map((block) => (
                      <div
                        key={block.id}
                        className="flex items-center justify-between p-2 bg-white rounded border border-gray-100"
                      >
                        <span className="text-xs text-gray-500 truncate flex-1">
                          {block.source_text.substring(0, 30)}...
                        </span>
                        <button
                          onClick={() => handleBlockRestore(block.id)}
                          className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          Restore
                        </button>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}

            {currentPageData?.blocks.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>No blocks on this page</p>
              </div>
            ) : (
              currentPageData?.blocks
                .filter(block => {
                  if (block.overlay?.visible === false) return false;
                  if (!showMissingOnly) return true;
                  return !((block.edited_text || block.translated_text || "").trim());
                })
                .map((block, idx) => (
                  <div
                    key={block.id}
                    ref={(el) => {
                      if (el) blockRefs.current.set(block.id, el);
                    }}
                    className={`border rounded-lg p-3 transition-all cursor-pointer ${
                      selectedBlockId === block.id
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                    onClick={() => handleBlockSelect(block.id)}
                    onDoubleClick={() => handleBlockDoubleClick(block)}
                  >
                    {/* Block Header */}
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-mono text-gray-400">#{idx + 1}</span>
                        <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                          {block.block_type}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBlockDoubleClick(block);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                    </div>

                    {/* Source Text */}
                    <p className="text-xs text-gray-600 mb-1 line-clamp-1">
                      {block.source_text}
                    </p>

                    {/* Translation */}
                    <p className={`text-sm font-medium line-clamp-2 ${
                      (block.edited_text || block.translated_text)
                        ? 'text-blue-700'
                        : 'text-gray-400 italic'
                    }`}>
                      {block.edited_text || block.translated_text || '(No translation)'}
                    </p>

                    {block.edited_text && (
                      <span className="inline-block mt-1 text-xs text-yellow-700 bg-yellow-50 px-1.5 py-0.5 rounded">
                        Edited
                      </span>
                    )}
                  </div>
                ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-4 py-3 bg-white">
            {(revision.status === 'approved' || revision.status === 'completed') ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium text-green-800">Translation Approved</span>
                </div>
                <button
                  onClick={handleCreateRequest}
                  disabled={isCreatingRequest}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isCreatingRequest && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                  {isCreatingRequest ? 'Creating...' : 'Create Sample Request'}
                </button>
              </div>
            ) : (
              <button
                onClick={handleApprove}
                disabled={isApproving}
                className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isApproving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                {isApproving ? 'Approving...' : 'Approve Revision'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Edit Popup */}
      <EditPopup
        isOpen={editPopupOpen}
        sourceText={editingBlock?.source_text || ''}
        translatedText={editingBlock?.edited_text || editingBlock?.translated_text || ''}
        position={{ x: 0, y: 0 }}
        onSave={handleEditSave}
        onDelete={handleEditDelete}
        onClose={() => {
          setEditPopupOpen(false);
          setEditingBlock(null);
        }}
      />
    </div>
    </div>
  );
}
