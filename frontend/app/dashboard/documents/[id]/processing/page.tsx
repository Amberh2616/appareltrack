'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2, AlertCircle, Clock, XCircle, RefreshCw } from 'lucide-react'
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

interface ProcessingStatus {
  id: string
  status: string
  filename: string
  classification_result?: {
    file_type: string
    total_pages: number
    pages: Array<{
      page: number
      type: string
      confidence: number
    }>
  }
  extraction_errors: any[]
  progress: {
    uploaded: boolean
    classified: boolean
    extracted: boolean
  }
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
    classification_result?: any
    error?: string
  }
}

// Service health status interface
interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  database: { status: string; message: string }
  redis: { status: string; message: string }
  celery: { status: string; message: string }
  async_ready: boolean
  sync_available: boolean
  hint?: string
}

// DA-2: Check if async mode is enabled (via environment or URL param)
const USE_ASYNC_MODE = false  // Disabled - Redis not running

// 格式化時間
function formatElapsedTime(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}分${secs}秒`
}

export default function ProcessingPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const documentId = params.id as string
  const styleId = searchParams.get('style_id')

  const [status, setStatus] = useState<ProcessingStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [isCancelled, setIsCancelled] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const startTimeRef = useRef<number>(Date.now())
  const abortControllerRef = useRef<AbortController | null>(null)

  // DA-2: Track Celery task ID for async mode
  const [taskId, setTaskId] = useState<string | null>(null)
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null)

  // Service health status
  const [serviceHealth, setServiceHealth] = useState<ServiceHealth | null>(null)
  const [healthChecked, setHealthChecked] = useState(false)

  // Check service health on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/health/services/`)
        if (response.ok) {
          const data = await response.json()
          setServiceHealth(data)
        }
      } catch (err) {
        console.warn('Health check failed:', err)
        // Set degraded status if health check fails
        setServiceHealth({
          status: 'degraded',
          database: { status: 'unknown', message: '' },
          redis: { status: 'unknown', message: '' },
          celery: { status: 'unknown', message: '' },
          async_ready: false,
          sync_available: true,
          hint: 'Could not verify service status. Proceeding with sync mode.'
        })
      } finally {
        setHealthChecked(true)
      }
    }
    checkHealth()
  }, [])

  useEffect(() => {
    if (!documentId || isCancelled) return

    // Reset start time
    startTimeRef.current = Date.now()
    abortControllerRef.current = new AbortController()

    // Auto-trigger classification when page loads
    triggerClassification()

    // Poll status every 2.5 seconds (async mode polls task status)
    const statusInterval = setInterval(() => {
      if (USE_ASYNC_MODE && taskId) {
        pollTaskStatus()
      } else {
        pollStatus()
      }
    }, 2500)

    // Update elapsed time every second
    const timeInterval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)

    return () => {
      clearInterval(statusInterval)
      clearInterval(timeInterval)
      abortControllerRef.current?.abort()
    }
  }, [documentId, isCancelled, taskId])

  const handleCancel = () => {
    setIsCancelled(true)
    abortControllerRef.current?.abort()
    router.push(styleId ? `/dashboard/styles/${styleId}` : '/dashboard/upload')
  }

  const triggerClassification = async () => {
    try {
      // DA-2: Use async mode if enabled
      const asyncParam = USE_ASYNC_MODE ? '?async=true' : ''
      const response = await authFetch(
        `${API_BASE_URL}/uploaded-documents/${documentId}/classify/${asyncParam}`,
        {
          method: 'POST',
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Classification failed')
      }

      const data = await response.json()

      // DA-2: If async mode, save task ID for polling
      if (USE_ASYNC_MODE && data.task_id) {
        console.log('[DA-2] Async classification started, task_id:', data.task_id)
        setTaskId(data.task_id)
      }
    } catch (err) {
      console.error('Failed to trigger classification:', err)
      setError(err instanceof Error ? err.message : 'Classification failed')
    }
  }

  // DA-2: Poll Celery task status
  const pollTaskStatus = async () => {
    if (!taskId) return

    try {
      const response = await authFetch(
        `${API_BASE_URL}/tasks/${taskId}/`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch task status')
      }

      const data: TaskStatus = await response.json()
      setTaskStatus(data)
      console.log('[DA-2] Task status:', data.status, data.ready)

      // If task completed successfully
      if (data.ready && data.successful && data.result) {
        if (data.result.status === 'success') {
          // Update document status by polling
          await pollStatus()
        } else if (data.result.error) {
          toast.error('Classification failed')
          setError(data.result.error)
        }
      }

      // If task failed
      if (data.ready && !data.successful) {
        toast.error('Task failed')
        setError(data.result?.error || 'Classification task failed')
      }
    } catch (err) {
      console.error('Failed to poll task status:', err)
    }
  }

  const pollStatus = async () => {
    try {
      const response = await authFetch(
        `${API_BASE_URL}/uploaded-documents/${documentId}/status/`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch status')
      }

      const data = await response.json()
      setStatus(data)

      // Redirect when classification is complete - 立即跳轉
      if (data.status === 'classified') {
        toast.success('AI 分類完成！', {
          description: `共 ${data.classification_result?.total_pages || 0} 頁`
        })
        const styleParam = styleId ? `?style_id=${styleId}` : ''
        router.push(`/dashboard/documents/${documentId}/review${styleParam}`)
      }

      // Handle failed status
      if (data.status === 'failed') {
        toast.error('AI 處理失敗')
        setError('AI processing failed. Please try again.')
      }
    } catch (err) {
      console.error('Failed to poll status:', err)
    }
  }

  const handleRetry = () => {
    setError(null)
    setRetryCount((prev) => prev + 1)
    setElapsedTime(0)
    setTaskId(null)  // DA-2: Reset task ID
    setTaskStatus(null)
    startTimeRef.current = Date.now()
    toast.info('重新開始處理...')
    triggerClassification()
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-3 text-red-800">
            <AlertCircle className="h-6 w-6" />
            <div>
              <h2 className="font-semibold">處理失敗</h2>
              <p className="text-sm mt-1">{error}</p>
              {retryCount > 0 && (
                <p className="text-xs mt-1 text-red-600">已重試 {retryCount} 次</p>
              )}
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleRetry}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" />
              重試
            </button>
            <button
              onClick={() => router.push(styleId ? `/dashboard/styles/${styleId}` : '/dashboard/upload')}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              {styleId ? '返回款式' : '返回上傳'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-3 text-gray-600">Loading...</span>
        </div>
      </div>
    )
  }

  const currentStep = status.status

  // 根據頁數估算時間（每頁約 3-5 秒）
  const estimatedTime = status.classification_result
    ? Math.max(30, status.classification_result.total_pages * 4)
    : 60

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      {/* Service Status Banner */}
      {healthChecked && serviceHealth && serviceHealth.status === 'degraded' && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-2 text-amber-800 text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Background Services Unavailable</p>
              <p className="text-amber-700 mt-1">
                {serviceHealth.redis?.status !== 'ok' && (
                  <span className="block">• Redis: {serviceHealth.redis?.message}</span>
                )}
                {serviceHealth.celery?.status !== 'ok' && (
                  <span className="block">• Celery: {serviceHealth.celery?.message}</span>
                )}
              </p>
              <p className="text-amber-600 mt-1 text-xs">
                Using sync mode (slower but functional). For faster processing, start Redis and Celery.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">AI Processing</h1>
            <p className="text-gray-600 mt-2">
              分析檔案: {status.filename}
            </p>
          </div>
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <XCircle className="h-5 w-5" />
            取消
          </button>
        </div>

        {/* 時間顯示 */}
        <div className="mt-4 flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2 text-blue-600">
            <Clock className="h-4 w-4" />
            <span>已花時間: {formatElapsedTime(elapsedTime)}</span>
          </div>
          {!status.progress.classified && (
            <div className="text-gray-500">
              預估總時間: ~{formatElapsedTime(estimatedTime)}
            </div>
          )}
          {elapsedTime > 120 && !status.progress.classified && (
            <div className="text-amber-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              處理時間較長，請耐心等待...
            </div>
          )}
        </div>

        {/* DA-2: Async task status indicator */}
        {USE_ASYNC_MODE && taskId && (
          <div className="mt-2 text-xs text-gray-500">
            <span className="font-mono">Task: {taskId.slice(0, 8)}...</span>
            {taskStatus && (
              <span className="ml-2">
                Status: <span className={
                  taskStatus.status === 'SUCCESS' ? 'text-green-600' :
                  taskStatus.status === 'FAILURE' ? 'text-red-600' :
                  taskStatus.status === 'STARTED' ? 'text-blue-600' :
                  'text-gray-600'
                }>{taskStatus.status}</span>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Step 1: Upload */}
        <StatusItem
          label="1. File Upload"
          status={status.progress.uploaded ? 'completed' : 'processing'}
          message={status.progress.uploaded ? 'Upload complete' : 'Uploading...'}
        />

        {/* Step 2: Classification */}
        <StatusItem
          label="2. AI File Classification (Smart Page Detection)"
          status={
            status.progress.classified
              ? 'completed'
              : currentStep === 'classifying'
              ? 'processing'
              : 'pending'
          }
          message={
            status.progress.classified && status.classification_result
              ? `Identified as ${status.classification_result.file_type} (${status.classification_result.total_pages} pages)`
              : currentStep === 'classifying'
              ? 'AI is analyzing file...'
              : undefined
          }
        >
          {status.progress.classified && status.classification_result && (
            <div className="ml-12 mt-3 space-y-1 text-sm">
              <p className="text-gray-600">Page classification results:</p>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                {status.classification_result.pages.slice(0, 10).map((page, idx) => (
                  <div
                    key={idx}
                    className="px-2 py-1 bg-gray-100 rounded text-xs flex justify-between"
                  >
                    <span>Page {page.page}</span>
                    <span className="font-medium capitalize">{page.type}</span>
                  </div>
                ))}
                {status.classification_result.pages.length > 10 && (
                  <div className="col-span-2 text-center text-gray-500">
                    ... {status.classification_result.pages.length - 10} more pages
                  </div>
                )}
              </div>
            </div>
          )}
        </StatusItem>

        {/* Step 3: Extraction */}
        <StatusItem
          label="3. AI Content Extraction"
          status={
            status.progress.extracted
              ? 'completed'
              : currentStep === 'extracting'
              ? 'processing'
              : 'pending'
          }
          message={
            status.progress.extracted
              ? 'Extraction complete, preparing review page...'
              : currentStep === 'extracting'
              ? 'Extracting Tech Pack, BOM, Measurement...'
              : undefined
          }
        />
      </div>

      {/* Success Message */}
      {status.progress.classified && (
        <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-800">
            <CheckCircle2 className="h-5 w-5" />
            <p className="font-medium">AI classification complete! Redirecting to review page...</p>
          </div>
        </div>
      )}
    </div>
  )
}

// StatusItem Component
interface StatusItemProps {
  label: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  message?: string
  children?: React.ReactNode
}

function StatusItem({ label, status, message, children }: StatusItemProps) {
  const getIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-6 w-6 text-green-500" />
      case 'processing':
        return <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
      case 'failed':
        return <AlertCircle className="h-6 w-6 text-red-500" />
      default:
        return <div className="h-6 w-6 rounded-full border-2 border-gray-300" />
    }
  }

  const getBorderColor = () => {
    switch (status) {
      case 'completed':
        return 'border-green-200'
      case 'processing':
        return 'border-blue-200'
      case 'failed':
        return 'border-red-200'
      default:
        return 'border-gray-200'
    }
  }

  return (
    <div className={`border rounded-lg p-4 ${getBorderColor()}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">{getIcon()}</div>
        <div className="flex-1">
          <p className="font-medium">{label}</p>
          {message && (
            <p className="text-sm text-gray-600 mt-1">{message}</p>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}
