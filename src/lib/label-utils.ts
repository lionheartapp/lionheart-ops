/**
 * Label generation utilities using jsPDF.
 * Client-side only — never import on server.
 *
 * Generates:
 * - Single 2x1 inch label: QR code (left) + asset number + name (right)
 * - Avery 5160 batch sheet: 30 labels per page, 3 cols x 10 rows, 2.625" x 1"
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssetLabelData {
  assetId: string
  assetNumber: string
  name: string
  qrDataUrl: string  // base64 PNG from server
  location?: string  // optional "Building > Room" string
}

// ─── Single Label (2" x 1") ───────────────────────────────────────────────────

export function generateSingleLabel(
  // Accept jsPDF constructor function to avoid top-level import (SSR safety)
  JsPDF: new (opts: object) => {
    setFontSize: (size: number) => void
    setFont: (font: string, style: string) => void
    setTextColor: (r: number, g: number, b: number) => void
    text: (text: string, x: number, y: number) => void
    addImage: (data: string, format: string, x: number, y: number, w: number, h: number) => void
    save: (filename: string) => void
    output: (type: string) => string
  },
  asset: AssetLabelData
) {
  // 2" x 1" in points (72pt = 1 inch)
  const doc = new JsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: [144, 72], // 2" x 1"
  })

  // QR code (left): 52x52pt, centered vertically, 4pt margin
  const qrSize = 52
  const qrX = 4
  const qrY = (72 - qrSize) / 2
  doc.addImage(asset.qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

  // Text (right of QR)
  const textX = qrX + qrSize + 6
  const maxTextWidth = 144 - textX - 4

  // Asset number
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(0, 0, 0)
  doc.text(asset.assetNumber, textX, 20)

  // Asset name (truncated to 2 lines)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(60, 60, 60)
  const nameLine = asset.name.length > 28 ? asset.name.substring(0, 26) + '…' : asset.name
  doc.text(nameLine, textX, 30)

  // Location (if provided)
  if (asset.location) {
    doc.setFontSize(6)
    doc.setTextColor(120, 120, 120)
    const locLine = asset.location.length > 32 ? asset.location.substring(0, 30) + '…' : asset.location
    doc.text(locLine, textX, 40)
  }

  return doc
}

// ─── Avery 5160 Batch Sheet ───────────────────────────────────────────────────
// 30 labels per page: 3 columns x 10 rows
// Label size: 2.625" x 1"
// Margins: top 0.5", left 0.1875", vertical gutter 0, horizontal gutter 0.125"

const A5160 = {
  pageWidth: 612,    // 8.5" x 72pt
  pageHeight: 792,   // 11" x 72pt
  labelW: 189,       // 2.625" x 72pt
  labelH: 72,        // 1" x 72pt
  marginLeft: 13.5,  // 0.1875" x 72pt
  marginTop: 36,     // 0.5" x 72pt
  colGutter: 9,      // 0.125" x 72pt
  rowGutter: 0,
  cols: 3,
  rows: 10,
}

export function generateBatchLabels(
  JsPDF: new (opts: object) => {
    setFontSize: (size: number) => void
    setFont: (font: string, style: string) => void
    setTextColor: (r: number, g: number, b: number) => void
    text: (text: string, x: number, y: number) => void
    addImage: (data: string, format: string, x: number, y: number, w: number, h: number) => void
    save: (filename: string) => void
    addPage: () => void
    output: (type: string) => string
  },
  assets: AssetLabelData[]
) {
  const doc = new JsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  })

  assets.forEach((asset, index) => {
    const page = Math.floor(index / 30)
    const posOnPage = index % 30
    const col = posOnPage % A5160.cols
    const row = Math.floor(posOnPage / A5160.cols)

    // Add a new page for every 30 labels (except the first)
    if (posOnPage === 0 && index > 0) {
      doc.addPage()
    }

    const x = A5160.marginLeft + col * (A5160.labelW + A5160.colGutter)
    const y = A5160.marginTop + row * (A5160.labelH + A5160.rowGutter)

    // QR code
    const qrSize = 54
    const qrX = x + 3
    const qrY = y + (A5160.labelH - qrSize) / 2
    doc.addImage(asset.qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

    // Text
    const textX = qrX + qrSize + 5
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(0, 0, 0)
    doc.text(asset.assetNumber, textX, y + 20)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(60, 60, 60)
    const nameLine = asset.name.length > 26 ? asset.name.substring(0, 24) + '…' : asset.name
    doc.text(nameLine, textX, y + 30)

    if (asset.location) {
      doc.setFontSize(5.5)
      doc.setTextColor(120, 120, 120)
      const locLine = asset.location.length > 30 ? asset.location.substring(0, 28) + '…' : asset.location
      doc.text(locLine, textX, y + 40)
    }

    // Suppress unused variable warning
    void page
  })

  return doc
}
