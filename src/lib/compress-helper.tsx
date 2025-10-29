import { PDFDocument } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf-js/pdf.worker.mjs`

export type CompressionMode = 'extreme' | 'normal' | 'less'

interface CompressionSettings {
  imageQuality: number
  scale: number
  format: 'jpeg' | 'png'
}

const compressionSettings: Record<CompressionMode, CompressionSettings> = {
  extreme: {
    imageQuality: 0.3,
    scale: 0.5, // Reduce to 50% of original size
    format: 'jpeg',
  },
  normal: {
    imageQuality: 0.6,
    scale: 0.7, // Reduce to 70% of original size
    format: 'jpeg',
  },
  less: {
    imageQuality: 0.85,
    scale: 0.9, // Reduce to 90% of original size
    format: 'jpeg',
  },
}

/**
 * Renders a PDF page to a canvas and compresses it
 */
async function renderAndCompressPage(
  page: pdfjsLib.PDFPageProxy,
  settings: CompressionSettings,
): Promise<{ blob: Blob; width: number; height: number }> {
  const viewport = page.getViewport({ scale: settings.scale })

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Failed to get canvas context')
  }

  canvas.width = viewport.width
  canvas.height = viewport.height

  await page.render({
    canvasContext: context,
    viewport: viewport,
    canvas: canvas,
  }).promise

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob from canvas'))
          return
        }
        resolve({
          blob,
          width: viewport.width,
          height: viewport.height,
        })
      },
      settings.format === 'jpeg' ? 'image/jpeg' : 'image/png',
      settings.imageQuality,
    )
  })
}

/**
 * Main compression function that renders each page as an image and recreates the PDF
 */
export async function compressPDF(
  pdfFile: File,
  mode: CompressionMode = 'normal',
  onProgress?: (current: number, total: number) => void,
): Promise<Uint8Array> {
  const settings = compressionSettings[mode]

  // Load the PDF with PDF.js
  const arrayBuffer = await pdfFile.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
  const pdfDocument = await loadingTask.promise

  // Create a new PDF document
  const newPdfDoc = await PDFDocument.create()

  const totalPages = pdfDocument.numPages

  // Process each page
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    try {
      // Get the page
      const page = await pdfDocument.getPage(pageNum)

      // Render and compress the page
      const { blob, width, height } = await renderAndCompressPage(
        page,
        settings,
      )

      // Convert blob to array buffer
      const imageArrayBuffer = await blob.arrayBuffer()
      const imageBytes = new Uint8Array(imageArrayBuffer)

      // Embed the image in the new PDF
      let image
      if (settings.format === 'jpeg') {
        image = await newPdfDoc.embedJpg(imageBytes)
      } else {
        image = await newPdfDoc.embedPng(imageBytes)
      }

      // Add a new page with the same dimensions as the compressed image
      const newPage = newPdfDoc.addPage([width, height])

      // Draw the image to fill the entire page
      newPage.drawImage(image, {
        x: 0,
        y: 0,
        width: width,
        height: height,
      })

      onProgress?.(pageNum, totalPages)
    } catch (error) {
      console.error(`Error processing page ${pageNum}:`, error)
      // Continue with other pages even if one fails
    }
  }

  // Save the new PDF
  const compressedBytes = await newPdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
  })

  return compressedBytes
}

/**
 * Calculate compression ratio as a percentage
 */
export function getCompressionRatio(
  originalSize: number,
  compressedSize: number,
): string {
  const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1)
  return `${ratio}%`
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}
