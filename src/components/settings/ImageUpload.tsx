'use client'

import { useState, useRef } from 'react'
import { Camera, X, Loader2, Plus } from 'lucide-react'

interface ImageUploadProps {
  entityType: 'building' | 'area' | 'room'
  entityId: string
  images: string[]
  onImagesChange: (images: string[]) => void
  maxImages?: number
  disabled?: boolean
  onImageClick?: (images: string[], index: number) => void
}

export default function ImageUpload({
  entityType,
  entityId,
  images,
  onImagesChange,
  maxImages = 4,
  disabled = false,
  onImageClick,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
    const orgId = typeof window !== 'undefined' ? localStorage.getItem('org-id') : null
    return {
      Authorization: token ? `Bearer ${token}` : '',
      'X-Organization-ID': orgId || '',
      'Content-Type': 'application/json',
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset file input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = ''

    // Validate
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      setError('Please select a JPEG, PNG, WebP, or GIF image')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB')
      return
    }

    setError(null)
    setUploading(true)

    try {
      // Convert to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          // Strip the data:image/xxx;base64, prefix
          const base64Data = result.split(',')[1]
          resolve(base64Data)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const res = await fetch('/api/settings/campus/images', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          entityType,
          entityId,
          fileBase64: base64,
          contentType: file.type,
        }),
      })

      const data = await res.json()
      if (!data.ok) {
        setError(data.error?.message || 'Upload failed')
        return
      }

      onImagesChange(data.data.images)
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (imageUrl: string) => {
    setDeletingUrl(imageUrl)
    setError(null)

    try {
      const res = await fetch('/api/settings/campus/images', {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          entityType,
          entityId,
          imageUrl,
        }),
      })

      const data = await res.json()
      if (!data.ok) {
        setError(data.error?.message || 'Delete failed')
        return
      }

      onImagesChange(data.data.images)
    } catch {
      setError('Delete failed. Please try again.')
    } finally {
      setDeletingUrl(null)
    }
  }

  const canAddMore = images.length < maxImages && !disabled

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-gray-700">
          <Camera className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
          Photos
        </label>
        <span className="text-xs text-gray-400">{images.length}/{maxImages}</span>
      </div>

      {/* Image grid */}
      <div className="grid grid-cols-2 gap-2">
        {images.map((url, idx) => (
          <div key={url} className="relative group aspect-[4/3] rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
            <img
              src={url}
              alt="Uploaded image preview"
              className={`w-full h-full object-cover${onImageClick ? ' cursor-pointer' : ''}`}
              loading="lazy"
              onClick={onImageClick ? () => onImageClick(images, idx) : undefined}
            />
            {!disabled && (
              <button
                onClick={() => handleDelete(url)}
                disabled={!!deletingUrl}
                className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                title="Remove photo"
              >
                {deletingUrl === url ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <X className="w-3 h-3" />
                )}
              </button>
            )}
          </div>
        ))}

        {/* Add photo button */}
        {canAddMore && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="aspect-[4/3] rounded-lg border-2 border-dashed border-gray-300 hover:border-primary-400 hover:bg-primary-50/50 flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:text-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-xs">Uploading...</span>
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                <span className="text-xs">Add Photo</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-700">{error}</p>
      )}
    </div>
  )
}
