'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { CheckCircle2, FileText, AlertCircle, ArrowLeft, ChevronDown, ChevronUp, FolderOpen, Clock } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { API_BASE_URL, getAccessToken } from '@/lib/api/client'

function authFetch(url: string, options: RequestInit = {}) {
  const token = getAccessToken()
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}

interface ClassificationPage {
  page: number
  type: string
  confidence: number
  reasoning?: string
}

interface ClassificationResult {
  file_type: string
  total_pages: number
  pages: ClassificationPage[]
}

interface DocumentStatus {
  id: string
  status: string
  filename: string
  classification_result?: ClassificationResult
  extraction_errors: any[]
  file_url?: string
  style_revision_id?: string  // ⚡ For BOM/Spec navigation
  tech_pack_revision_id?: string  // ⚡ For translation review navigation
}

// DA-2: Task status interface for async mode
interface TaskStatus {
  task_id: string
  status: 'PENDING' | 'STARTED' | 'SUCCESS' | 'FAILURE' | 'RETRY' | 'REVOKED'
  ready: boolean
  successful?: boolean
  result?: {
    status: string
    document_id: string
    style_revision_id?: string
    tech_pack_revision_id?: string
    extraction_stats?: any
    error?: string
  }
}

// Helper: resolve styleId from style_revision_id
async function resolveStyleId(styleRevisionId: string): Promise<string | null> {
  try {
    const res = await authFetch(`${API_BASE_URL}/style-revisions/${styleRevisionId}/`)
    if (!res.ok) return null
    const data = await res.json()
    return data.data?.style || data.style || null
  } catch {
    return null
  }
}

// Helper: resolve styleId from tech pack revision
async function resolveStyleIdFromTechPackRevision(techPackRevisionId: string): Promise<string | null> {
  try {
    const res = await authFetch(`${API_BASE_URL}/revisions/${techPackRevisionId}/`)
    if (!res.ok) return null
    const data = await res.json()
    return data.data?.style || data.style || null
  } catch {
    return null
  }
}

// DA-2: Async mode disabled - Redis not running
const USE_ASYNC_MODE = false

