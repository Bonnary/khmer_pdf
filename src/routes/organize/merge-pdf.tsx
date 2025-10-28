import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import { PDFDocument } from 'pdf-lib'
import { Upload, X, FileText, ArrowDown, Download, Loader2 } from 'lucide-react'

export const Route = createFileRoute('/organize/merge-pdf')({
  component: RouteComponent,
})

interface PDFFile {
  id: string
  file: File
  name: string
  size: number
}

function RouteComponent() {
  const [pdfFiles, setPdfFiles] = useState<PDFFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
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

  const moveFile = (index: number, direction: 'up' | 'down') => {
    const newFiles = [...pdfFiles]
    const targetIndex = direction === 'up' ? index - 1 : index + 1

    if (targetIndex < 0 || targetIndex >= newFiles.length) return
    ;[newFiles[index], newFiles[targetIndex]] = [
      newFiles[targetIndex],
      newFiles[index],
    ]
    setPdfFiles(newFiles)
  }

  const mergePDFs = async () => {
    if (pdfFiles.length < 2) {
      alert('Please select at least 2 PDF files to merge')
      return
    }

    setIsProcessing(true)

    try {
      const mergedPdf = await PDFDocument.create()

      for (const pdfFile of pdfFiles) {
        const arrayBuffer = await pdfFile.file.arrayBuffer()
        const pdf = await PDFDocument.load(arrayBuffer)
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
        copiedPages.forEach((page) => mergedPdf.addPage(page))
      }

      const mergedPdfBytes = await mergedPdf.save()
      const blob = new Blob([mergedPdfBytes.buffer as ArrayBuffer], {
        type: 'application/pdf',
      })
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = `merged-${Date.now()}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      // Reset after successful merge
      setPdfFiles([])
    } catch (error) {
      console.error('Error merging PDFs:', error)
      alert('An error occurred while merging PDFs. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-red-50 to-white">
      {/* Header */}
      <div className="bg-linear-to-r from-red-600 to-pink-600 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-2">Merge PDF Files</h1>
          <p className="text-red-50">
            Combine multiple PDF files into one document
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Drop Zone */}
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${
            isDragging
              ? 'border-red-500 bg-red-50 scale-105'
              : 'border-gray-300 bg-white hover:border-red-400 hover:bg-red-50'
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
            className={`mx-auto mb-4 ${isDragging ? 'text-red-500 animate-bounce' : 'text-gray-400'}`}
            size={64}
          />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            {isDragging ? 'Drop your PDF files here' : 'Drag & Drop PDF files'}
          </h3>
          <p className="text-gray-500 mb-4">or click to browse</p>
          <p className="text-sm text-gray-400">
            Select multiple PDF files to merge them into one
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
                className="text-red-600 hover:text-red-700 text-sm font-medium"
              >
                Clear All
              </button>
            </div>

            <div className="space-y-3">
              {pdfFiles.map((pdfFile, index) => (
                <div
                  key={pdfFile.id}
                  className="bg-white rounded-xl p-4 shadow-md border border-gray-200 flex items-center gap-4 hover:shadow-lg transition-shadow"
                >
                  <FileText className="text-red-600 shrink-0" size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">
                      {pdfFile.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(pdfFile.size)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => moveFile(index, 'up')}
                      disabled={index === 0}
                      className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Move up"
                    >
                      <ArrowDown className="rotate-180" size={20} />
                    </button>
                    <button
                      onClick={() => moveFile(index, 'down')}
                      disabled={index === pdfFiles.length - 1}
                      className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Move down"
                    >
                      <ArrowDown size={20} />
                    </button>
                    <button
                      onClick={() => removeFile(pdfFile.id)}
                      className="p-2 rounded-lg hover:bg-red-100 text-red-600 transition-colors"
                      title="Remove file"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Merge Button */}
            <button
              onClick={mergePDFs}
              disabled={pdfFiles.length < 2 || isProcessing}
              className="w-full mt-6 bg-red-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={24} />
                  Merging PDFs...
                </>
              ) : (
                <>
                  <Download size={24} />
                  Merge {pdfFiles.length} PDF{pdfFiles.length > 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        )}

        {/* Instructions */}
        {pdfFiles.length === 0 && (
          <div className="mt-12 bg-white rounded-2xl p-8 shadow-md">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              How to merge PDF files:
            </h3>
            <ol className="space-y-3 text-gray-600">
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  1
                </span>
                <span>
                  Drag and drop your PDF files into the upload area, or click to
                  select files from your computer
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  2
                </span>
                <span>
                  Arrange the files in the desired order using the up/down
                  arrows
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  3
                </span>
                <span>
                  Click the "Merge PDFs" button to combine all files into one
                  PDF document
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  4
                </span>
                <span>The merged PDF will be downloaded to your computer</span>
              </li>
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
