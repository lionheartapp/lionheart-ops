/**
 * Extract text content from uploaded files (txt, md, pdf).
 * Returns a Promise that resolves to the extracted text, or rejects with an error.
 */
import * as pdfjsLib from 'pdfjs-dist'

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
}

/**
 * Render the first page of a PDF as a base64 PNG image (for vision/OCR when PDF has no selectable text).
 * @param {File} file - PDF file
 * @returns {Promise<{ data: string, mimeType: string }>}
 */
export async function renderPdfFirstPageAsImage(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 2 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  await page.render({ canvasContext: ctx, viewport }).promise
  const dataUrl = canvas.toDataURL('image/png')
  const base64 = dataUrl.split(',')[1]
  return { data: base64, mimeType: 'image/png' }
}

export async function extractDocumentText(file) {
  const ext = (file.name?.split('.').pop() || '').toLowerCase()

  if (['txt', 'md', 'csv', 'json'].includes(ext)) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result || '')
      reader.onerror = () => reject(new Error('Could not read file'))
      reader.readAsText(file)
    })
  }

  if (ext === 'pdf') {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      let fullText = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items.map((item) => item.str).join(' ')
        fullText += pageText + '\n'
      }
      return fullText.trim()
    } catch (err) {
      throw new Error('Could not extract text from PDF. Try uploading a screenshot of the form instead.')
    }
  }

  throw new Error('Unsupported file type. Use .txt, .md, .csv, .json, or .pdf')
}
