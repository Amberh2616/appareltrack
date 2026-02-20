'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { FileText, ArrowLeft, Loader2 } from 'lucide-react'
import { API_BASE_URL } from '@/lib/api/client'

interface DraftBlock {
  id: string
  block_type: string
  source_text: string
  translated_text: string
  edited_text: string | null
  status: string
  bbox: {
    x: number
    y: number
    width: number
    height: number
  }
}

interface RevisionPage {
  page_number: number
  width: number
  height: number
  blocks: DraftBlock[]
}

interface Revision {
  id: string
  filename: string
  page_count: number
  status: string
  file_url: string
  pages: RevisionPage[]
}

export default function TechPackTranslationPage() {
  const params = useParams()
  const router = useRouter()
  const revisionId = params.id as string

  const [revision, setRevision] = useState<Revision | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!revisionId) return
    fetchRevision()
  }, [revisionId])

  const fetchRevision = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/revisions/${revisionId}/`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch revision')
      }

      const data = await response.json()
      setRevision(data)
    } catch (err) {
      console.error('Failed to fetch revision:', err)
      setError(err instanceof Error ? err.message : 'Failed to load revision')
    } finally {
      setLoading(false)
    }
  }

  const getBlockTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      header: 'bg-blue-50 border-blue-200 text-blue-900',
      body: 'bg-gray-50 border-gray-200 text-gray-900',
      annotation: 'bg-green-50 border-green-200 text-green-900',
      dimension: 'bg-purple-50 border-purple-200 text-purple-900',
      callout: 'bg-yellow-50 border-yellow-200 text-yellow-900',
      note: 'bg-pink-50 border-pink-200 text-pink-900',
    }
    return colors[type] || colors.body
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-3 text-gray-600">Loading translation...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="font-semibold text-red-800">Error Loading Revision</h2>
          <p className="text-sm mt-1 text-red-700">{error}</p>
          <button
            onClick={() => router.push('/dashboard/upload')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Back to Upload
          </button>
        </div>
      </div>
    )
  }

  if (!revision) {
    return (
      <div className="container mx-auto py-8 px-4">
        <p className="text-gray-600">Revision not found</p>
      </div>
    )
  }

  const totalBlocks = revision.pages.reduce((sum, page) => sum + page.blocks.length, 0)

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/dashboard/upload')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Upload
        </button>
        <div className="flex items-center gap-4">
          <FileText className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">Tech Pack Translation</h1>
            <p className="text-gray-600 mt-1">{revision.filename}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">Total Pages</p>
          <p className="text-2xl font-bold text-blue-900">{revision.page_count}</p>
        </div>
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700">Total Blocks</p>
          <p className="text-2xl font-bold text-green-900">{totalBlocks}</p>
        </div>
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <p className="text-sm text-purple-700">Status</p>
          <p className="text-2xl font-bold text-purple-900 capitalize">{revision.status}</p>
        </div>
      </div>

      {/* Pages */}
      <div className="space-y-8">
        {revision.pages.map((page) => (
          <div key={page.page_number} className="border rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-4 py-3 border-b">
              <h2 className="font-semibold text-gray-900">
                Page {page.page_number} ({page.blocks.length} blocks)
              </h2>
            </div>
            <div className="p-4 space-y-3">
              {page.blocks.map((block, idx) => (
                <div
                  key={block.id}
                  className={`p-4 border rounded-lg ${getBlockTypeColor(block.block_type)}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-medium uppercase tracking-wide opacity-70">
                      {block.block_type}
                    </span>
                    <span className="text-xs opacity-50">#{idx + 1}</span>
                  </div>

                  {/* English */}
                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-600 mb-1">English:</p>
                    <p className="text-sm">{block.source_text}</p>
                  </div>

                  {/* Chinese Translation */}
                  {block.translated_text && (
                    <div className="border-t pt-3">
                      <p className="text-xs font-medium text-gray-600 mb-1">中文翻譯:</p>
                      <p className="text-sm font-medium">{block.translated_text}</p>
                    </div>
                  )}

                  {/* Edited Text */}
                  {block.edited_text && (
                    <div className="border-t pt-3 mt-3">
                      <p className="text-xs font-medium text-green-700 mb-1">Edited:</p>
                      <p className="text-sm text-green-900">{block.edited_text}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* No blocks message */}
      {totalBlocks === 0 && (
        <div className="p-12 bg-gray-50 border border-gray-200 rounded-lg text-center">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Translation Blocks</h3>
          <p className="text-gray-600">No text blocks were extracted from this Tech Pack.</p>
        </div>
      )}
    </div>
  )
}
