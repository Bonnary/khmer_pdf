import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import { PDFDocument } from 'pdf-lib'
import {
  Upload,
  X,
  FileText,
  Download,
  Loader2,
  Scissors,
  FileStack,
  ChevronRight,
} from 'lucide-react'

export const Route = createFileRoute('/organize/split-pdf')({
  component: RouteComponent,
})

interface PDFFile {
  id: string
  file: File
  name: string
  size: number
  pageCount?: number
}

type SplitMode = 'pages' | 'ranges' | 'all'

interface PageRange {
  id: string
  start: number
  end: number
}

function RouteComponent() {
  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [splitMode, setSplitMode] = useState<SplitMode>('all')
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set())
  const [pageRanges, setPageRanges] = useState<PageRange[]>([
    { id: '1', start: 1, end: 1 },
  ])
  const [isLoadingPDF, setIsLoadingPDF] = useState(false)
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
    if (files.length > 0) {
      addFile(files[0]) // Only take the first file
    }
  }

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      addFile(e.target.files[0])
    }
  }

  const addFile = async (file: File) => {
    setIsLoadingPDF(true)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await PDFDocument.load(arrayBuffer)
      const pageCount = pdf.getPageCount()

      const newPdfFile: PDFFile = {
        id: `${file.name}-${Date.now()}`,
        file,
        name: file.name,
        size: file.size,
        pageCount,
      }
      setPdfFile(newPdfFile)
      setSelectedPages(new Set())
      setPageRanges([{ id: '1', start: 1, end: Math.min(1, pageCount) }])
    } catch (error) {
      console.error('Error loading PDF:', error)
      alert('Failed to load PDF file. Please try another file.')
    } finally {
      setIsLoadingPDF(false)
    }
  }

  const removeFile = () => {
    setPdfFile(null)
    setSelectedPages(new Set())
    setPageRanges([{ id: '1', start: 1, end: 1 }])
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  const togglePage = (pageNum: number) => {
    const newSelected = new Set(selectedPages)
    if (newSelected.has(pageNum)) {
      newSelected.delete(pageNum)
    } else {
      newSelected.add(pageNum)
    }
    setSelectedPages(newSelected)
  }

  const addRange = () => {
    const maxPage = pdfFile?.pageCount || 1
    setPageRanges([
      ...pageRanges,
      {
        id: Date.now().toString(),
        start: 1,
        end: Math.min(1, maxPage),
      },
    ])
  }

  const updateRange = (id: string, field: 'start' | 'end', value: number) => {
    setPageRanges(
      pageRanges.map((range) =>
        range.id === id ? { ...range, [field]: value } : range,
      ),
    )
  }

  const removeRange = (id: string) => {
    if (pageRanges.length > 1) {
      setPageRanges(pageRanges.filter((range) => range.id !== id))
    }
  }

  const splitPDF = async () => {
    if (!pdfFile) {
      alert('Please select a PDF file first')
      return
    }

    setIsProcessing(true)

    try {
      const arrayBuffer = await pdfFile.file.arrayBuffer()
      const sourcePdf = await PDFDocument.load(arrayBuffer)

      let pagesToSplit: number[][] = []

      if (splitMode === 'all') {
        // Each page becomes its own PDF
        pagesToSplit = Array.from(
          { length: pdfFile.pageCount || 0 },
          (_, i) => [i],
        )
      } else if (splitMode === 'pages') {
        // Selected pages become individual PDFs
        pagesToSplit = Array.from(selectedPages)
          .sort((a, b) => a - b)
          .map((page) => [page - 1])
      } else if (splitMode === 'ranges') {
        // Each range becomes a PDF
        pagesToSplit = pageRanges.map((range) => {
          const pages: number[] = []
          for (let i = range.start; i <= range.end; i++) {
            pages.push(i - 1)
          }
          return pages
        })
      }

      if (pagesToSplit.length === 0) {
        alert('Please select at least one page or range to split')
        setIsProcessing(false)
        return
      }

      // Create individual PDFs
      for (let i = 0; i < pagesToSplit.length; i++) {
        const newPdf = await PDFDocument.create()
        const pageIndices = pagesToSplit[i]

        for (const pageIndex of pageIndices) {
          if (pageIndex >= 0 && pageIndex < sourcePdf.getPageCount()) {
            const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageIndex])
            newPdf.addPage(copiedPage)
          }
        }

        const pdfBytes = await newPdf.save()
        const blob = new Blob([pdfBytes.buffer as ArrayBuffer], {
          type: 'application/pdf',
        })
        const url = URL.createObjectURL(blob)

        const link = document.createElement('a')
        link.href = url

        // Generate filename based on mode
        const baseName = pdfFile.name.replace('.pdf', '')
        if (splitMode === 'all') {
          link.download = `${baseName}_page_${pageIndices[0] + 1}.pdf`
        } else if (splitMode === 'pages') {
          link.download = `${baseName}_page_${pageIndices[0] + 1}.pdf`
        } else {
          link.download = `${baseName}_pages_${pageIndices[0] + 1}-${pageIndices[pageIndices.length - 1] + 1}.pdf`
        }

        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        // Small delay between downloads
        if (i < pagesToSplit.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      }

      alert(
        `Successfully split into ${pagesToSplit.length} PDF file${pagesToSplit.length > 1 ? 's' : ''}!`,
      )
      // Reset after successful split
      removeFile()
    } catch (error) {
      console.error('Error splitting PDF:', error)
      alert('An error occurred while splitting the PDF. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-primary/10 to-background">
      {/* Header */}
      <div className="bg-linear-to-r from-primary to-accent text-primary-foreground py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Scissors className="mx-auto mb-4" size={48} />
          <h1 className="text-4xl font-bold mb-2">Split PDF Files</h1>
          <p className="text-primary-foreground/90">
            Separate pages from your PDF into individual files
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Drop Zone */}
        {!pdfFile && (
          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${
              isDragging
                ? 'border-primary bg-primary/10 scale-105'
                : 'border-border bg-card hover:border-primary hover:bg-primary/5'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileInput}
              className="hidden"
            />
            <Upload
              className={`mx-auto mb-4 ${isDragging ? 'text-primary animate-bounce' : 'text-muted-foreground'}`}
              size={64}
            />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {isDragging ? 'Drop your PDF file here' : 'Drag & Drop PDF file'}
            </h3>
            <p className="text-muted-foreground mb-4">or click to browse</p>
            <p className="text-sm text-muted-foreground">
              Select a PDF file to split into separate documents
            </p>
          </div>
        )}

        {/* Loading */}
        {isLoadingPDF && (
          <div className="text-center py-8">
            <Loader2 className="animate-spin mx-auto text-primary" size={48} />
            <p className="mt-4 text-muted-foreground">Loading PDF...</p>
          </div>
        )}

        {/* File Info */}
        {pdfFile && !isLoadingPDF && (
          <div className="space-y-6">
            <div className="bg-card rounded-xl p-4 shadow-md border border-border flex items-center gap-4">
              <FileText className="text-primary shrink-0" size={32} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">
                  {pdfFile.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(pdfFile.size)} • {pdfFile.pageCount} page
                  {pdfFile.pageCount !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={removeFile}
                className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                title="Remove file"
              >
                <X size={20} />
              </button>
            </div>

            {/* Split Mode Selection */}
            <div className="bg-card rounded-xl p-6 shadow-md border border-border">
              <h2 className="text-xl font-bold text-foreground mb-4">
                Split Options
              </h2>
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-4 rounded-lg border-2 border-border hover:border-primary cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="splitMode"
                    value="all"
                    checked={splitMode === 'all'}
                    onChange={(e) => setSplitMode(e.target.value as SplitMode)}
                    className="mt-1 accent-primary"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <FileStack className="text-primary" size={20} />
                      <span className="font-semibold text-foreground">
                        Split All Pages
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Extract each page as a separate PDF file
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 rounded-lg border-2 border-border hover:border-primary cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="splitMode"
                    value="pages"
                    checked={splitMode === 'pages'}
                    onChange={(e) => setSplitMode(e.target.value as SplitMode)}
                    className="mt-1 accent-primary"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Scissors className="text-primary" size={20} />
                      <span className="font-semibold text-foreground">
                        Select Specific Pages
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Choose individual pages to extract
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 rounded-lg border-2 border-border hover:border-primary cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="splitMode"
                    value="ranges"
                    checked={splitMode === 'ranges'}
                    onChange={(e) => setSplitMode(e.target.value as SplitMode)}
                    className="mt-1 accent-primary"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <ChevronRight className="text-primary" size={20} />
                      <span className="font-semibold text-foreground">
                        Custom Page Ranges
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Define page ranges to extract
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Page Selection */}
            {splitMode === 'pages' && pdfFile.pageCount && (
              <div className="bg-card rounded-xl p-6 shadow-md border border-border">
                <h3 className="text-lg font-bold text-foreground mb-4">
                  Select Pages ({selectedPages.size} selected)
                </h3>
                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                  {Array.from(
                    { length: pdfFile.pageCount },
                    (_, i) => i + 1,
                  ).map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => togglePage(pageNum)}
                      className={`aspect-square rounded-lg font-semibold transition-all ${
                        selectedPages.has(pageNum)
                          ? 'bg-primary text-primary-foreground shadow-lg scale-105'
                          : 'bg-muted text-muted-foreground hover:bg-primary/20 hover:text-primary'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Range Selection */}
            {splitMode === 'ranges' && pdfFile.pageCount && (
              <div className="bg-card rounded-xl p-6 shadow-md border border-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-foreground">
                    Page Ranges
                  </h3>
                  <button
                    onClick={addRange}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                  >
                    Add Range
                  </button>
                </div>
                <div className="space-y-3">
                  {pageRanges.map((range, index) => (
                    <div
                      key={range.id}
                      className="flex items-center gap-4 p-4 bg-muted rounded-lg"
                    >
                      <span className="text-muted-foreground font-medium">
                        Range {index + 1}:
                      </span>
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="number"
                          min="1"
                          max={pdfFile.pageCount}
                          value={range.start}
                          onChange={(e) =>
                            updateRange(
                              range.id,
                              'start',
                              parseInt(e.target.value) || 1,
                            )
                          }
                          className="w-20 px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                        />
                        <span className="text-muted-foreground">to</span>
                        <input
                          type="number"
                          min="1"
                          max={pdfFile.pageCount}
                          value={range.end}
                          onChange={(e) =>
                            updateRange(
                              range.id,
                              'end',
                              parseInt(e.target.value) || 1,
                            )
                          }
                          className="w-20 px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                        />
                      </div>
                      {pageRanges.length > 1 && (
                        <button
                          onClick={() => removeRange(range.id)}
                          className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                          title="Remove range"
                        >
                          <X size={20} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Split Button */}
            <button
              onClick={splitPDF}
              disabled={
                isProcessing ||
                (splitMode === 'pages' && selectedPages.size === 0)
              }
              className="w-full bg-primary text-primary-foreground py-4 px-6 rounded-xl font-semibold text-lg hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={24} />
                  Splitting PDF...
                </>
              ) : (
                <>
                  <Download size={24} />
                  Split PDF
                </>
              )}
            </button>
          </div>
        )}

        {/* Instructions */}
        {!pdfFile && !isLoadingPDF && (
          <div className="mt-12 bg-card rounded-2xl p-8 shadow-md border border-border">
            <h3 className="text-xl font-bold text-foreground mb-4">
              How to split PDF files:
            </h3>
            <ol className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                  1
                </span>
                <span>
                  Drag and drop your PDF file into the upload area, or click to
                  select a file from your computer
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                  2
                </span>
                <span>
                  Choose your split option: all pages, specific pages, or custom
                  page ranges
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                  3
                </span>
                <span>
                  If selecting specific pages or ranges, choose the pages you
                  want to extract
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                  4
                </span>
                <span>
                  Click "Split PDF" to extract the selected pages as separate
                  PDF files
                </span>
              </li>
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
