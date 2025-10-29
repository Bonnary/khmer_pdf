import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef, useEffect } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import { PDFDocument, degrees } from 'pdf-lib'
import {
  Upload,
  FileText,
  Download,
  RotateCw,
  RotateCcw,
  Trash2,
  GripVertical,
  Plus,
  ArrowUpDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'

// Import PDF.js types
declare global {
  interface Window {
    pdfjsLib: any
  }
}

export const Route = createFileRoute('/organize/organize-pdf')({
  component: RouteComponent,
})

interface PDFPage {
  id: string
  pageNumber: number
  rotation: number
  previewUrl?: string
  isDeleted: boolean
}

interface PDFFileData {
  id: string
  file: File
  name: string
  size: number
  pages: PDFPage[]
  isLoading: boolean
}

function RouteComponent() {
  const [pdfFile, setPdfFile] = useState<PDFFileData | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPdfJsLoaded, setIsPdfJsLoaded] = useState(false)
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null)
  const [dragOverPageId, setDragOverPageId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const addFileInputRef = useRef<HTMLInputElement>(null)

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

  // Generate preview for a PDF page
  const generatePagePreview = async (
    file: File,
    pageNumber: number,
    rotation: number = 0,
  ): Promise<string | undefined> => {
    if (!isPdfJsLoaded || !window.pdfjsLib) return undefined

    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer })
        .promise
      const page = await pdf.getPage(pageNumber)

      const scale = 0.5
      const viewport = page.getViewport({ scale, rotation })

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
    if (files.length > 0) {
      loadPdfFile(files[0])
    }
  }

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      loadPdfFile(e.target.files[0])
    }
  }

  const loadPdfFile = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer)
      const pageCount = pdfDoc.getPageCount()

      const fileData: PDFFileData = {
        id: `${file.name}-${Date.now()}`,
        file,
        name: file.name,
        size: file.size,
        pages: [],
        isLoading: true,
      }

      setPdfFile(fileData)

      // Generate previews for all pages
      const pages: PDFPage[] = []
      for (let i = 1; i <= pageCount; i++) {
        const previewUrl = await generatePagePreview(file, i)
        pages.push({
          id: `page-${i}-${Date.now()}`,
          pageNumber: i,
          rotation: 0,
          previewUrl,
          isDeleted: false,
        })
      }

      setPdfFile((prev) => (prev ? { ...prev, pages, isLoading: false } : null))
    } catch (error) {
      console.error('Error loading PDF:', error)
      alert('Error loading PDF file. Please try again.')
    }
  }

  const handleAddPages = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !pdfFile) return

    const newFile = e.target.files[0]
    try {
      const arrayBuffer = await newFile.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer)
      const pageCount = pdfDoc.getPageCount()

      // Generate previews for new pages
      const newPages: PDFPage[] = []
      const currentMaxPage = Math.max(...pdfFile.pages.map((p) => p.pageNumber))

      for (let i = 1; i <= pageCount; i++) {
        const previewUrl = await generatePagePreview(newFile, i)
        newPages.push({
          id: `page-${currentMaxPage + i}-${Date.now()}`,
          pageNumber: currentMaxPage + i,
          rotation: 0,
          previewUrl,
          isDeleted: false,
        })
      }

      setPdfFile((prev) =>
        prev ? { ...prev, pages: [...prev.pages, ...newPages] } : null,
      )
    } catch (error) {
      console.error('Error adding pages:', error)
      alert('Error adding pages. Please try again.')
    }

    // Reset input
    e.target.value = ''
  }

  const rotatePage = async (pageId: string, direction: 'cw' | 'ccw') => {
    if (!pdfFile) return

    setPdfFile((prev) => {
      if (!prev) return null
      return {
        ...prev,
        pages: prev.pages.map((page) => {
          if (page.id === pageId) {
            const change = direction === 'cw' ? 90 : -90
            const newRotation = (page.rotation + change + 360) % 360
            return { ...page, rotation: newRotation }
          }
          return page
        }),
      }
    })

    // We rely on CSS transform for the preview animation and visual
    // rotation. Avoid regenerating the preview image (expensive and
    // causes jumps); the final PDF will get the actual rotation when
    // processing/saving via `processPDF`.
  }

  const deletePage = (pageId: string) => {
    setPdfFile((prev) => {
      if (!prev) return null
      return {
        ...prev,
        pages: prev.pages.map((page) =>
          page.id === pageId ? { ...page, isDeleted: true } : page,
        ),
      }
    })
  }

  const restorePage = (pageId: string) => {
    setPdfFile((prev) => {
      if (!prev) return null
      return {
        ...prev,
        pages: prev.pages.map((page) =>
          page.id === pageId ? { ...page, isDeleted: false } : page,
        ),
      }
    })
  }

  const handlePageDragStart = (pageId: string) => {
    setDraggedPageId(pageId)
  }

  const handlePageDragOver = (e: DragEvent<HTMLDivElement>, pageId: string) => {
    e.preventDefault()
    setDragOverPageId(pageId)
  }

  const handlePageDrop = (
    e: DragEvent<HTMLDivElement>,
    targetPageId: string,
  ) => {
    e.preventDefault()

    if (!draggedPageId || draggedPageId === targetPageId) {
      setDraggedPageId(null)
      setDragOverPageId(null)
      return
    }

    setPdfFile((prev) => {
      if (!prev) return null

      const pages = [...prev.pages]
      const draggedIndex = pages.findIndex((p) => p.id === draggedPageId)
      const targetIndex = pages.findIndex((p) => p.id === targetPageId)

      if (draggedIndex === -1 || targetIndex === -1) return prev

      const [draggedPage] = pages.splice(draggedIndex, 1)
      pages.splice(targetIndex, 0, draggedPage)

      return { ...prev, pages }
    })

    setDraggedPageId(null)
    setDragOverPageId(null)
  }

  const processPDF = async () => {
    if (!pdfFile) return

    const activePages = pdfFile.pages.filter((p) => !p.isDeleted)
    if (activePages.length === 0) {
      alert('No pages to save. Please keep at least one page.')
      return
    }

    setIsProcessing(true)

    try {
      // Load original PDF
      const arrayBuffer = await pdfFile.file.arrayBuffer()
      const originalPdf = await PDFDocument.load(arrayBuffer)

      // Create new PDF
      const newPdf = await PDFDocument.create()

      // Process each active page in order
      for (const page of activePages) {
        const [copiedPage] = await newPdf.copyPages(originalPdf, [
          page.pageNumber - 1,
        ])

        // Apply rotation
        if (page.rotation !== 0) {
          const currentRotation = copiedPage.getRotation().angle
          copiedPage.setRotation(degrees(currentRotation + page.rotation))
        }

        newPdf.addPage(copiedPage)
      }

      // Save and download
      const pdfBytes = await newPdf.save()
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], {
        type: 'application/pdf',
      })
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = `organized-${pdfFile.name}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      // Reset
      setPdfFile(null)
    } catch (error) {
      console.error('Error processing PDF:', error)
      alert('Error processing PDF. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  const activePages = pdfFile?.pages.filter((p) => !p.isDeleted) || []
  const deletedPages = pdfFile?.pages.filter((p) => p.isDeleted) || []

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-linear-to-r from-primary to-accent text-primary-foreground py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-2">Organize PDF Pages</h1>
          <p className="opacity-90">
            Sort, delete, rotate, and add pages to your PDF document
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Drop Zone */}
        {!pdfFile && (
          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300',
              isDragging
                ? 'border-primary bg-primary/10 scale-105'
                : 'border-border bg-card hover:border-primary/50 hover:bg-primary/5',
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileInput}
              className="hidden"
            />
            <Upload
              className={cn(
                'mx-auto mb-4',
                isDragging
                  ? 'text-primary animate-bounce'
                  : 'text-muted-foreground',
              )}
              size={64}
            />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {isDragging ? 'Drop your PDF file here' : 'Drag & Drop PDF file'}
            </h3>
            <p className="text-muted-foreground mb-4">or click to browse</p>
            <p className="text-sm text-muted-foreground">
              Upload a PDF file to organize its pages
            </p>
          </div>
        )}

        {/* Loading State */}
        {pdfFile && pdfFile.isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Spinner className="size-12 mb-4" />
            <p className="text-lg font-medium text-foreground">
              Loading PDF pages...
            </p>
          </div>
        )}

        {/* PDF Editor */}
        {pdfFile && !pdfFile.isLoading && (
          <div>
            {/* File Info */}
            <div className="bg-card rounded-xl p-6 shadow-md border border-border mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <FileText className="text-primary" size={40} />
                  <div>
                    <h2 className="text-xl font-bold text-foreground">
                      {pdfFile.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(pdfFile.size)} • {activePages.length}{' '}
                      {activePages.length === 1 ? 'page' : 'pages'}
                      {deletedPages.length > 0 &&
                        ` • ${deletedPages.length} deleted`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => addFileInputRef.current?.click()}
                    className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors flex items-center gap-2 font-medium"
                  >
                    <Plus size={18} />
                    Add Pages
                  </button>
                  <input
                    ref={addFileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={handleAddPages}
                    className="hidden"
                  />
                  <button
                    onClick={() => setPdfFile(null)}
                    className="px-4 py-2 text-destructive hover:text-destructive/80 border border-destructive/30 rounded-lg hover:bg-destructive/10 transition-colors font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>

            {/* Toolbar */}
            <div className="bg-card rounded-xl p-4 shadow-md border border-border mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ArrowUpDown size={18} />
                <span>Drag pages to reorder</span>
              </div>
              <button
                onClick={processPDF}
                disabled={isProcessing || activePages.length === 0}
                className={cn(
                  'px-6 py-3 rounded-lg font-semibold text-lg flex items-center gap-2 transition-colors',
                  isProcessing || activePages.length === 0
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg hover:shadow-xl',
                )}
              >
                {isProcessing ? (
                  <>
                    <Spinner className="size-5" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Download size={20} />
                    Save Organized PDF
                  </>
                )}
              </button>
            </div>

            {/* Pages Grid */}
            {activePages.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xl font-bold text-foreground mb-4">
                  Pages ({activePages.length})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {activePages.map((page, index) => (
                    <div
                      key={page.id}
                      draggable
                      onDragStart={() => handlePageDragStart(page.id)}
                      onDragOver={(e) => handlePageDragOver(e, page.id)}
                      onDrop={(e) => handlePageDrop(e, page.id)}
                      className={cn(
                        'bg-card rounded-lg border-2 transition-all duration-200 cursor-move',
                        dragOverPageId === page.id
                          ? 'border-primary bg-primary/10 scale-105'
                          : 'border-border hover:border-primary/50 hover:shadow-lg',
                        draggedPageId === page.id && 'opacity-50',
                      )}
                    >
                      <div className="p-3">
                        {/* Page Number */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <GripVertical
                              size={16}
                              className="text-muted-foreground"
                            />
                            <span className="text-sm font-semibold text-foreground">
                              Page {index + 1}
                            </span>
                          </div>
                        </div>

                        {/* Preview */}
                        <div className="bg-muted rounded-lg mb-3 aspect-[1/1.4] flex items-center justify-center overflow-hidden">
                          {page.previewUrl ? (
                            <img
                              src={page.previewUrl}
                              alt={`Page ${page.pageNumber}`}
                              className="w-full h-full object-contain transition-transform duration-300"
                              style={{
                                transform: `rotate(${page.rotation}deg)`,
                              }}
                            />
                          ) : (
                            <FileText
                              size={48}
                              className="text-muted-foreground"
                            />
                          )}
                        </div>

                        {/* Actions */}
                        <div className="grid grid-cols-3 gap-1">
                          <button
                            onClick={() => rotatePage(page.id, 'ccw')}
                            className="p-2 rounded-md hover:bg-secondary text-secondary-foreground transition-colors"
                            title="Rotate counter-clockwise"
                          >
                            <RotateCcw size={16} />
                          </button>
                          <button
                            onClick={() => rotatePage(page.id, 'cw')}
                            className="p-2 rounded-md hover:bg-secondary text-secondary-foreground transition-colors"
                            title="Rotate clockwise"
                          >
                            <RotateCw size={16} />
                          </button>
                          <button
                            onClick={() => deletePage(page.id)}
                            className="p-2 rounded-md hover:bg-destructive/10 text-destructive transition-colors"
                            title="Delete page"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Deleted Pages */}
            {deletedPages.length > 0 && (
              <div>
                <h3 className="text-xl font-bold text-foreground mb-4">
                  Deleted Pages ({deletedPages.length})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {deletedPages.map((page) => (
                    <div
                      key={page.id}
                      className="bg-card rounded-lg border-2 border-destructive/30 opacity-60"
                    >
                      <div className="p-3">
                        {/* Page Number */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-foreground line-through">
                            Page {page.pageNumber}
                          </span>
                        </div>

                        {/* Preview */}
                        <div className="bg-muted rounded-lg mb-3 aspect-[1/1.4] flex items-center justify-center overflow-hidden">
                          {page.previewUrl ? (
                            <img
                              src={page.previewUrl}
                              alt={`Page ${page.pageNumber}`}
                              className="w-full h-full object-contain transition-transform duration-300"
                              style={{
                                transform: `rotate(${page.rotation}deg)`,
                              }}
                            />
                          ) : (
                            <FileText
                              size={48}
                              className="text-muted-foreground"
                            />
                          )}
                        </div>

                        {/* Restore Button */}
                        <button
                          onClick={() => restorePage(page.id)}
                          className="w-full p-2 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors text-sm font-medium"
                        >
                          Restore
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        {!pdfFile && (
          <div className="mt-12 bg-card rounded-2xl p-8 shadow-md border border-border">
            <h3 className="text-xl font-bold text-foreground mb-4">
              How to organize your PDF:
            </h3>
            <ol className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                  1
                </span>
                <span>
                  Upload your PDF file by dragging and dropping or clicking to
                  browse
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                  2
                </span>
                <span>
                  Drag and drop pages to reorder them in your preferred sequence
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                  3
                </span>
                <span>
                  Use the rotate buttons to adjust page orientation clockwise or
                  counter-clockwise
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                  4
                </span>
                <span>
                  Delete unwanted pages by clicking the trash icon (you can
                  restore them later)
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                  5
                </span>
                <span>
                  Add more pages from another PDF using the "Add Pages" button
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                  6
                </span>
                <span>
                  Click "Save Organized PDF" to download your reorganized
                  document
                </span>
              </li>
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
