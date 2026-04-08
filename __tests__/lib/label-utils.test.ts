import { describe, it, expect, vi } from 'vitest'
import {
  generateSingleLabel,
  generateBatchLabels,
  type AssetLabelData,
  type JsPDFConstructor,
} from '@/lib/label-utils'

function createMockJsPDF() {
  const doc = {
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    addImage: vi.fn(),
    save: vi.fn(),
    output: vi.fn(() => 'mock-pdf-output'),
    addPage: vi.fn(),
  }
  // Use a real class so `new` works
  const MockJsPDF = class {
    constructor(public opts: object) {
      Object.assign(this, doc)
    }
  } as unknown as JsPDFConstructor
  return { MockJsPDF, doc }
}

const sampleAsset: AssetLabelData = {
  assetId: 'asset-1',
  assetNumber: 'LH-001',
  name: 'MacBook Pro 14"',
  qrDataUrl: 'data:image/png;base64,ABC123',
}

describe('generateSingleLabel', () => {
  it('creates a document and adds QR image', () => {
    const { MockJsPDF, doc } = createMockJsPDF()
    const result = generateSingleLabel(MockJsPDF, sampleAsset)
    // doc methods were called on the constructed instance
    expect(doc.addImage).toHaveBeenCalled()
    expect(result).toBeTruthy()
  })

  it('adds QR code image', () => {
    const { MockJsPDF, doc } = createMockJsPDF()
    generateSingleLabel(MockJsPDF, sampleAsset)
    expect(doc.addImage).toHaveBeenCalledWith(
      'data:image/png;base64,ABC123', 'PNG',
      expect.any(Number), expect.any(Number),
      52, 52 // qrSize
    )
  })

  it('prints asset number in bold', () => {
    const { MockJsPDF, doc } = createMockJsPDF()
    generateSingleLabel(MockJsPDF, sampleAsset)
    expect(doc.setFont).toHaveBeenCalledWith('helvetica', 'bold')
    expect(doc.text).toHaveBeenCalledWith('LH-001', expect.any(Number), expect.any(Number))
  })

  it('truncates long asset names with ellipsis', () => {
    const { MockJsPDF, doc } = createMockJsPDF()
    const longNameAsset = { ...sampleAsset, name: 'This is a very long asset name that exceeds 28 characters' }
    generateSingleLabel(MockJsPDF, longNameAsset)

    const textCalls = doc.text.mock.calls.map((c) => c[0])
    const truncated = textCalls.find((t: string) => t.endsWith('…'))
    expect(truncated).toBeTruthy()
    expect(truncated!.length).toBeLessThanOrEqual(28)
  })

  it('does not truncate short asset names', () => {
    const { MockJsPDF, doc } = createMockJsPDF()
    generateSingleLabel(MockJsPDF, sampleAsset)
    const textCalls = doc.text.mock.calls.map((c) => c[0])
    expect(textCalls).toContain('MacBook Pro 14"')
  })

  it('prints location when provided', () => {
    const { MockJsPDF, doc } = createMockJsPDF()
    const assetWithLoc = { ...sampleAsset, location: 'Main Building > Room 101' }
    generateSingleLabel(MockJsPDF, assetWithLoc)
    const textCalls = doc.text.mock.calls.map((c) => c[0])
    expect(textCalls).toContain('Main Building > Room 101')
  })

  it('does not print location when absent', () => {
    const { MockJsPDF, doc } = createMockJsPDF()
    generateSingleLabel(MockJsPDF, sampleAsset)
    // Only 2 text calls: assetNumber + name (no location)
    expect(doc.text).toHaveBeenCalledTimes(2)
  })

  it('returns the doc instance', () => {
    const { MockJsPDF, doc } = createMockJsPDF()
    const result = generateSingleLabel(MockJsPDF, sampleAsset)
    expect(result).toBeTruthy()
  })
})

describe('generateBatchLabels', () => {
  it('creates document and renders labels', () => {
    const { MockJsPDF, doc } = createMockJsPDF()
    const MockBatch = MockJsPDF as unknown as Parameters<typeof generateBatchLabels>[0]
    generateBatchLabels(MockBatch, [sampleAsset])
    expect(doc.addImage).toHaveBeenCalled()
    expect(doc.text).toHaveBeenCalled()
  })

  it('fits 30 labels on one page without addPage', () => {
    const { MockJsPDF, doc } = createMockJsPDF()
    const MockBatch = MockJsPDF as unknown as Parameters<typeof generateBatchLabels>[0]
    const assets = Array.from({ length: 30 }, (_, i) => ({
      ...sampleAsset,
      assetId: `asset-${i}`,
      assetNumber: `LH-${String(i).padStart(3, '0')}`,
    }))

    generateBatchLabels(MockBatch, assets)
    expect(doc.addPage).not.toHaveBeenCalled()
  })

  it('adds new page after 30 labels', () => {
    const { MockJsPDF, doc } = createMockJsPDF()
    const MockBatch = MockJsPDF as unknown as Parameters<typeof generateBatchLabels>[0]
    const assets = Array.from({ length: 31 }, (_, i) => ({
      ...sampleAsset,
      assetId: `asset-${i}`,
      assetNumber: `LH-${String(i).padStart(3, '0')}`,
    }))

    generateBatchLabels(MockBatch, assets)
    expect(doc.addPage).toHaveBeenCalledTimes(1)
  })

  it('adds QR code for each asset', () => {
    const { MockJsPDF, doc } = createMockJsPDF()
    const MockBatch = MockJsPDF as unknown as Parameters<typeof generateBatchLabels>[0]
    const assets = [sampleAsset, { ...sampleAsset, assetId: 'asset-2', assetNumber: 'LH-002' }]

    generateBatchLabels(MockBatch, assets)
    expect(doc.addImage).toHaveBeenCalledTimes(2)
  })

  it('returns the doc instance', () => {
    const { MockJsPDF, doc } = createMockJsPDF()
    const MockBatch = MockJsPDF as unknown as Parameters<typeof generateBatchLabels>[0]
    const result = generateBatchLabels(MockBatch, [sampleAsset])
    expect(result).toBeTruthy()
  })
})
