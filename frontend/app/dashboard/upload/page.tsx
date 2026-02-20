'use client';

/**
 * Upload Page - 整合單筆上傳與批量上傳
 * Tab 1: Single - 單一或多個 PDF/Excel 檔案
 * Tab 2: Batch - ZIP 批量上傳（按款號自動分組）
 */

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { useMutation } from '@tanstack/react-query';
import {
  Upload,
  FileText,
  FileSpreadsheet,
  FileArchive,
  X,
  AlertCircle,
  Loader2,
  FolderOpen,
  CheckCircle,
  XCircle,
  Play,
  RefreshCw,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  batchUpload,
  batchProcess,
  type BatchUploadResponse,
  type BatchProcessResponse,
  type StyleResult,
} from '@/lib/api/batch-upload';
import { API_BASE_URL, getAccessToken } from '@/lib/api/client';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

// ============================================
// Single Upload Types
// ============================================
interface UploadedFile {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  progress: number;
  error?: string;
  documentId?: string;
}

// ============================================
// Batch Upload Types
// ============================================
type BatchStep = 'upload' | 'preview' | 'processing' | 'complete';

export default function UploadPage() {
  const [activeTab, setActiveTab] = useState<string>('single');
  const searchParams = useSearchParams();
  const styleId = searchParams.get('style_id');

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Style context banner */}
      {styleId && (
        <div className="mb-4 flex items-center gap-3 bg-blue-50 border border-blue-200 text-blue-800 px-4 py-2.5 rounded-lg text-sm">
          <Link href={`/dashboard/styles/${styleId}`}>
            <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs text-blue-700">
              <ArrowLeft className="w-3 h-3" />
              Back to Style Center
            </Button>
          </Link>
          <span className="text-blue-600">|</span>
          <span>Uploading for this style. Files will be linked automatically.</span>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Upload Documents</h1>
        <p className="text-muted-foreground">
          Upload Tech Pack, BOM, or Measurement files for AI processing
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="single" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Single Upload
          </TabsTrigger>
          <TabsTrigger value="batch" className="flex items-center gap-2">
            <FileArchive className="h-4 w-4" />
            Batch Upload (ZIP)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <SingleUpload styleId={styleId} />
        </TabsContent>

        <TabsContent value="batch">
          <BatchUploadSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================
// Single Upload Component
// ============================================
function SingleUpload({ styleId }: { styleId?: string | null }) {
  const router = useRouter();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  }, []);

  const addFiles = (newFiles: File[]) => {
    const uploadedFiles: UploadedFile[] = newFiles.map((file) => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending',
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...uploadedFiles]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const uploadFile = async (uploadedFile: UploadedFile): Promise<string | null> => {
    return new Promise((resolve) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadedFile.id ? { ...f, status: 'uploading' as const, progress: 0 } : f
        )
      );

      const formData = new FormData();
      formData.append('file', uploadedFile.file);

      const xhr = new XMLHttpRequest();

      // 追蹤上傳進度
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadedFile.id ? { ...f, progress } : f
            )
          );
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            setFiles((prev) =>
              prev.map((f) =>
                f.id === uploadedFile.id
                  ? { ...f, status: 'uploaded' as const, progress: 100, documentId: data.id }
                  : f
              )
            );
            resolve(data.id);
          } catch {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === uploadedFile.id
                  ? { ...f, status: 'error' as const, error: 'Invalid response' }
                  : f
              )
            );
            resolve(null);
          }
        } else {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadedFile.id
                ? { ...f, status: 'error' as const, error: `Upload failed: ${xhr.statusText}` }
                : f
            )
          );
          resolve(null);
        }
      });

      xhr.addEventListener('error', () => {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadedFile.id
              ? { ...f, status: 'error' as const, error: 'Network error' }
              : f
          )
        );
        resolve(null);
      });

      xhr.open('POST', `${API_BASE_URL}/uploaded-documents/`);
      const token = getAccessToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);
    });
  };

  const handleUploadAll = async () => {
    const pendingFiles = files.filter((f) => f.status === 'pending');
    const uploadPromises = pendingFiles.map((f) => uploadFile(f));
    const documentIds = await Promise.all(uploadPromises);
    const successfulIds = documentIds.filter((id) => id !== null) as string[];

    if (successfulIds.length > 0) {
      const styleParam = styleId ? `?style_id=${styleId}` : '';
      router.push(`/dashboard/documents/${successfulIds[0]}/processing${styleParam}`);
    }
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') {
      return <FileText className="h-8 w-8 text-red-500" />;
    }
    return <FileSpreadsheet className="h-8 w-8 text-green-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const uploadedCount = files.filter((f) => f.status === 'uploaded').length;
  const errorCount = files.filter((f) => f.status === 'error').length;

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg font-medium">Drop files here</p>
        <p className="text-sm text-muted-foreground mb-4">or</p>
        <label className="inline-block">
          <Button variant="outline" asChild>
            <span>Choose Files</span>
          </Button>
          <input
            type="file"
            multiple
            accept=".pdf,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
        <p className="text-xs text-muted-foreground mt-4">
          Supported: PDF, Excel (.xlsx, .xls) - Max 50MB
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Selected Files ({files.length})</CardTitle>
              <div className="flex items-center gap-2">
                {uploadedCount > 0 && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700">
                    {uploadedCount} Uploaded
                  </Badge>
                )}
                {errorCount > 0 && (
                  <Badge variant="destructive">{errorCount} Failed</Badge>
                )}
                <Button variant="ghost" size="sm" onClick={() => setFiles([])}>
                  Clear All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {files.map((uploadedFile) => (
              <div
                key={uploadedFile.id}
                className={`p-3 border rounded-lg ${
                  uploadedFile.status === 'error'
                    ? 'border-red-200 bg-red-50'
                    : uploadedFile.status === 'uploaded'
                    ? 'border-green-200 bg-green-50'
                    : 'border-border'
                }`}
              >
                <div className="flex items-center gap-3">
                  {getFileIcon(uploadedFile.file.name)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{uploadedFile.file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(uploadedFile.file.size)}
                      {uploadedFile.status === 'uploading' && (
                        <span className="ml-2 text-blue-600">{uploadedFile.progress}%</span>
                      )}
                      {uploadedFile.status === 'uploaded' && (
                        <span className="ml-2 text-green-600">✓ 上傳完成</span>
                      )}
                      {uploadedFile.status === 'error' && (
                        <span className="ml-2 text-red-600">{uploadedFile.error}</span>
                      )}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeFile(uploadedFile.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {/* 進度條 */}
                {uploadedFile.status === 'uploading' && (
                  <div className="mt-2">
                    <Progress value={uploadedFile.progress} className="h-2" />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upload Button */}
      {pendingCount > 0 && (
        <Button onClick={handleUploadAll} className="w-full" size="lg">
          <Upload className="h-4 w-4 mr-2" />
          Upload & Process ({pendingCount} files)
        </Button>
      )}

      {/* Info */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>How it works</AlertTitle>
        <AlertDescription>
          AI will classify (Tech Pack / BOM / Spec) and extract content automatically.
          After extraction, review and verify the data accuracy.
        </AlertDescription>
      </Alert>
    </div>
  );
}

// ============================================
// Batch Upload Component
// ============================================
function BatchUploadSection() {
  const [step, setStep] = useState<BatchStep>('upload');
  const [uploadResult, setUploadResult] = useState<BatchUploadResponse | null>(null);
  const [processResult, setProcessResult] = useState<BatchProcessResponse | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);

  const uploadMutation = useMutation({
    mutationFn: batchUpload,
    onSuccess: (data) => {
      setUploadResult(data);
      setStep('preview');
    },
  });

  const processMutation = useMutation({
    mutationFn: async (documentIds: string[]) => {
      const progressInterval = setInterval(() => {
        setProcessingProgress((prev) => Math.min(prev + 10, 90));
      }, 500);

      try {
        const result = await batchProcess(documentIds, false);
        clearInterval(progressInterval);
        setProcessingProgress(100);
        return result;
      } catch (error) {
        clearInterval(progressInterval);
        throw error;
      }
    },
    onSuccess: (data) => {
      setProcessResult(data);
      setStep('complete');
    },
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        uploadMutation.mutate(acceptedFiles[0]);
      }
    },
    [uploadMutation]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/zip': ['.zip'] },
    maxFiles: 1,
    disabled: uploadMutation.isPending,
  });

  const getAllDocumentIds = (): string[] => {
    if (!uploadResult) return [];
    return Object.values(uploadResult.style_results).flatMap((style) =>
      style.documents.map((doc) => doc.id)
    );
  };

  const handleStartProcessing = () => {
    const documentIds = getAllDocumentIds();
    if (documentIds.length > 0) {
      setStep('processing');
      setProcessingProgress(0);
      processMutation.mutate(documentIds);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setUploadResult(null);
    setProcessResult(null);
    setProcessingProgress(0);
    uploadMutation.reset();
    processMutation.reset();
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Upload ZIP */}
      {step === 'upload' && (
        <>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
            } ${uploadMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input {...getInputProps()} />
            {uploadMutation.isPending ? (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
                <p className="text-lg font-medium">Analyzing ZIP file...</p>
              </div>
            ) : (
              <>
                <FileArchive className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">Drop ZIP file here</p>
                <p className="text-sm text-muted-foreground">or click to browse</p>
              </>
            )}
          </div>

          {uploadMutation.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Upload Failed</AlertTitle>
              <AlertDescription>{uploadMutation.error?.message}</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">File Naming Convention</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <p><code className="bg-muted px-1 rounded">LW1FLWS.pdf</code> - Single PDF for style</p>
              <p><code className="bg-muted px-1 rounded">LW1FLWS_techpack.pdf</code> - Tech Pack</p>
              <p><code className="bg-muted px-1 rounded">LW1FLWS_bom.pdf</code> - BOM</p>
              <p><code className="bg-muted px-1 rounded">LW1FLWS_spec.pdf</code> - Measurement</p>
            </CardContent>
          </Card>
        </>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && uploadResult && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard label="Total Files" value={uploadResult.total_files} icon={FileText} />
            <SummaryCard label="Styles Found" value={uploadResult.styles_found} icon={FolderOpen} />
            <SummaryCard label="New Styles" value={uploadResult.styles_created} icon={CheckCircle} variant="success" />
            <SummaryCard label="Errors" value={uploadResult.errors.length} icon={XCircle} variant={uploadResult.errors.length > 0 ? 'error' : 'default'} />
          </div>

          {uploadResult.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Some files could not be processed</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-2">
                  {uploadResult.errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Styles Found</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(uploadResult.style_results).map(([styleNumber, result]) => (
                <StyleGroupCard key={styleNumber} styleNumber={styleNumber} result={result} />
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={handleReset}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Start Over
            </Button>
            <Button onClick={handleStartProcessing} disabled={uploadResult.documents_created === 0}>
              <Play className="h-4 w-4 mr-2" />
              Start AI Processing ({uploadResult.documents_created} files)
            </Button>
          </div>
        </>
      )}

      {/* Step 3: Processing */}
      {step === 'processing' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Processing Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={processingProgress} className="h-3" />
            <p className="text-center text-muted-foreground">
              AI is classifying and extracting content...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Complete */}
      {step === 'complete' && processResult && (
        <>
          <Alert className={processResult.failed > 0 ? 'border-amber-500' : 'border-green-500'}>
            {processResult.failed === 0 ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-500" />
            )}
            <AlertTitle>
              Processing Complete - {processResult.processed}/{processResult.total} Successful
            </AlertTitle>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(processResult.results).map(([docId, result]) => {
                const docInfo = Object.values(uploadResult?.style_results || {})
                  .flatMap((s) => s.documents)
                  .find((d) => d.id === docId);

                return (
                  <div key={docId} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {result.status === 'completed' ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <span className="font-medium">{docInfo?.filename || docId}</span>
                    </div>
                    <div className="flex gap-2">
                      {result.blocks_count !== undefined && (
                        <Badge variant="secondary">{result.blocks_count} blocks</Badge>
                      )}
                      {result.bom_items_count !== undefined && (
                        <Badge variant="secondary">{result.bom_items_count} BOM</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={handleReset}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Upload More
            </Button>
            <Button asChild>
              <a href="/dashboard/styles">View Styles</a>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// Helper Components
// ============================================
function SummaryCard({
  label,
  value,
  icon: Icon,
  variant = 'default',
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  variant?: 'default' | 'success' | 'error';
}) {
  const colors = {
    default: 'text-muted-foreground',
    success: 'text-green-500',
    error: 'text-red-500',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <Icon className={`h-8 w-8 ${colors[variant]}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function StyleGroupCard({ styleNumber, result }: { styleNumber: string; result: StyleResult }) {
  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-primary" />
          <span className="font-medium">{styleNumber}</span>
          {result.style_created && <Badge variant="secondary">New</Badge>}
        </div>
        <Badge variant={result.status === 'created' ? 'default' : 'destructive'}>
          {result.status}
        </Badge>
      </div>
      <div className="space-y-1 ml-6">
        {result.documents.map((doc) => (
          <div key={doc.id} className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-3 w-3" />
            <span>{doc.filename}</span>
            <Badge variant="outline" className="text-xs">{doc.file_type}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
