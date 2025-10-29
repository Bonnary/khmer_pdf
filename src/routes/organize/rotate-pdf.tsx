import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef, useEffect } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import { PDFDocument, degrees } from 'pdf-lib'
import {
  Upload,
  X,
  FileText,
  Download,
  Loader2,
  RotateCw,
  RotateCcw,
  Check,
} from 'lucide-react'

// Import PDF.js types
declare global {
  interface Window {
    pdfjsLib: any
  }
}

export const Route = createFileRoute('/organize/rotate-pdf')({
  component: RouteComponent,
})

interface PDFFile {
  id: string
  file: File
  name: string
  size: number
  rotation: number // 0, 90, 180, 270
  status: 'pending' | 'processing' | 'completed' | 'error'
  pageCount?: number
  previewUrl?: string
}

type RotateDirection = 'clockwise' | 'counterclockwise'

function RouteComponent() {
  const [pdfFiles, setPdfFiles] = useState<PDFFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPdfJsLoaded, setIsPdfJsLoaded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load PDF.js library
  useEffect(() => {
    const loadPdfJs = async () => {
      if (window.pdfjsLib) {
        setIsPdfJsLoaded(true)
        return
      }

      try {
        const script = document.createElement('script')
        script.src = '/pdf-js/pdf.mjs'
        script.type = 'module'
        script.onload = () => {
          if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
              '/pdf-js/pdf.worker.mjs'
            setIsPdfJsLoaded(true)
          }
        }
        document.head.appendChild(script)
      } catch (error) {
        console.error('Error loading PDF.js:', error)
      }
    }

    loadPdfJs()
  }, [])

  // Generate preview for a PDF file
  const generatePreview = async (file: File): Promise<string | undefined> => {
    if (!isPdfJsLoaded || !window.pdfjsLib) return undefined

    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer })
        .promise
      const page = await pdf.getPage(1)

      const scale = 1.5
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      canvas.height = viewport.height
      canvas.width = viewport.width

      if (context) {
        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise

        return canvas.toDataURL()
      }
    } catch (error) {
      console.error('Error generating preview:', error)
    }

    return undefined
  }

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

  const addFiles = async (files: File[]) => {
    const newPdfFiles: PDFFile[] = []

    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await PDFDocument.load(arrayBuffer)
        const pageCount = pdf.getPageCount()

        // Generate preview
        const previewUrl = await generatePreview(file)

        newPdfFiles.push({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          file,
          name: file.name,
          size: file.size,
          rotation: 0,
          status: 'pending',
          pageCount,
          previewUrl,
        })
      } catch (error) {
        console.error(`Error loading ${file.name}:`, error)
      }
    }

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

  const rotateFile = (id: string, direction: RotateDirection) => {
    setPdfFiles((prev) =>
      prev.map((file) => {
        if (file.id === id) {
          const change = direction === 'clockwise' ? 90 : -90
          const newRotation = (file.rotation + change + 360) % 360
          return { ...file, rotation: newRotation }
        }
        return file
      }),
    )
  }

  const rotateAllFiles = (direction: RotateDirection) => {
    setPdfFiles((prev) =>
      prev.map((file) => {
        const change = direction === 'clockwise' ? 90 : -90
        const newRotation = (file.rotation + change + 360) % 360
        return { ...file, rotation: newRotation }
      }),
    )
  }

  const resetRotation = (id: string) => {
    setPdfFiles((prev) =>
      prev.map((file) => (file.id === id ? { ...file, rotation: 0 } : file)),
    )
  }

  const resetAllRotations = () => {
    setPdfFiles((prev) => prev.map((file) => ({ ...file, rotation: 0 })))
  }

  const rotatePDF = async (pdfFile: PDFFile): Promise<Uint8Array> => {
    const arrayBuffer = await pdfFile.file.arrayBuffer()
    const pdfDoc = await PDFDocument.load(arrayBuffer)
    const pages = pdfDoc.getPages()

    // Rotate all pages by the specified angle
    pages.forEach((page) => {
      const currentRotation = page.getRotation().angle
      const newRotation = currentRotation + pdfFile.rotation
      page.setRotation(degrees(newRotation))
    })

    return await pdfDoc.save()
  }

  const processRotations = async () => {
    if (pdfFiles.length === 0) {
      alert('Please select at least 1 PDF file to rotate')
      return
    }

    // Check if any files need rotation
    const filesToRotate = pdfFiles.filter((file) => file.rotation !== 0)
    if (filesToRotate.length === 0) {
      alert('Please rotate at least one PDF file before processing')
      return
    }

    setIsProcessing(true)

    try {
      for (const pdfFile of pdfFiles) {
        if (pdfFile.rotation === 0) {
          // Skip files with no rotation
          setPdfFiles((prev) =>
            prev.map((f) =>
              f.id === pdfFile.id ? { ...f, status: 'completed' } : f,
            ),
          )
          continue
        }

        // Update status to processing
        setPdfFiles((prev) =>
          prev.map((f) =>
            f.id === pdfFile.id ? { ...f, status: 'processing' } : f,
          ),
        )

        try {
          const rotatedBytes = await rotatePDF(pdfFile)

          // Update status to completed
          setPdfFiles((prev) =>
            prev.map((f) =>
              f.id === pdfFile.id ? { ...f, status: 'completed' } : f,
            ),
          )

          // Download rotated PDF
          const blob = new Blob([new Uint8Array(rotatedBytes)], {
            type: 'application/pdf',
          })
          const url = URL.createObjectURL(blob)

          const link = document.createElement('a')
          link.href = url
          link.download = `rotated-${pdfFile.name}`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
        } catch (error) {
          console.error(`Error rotating ${pdfFile.name}:`, error)
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

  const getRotationLabel = (rotation: number): string => {
    switch (rotation) {
      case 0:
        return 'No rotation'
      case 90:
        return '90° clockwise'
      case 180:
        return '180°'
      case 270:
        return '90° counter-clockwise'
      default:
        return `${rotation}°`
    }
  }

  const getStatusIcon = (status: PDFFile['status']) => {
    switch (status) {
      case 'processing':
        return <Loader2 className="animate-spin text-primary" size={20} />
      case 'completed':
        return <Check className="text-green-600" size={20} />
      case 'error':
        return <X className="text-destructive" size={20} />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-primary/10 to-background">
      {/* Header */}
      <div className="bg-linear-to-r from-primary to-accent text-primary-foreground py-12 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-2">Rotate PDF Files</h1>
          <p className="opacity-90">
            Rotate your PDF pages to the perfect orientation
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Drop Zone */}
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${
            isDragging
              ? 'border-primary bg-primary/10 scale-105'
              : 'border-border bg-card hover:border-primary/50 hover:bg-primary/5'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="application/pdf"
            onChange={handleFileInput}
            className="hidden"
          />
          <Upload
            className={`mx-auto mb-4 ${isDragging ? 'text-primary animate-bounce' : 'text-muted-foreground'}`}
            size={64}
          />
          <h3 className="text-xl font-semibold text-foreground mb-2">
            {isDragging ? 'Drop your PDF files here' : 'Drag & Drop PDF files'}
          </h3>
          <p className="text-muted-foreground mb-4">or click to browse</p>
          <p className="text-sm text-muted-foreground">
            Select one or multiple PDF files to rotate
          </p>
        </div>

        {/* File List */}
        {pdfFiles.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-foreground">
                Selected Files ({pdfFiles.length})
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={resetAllRotations}
                  disabled={isProcessing}
                  className="px-4 py-2 text-primary hover:text-primary/80 text-sm font-medium border border-primary/30 rounded-lg hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Reset All
                </button>
                <button
                  onClick={() => setPdfFiles([])}
                  disabled={isProcessing}
                  className="px-4 py-2 text-destructive hover:text-destructive/80 text-sm font-medium border border-destructive/30 rounded-lg hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Global Rotation Controls */}
            <div className="bg-card rounded-xl p-4 shadow-md border border-primary/20 mb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-card-foreground">
                  Rotate All Files
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => rotateAllFiles('counterclockwise')}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Rotate all counter-clockwise"
                  >
                    <RotateCcw size={20} />
                    Rotate Left
                  </button>
                  <button
                    onClick={() => rotateAllFiles('clockwise')}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Rotate all clockwise"
                  >
                    <RotateCw size={20} />
                    Rotate Right
                  </button>
                </div>
              </div>
            </div>

            {/* Individual Files */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pdfFiles.map((pdfFile) => (
                <div
                  key={pdfFile.id}
                  className="bg-card rounded-xl p-4 shadow-md border border-border hover:shadow-lg transition-shadow"
                >
                  {/* File Header */}
                  <div className="flex items-start gap-3 mb-3">
                    <FileText className="text-primary shrink-0" size={32} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-card-foreground truncate">
                        {pdfFile.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(pdfFile.size)}
                        {pdfFile.pageCount && ` • ${pdfFile.pageCount} pages`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(pdfFile.status)}
                      <button
                        onClick={() => removeFile(pdfFile.id)}
                        disabled={isProcessing}
                        className="p-1 rounded-lg hover:bg-destructive/10 text-destructive transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Remove file"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>

                  {/* Rotation Preview */}
                  <div className="flex items-center justify-center mb-3 bg-muted rounded-lg p-4 min-h-[200px]">
                    {pdfFile.previewUrl ? (
                      <div
                        className="max-w-full max-h-[180px] transition-transform duration-300"
                        style={{
                          transform: `rotate(${pdfFile.rotation}deg)`,
                        }}
                      >
                        <img
                          src={pdfFile.previewUrl}
                          alt={`Preview of ${pdfFile.name}`}
                          className="max-w-full max-h-[180px] object-contain rounded shadow-sm"
                        />
                      </div>
                    ) : (
                      <div
                        className="w-20 h-28 bg-card border-2 border-primary/30 rounded-lg shadow-sm flex items-center justify-center text-muted-foreground transition-transform duration-300"
                        style={{
                          transform: `rotate(${pdfFile.rotation}deg)`,
                        }}
                      >
                        <FileText size={40} />
                      </div>
                    )}
                  </div>

                  {/* Rotation Info */}
                  <div className="text-center mb-3">
                    <p className="text-sm font-medium text-foreground">
                      {getRotationLabel(pdfFile.rotation)}
                    </p>
                  </div>

                  {/* Rotation Controls */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => rotateFile(pdfFile.id, 'counterclockwise')}
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Rotate counter-clockwise"
                    >
                      <RotateCcw size={18} />
                      <span className="text-sm">Left</span>
                    </button>
                    <button
                      onClick={() => resetRotation(pdfFile.id)}
                      disabled={isProcessing || pdfFile.rotation === 0}
                      className="px-3 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
                      title="Reset rotation"
                    >
                      Reset
                    </button>
                    <button
                      onClick={() => rotateFile(pdfFile.id, 'clockwise')}
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Rotate clockwise"
                    >
                      <RotateCw size={18} />
                      <span className="text-sm">Right</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Process Button */}
            <button
              onClick={processRotations}
              disabled={
                isProcessing || pdfFiles.every((file) => file.rotation === 0)
              }
              className="w-full mt-6 bg-primary text-primary-foreground py-4 px-6 rounded-xl font-semibold text-lg hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={24} />
                  Processing PDFs...
                </>
              ) : (
                <>
                  <Download size={24} />
                  Download Rotated PDF
                  {pdfFiles.filter((f) => f.rotation !== 0).length > 1
                    ? 's'
                    : ''}
                </>
              )}
            </button>
          </div>
        )}

        {/* Instructions */}
        {pdfFiles.length === 0 && (
          <div className="mt-12 bg-card rounded-2xl p-8 shadow-md">
            <h3 className="text-xl font-bold text-card-foreground mb-4">
              How to rotate PDF files:
            </h3>
            <ol className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                  1
                </span>
                <span>
                  Drag and drop your PDF files into the upload area, or click to
                  select files from your computer
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                  2
                </span>
                <span>
                  Use the rotation buttons to rotate each PDF individually, or
                  use "Rotate All Files" to rotate all PDFs at once
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                  3
                </span>
                <span>
                  Preview the rotation angle in real-time with the visual
                  preview
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                  4
                </span>
                <span>
                  Click "Download Rotated PDFs" to process and download your
                  rotated files
                </span>
              </li>
            </ol>

            <div className="mt-6 p-4 bg-primary/10 rounded-lg border border-primary/20">
              <h4 className="font-semibold text-foreground mb-2">💡 Tip</h4>
              <p className="text-sm text-muted-foreground">
                You can rotate multiple PDF files at once! Simply add all your
                PDFs, adjust their rotations as needed, and download them all in
                one go. Files without any rotation will be skipped.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
