'use client'

import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Camera, Check, Loader2, Upload, CheckSquare, ClipboardCheck } from 'lucide-react'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'
import { FileInput } from '@/components/ui/FileInput'
import { Textarea } from '@/components/ui/Textarea'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'

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
  const [workPerformed, setWorkPerformed] = useState('')
  const [causeFound, setCauseFound] = useState('')
  const [partsUsed, setPartsUsed] = useState('')
  const [repairType, setRepairType] = useState<'PERMANENT' | 'TEMPORARY' | 'INSPECTION_ONLY'>('PERMANENT')
  const [followUpNeeded, setFollowUpNeeded] = useState(false)
  const [followUpNote, setFollowUpNote] = useState('')
  const [completionNote, setCompletionNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [submitError, setSubmitError] = useState('')

  const hasPhoto = photos.length > 0
  const hasWorkPerformed = workPerformed.trim().length >= 10
  const hasFollowUpNote = !followUpNeeded || followUpNote.trim().length >= 5
  const canSubmit = hasPhoto && hasWorkPerformed && hasFollowUpNote && !isSubmitting && uploading.filter((u) => u.status === 'uploading').length === 0

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setPhotos([])
      setUploading([])
      setWorkPerformed('')
      setCauseFound('')
      setPartsUsed('')
      setRepairType('PERMANENT')
      setFollowUpNeeded(false)
      setFollowUpNote('')
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
    []
  )

  function handleFiles(files: File[] | null) {
    if (!files) return
    const available = 5 - photos.length
    if (available <= 0) return
    files
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
    const closeoutSummary = [
      `Work performed: ${workPerformed.trim()}`,
      causeFound.trim() ? `Cause found: ${causeFound.trim()}` : null,
      partsUsed.trim() ? `Parts/materials used: ${partsUsed.trim()}` : null,
      `Repair type: ${repairType === 'PERMANENT' ? 'Permanent fix' : repairType === 'TEMPORARY' ? 'Temporary fix' : 'Inspection/documentation only'}`,
      `Follow-up needed: ${followUpNeeded ? 'Yes' : 'No'}`,
      followUpNeeded && followUpNote.trim() ? `Follow-up notes: ${followUpNote.trim()}` : null,
      completionNote.trim() ? `Additional notes: ${completionNote.trim()}` : null,
    ].filter(Boolean).join('\n')

    try {
      await fetchApi(`/api/maintenance/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: 'QA',
          completionPhotos: photos.map((p) => p.url),
          completionNote: closeoutSummary,
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
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100/50">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-slate-900" />
                  <h2 className="text-base font-semibold text-slate-900">Submit for QA Review</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
                <p className="text-sm text-slate-600">
                  Add a completion photo and a short closeout summary. This helps future repair history and repeat-work decisions.
                </p>

                {/* Photo upload */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Completion Photos <span className="text-red-500">*</span>
                    <span className="text-xs text-slate-400 font-normal ml-1">(at least 1 required)</span>
                  </label>

                  {/* Upload area */}
                  {photos.length < 5 && (
                    <FileInput
                      accept="image/*"
                      capture="environment"
                      multiple
                      onFiles={handleFiles}
                      compact
                      className="p-4"
                    >
                      <Camera className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                      <p className="text-sm text-slate-600 font-medium">Add Completion Photo</p>
                      <p className="text-xs text-slate-400 mt-0.5">Tap to take a photo or upload from device</p>
                    </FileInput>
                  )}

                  {uploadError && (
                    <p className="text-xs text-red-600 mt-1">{uploadError}</p>
                  )}

                  {/* Photo grid */}
                  {(photos.length > 0 || uploading.length > 0) && (
                    <div className="grid grid-cols-4 gap-2 mt-3">
                      {photos.map((photo, i) => (
                        <div key={photo.url} className="relative aspect-square rounded-xl overflow-hidden group bg-slate-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo.localPreview || photo.url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removePhoto(i)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity hover:bg-black/80 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {uploading.map((u) => (
                        <div key={u.id} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100">
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

                {/* Structured closeout */}
                <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-slate-500" />
                    <p className="text-sm font-semibold text-slate-800">Closeout Summary</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Work performed <span className="text-red-500">*</span>
                    </label>
                    <Textarea
                      value={workPerformed}
                      onChange={(e) => setWorkPerformed(e.target.value)}
                      placeholder="Describe what was repaired, replaced, cleaned, adjusted, or inspected."
                      rows={3}
                      className="resize-none"
                    />
                    <div className="flex items-center justify-between mt-1">
                      {!hasWorkPerformed && workPerformed.trim().length > 0 ? (
                        <p className="text-xs text-amber-600">
                          {10 - workPerformed.trim().length} more character{10 - workPerformed.trim().length !== 1 ? 's' : ''} needed
                        </p>
                      ) : !hasWorkPerformed ? (
                        <p className="text-xs text-slate-400">At least 10 characters required</p>
                      ) : (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Looks good
                        </p>
                      )}
                      <span className="text-xs text-slate-400">{workPerformed.trim().length} chars</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Cause found
                    </label>
                    <Input
                      value={causeFound}
                      onChange={(e) => setCauseFound(e.target.value)}
                      placeholder="e.g. worn cartridge, loose wire, clogged drain"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Parts or materials used
                    </label>
                    <Input
                      value={partsUsed}
                      onChange={(e) => setPartsUsed(e.target.value)}
                      placeholder="e.g. 1/2 inch supply line, filter, disinfectant"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Repair type
                    </label>
                    <Select
                      value={repairType}
                      onChange={(value) => setRepairType(value as typeof repairType)}
                      options={[
                        { value: 'PERMANENT', label: 'Permanent fix' },
                        { value: 'TEMPORARY', label: 'Temporary fix' },
                        { value: 'INSPECTION_ONLY', label: 'Inspection only' },
                      ]}
                    />
                  </div>

                  <Checkbox
                    checked={followUpNeeded}
                    onChange={(e) => setFollowUpNeeded(e.target.checked)}
                    label="Follow-up needed"
                    description="Use this when the repair is temporary, parts are pending, or the asset may need replacement."
                  />

                  {followUpNeeded && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Follow-up note <span className="text-red-500">*</span>
                      </label>
                      <Input
                        value={followUpNote}
                        onChange={(e) => setFollowUpNote(e.target.value)}
                        placeholder="e.g. order cartridge, monitor for leak, recommend replacement"
                        hasError={!hasFollowUpNote}
                      />
                    </div>
                  )}
                </div>

                {/* Additional note */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Additional note
                  </label>
                  <Textarea
                    value={completionNote}
                    onChange={(e) => setCompletionNote(e.target.value)}
                    placeholder="Optional extra context for QA or future reference..."
                    rows={3}
                    className="resize-none"
                  />
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-slate-400">Optional</p>
                    <span className="text-xs text-slate-400">{completionNote.trim().length} chars</span>
                  </div>
                </div>

                {submitError && (
                  <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{submitError}</p>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100/50">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
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
