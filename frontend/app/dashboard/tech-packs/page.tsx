'use client';

/**
 * Documents 頁面
 * 使用 AI 分類結果分 Tab 查看 Tech Pack / BOM / Spec
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { FileText, Search, Eye, CheckCircle, Clock, AlertCircle, Package, Ruler, Layers, Trash2, FolderKanban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/client';

interface ClassificationResult {
  file_type: string; // 'tech_pack_only' | 'bom_only' | 'mixed' | 'spec_only'
  total_pages: number;
}

interface UploadedDocument {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: string;
  classification_result: ClassificationResult | null;
  style_revision: string | null;
  tech_pack_revision_id: string | null;
  created_at: string;
  updated_at: string;
}

interface DocumentsResponse {
  count: number;
  results: UploadedDocument[];
}

// Style 相關介面
interface Style {
  id: string;
  style_number: string;
  brand: string | null;
  season: string | null;
  created_at: string;
  updated_at: string;
}

// 獲取文件列表
async function fetchDocuments(): Promise<DocumentsResponse> {
  return apiClient<DocumentsResponse>('/uploaded-documents/');
}

// 獲取款式列表（Styles API 使用自訂 envelope，apiClient 解包 data 陣列）
async function fetchStyles(): Promise<Style[]> {
  return apiClient<Style[]>('/styles/');
}

// 刪除文件
async function deleteDocument(id: string): Promise<void> {
  return apiClient<void>(`/uploaded-documents/${id}/`, { method: 'DELETE' });
}

// Tab 定義
type TabType = 'tech_pack' | 'bom' | 'mixed' | 'unclassified' | 'styles';

const TABS: { key: TabType; label: string; icon: React.ReactNode; fileTypes: string[] }[] = [
  {
    key: 'tech_pack',
    label: 'Tech Pack',
    icon: <FileText className="w-4 h-4" />,
    fileTypes: ['tech_pack_only'],
  },
  {
    key: 'bom',
    label: 'BOM',
    icon: <Package className="w-4 h-4" />,
    fileTypes: ['bom_only'],
  },
  {
    key: 'mixed',
    label: 'Mixed',
    icon: <Layers className="w-4 h-4" />,
    fileTypes: ['mixed'],
  },
  {
    key: 'unclassified',
    label: '未分類',
    icon: <AlertCircle className="w-4 h-4" />,
    fileTypes: [],
  },
  {
    key: 'styles',
    label: '款式',
    icon: <FolderKanban className="w-4 h-4" />,
    fileTypes: [],
  },
];

// 狀態顯示
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  extracted: {
    label: '已提取',
    color: 'bg-gray-100 text-gray-700',
    icon: <CheckCircle className="w-4 h-4" />,
  },
  classified: {
    label: '已分類',
    color: 'bg-gray-100 text-gray-600',
    icon: <CheckCircle className="w-4 h-4" />,
  },
  uploaded: {
    label: '待處理',
    color: 'bg-gray-100 text-gray-500',
    icon: <Clock className="w-4 h-4" />,
  },
  error: {
    label: '錯誤',
    color: 'bg-gray-100 text-gray-700',
    icon: <AlertCircle className="w-4 h-4" />,
  },
};

// 根據 AI 分類結果判斷類型
function getDocumentType(doc: UploadedDocument): TabType {
  if (!doc.classification_result?.file_type) {
    return 'unclassified';
  }
  const fileType = doc.classification_result.file_type;
  if (fileType === 'tech_pack_only') return 'tech_pack';
  if (fileType === 'bom_only') return 'bom';
  if (fileType === 'mixed') return 'mixed';
  return 'unclassified';
}

// AI 分類標籤
function getAIClassificationLabel(fileType: string | undefined): string {
  if (!fileType) return '未分類';
  const labels: Record<string, string> = {
    tech_pack_only: 'Tech Pack',
    bom_only: 'BOM',
    mixed: 'Tech Pack + BOM',
    spec_only: 'Spec',
  };
  return labels[fileType] || fileType;
}

export default function DocumentsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab') as TabType | null;
  const activeTab: TabType = tabParam && ['tech_pack', 'bom', 'mixed', 'unclassified', 'styles'].includes(tabParam) ? tabParam : 'tech_pack';

  const setActiveTab = (tab: TabType) => {
    router.push(`/dashboard/tech-packs?tab=${tab}`, { scroll: false });
  };

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // 文件查詢
  const { data, isLoading, error } = useQuery({
    queryKey: ['uploaded-documents'],
    queryFn: fetchDocuments,
  });

  // 款式查詢
  const { data: stylesData, isLoading: stylesLoading } = useQuery({
    queryKey: ['styles'],
    queryFn: fetchStyles,
    enabled: activeTab === 'styles',
  });

  // 刪除 mutation
  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uploaded-documents'] });
      toast.success('文件已刪除');
      setDeletingId(null);
    },
    onError: (error) => {
      toast.error('刪除失敗：' + (error as Error).message);
      setDeletingId(null);
    },
  });

  // 處理刪除
  const handleDelete = (id: string, filename: string) => {
    if (confirm(`確定要刪除「${filename}」嗎？此操作無法復原。`)) {
      setDeletingId(id);
      deleteMutation.mutate(id);
    }
  };

  // 按 AI 分類結果分組
  const groupedDocs = {
    tech_pack: data?.results.filter((d) => getDocumentType(d) === 'tech_pack') || [],
    bom: data?.results.filter((d) => getDocumentType(d) === 'bom') || [],
    mixed: data?.results.filter((d) => getDocumentType(d) === 'mixed') || [],
    unclassified: data?.results.filter((d) => getDocumentType(d) === 'unclassified') || [],
    styles: [], // styles 使用獨立資料源
  };

  // 款式列表
  const stylesList = Array.isArray(stylesData) ? stylesData : [];

  // 當前 Tab 的文件
  const currentDocs = groupedDocs[activeTab];

  // 過濾文件結果
  const filteredResults = currentDocs.filter((item) => {
    const matchesSearch = item.filename.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // 過濾款式結果
  const filteredStyles = stylesList.filter((item) => {
    const matchesSearch =
      item.style_number.toLowerCase().includes(search.toLowerCase()) ||
      (item.brand || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.season || '').toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  // 統計
  const stats = {
    total: activeTab === 'styles' ? stylesList.length : currentDocs.length,
    extracted: currentDocs.filter((r) => r.status === 'extracted').length,
    pending: currentDocs.filter((r) => r.status === 'uploaded' || r.status === 'classified').length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-500">載入中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          載入失敗：{(error as Error).message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-sm text-gray-500 mt-1">
            View Tech Pack, BOM files by AI classification
          </p>
        </div>
        <Link
          href="/dashboard/upload"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          上傳新文件
        </Link>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-1">
          {TABS.map((tab) => {
            const count = tab.key === 'styles' ? stylesList.length : groupedDocs[tab.key].length;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  isActive
                    ? 'border-blue-600 text-gray-900'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                )}
              >
                {tab.icon}
                {tab.label}
                <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats for current tab */}
      <div className="flex items-center gap-4 text-sm text-gray-500">
        {activeTab === 'styles' ? (
          <span>共 {stats.total} 個款式</span>
        ) : (
          <>
            <span>共 {stats.total} 個文件</span>
            <span>· {stats.extracted} 已提取</span>
            <span>· {stats.pending} 待處理</span>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-lg">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={activeTab === 'styles' ? '搜尋款號、品牌、季節...' : '搜尋檔案名稱...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Status Filter - 只在文件 Tab 顯示 */}
        {activeTab !== 'styles' && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-white"
          >
            <option value="all">全部狀態</option>
            <option value="extracted">已提取</option>
            <option value="classified">已分類</option>
            <option value="uploaded">待處理</option>
          </select>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {activeTab === 'styles' ? (
          /* Styles Table */
          stylesLoading ? (
            <div className="p-8 text-center text-gray-500">載入款式中...</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">款號</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">品牌</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">季節</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">建立時間</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredStyles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      沒有找到符合條件的款式
                    </td>
                  </tr>
                ) : (
                  filteredStyles.map((style) => (
                    <tr key={style.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FolderKanban className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{style.style_number}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {style.brand || '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {style.season || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(style.created_at).toLocaleString('zh-TW', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/dashboard/styles/${style.id}`}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors inline-flex"
                          title="查看款式"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )
        ) : (
          /* Documents Table */
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">檔案名稱</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">AI 分類</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">頁數</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">狀態</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">上傳時間</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    沒有找到符合條件的文件
                  </td>
                </tr>
              ) : (
                filteredResults.map((item) => {
                  const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.uploaded;
                  const tabConfig = TABS.find((t) => t.key === activeTab);
                  const pageCount = item.classification_result?.total_pages || 0;
                  const aiLabel = getAIClassificationLabel(item.classification_result?.file_type);

                  // 決定查看翻譯的連結
                  const reviewLink = item.tech_pack_revision_id
                    ? `/dashboard/revisions/${item.tech_pack_revision_id}/review`
                    : item.style_revision
                    ? `/dashboard/revisions/${item.style_revision}/bom`
                    : null;

                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {tabConfig?.icon}
                          <span className="font-medium">{item.filename}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium">
                          {aiLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {pageCount > 0 ? `${pageCount} 頁` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}
                        >
                          {statusConfig.icon}
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(item.created_at).toLocaleString('zh-TW', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {reviewLink ? (
                            <Link
                              href={reviewLink}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="查看"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                          ) : (
                            <span className="p-2 text-gray-300">
                              <Eye className="w-4 h-4" />
                            </span>
                          )}
                          <button
                            onClick={() => handleDelete(item.id, item.filename)}
                            disabled={deletingId === item.id}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                            title="刪除"
                          >
                            <Trash2 className={`w-4 h-4 ${deletingId === item.id ? 'animate-pulse' : ''}`} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-500">
        {activeTab === 'styles'
          ? `顯示 ${filteredStyles.length} / ${stylesList.length} 筆款式`
          : `顯示 ${filteredResults.length} / ${currentDocs.length} 筆結果`}
      </div>
    </div>
  );
}
