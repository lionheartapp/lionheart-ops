import { describe, it, expect } from 'vitest'
import {
  validateFileUpload,
  validateMultipleFiles,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_DOCUMENT_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/validation/file-upload'

// ── Constants ────────────────────────────────────────────────────────────────

describe('constants', () => {
  it('ALLOWED_IMAGE_TYPES includes standard image formats', () => {
    expect(ALLOWED_IMAGE_TYPES.has('image/jpeg')).toBe(true)
    expect(ALLOWED_IMAGE_TYPES.has('image/png')).toBe(true)
    expect(ALLOWED_IMAGE_TYPES.has('image/webp')).toBe(true)
    expect(ALLOWED_IMAGE_TYPES.has('image/gif')).toBe(true)
  })

  it('ALLOWED_IMAGE_TYPES does not include non-image types', () => {
    expect(ALLOWED_IMAGE_TYPES.has('application/pdf')).toBe(false)
    expect(ALLOWED_IMAGE_TYPES.has('text/plain')).toBe(false)
  })

  it('ALLOWED_DOCUMENT_TYPES includes images + PDF', () => {
    expect(ALLOWED_DOCUMENT_TYPES.has('image/jpeg')).toBe(true)
    expect(ALLOWED_DOCUMENT_TYPES.has('application/pdf')).toBe(true)
  })

  it('MAX_FILE_SIZE_BYTES is 10MB', () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024)
  })
})

// ── validateFileUpload ───────────────────────────────────────────────────────

describe('validateFileUpload', () => {
  it('accepts valid image file', () => {
    const result = validateFileUpload({ type: 'image/png', size: 1024, name: 'photo.png' })
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('rejects invalid MIME type', () => {
    const result = validateFileUpload({ type: 'text/plain', size: 100, name: 'readme.txt' })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('not allowed')
    expect(result.error).toContain('text/plain')
  })

  it('lists accepted types in error message', () => {
    const result = validateFileUpload({ type: 'video/mp4', size: 100, name: 'video.mp4' })
    expect(result.error).toContain('JPEG')
    expect(result.error).toContain('PNG')
  })

  it('rejects files exceeding size limit', () => {
    const result = validateFileUpload({
      type: 'image/png',
      size: MAX_FILE_SIZE_BYTES + 1,
      name: 'huge.png',
    })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('exceeds')
    expect(result.error).toContain('10MB')
  })

  it('accepts files exactly at size limit', () => {
    const result = validateFileUpload({
      type: 'image/png',
      size: MAX_FILE_SIZE_BYTES,
      name: 'exact.png',
    })
    expect(result.valid).toBe(true)
  })

  it('skips size check when size is 0 (signed URL mode)', () => {
    const result = validateFileUpload({ type: 'image/png', size: 0, name: 'unknown-size.png' })
    expect(result.valid).toBe(true)
  })

  it('respects custom allowedTypes option', () => {
    const customTypes = new Set(['application/pdf'])
    const result = validateFileUpload(
      { type: 'application/pdf', size: 1024, name: 'doc.pdf' },
      { allowedTypes: customTypes }
    )
    expect(result.valid).toBe(true)
  })

  it('respects custom maxSizeBytes option', () => {
    const result = validateFileUpload(
      { type: 'image/png', size: 2000, name: 'small.png' },
      { maxSizeBytes: 1000 }
    )
    expect(result.valid).toBe(false)
    expect(result.error).toContain('exceeds')
  })

  it('accepts ALLOWED_DOCUMENT_TYPES for PDF uploads', () => {
    const result = validateFileUpload(
      { type: 'application/pdf', size: 5000, name: 'report.pdf' },
      { allowedTypes: ALLOWED_DOCUMENT_TYPES }
    )
    expect(result.valid).toBe(true)
  })
})

// ── validateMultipleFiles ────────────────────────────────────────────────────

describe('validateMultipleFiles', () => {
  it('accepts all valid files', () => {
    const files = [
      { type: 'image/png', size: 1024, name: 'a.png' },
      { type: 'image/jpeg', size: 2048, name: 'b.jpg' },
    ]
    expect(validateMultipleFiles(files).valid).toBe(true)
  })

  it('fails on first invalid file', () => {
    const files = [
      { type: 'image/png', size: 1024, name: 'good.png' },
      { type: 'text/plain', size: 100, name: 'bad.txt' },
      { type: 'image/jpeg', size: 2048, name: 'also-good.jpg' },
    ]
    const result = validateMultipleFiles(files)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('text/plain')
  })

  it('accepts empty file array', () => {
    expect(validateMultipleFiles([]).valid).toBe(true)
  })

  it('passes custom options through to individual validations', () => {
    const files = [
      { type: 'application/pdf', size: 1024, name: 'doc.pdf' },
    ]
    const result = validateMultipleFiles(files, { allowedTypes: ALLOWED_DOCUMENT_TYPES })
    expect(result.valid).toBe(true)
  })
})
