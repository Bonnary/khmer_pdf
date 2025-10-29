import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import {
  Upload,
  X,
  FileText,
  Download,
  Loader2,
  FileCode,
  File,
} from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import { Document, Packer, Paragraph, TextRun } from 'docx'

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf-js/pdf.worker.mjs'

export const Route = createFileRoute('/convert/pdf-to-word')({
  component: RouteComponent,
})

interface PDFFile {
  id: string
  file: File
  name: string
  size: number
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress?: number
  htmlContent?: string
  docxBlob?: Blob
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

  // Convert PDF to HTML (each page as an image)
  const convertPdfToHtml = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    let htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${file.name}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }
    .page { margin-bottom: 30px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); page-break-after: always; }
    .page-number { color: #666; font-size: 14px; margin-bottom: 15px; font-weight: bold; }
    .page img { max-width: 100%; height: auto; display: block; border: 1px solid #ddd; }
  </style>
</head>
<body>
`

    const numPages = pdf.numPages
    const scale = 2.0 // Higher scale for better quality

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale })

      // Create canvas to render the page
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      if (!context) {
        throw new Error('Failed to get canvas context')
      }

      canvas.width = viewport.width
      canvas.height = viewport.height

      // Render the page to canvas
      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      }).promise

      // Convert canvas to base64 image
      const imageDataUrl = canvas.toDataURL('image/png', 0.95)

      htmlContent += `  <div class="page">
    <div class="page-number">Page ${pageNum} of ${numPages}</div>
    <img src="${imageDataUrl}" alt="Page ${pageNum}" />
  </div>
`
    }

    htmlContent += `</body>
</html>`

    return htmlContent
  }

  // Convert HTML to DOCX
  const convertHtmlToDocx = async (htmlContent: string): Promise<Blob> => {
    // Parse HTML content
    const parser = new DOMParser()
    const doc = parser.parseFromString(htmlContent, 'text/html')
    const pages = doc.querySelectorAll('.page')

    const docParagraphs: Paragraph[] = []

    pages.forEach((page, pageIndex) => {
      // Add page number
      const pageNumber = page.querySelector('.page-number')?.textContent
      if (pageNumber) {
        docParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: pageNumber,
                size: 20,
                color: '666666',
              }),
            ],
            spacing: { after: 200 },
          }),
        )
      }

      // Add paragraphs
      const paragraphs = page.querySelectorAll('p')
      paragraphs.forEach((p) => {
        const text = p.textContent || ''
        if (text.trim()) {
          docParagraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: text,
                  size: 24,
                }),
              ],
              spacing: { after: 120 },
            }),
          )
        }
      })

      // Add page break except for the last page
      if (pageIndex < pages.length - 1) {
        docParagraphs.push(
          new Paragraph({
            pageBreakBefore: true,
          }),
        )
      }
    })

    const document = new Document({
      sections: [
        {
          properties: {},
          children: docParagraphs,
        },
      ],
    })

    const blob = await Packer.toBlob(document)
    return blob
  }

  // Process all files
  const convertFiles = async () => {
    if (pdfFiles.length === 0) {
      alert('Please select at least 1 PDF file to convert')
      return
    }

    setIsProcessing(true)

    try {
      for (let i = 0; i < pdfFiles.length; i++) {
        const pdfFile = pdfFiles[i]

        // Update status to processing
        setPdfFiles((prev) =>
          prev.map((f) =>
            f.id === pdfFile.id
              ? { ...f, status: 'processing', progress: 0 }
              : f,
          ),
        )

        try {
          // Step 1: Convert PDF to HTML
          setPdfFiles((prev) =>
            prev.map((f) => (f.id === pdfFile.id ? { ...f, progress: 30 } : f)),
          )

          const htmlContent = await convertPdfToHtml(pdfFile.file)

          // Step 2: Convert HTML to DOCX
          setPdfFiles((prev) =>
            prev.map((f) => (f.id === pdfFile.id ? { ...f, progress: 70 } : f)),
          )

          const docxBlob = await convertHtmlToDocx(htmlContent)

          // Update with results
          setPdfFiles((prev) =>
            prev.map((f) =>
              f.id === pdfFile.id
                ? {
                    ...f,
                    htmlContent,
                    docxBlob,
                    status: 'completed',
                    progress: 100,
                  }
                : f,
            ),
          )
        } catch (error) {
          console.error(`Error converting ${pdfFile.name}:`, error)
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

  // Download HTML
  const downloadHtml = (pdfFile: PDFFile) => {
    if (!pdfFile.htmlContent) return

    const blob = new Blob([pdfFile.htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${pdfFile.name.replace('.pdf', '')}.html`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Download DOCX
  const downloadDocx = (pdfFile: PDFFile) => {
    if (!pdfFile.docxBlob) return

    const url = URL.createObjectURL(pdfFile.docxBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${pdfFile.name.replace('.pdf', '')}.docx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-green-50 to-white">
      {/* Header */}
      <div className="bg-linear-to-r from-green-600 to-emerald-600 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-2">PDF to Word Converter</h1>
          <p className="text-green-50">
            Convert your PDF files to editable Word documents (DOCX) and HTML
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
              ? 'border-green-500 bg-green-50 scale-105'
              : 'border-gray-300 bg-white hover:border-green-400 hover:bg-green-50'
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
            className={`mx-auto mb-4 ${isDragging ? 'text-green-500 animate-bounce' : 'text-gray-400'}`}
            size={64}
          />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            {isDragging ? 'Drop your PDF files here' : 'Drag & Drop PDF files'}
          </h3>
          <p className="text-gray-500 mb-4">or click to browse</p>
          <p className="text-sm text-gray-400">
            Select PDF files to convert to Word (DOCX) and HTML
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
                className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear All
              </button>
            </div>

            <div className="space-y-3">
              {pdfFiles.map((pdfFile) => (
                <div
                  key={pdfFile.id}
                  className="bg-white rounded-xl p-4 shadow-md border border-gray-200 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    <FileText
                      className={`shrink-0 ${
                        pdfFile.status === 'completed'
                          ? 'text-green-600'
                          : pdfFile.status === 'error'
                            ? 'text-red-600'
                            : 'text-green-600'
                      }`}
                      size={32}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">
                        {pdfFile.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(pdfFile.size)}
                      </p>
                      {pdfFile.status === 'processing' && (
                        <div className="mt-2">
                          <p className="text-sm text-green-600 font-medium mb-1">
                            Converting... {pdfFile.progress || 0}%
                          </p>
                          <div className="w-full bg-green-200 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${pdfFile.progress || 0}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                      {pdfFile.status === 'completed' && (
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => downloadHtml(pdfFile)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                          >
                            <FileCode size={16} />
                            Download HTML
                          </button>
                          <button
                            onClick={() => downloadDocx(pdfFile)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
                          >
                            <File size={16} />
                            Download DOCX
                          </button>
                        </div>
                      )}
                      {pdfFile.status === 'error' && (
                        <p className="text-sm text-red-600 font-medium mt-1">
                          ✗ Error converting file
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {pdfFile.status === 'processing' && (
                        <Loader2
                          className="text-green-600 animate-spin"
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

            {/* Convert Button */}
            <button
              onClick={convertFiles}
              disabled={pdfFiles.length === 0 || isProcessing}
              className="w-full mt-6 bg-green-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={24} />
                  Converting PDFs...
                </>
              ) : (
                <>
                  <Download size={24} />
                  Convert {pdfFiles.length} PDF{pdfFiles.length > 1 ? 's' : ''}{' '}
                  to Word
                </>
              )}
            </button>
          </div>
        )}

        {/* Instructions */}
        {pdfFiles.length === 0 && (
          <div className="mt-12 bg-white rounded-2xl p-8 shadow-md">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              How to convert PDF to Word:
            </h3>
            <ol className="space-y-3 text-gray-600">
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  1
                </span>
                <span>
                  Drag and drop your PDF files into the upload area, or click to
                  select files from your computer
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  2
                </span>
                <span>
                  Click the "Convert PDFs to Word" button to start the
                  conversion process
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  3
                </span>
                <span>
                  Once converted, download either the HTML or DOCX version using
                  the respective buttons
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  4
                </span>
                <span>
                  The DOCX file can be opened and edited in Microsoft Word,
                  Google Docs, or any compatible word processor
                </span>
              </li>
            </ol>

            <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-semibold text-green-800 mb-2">
                Conversion Process:
              </h4>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• Step 1: PDF is converted to HTML format</li>
                <li>• Step 2: HTML is converted to DOCX format</li>
                <li>• Step 3: Both formats are available for download</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