export default function ReviewPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const documentId = params.id as string
  const styleId = searchParams.get('style_id')

  const [status, setStatus] = useState<DocumentStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    classification: true,
    pages: false,
  })

  // DA-2: Async mode state
  const [extractTaskId, setExtractTaskId] = useState<string | null>(null)
  const [extractTaskStatus, setExtractTaskStatus] = useState<TaskStatus | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const startTimeRef = useRef<number | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const timeIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!documentId) return
    fetchStatus()
  }, [documentId])

  // DA-2: Poll task status when extracting in async mode
  useEffect(() => {
    if (!extractTaskId || !isExtracting) return

    // Start elapsed time counter
    startTimeRef.current = Date.now()
    timeIntervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }
    }, 1000)

    // Poll task status every 2.5 seconds
    pollIntervalRef.current = setInterval(pollExtractTaskStatus, 2500)

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      if (timeIntervalRef.current) clearInterval(timeIntervalRef.current)
    }
  }, [extractTaskId, isExtracting])

  // DA-2: Poll Celery task status for extraction
  const pollExtractTaskStatus = async () => {
    if (!extractTaskId) return

    try {
      const response = await authFetch(
        `${API_BASE_URL}/tasks/${extractTaskId}/`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch task status')
      }

      const data: TaskStatus = await response.json()
      setExtractTaskStatus(data)
      console.log('[DA-2] Extract task status:', data.status, data.ready)

      // If task completed successfully
      if (data.ready && data.successful && data.result) {
        if (data.result.status === 'success') {
          // Clear intervals
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
          if (timeIntervalRef.current) clearInterval(timeIntervalRef.current)

          setIsExtracting(false)
          setIsCompleted(true)
          toast.success('AI 提取完成!')

          // If style_id was provided via URL, use it directly
          if (styleId) {
            router.push(`/dashboard/styles/${styleId}`)
            return
          }

          // Otherwise resolve from revision
          const revId = data.result.style_revision_id
          if (revId) {
            const sid = await resolveStyleId(revId)
            if (sid) {
              router.push(`/dashboard/styles/${sid}`)
              return
            }
          }
          router.push('/dashboard/tech-packs')
        } else if (data.result.error) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
          if (timeIntervalRef.current) clearInterval(timeIntervalRef.current)
          toast.error('Extraction failed')
          setError(data.result.error)
          setIsExtracting(false)
        }
      }

      // If task failed
      if (data.ready && !data.successful) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
        if (timeIntervalRef.current) clearInterval(timeIntervalRef.current)
        toast.error('Task failed')
        setError(data.result?.error || 'Extraction task failed')
        setIsExtracting(false)
      }
    } catch (err) {
      console.error('Failed to poll extract task status:', err)
    }
  }

  // Helper to format elapsed time
  const formatElapsedTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}秒`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}分${secs}秒`
  }

  const fetchStatus = async () => {
    try {
      const response = await authFetch(
        `${API_BASE_URL}/uploaded-documents/${documentId}/status/`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch document status')
      }

      const data = await response.json()
      setStatus(data)

      // Redirect based on status
      if (data.status === 'uploaded' || data.status === 'classifying') {
        const param = styleId ? `?style_id=${styleId}` : ''
        router.push(`/dashboard/documents/${documentId}/processing${param}`)
      } else if (data.status === 'extracted' || data.status === 'completed') {
        // Mark as completed
        setIsCompleted(true)

        // If style_id was provided via URL, use it directly
        if (styleId) {
          router.push(`/dashboard/styles/${styleId}`)
          return
        }

        // ⚡ Auto-navigate to Style Center if possible
        const styleRevId = data.style_revision_id
        const techPackRevId = data.tech_pack_revision_id

        if (styleRevId) {
          const sid = await resolveStyleId(styleRevId)
          if (sid) {
            router.push(`/dashboard/styles/${sid}`)
            return
          }
        }
        if (techPackRevId) {
          const sid = await resolveStyleIdFromTechPackRevision(techPackRevId)
          if (sid) {
            router.push(`/dashboard/styles/${sid}`)
            return
          }
        }
        router.push('/dashboard/tech-packs')
      }
    } catch (err) {
      console.error('Failed to fetch status:', err)
      setError(err instanceof Error ? err.message : 'Failed to load document')
    }
  }

  const handleExtract = async () => {
    setIsExtracting(true)
    setError(null)
    setElapsedTime(0)
    setExtractTaskId(null)
    setExtractTaskStatus(null)

    try {
      // Build extract URL with optional style_id
      const styleParam = styleId ? `&style_id=${styleId}` : ''

      // DA-2: Use async mode if enabled
      if (USE_ASYNC_MODE) {
        const response = await authFetch(
          `${API_BASE_URL}/uploaded-documents/${documentId}/extract/?async=true${styleParam}`,
          { method: 'POST' }
        )

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to start extraction')
        }

        const data = await response.json()
        console.log('[DA-2] Async extraction started, task_id:', data.task_id)
        setExtractTaskId(data.task_id)
        toast.info('AI 提取已開始，請稍候...')
        return  // Let the useEffect handle polling
      }

      // Sync mode (original behavior)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 600000)

      const syncUrl = styleId
        ? `${API_BASE_URL}/uploaded-documents/${documentId}/extract/?style_id=${styleId}`
        : `${API_BASE_URL}/uploaded-documents/${documentId}/extract/`

      const response = await authFetch(
        syncUrl,
        {
          method: 'POST',
          signal: controller.signal,
        }
      )

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Extraction failed')
      }

      // ⚡ Check extract response directly for immediate redirect
      const extractData = await response.json()
      console.log('Extract response:', extractData)

      const styleRevId = extractData.style_revision_id
      const techPackRevId = extractData.tech_pack_revision_id

      if (styleRevId || techPackRevId) {
        // Extraction completed - redirect immediately
        setIsExtracting(false)
        setIsCompleted(true)
        toast.success('Extraction completed!')

        // If style_id was provided via URL, use it directly (fastest)
        if (styleId) {
          router.push(`/dashboard/styles/${styleId}`)
          return
        }

        // Otherwise resolve from revision
        if (styleRevId) {
          const sid = await resolveStyleId(styleRevId)
          if (sid) {
            router.push(`/dashboard/styles/${sid}`)
            return
          }
        }
        if (techPackRevId) {
          const sid = await resolveStyleIdFromTechPackRevision(techPackRevId)
          if (sid) {
            router.push(`/dashboard/styles/${sid}`)
            return
          }
        }
        // Fallback to Documents
        router.push('/dashboard/tech-packs')
        return
      }

      // Fallback: Poll for extraction completion if not in response
      const pollInterval = setInterval(async () => {
        const statusResponse = await authFetch(
          `${API_BASE_URL}/uploaded-documents/${documentId}/status/`
        )
        const statusData = await statusResponse.json()

        if (statusData.status === 'extracted' || statusData.status === 'completed') {
          clearInterval(pollInterval)
          setIsExtracting(false)
          setIsCompleted(true)
          setStatus(statusData)
          toast.success('Extraction completed!')

          // If style_id was provided via URL, use it directly
          if (styleId) {
            router.push(`/dashboard/styles/${styleId}`)
            return
          }

          // Otherwise resolve from revision
          const pollStyleRevId = statusData.style_revision_id
          if (pollStyleRevId) {
            const sid = await resolveStyleId(pollStyleRevId)
            if (sid) {
              router.push(`/dashboard/styles/${sid}`)
              return
            }
          }
          const pollTechPackRevId = statusData.tech_pack_revision_id
          if (pollTechPackRevId) {
            const sid = await resolveStyleIdFromTechPackRevision(pollTechPackRevId)
            if (sid) {
              router.push(`/dashboard/styles/${sid}`)
              return
            }
          }
          router.push('/dashboard/tech-packs')
        } else if (statusData.status === 'failed') {
          clearInterval(pollInterval)
          setIsExtracting(false)
          setError('Extraction failed. Please check the errors and try again.')
        }
      }, 2000)
    } catch (err) {
      console.error('Extraction error:', err)
      setError(err instanceof Error ? err.message : 'Extraction failed')
      setIsExtracting(false)
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      tech_pack: 'bg-blue-100 text-blue-800 border-blue-300',
      bom_table: 'bg-green-100 text-green-800 border-green-300',
      measurement_table: 'bg-purple-100 text-purple-800 border-purple-300',
      cover: 'bg-gray-100 text-gray-800 border-gray-300',
      other: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    }
    return colors[type] || colors.other
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600'
    if (confidence >= 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-3 text-red-800">
            <AlertCircle className="h-6 w-6" />
            <div>
              <h2 className="font-semibold">Error Loading Document</h2>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={() => router.push(styleId ? `/dashboard/styles/${styleId}` : '/dashboard/upload')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            {styleId ? 'Back to Style Center' : 'Back to Upload'}
          </button>
        </div>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          <span className="ml-3 text-gray-600">Loading document...</span>
        </div>
      </div>
    )
  }

  const classification = status.classification_result

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Style context banner */}
      {styleId && (
        <div className="mb-4 flex items-center gap-3 bg-blue-50 border border-blue-200 text-blue-800 px-4 py-2.5 rounded-lg text-sm">
          <button
            onClick={() => router.push(`/dashboard/styles/${styleId}`)}
            className="flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 font-medium"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Style Center
          </button>
          <span className="text-blue-400">|</span>
          <span>Extracting for this style. Data will be linked automatically.</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push(styleId ? `/dashboard/styles/${styleId}` : '/dashboard/upload')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {styleId ? 'Back to Style Center' : 'Back to Upload'}
        </button>
        <h1 className="text-3xl font-bold">Review Classification Results</h1>
        <p className="text-gray-600 mt-2">
          Verify AI classification before proceeding with data extraction
        </p>
      </div>

      {/* File Info */}
      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-gray-500" />
          <div>
            <p className="font-medium">{status.filename}</p>
            <p className="text-sm text-gray-600">Status: {status.status}</p>
          </div>
        </div>
      </div>

      {/* Classification Results */}
      {classification && (
        <div className="space-y-4 mb-6">
          {/* Overall Classification */}
          <div className="border rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('classification')}
              className="w-full p-4 bg-white hover:bg-gray-50 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div className="text-left">
                  <h3 className="font-semibold">Overall Classification</h3>
                  <p className="text-sm text-gray-600">
                    File Type: <span className="font-medium capitalize">{classification.file_type}</span>
                    {' • '}
                    Total Pages: {classification.total_pages}
                  </p>
                </div>
              </div>
              {expandedSections.classification ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </button>

            {expandedSections.classification && (
              <div className="p-4 border-t bg-gray-50">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Tech Pack Pages', type: 'tech_pack' },
                    { label: 'BOM Pages', type: 'bom_table' },
                    { label: 'Measurement Pages', type: 'measurement_table' },
                  ].map(({ label, type }) => {
                    const count = classification.pages.filter(p => p.type === type).length
                    return (
                      <div key={type} className="p-3 bg-white border rounded-lg">
                        <p className="text-sm text-gray-600">{label}</p>
                        <p className="text-2xl font-bold">{count}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Page-by-Page Classification */}
          <div className="border rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('pages')}
              className="w-full p-4 bg-white hover:bg-gray-50 flex items-center justify-between"
            >
              <h3 className="font-semibold">Page-by-Page Classification</h3>
              {expandedSections.pages ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </button>

            {expandedSections.pages && (
              <div className="border-t bg-gray-50 p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                  {classification.pages.map((page, idx) => (
                    <div
                      key={idx}
                      className={`p-3 border rounded-lg ${getTypeColor(page.type)}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">Page {page.page}</span>
                        <span className={`text-xs font-medium ${getConfidenceColor(page.confidence)}`}>
                          {(page.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-xs font-medium capitalize mb-1">
                        {page.type.replace('_', ' ')}
                      </p>
                      {page.reasoning && (
                        <p className="text-xs opacity-75 italic">
                          {page.reasoning}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Completion Message */}
      {isCompleted && (
        <div className="mb-6 p-6 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-3 text-green-800">
            <CheckCircle2 className="h-6 w-6" />
            <div>
              <h2 className="font-semibold">Extraction Completed</h2>
              <p className="text-sm mt-1">
                Redirecting to Style Center...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* DA-2: Async extraction progress indicator */}
      {isExtracting && USE_ASYNC_MODE && extractTaskId && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
              <div>
                <p className="font-medium text-blue-900">AI 正在提取資料...</p>
                <p className="text-sm text-blue-700 mt-1">
                  <Clock className="inline-block w-3 h-3 mr-1" />
                  已花時間: {formatElapsedTime(elapsedTime)}
                </p>
              </div>
            </div>
            {extractTaskStatus && (
              <div className="text-xs text-gray-500">
                <span className="font-mono">Task: {extractTaskId.slice(0, 8)}...</span>
                <span className="ml-2">
                  Status: <span className={
                    extractTaskStatus.status === 'SUCCESS' ? 'text-green-600' :
                    extractTaskStatus.status === 'FAILURE' ? 'text-red-600' :
                    extractTaskStatus.status === 'STARTED' ? 'text-blue-600' :
                    'text-gray-600'
                  }>{extractTaskStatus.status}</span>
                </span>
              </div>
            )}
          </div>
          {elapsedTime > 60 && (
            <p className="mt-2 text-xs text-blue-600">
              大型 PDF 提取可能需要 1-3 分鐘，請耐心等待...
            </p>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={handleExtract}
          disabled={isExtracting || status.status === 'extracting' || isCompleted}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isCompleted
            ? '✓ Extraction Completed'
            : isExtracting || status.status === 'extracting'
            ? 'Extracting Data...'
            : 'Confirm & Extract Data'}
        </button>
        <button
          onClick={() => router.push(styleId ? `/dashboard/styles/${styleId}` : '/dashboard/upload')}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
        >
          {isCompleted ? (styleId ? 'Back to Style' : 'Back to Upload') : 'Cancel'}
        </button>
        <Link
          href="/dashboard/tech-packs"
          className="flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
        >
          <FolderOpen className="w-4 h-4" />
          所有文件
        </Link>
      </div>

      {/* Info Box */}
      <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-3">Next Steps</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <span className="mt-0.5">1.</span>
            <span>Review the classification results above</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">2.</span>
            <span>Click "Confirm & Extract Data" to proceed with AI extraction</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">3.</span>
            <span>AI will extract Tech Pack annotations, BOM items, and Measurements</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-yellow-600">⚠</span>
            <span>You'll be able to verify and edit extracted data before creating a Sample Request</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
