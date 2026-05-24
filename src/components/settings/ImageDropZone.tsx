'use client'

import { useCallback, useState } from 'react'
import { Upload, X, Loader2 } from 'lucide-react'
import { FileInput } from '@/components/ui/FileInput'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

type ImageDropZoneProps = {
  label: string
  imageUrl: string
  imageType: 'logo' | 'hero'
  onImageChange: (url: string | null) => void
  aspectRatio?: string
  disabled?: boolean
  compact?: boolean
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
  compact = false,
}: ImageDropZoneProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

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

  const hasImage = !!imageUrl
  const zoneClasses = `
    relative overflow-hidden rounded-lg border-2 border-dashed transition-colors
    ${compact ? 'aspect-[3/2]' : aspectRatio}
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    ${hasImage ? 'border-slate-200' : ''}
    ${!hasImage ? 'border-slate-300 hover:border-slate-400 cursor-pointer' : ''}
    ${uploading ? 'pointer-events-none' : ''}
  `

  return (
    <div>
      <label className="block text-xs text-slate-500 font-medium mb-1.5">{label}</label>
      {hasImage ? (
        <div className={zoneClasses}>
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
            </div>
          )}
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
                onClick={handleRemove}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity hover:bg-black/80"
                title="Remove image"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <FileInput
          accept={ALLOWED_TYPES.join(',')}
          onFiles={(files) => {
            const file = files[0]
            if (file) handleFile(file)
          }}
          disabled={disabled || uploading}
          compact
          className={zoneClasses}
        >
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
          </div>
        )}

          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Upload className={compact ? 'w-6 h-6' : 'w-8 h-8'} />
            <span className={compact ? 'text-xs' : 'text-sm'}>
              Drag & drop or click to upload
            </span>
            {!compact && (
              <span className="text-xs text-slate-400">JPEG, PNG, WebP, GIF up to 5MB</span>
            )}
          </div>
        </FileInput>
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
