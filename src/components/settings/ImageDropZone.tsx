'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload, X, Loader2 } from 'lucide-react'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

type ImageDropZoneProps = {
  label: string
  imageUrl: string
  imageType: 'logo' | 'hero'
  onImageChange: (url: string | null) => void
  aspectRatio?: string
  disabled?: boolean
}

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export default function ImageDropZone({
  label,
  imageUrl,
  imageType,
  onImageChange,
  aspectRatio = 'aspect-video',
  disabled = false,
}: ImageDropZoneProps) {
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      setError('')

      if (!ALLOWED_TYPES.includes(file.type)) {
        setError('Unsupported file type. Use JPEG, PNG, WebP, or GIF.')
        return
      }
      if (file.size > MAX_SIZE) {
        setError('File exceeds 5MB limit.')
        return
      }

      setUploading(true)
      try {
        const buffer = await file.arrayBuffer()
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        )

        const res = await fetch('/api/settings/branding/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({
            imageType,
            fileBase64: base64,
            contentType: file.type,
          }),
        })

        let data
        try {
          data = await res.json()
        } catch {
          throw new Error('Upload failed: Invalid server response')
        }
        if (!res.ok || !data.ok) {
          throw new Error(data?.error?.message || 'Upload failed')
        }

        onImageChange(data.data.imageUrl)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [imageType, onImageChange]
  )

  const handleRemove = useCallback(async () => {
    if (!imageUrl) return
    setError('')
    setUploading(true)

    try {
      // Only attempt storage deletion if it's a Supabase URL we uploaded
      if (imageUrl.includes('/storage/v1/object/public/')) {
        await fetch('/api/settings/branding/upload', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ imageUrl }),
        })
      }
      onImageChange(null)
    } catch {
      // Clear locally even if remote delete fails
      onImageChange(null)
    } finally {
      setUploading(false)
    }
  }, [imageUrl, onImageChange])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (disabled || uploading) return
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [disabled, uploading, handleFile]
  )

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!disabled && !uploading) setDragOver(true)
    },
    [disabled, uploading]
  )

  const onDragLeave = useCallback(() => setDragOver(false), [])

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
      // Reset so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = ''
    },
    [handleFile]
  )

  const hasImage = !!imageUrl

  return (
    <div>
      <label className="block text-xs text-gray-500 font-medium mb-1.5">{label}</label>
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !hasImage && !uploading && !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !hasImage && !uploading && !disabled) {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        role={!hasImage && !disabled ? 'button' : undefined}
        tabIndex={!hasImage && !disabled ? 0 : undefined}
        aria-label={!hasImage ? `Upload ${label}` : undefined}
        className={`
          relative overflow-hidden rounded-lg border-2 border-dashed transition-colors
          ${aspectRatio}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${hasImage ? 'border-gray-200' : ''}
          ${!hasImage && !dragOver ? 'border-gray-300 hover:border-gray-400 cursor-pointer' : ''}
          ${dragOver ? 'border-blue-500 bg-blue-50' : ''}
          ${uploading ? 'pointer-events-none' : ''}
        `}
      >
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
          </div>
        )}

        {hasImage ? (
          <div className="group relative w-full h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={label}
              className="w-full h-full object-contain"
            />
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemove()
                }}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                title="Remove image"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400">
            <Upload className="w-8 h-8" />
            <span className="text-sm">
              {dragOver ? 'Drop image here' : 'Drag & drop or click to upload'}
            </span>
            <span className="text-xs text-gray-400">JPEG, PNG, WebP, GIF up to 5MB</span>
          </div>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        onChange={onInputChange}
        className="hidden"
      />
    </div>
  )
}
