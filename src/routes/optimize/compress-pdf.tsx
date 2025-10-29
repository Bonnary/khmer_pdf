import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import { Upload, X, FileText, Download, Loader2, Gauge } from 'lucide-react'
import { compressPDF, type CompressionMode } from '@/lib/compress-helper'

export const Route = createFileRoute('/optimize/compress-pdf')({
  component: RouteComponent,
})

interface PDFFile {
  id: string
  file: File
  name: string
  size: number
  compressedSize?: number
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress?: number
}

interface CompressionOption {
  mode: CompressionMode
  label: string
  description: string
  quality: string
  compression: string
  imageQuality: number
}

const compressionOptions: CompressionOption[] = [
  {
    mode: 'extreme',
    label: 'Extreme',
    description: 'Maximum compression',
    quality: 'Lower quality',
    compression: 'High compression',
    imageQuality: 0.3,
  },
  {
    mode: 'normal',
    label: 'Normal',
    description: 'Balanced compression',
    quality: 'Good quality',
    compression: 'Good compression',
    imageQuality: 0.6,
  },
  {
    mode: 'less',
    label: 'Less',
    description: 'Light compression',
    quality: 'High quality',
    compression: 'Less compression',
    imageQuality: 0.85,
  },
]

function RouteComponent() {
  const [pdfFiles, setPdfFiles] = useState<PDFFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [compressionMode, setCompressionMode] =
    useState<CompressionMode>('normal')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files).filter(
      (file) => file.type === 'application/pdf',
    )
    addFiles(files)
  }

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(
        (file) => file.type === 'application/pdf',
      )
      addFiles(files)
    }
  }

  const addFiles = (files: File[]) => {
    const newPdfFiles: PDFFile[] = files.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      name: file.name,
      size: file.size,
      status: 'pending',
    }))
    setPdfFiles((prev) => [...prev, ...newPdfFiles])
  }

  const removeFile = (id: string) => {
    setPdfFiles((prev) => prev.filter((file) => file.id !== id))
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  const handleCompressPDF = async (pdfFile: PDFFile): Promise<Uint8Array> => {
    return await compressPDF(
      pdfFile.file,
      compressionMode,
      (current, total) => {
        const progress = Math.floor((current / total) * 100)
        setPdfFiles((prev) =>
          prev.map((f) => (f.id === pdfFile.id ? { ...f, progress } : f)),
        )
      },
    )
  }

  const compressPDFs = async () => {
    if (pdfFiles.length === 0) {
      alert('Please select at least 1 PDF file to compress')
      return
    }

    setIsProcessing(true)

    try {
      for (let i = 0; i < pdfFiles.length; i++) {
        const pdfFile = pdfFiles[i]

        // Update status to processing
        setPdfFiles((prev) =>
          prev.map((f) =>
            f.id === pdfFile.id ? { ...f, status: 'processing' } : f,
          ),
        )

        try {
          const compressedBytes = await handleCompressPDF(pdfFile)
          const compressedSize = compressedBytes.length

          // Update with compressed size
          setPdfFiles((prev) =>
            prev.map((f) =>
              f.id === pdfFile.id
                ? { ...f, compressedSize, status: 'completed' }
                : f,
            ),
          )

          // Download compressed PDF
          const blob = new Blob([new Uint8Array(compressedBytes)], {
            type: 'application/pdf',
          })
          const url = URL.createObjectURL(blob)

          const link = document.createElement('a')
          link.href = url
          link.download = `compressed-${pdfFile.name}`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
        } catch (error) {
          console.error(`Error compressing ${pdfFile.name}:`, error)
          setPdfFiles((prev) =>
            prev.map((f) =>
              f.id === pdfFile.id ? { ...f, status: 'error' } : f,
            ),
          )
        }
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const getCompressionRatio = (
    original: number,
    compressed?: number,
  ): string => {
    if (!compressed) return '-'
    const ratio = ((1 - compressed / original) * 100).toFixed(1)
    return `${ratio}%`
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-blue-50 to-white">
      {/* Header */}
      <div className="bg-linear-to-r from-blue-600 to-cyan-600 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-2">Compress PDF Files</h1>
          <p className="text-blue-50">
            Reduce PDF file size while maintaining quality
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Compression Mode Selection */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Gauge className="text-blue-600" size={24} />
            Compression Mode
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {compressionOptions.map((option) => (
              <button
                key={option.mode}
                onClick={() => setCompressionMode(option.mode)}
                disabled={isProcessing}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  compressionMode === option.mode
                    ? 'border-blue-600 bg-blue-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                } ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      compressionMode === option.mode
                        ? 'border-blue-600'
                        : 'border-gray-300'
                    }`}
                  >
                    {compressionMode === option.mode && (
                      <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-800">{option.label}</h3>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  {option.description}
                </p>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>• {option.quality}</p>
                  <p>• {option.compression}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Drop Zone */}
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${
            isDragging
              ? 'border-blue-500 bg-blue-50 scale-105'
              : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50'
          } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="application/pdf"
            onChange={handleFileInput}
            className="hidden"
            disabled={isProcessing}
          />
          <Upload
            className={`mx-auto mb-4 ${isDragging ? 'text-blue-500 animate-bounce' : 'text-gray-400'}`}
            size={64}
          />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            {isDragging ? 'Drop your PDF files here' : 'Drag & Drop PDF files'}
          </h3>
          <p className="text-gray-500 mb-4">or click to browse</p>
          <p className="text-sm text-gray-400">
            Select PDF files to compress with {compressionMode} mode
          </p>
        </div>

        {/* File List */}
        {pdfFiles.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-800">
                Selected Files ({pdfFiles.length})
              </h2>
              <button
                onClick={() => setPdfFiles([])}
                disabled={isProcessing}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear All
              </button>
            </div>

            <div className="space-y-3">
              {pdfFiles.map((pdfFile) => (
                <div
                  key={pdfFile.id}
                  className={`bg-white rounded-xl p-4 shadow-md border-2 transition-all ${
                    pdfFile.status === 'processing'
                      ? 'border-blue-500 bg-blue-50'
                      : pdfFile.status === 'completed'
                        ? 'border-green-500 bg-green-50'
                        : pdfFile.status === 'error'
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <FileText
                      className={`shrink-0 ${
                        pdfFile.status === 'processing'
                          ? 'text-blue-600'
                          : pdfFile.status === 'completed'
                            ? 'text-green-600'
                            : pdfFile.status === 'error'
                              ? 'text-red-600'
                              : 'text-blue-600'
                      }`}
                      size={32}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">
                        {pdfFile.name}
                      </p>
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <span>Original: {formatFileSize(pdfFile.size)}</span>
                        {pdfFile.compressedSize && (
                          <>
                            <span>→</span>
                            <span className="text-green-600 font-medium">
                              Compressed:{' '}
                              {formatFileSize(pdfFile.compressedSize)}
                            </span>
                            <span className="text-green-600 font-bold">
                              (
                              {getCompressionRatio(
                                pdfFile.size,
                                pdfFile.compressedSize,
                              )}{' '}
                              smaller)
                            </span>
                          </>
                        )}
                      </div>
                      {pdfFile.status === 'processing' && (
                        <div className="mt-2">
                          <p className="text-sm text-blue-600 font-medium mb-1">
                            Compressing... {pdfFile.progress || 0}%
                          </p>
                          <div className="w-full bg-blue-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${pdfFile.progress || 0}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                      {pdfFile.status === 'completed' && (
                        <p className="text-sm text-green-600 font-medium mt-1">
                          ✓ Compressed and downloaded
                        </p>
                      )}
                      {pdfFile.status === 'error' && (
                        <p className="text-sm text-red-600 font-medium mt-1">
                          ✗ Error compressing file
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {pdfFile.status === 'processing' && (
                        <Loader2
                          className="text-blue-600 animate-spin"
                          size={24}
                        />
                      )}
                      {pdfFile.status !== 'processing' && (
                        <button
                          onClick={() => removeFile(pdfFile.id)}
                          disabled={isProcessing}
                          className="p-2 rounded-lg hover:bg-red-100 text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Remove file"
                        >
                          <X size={20} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Compress Button */}
            <button
              onClick={compressPDFs}
              disabled={pdfFiles.length === 0 || isProcessing}
              className="w-full mt-6 bg-blue-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={24} />
                  Compressing PDFs...
                </>
              ) : (
                <>
                  <Download size={24} />
                  Compress {pdfFiles.length} PDF{pdfFiles.length > 1 ? 's' : ''}{' '}
                  ({compressionMode} mode)
                </>
              )}
            </button>
          </div>
        )}

        {/* Instructions */}
        {pdfFiles.length === 0 && (
          <div className="mt-12 bg-white rounded-2xl p-8 shadow-md">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              How to compress PDF files:
            </h3>
            <ol className="space-y-3 text-gray-600">
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  1
                </span>
                <span>
                  Select your preferred compression mode (Extreme, Normal, or
                  Less)
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  2
                </span>
                <span>
                  Drag and drop your PDF files into the upload area, or click to
                  select files from your computer
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  3
                </span>
                <span>
                  Click the "Compress PDFs" button to start the compression
                  process
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  4
                </span>
                <span>
                  Each compressed PDF will be automatically downloaded to your
                  computer
                </span>
              </li>
            </ol>
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-2">
                Compression Modes:
              </h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>
                  <strong>Extreme:</strong> Maximum file size reduction with
                  lower quality - best for documents where quality is less
                  critical
                </li>
                <li>
                  <strong>Normal:</strong> Balanced compression maintaining good
                  quality - recommended for most use cases
                </li>
                <li>
                  <strong>Less:</strong> Light compression preserving high
                  quality - ideal for important documents
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
