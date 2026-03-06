'use client'

import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, X, Check, Loader2, Upload, ImageIcon } from 'lucide-react'
import { cardEntrance } from '@/lib/animations'

export interface UploadedPhoto {
  url: string
  fileName: string
  localPreview?: string
}

interface StepPhotosProps {
  photos: UploadedPhoto[]
  onPhotosChange: (photos: UploadedPhoto[]) => void
  onAiCategoryDetected: (category: string | null) => void
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_PHOTOS = 5

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  if (token) return { Authorization: `Bearer ${token}` }
  return {}
}

type PhotoState = {
  id: string
  file: File
  preview: string
  status: 'uploading' | 'done' | 'error'
  url?: string
  error?: string
}

export default function StepPhotos({
  photos,
  onPhotosChange,
  onAiCategoryDetected,
}: StepPhotosProps) {
  const [uploading, setUploading] = useState<PhotoState[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const totalCount = photos.length + uploading.filter((u) => u.status === 'uploading').length

  const uploadFile = useCallback(
    async (file: File, isFirst: boolean) => {
      const id = Math.random().toString(36).slice(2)
      const preview = URL.createObjectURL(file)

      setUploading((prev) => [
        ...prev,
        { id, file, preview, status: 'uploading' },
      ])

      try {
        // 1. Get signed URL
        const urlRes = await fetch('/api/maintenance/tickets/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ fileName: file.name, contentType: file.type }),
        })
        if (!urlRes.ok) throw new Error('Failed to get upload URL')
        const urlData = await urlRes.json()
        if (!urlData.ok) throw new Error(urlData.error?.message || 'Upload URL error')

        const { signedUrl, publicUrl } = urlData.data

        // 2. PUT file to Supabase
        const putRes = await fetch(signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        })
        if (!putRes.ok) throw new Error('Upload to storage failed')

        // 3. Mark done
        setUploading((prev) =>
          prev.map((u) => u.id === id ? { ...u, status: 'done', url: publicUrl } : u)
        )

        // Add to photos list
        onPhotosChange([...photos, { url: publicUrl, fileName: file.name, localPreview: preview }])

        // 4. After first photo, fire AI category suggestion in background
        if (isFirst) {
          try {
            const buffer = await file.arrayBuffer()
            const base64 = btoa(
              new Uint8Array(buffer).reduce(
                (data, byte) => data + String.fromCharCode(byte), ''
              )
            )
            fetch('/api/maintenance/tickets/ai-suggest-category', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
              body: JSON.stringify({ imageBase64: base64 }),
            })
              .then((r) => r.json())
              .then((data) => {
                if (data.ok && data.data?.suggestedCategory) {
                  onAiCategoryDetected(data.data.suggestedCategory)
                }
              })
              .catch(() => {
                // silently ignore AI errors
              })
          } catch {
            // silently ignore
          }
        }

        // Remove from uploading after a short delay to show checkmark
        setTimeout(() => {
          setUploading((prev) => prev.filter((u) => u.id !== id))
          // revoke object URL
          URL.revokeObjectURL(preview)
        }, 1200)
      } catch (err) {
        setUploading((prev) =>
          prev.map((u) =>
            u.id === id
              ? { ...u, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' }
              : u
          )
        )
        setTimeout(() => {
          setUploading((prev) => prev.filter((u) => u.id !== id))
          URL.revokeObjectURL(preview)
        }, 3000)
      }
    },
    [photos, onPhotosChange, onAiCategoryDetected]
  )

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return
      setError('')

      const available = MAX_PHOTOS - photos.length
      if (available <= 0) {
        setError(`Maximum ${MAX_PHOTOS} photos allowed`)
        return
      }

      const toUpload = Array.from(files).slice(0, available)
      const isFirstPhoto = photos.length === 0

      for (let i = 0; i < toUpload.length; i++) {
        const file = toUpload[i]
        if (!file.type.match(/^image\//)) {
          setError('Only image files are allowed (JPG, PNG, WebP, HEIC)')
          continue
        }
        if (file.size > MAX_SIZE) {
          setError('File exceeds 10MB limit')
          continue
        }
        uploadFile(file, isFirstPhoto && i === 0)
      }
    },
    [photos.length, uploadFile]
  )

  const removePhoto = (index: number) => {
    const updated = photos.filter((_, i) => i !== index)
    onPhotosChange(updated)
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Add Photos</h3>
        <p className="text-sm text-gray-500">
          Photos help the maintenance team diagnose the issue faster
          {photos.length > 0 && (
            <span className="ml-2 text-emerald-600 font-medium">{photos.length}/{MAX_PHOTOS} photos</span>
          )}
        </p>
      </div>

      {/* Upload area */}
      {photos.length < MAX_PHOTOS && (
        <div
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            handleFiles(e.dataTransfer.files)
          }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => inputRef.current?.click()}
          className={`
            relative rounded-xl border-2 border-dashed p-6 text-center transition-all cursor-pointer
            ${dragOver
              ? 'border-emerald-400 bg-emerald-50'
              : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/30'
            }
          `}
        >
          <div className="flex flex-col items-center gap-2">
            {dragOver ? (
              <Upload className="w-8 h-8 text-emerald-500" />
            ) : (
              <Camera className="w-8 h-8 text-gray-400" />
            )}
            <div>
              <p className="text-sm font-medium text-gray-700">
                {dragOver ? 'Drop photos here' : 'Add Photos'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Tap to open camera or choose from library · JPG, PNG, WebP, HEIC up to 10MB
              </p>
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={[...ALLOWED_TYPES, 'image/*'].join(',')}
            capture="environment"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}

      {/* Photo grid */}
      {(photos.length > 0 || uploading.length > 0) && (
        <div className="grid grid-cols-3 gap-2">
          {/* Uploaded photos */}
          <AnimatePresence>
            {photos.map((photo, i) => (
              <motion.div
                key={photo.url}
                variants={cardEntrance}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                className="relative aspect-square rounded-xl overflow-hidden group bg-gray-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.localPreview || photo.url}
                  alt={`Photo ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                {/* Remove button */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removePhoto(i) }}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                {/* Photo number */}
                <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-black/50 text-white text-xs rounded-md">
                  {i + 1}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Uploading items */}
          {uploading.map((u) => (
            <div
              key={u.id}
              className="relative aspect-square rounded-xl overflow-hidden bg-gray-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={u.preview}
                alt="Uploading..."
                className="w-full h-full object-cover opacity-60"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                {u.status === 'uploading' && (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                )}
                {u.status === 'done' && (
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                )}
                {u.status === 'error' && (
                  <div className="text-center px-2">
                    <X className="w-6 h-6 text-red-400 mx-auto mb-1" />
                    <p className="text-xs text-white">Failed</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {photos.length === 0 && uploading.length === 0 && (
        <div className="flex items-center gap-2 py-2">
          <ImageIcon className="w-4 h-4 text-gray-300" />
          <p className="text-sm text-gray-400">Photos are optional but recommended</p>
        </div>
      )}
    </div>
  )
}
