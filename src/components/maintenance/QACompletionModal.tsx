'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Camera, Check, Loader2, Upload, CheckSquare } from 'lucide-react'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'

// ─── Types ───────────────────────────────────────────────────────────────────

interface UploadedPhoto {
  url: string
  fileName: string
  localPreview?: string
}

interface QACompletionModalProps {
  ticketId: string
  open: boolean
  onClose: () => void
  onComplete: () => void
}

// ─── Photo upload state ───────────────────────────────────────────────────────

type PhotoState = {
  id: string
  file: File
  preview: string
  status: 'uploading' | 'done' | 'error'
  url?: string
  error?: string
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function QACompletionModal({
  ticketId,
  open,
  onClose,
  onComplete,
}: QACompletionModalProps) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [uploading, setUploading] = useState<PhotoState[]>([])
  const [completionNote, setCompletionNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const hasPhoto = photos.length > 0
  const hasNote = completionNote.trim().length >= 10
  const canSubmit = hasPhoto && hasNote && !isSubmitting && uploading.filter((u) => u.status === 'uploading').length === 0

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setPhotos([])
      setUploading([])
      setCompletionNote('')
      setUploadError('')
      setSubmitError('')
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Photo upload logic
  const uploadFile = useCallback(
    async (file: File) => {
      const id = Math.random().toString(36).slice(2)
      const preview = URL.createObjectURL(file)

      setUploading((prev) => [...prev, { id, file, preview, status: 'uploading' }])
      setUploadError('')

      try {
        // 1. Get signed URL
        const urlData = await fetchApi<{ signedUrl: string; publicUrl: string }>(
          '/api/maintenance/tickets/upload-url',
          {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ fileName: file.name, contentType: file.type }),
          }
        )

        // 2. PUT file to Supabase storage
        const putRes = await fetch(urlData.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        })
        if (!putRes.ok) throw new Error('Upload to storage failed')

        setUploading((prev) =>
          prev.map((u) => (u.id === id ? { ...u, status: 'done', url: urlData.publicUrl } : u))
        )

        setPhotos((prev) => [...prev, { url: urlData.publicUrl, fileName: file.name, localPreview: preview }])

        setTimeout(() => {
          setUploading((prev) => prev.filter((u) => u.id !== id))
          URL.revokeObjectURL(preview)
        }, 1200)
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed')
        setUploading((prev) =>
          prev.map((u) => (u.id === id ? { ...u, status: 'error', error: 'Failed' } : u))
        )
        setTimeout(() => {
          setUploading((prev) => prev.filter((u) => u.id !== id))
          URL.revokeObjectURL(preview)
        }, 3000)
      }
    },
    [photos]
  )

  function handleFiles(files: FileList | null) {
    if (!files) return
    const available = 5 - photos.length
    if (available <= 0) return
    Array.from(files)
      .slice(0, available)
      .filter((f) => f.type.startsWith('image/'))
      .forEach((f) => uploadFile(f))
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setIsSubmitting(true)
    setSubmitError('')
    try {
      await fetchApi(`/api/maintenance/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: 'QA',
          completionPhotos: photos.map((p) => p.url),
          completionNote: completionNote.trim(),
        }),
      })
      onComplete()
      onClose()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit for QA. Please try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } }}
            exit={{ opacity: 0, scale: 0.95, y: 8, transition: { duration: 0.15, ease: 'easeIn' } }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ui-glass-overlay w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100/50">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-gray-900" />
                  <h2 className="text-base font-semibold text-gray-900">Submit for QA Review</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
                <p className="text-sm text-gray-600">
                  To submit this ticket for QA review, you must provide at least one completion photo and a detailed completion note describing the work done.
                </p>

                {/* Photo upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Completion Photos <span className="text-red-500">*</span>
                    <span className="text-xs text-gray-400 font-normal ml-1">(at least 1 required)</span>
                  </label>

                  {/* Upload area */}
                  {photos.length < 5 && (
                    <div
                      onClick={() => inputRef.current?.click()}
                      className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50/30 transition-all"
                    >
                      <Camera className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                      <p className="text-sm text-gray-600 font-medium">Add Completion Photo</p>
                      <p className="text-xs text-gray-400 mt-0.5">Tap to take a photo or upload from device</p>
                      <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        multiple
                        onChange={(e) => handleFiles(e.target.files)}
                        className="hidden"
                      />
                    </div>
                  )}

                  {uploadError && (
                    <p className="text-xs text-red-600 mt-1">{uploadError}</p>
                  )}

                  {/* Photo grid */}
                  {(photos.length > 0 || uploading.length > 0) && (
                    <div className="grid grid-cols-4 gap-2 mt-3">
                      {photos.map((photo, i) => (
                        <div key={photo.url} className="relative aspect-square rounded-xl overflow-hidden group bg-gray-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo.localPreview || photo.url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removePhoto(i)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {uploading.map((u) => (
                        <div key={u.id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u.preview} alt="Uploading..." className="w-full h-full object-cover opacity-60" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            {u.status === 'uploading' && <Loader2 className="w-5 h-5 text-white animate-spin" />}
                            {u.status === 'done' && <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center"><Check className="w-4 h-4 text-white" /></div>}
                            {u.status === 'error' && <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center"><X className="w-3 h-3 text-white" /></div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Required indicator */}
                  {!hasPhoto && (
                    <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5" />
                      At least one photo is required before submitting
                    </p>
                  )}
                </div>

                {/* Completion note */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Completion Note <span className="text-red-500">*</span>
                    <span className="text-xs text-gray-400 font-normal ml-1">(min. 10 characters)</span>
                  </label>
                  <textarea
                    value={completionNote}
                    onChange={(e) => setCompletionNote(e.target.value)}
                    placeholder="Describe the work completed, materials used, and any follow-up notes..."
                    rows={4}
                    className="ui-input resize-none"
                  />
                  <div className="flex items-center justify-between mt-1">
                    {!hasNote && completionNote.trim().length > 0 ? (
                      <p className="text-xs text-amber-600">
                        {10 - completionNote.trim().length} more character{10 - completionNote.trim().length !== 1 ? 's' : ''} needed
                      </p>
                    ) : !hasNote ? (
                      <p className="text-xs text-gray-400">Describe what was done in at least 10 characters</p>
                    ) : (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Note looks good
                      </p>
                    )}
                    <span className="text-xs text-gray-400">{completionNote.trim().length} chars</span>
                  </div>
                </div>

                {submitError && (
                  <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{submitError}</p>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100/50">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="ui-btn-md ui-btn-primary"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Submit for QA
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
