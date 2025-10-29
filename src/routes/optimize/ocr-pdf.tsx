import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef, useCallback } from 'react'
import { createWorker, type Worker } from 'tesseract.js'
import * as pdfjsLib from 'pdfjs-dist'
import { FileText, Upload, Download, AlertCircle } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { languages, type Language } from '@/types/ocr-language'

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf-js/pdf.worker.mjs`

export const Route = createFileRoute('/optimize/ocr-pdf')({
  component: RouteComponent,
})

function RouteComponent() {
  const [file, setFile] = useState<File | null>(null)
  const [selectedLanguages, setSelectedLanguages] = useState<Language[]>([
    'eng',
  ])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [extractedText, setExtractedText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const workerRef = useRef<Worker | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile)
      setExtractedText('')
      setError(null)
      setProgress(0)
    } else {
      setError('Please select a valid PDF file')
    }
  }

  const handleLanguageToggle = (langCode: Language) => {
    setSelectedLanguages((prev) => {
      if (prev.includes(langCode)) {
        // Don't allow deselecting if it's the only one
        if (prev.length === 1) return prev
        return prev.filter((l) => l !== langCode)
      } else {
        return [...prev, langCode]
      }
    })
  }

  const processImage = async (
    imageData: ImageData,
    worker: Worker,
  ): Promise<string> => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    canvas.width = imageData.width
    canvas.height = imageData.height
    ctx.putImageData(imageData, 0, 0)

    const {
      data: { text },
    } = await worker.recognize(canvas)
    return text
  }

  const extractTextFromPDF = useCallback(async () => {
    if (!file) return

    setIsProcessing(true)
    setError(null)
    setProgress(0)
    setExtractedText('')
    setCurrentPage(0)
    setTotalPages(0)

    try {
      // Initialize Tesseract worker
      const worker = await createWorker(selectedLanguages.join('+'), 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(m.progress * 100)
          }
        },
      })
      workerRef.current = worker

      // Load PDF
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      setTotalPages(pdf.numPages)

      let fullText = ''

      // Process each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        setCurrentPage(pageNum)
        const page = await pdf.getPage(pageNum)

        // Get page viewport and render to canvas
        const viewport = page.getViewport({ scale: 2.0 })
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')!
        canvas.width = viewport.width
        canvas.height = viewport.height

        await page.render({
          canvasContext: context,
          viewport: viewport,
          canvas: canvas,
        }).promise

        // Get image data
        const imageData = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        )

        // Extract text using Tesseract
        const pageText = await processImage(imageData, worker)
        fullText += `\n\n--- Page ${pageNum} ---\n\n${pageText}`

        // Update progress
        const overallProgress = (pageNum / pdf.numPages) * 100
        setProgress(overallProgress)
      }

      setExtractedText(fullText.trim())

      // Cleanup worker
      await worker.terminate()
      workerRef.current = null
    } catch (err) {
      console.error('OCR Error:', err)
      setError(
        err instanceof Error ? err.message : 'Failed to extract text from PDF',
      )

      // Cleanup worker on error
      if (workerRef.current) {
        await workerRef.current.terminate()
        workerRef.current = null
      }
    } finally {
      setIsProcessing(false)
      setProgress(0)
    }
  }, [file, selectedLanguages])

  const downloadText = () => {
    if (!extractedText) return

    const blob = new Blob([extractedText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download =
      `${file?.name.replace('.pdf', '')}_ocr.txt` || 'extracted_text.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="container mx-auto max-w-6xl p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <FileText className="size-8" />
          OCR PDF Extractor
        </h1>
        <p className="text-muted-foreground">
          Extract text from PDF files using Optical Character Recognition
        </p>
      </div>

      {/* Language Selection */}
      <div className="mb-6 p-6 bg-card rounded-lg shadow-sm border border-border">
        <h2 className="text-lg font-semibold mb-3">Select Languages</h2>
        <div className="flex flex-wrap gap-3">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageToggle(lang.code)}
              disabled={isProcessing}
              className={cn(
                'px-4 py-2 rounded-lg border-2 transition-all duration-200',
                'flex items-center gap-2 font-medium',
                selectedLanguages.includes(lang.code)
                  ? 'bg-primary border-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-card border-border text-card-foreground hover:border-primary',
                isProcessing && 'opacity-50 cursor-not-allowed',
              )}
            >
              <span className="text-xl">{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {selectedLanguages.length} language
          {selectedLanguages.length !== 1 ? 's' : ''} selected
        </p>
      </div>

      {/* File Upload */}
      <div className="mb-6">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="application/pdf"
          className="hidden"
          disabled={isProcessing}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className={cn(
            'w-full p-8 border-2 border-dashed rounded-lg',
            'flex flex-col items-center justify-center gap-3',
            'transition-colors duration-200',
            isProcessing
              ? 'border-border bg-muted cursor-not-allowed'
              : 'border-border hover:border-primary hover:bg-primary/5 cursor-pointer',
          )}
        >
          <Upload className="size-12 text-muted-foreground" />
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">
              {file ? file.name : 'Click to upload PDF'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">PDF files only</p>
          </div>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-3">
          <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-destructive">Error</p>
            <p className="text-sm text-destructive/90">{error}</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mb-6 flex gap-3">
        <button
          onClick={extractTextFromPDF}
          disabled={!file || isProcessing || selectedLanguages.length === 0}
          className={cn(
            'flex-1 px-6 py-3 rounded-lg font-semibold',
            'flex items-center justify-center gap-2',
            'transition-colors duration-200',
            !file || isProcessing || selectedLanguages.length === 0
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-primary hover:bg-primary/90 text-primary-foreground',
          )}
        >
          {isProcessing ? (
            <>
              <Spinner className="size-5" />
              Processing...{' '}
              {currentPage > 0 && `(Page ${currentPage}/${totalPages})`}
            </>
          ) : (
            <>
              <FileText className="size-5" />
              Extract Text
            </>
          )}
        </button>

        <button
          onClick={downloadText}
          disabled={!extractedText || isProcessing}
          className={cn(
            'px-6 py-3 rounded-lg font-semibold',
            'flex items-center justify-center gap-2',
            'transition-colors duration-200',
            !extractedText || isProcessing
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-accent hover:bg-accent/90 text-accent-foreground',
          )}
        >
          <Download className="size-5" />
          Download
        </button>
      </div>

      {/* Progress Bar */}
      {isProcessing && (
        <div className="mb-6">
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-300 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground text-center mt-2">
            {Math.round(progress)}%
          </p>
        </div>
      )}

      {/* Extracted Text Display */}
      {extractedText && (
        <div className="p-6 bg-card rounded-lg shadow-sm border border-border">
          <h2 className="text-lg font-semibold mb-3">Extracted Text</h2>
          <div className="bg-muted rounded-lg p-4 max-h-[600px] overflow-y-auto">
            <pre className="whitespace-pre-wrap text-sm font-mono text-foreground">
              {extractedText}
            </pre>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {extractedText.length} characters extracted
          </p>
        </div>
      )}
    </div>
  )
}
