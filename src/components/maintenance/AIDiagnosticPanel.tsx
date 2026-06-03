'use client'

import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Camera, Check, Loader2, Sparkles, UploadCloud } from 'lucide-react'
import { logger } from '@/lib/logger'
import { getAuthHeaders, fetchApi } from '@/lib/api-client'
import { useToast } from '@/components/Toast'
import { FileInput } from '@/components/ui/FileInput'
import type { ImageAttachment } from '@/lib/types/assistant'
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS } from '@/lib/constants/maintenance'

interface AIDiagnosticPanelProps {
  ticketId: string
  ticketNumber: string
  title: string
  description?: string | null
  status: string
  priority: string
  category: string
  photos: string[]
  locationLabel?: string | null
  submittedByName?: string | null
  assignedToName?: string | null
  comments?: Array<{
    content: string | null
    createdAt: string
    actorName?: string | null
  }>
}

type UploadState = {
  id: string
  name: string
  status: 'uploading' | 'done' | 'error'
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const MAX_SIZE = 10 * 1024 * 1024
const MAX_TICKET_PHOTOS = 5
const MAX_LEO_IMAGES = 3

function dataUrlToAttachment(dataUrl: string, name: string, fallbackMime: string): ImageAttachment {
  const match = dataUrl.match(/^data:(.+);base64,(.*)$/)
  return {
    data: match?.[2] ?? dataUrl,
    mimeType: match?.[1] ?? fallbackMime,
    name,
  }
}

function fileToAttachment(file: File): Promise<ImageAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(dataUrlToAttachment(String(reader.result), file.name, file.type))
    reader.onerror = () => reject(new Error('Could not read image'))
    reader.readAsDataURL(file)
  })
}

async function urlToAttachment(url: string, index: number): Promise<ImageAttachment | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await fileToAttachment(new File([blob], `ticket-photo-${index + 1}`, { type: blob.type || 'image/jpeg' }))
  } catch (error) {
    logger.warn({ error: String(error), url }, 'Could not attach ticket photo to Leo prompt')
    return null
  }
}

function compactList(items: Array<string | null | undefined>): string {
  return items.filter(Boolean).join('\n')
}

function buildCommentSynopsis(comments: AIDiagnosticPanelProps['comments']): string | null {
  const cleanComments = (comments ?? [])
    .filter((comment) => comment.content?.trim())
    .slice(-6)

  if (cleanComments.length === 0) return null

  return cleanComments
    .map((comment) => {
      const by = comment.actorName || 'Staff'
      const date = new Date(comment.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
      return `- ${date}, ${by}: ${comment.content!.trim()}`
    })
    .join('\n')
}

export default function AIDiagnosticPanel({
  ticketId,
  ticketNumber,
  title,
  description,
  status,
  priority,
  category,
  photos,
  locationLabel,
  submittedByName,
  assignedToName,
  comments,
}: AIDiagnosticPanelProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [isOpeningLeo, setIsOpeningLeo] = useState(false)
  const [uploading, setUploading] = useState<UploadState[]>([])
  const [pendingLeoImages, setPendingLeoImages] = useState<ImageAttachment[]>([])
  const [uploadError, setUploadError] = useState('')

  const remainingPhotos = Math.max(0, MAX_TICKET_PHOTOS - photos.length)

  const buildPrompt = useCallback(() => {
    const commentSynopsis = buildCommentSynopsis(comments)
    const context = compactList([
      `Ticket: ${ticketNumber} (${ticketId})`,
      `Title: ${title}`,
      `Status: ${STATUS_LABELS[status] ?? status}`,
      `Priority: ${PRIORITY_LABELS[priority] ?? priority}`,
      `Category: ${CATEGORY_LABELS[category] ?? category}`,
      locationLabel ? `Location: ${locationLabel}` : null,
      submittedByName ? `Submitted by: ${submittedByName}` : null,
      assignedToName ? `Assigned to: ${assignedToName}` : 'Assigned to: Unassigned',
      description ? `Description: ${description}` : null,
      `Ticket photos available: ${photos.length}`,
      commentSynopsis ? `Comment synopsis:\n${commentSynopsis}` : null,
    ])

    return [
      'Leo, act as a practical maintenance partner for this work order.',
      'Assume the assigned technician is competent in their trade. Do not explain basics or talk down to them.',
      'Help them reason through likely causes, useful checks, what evidence would confirm or rule out each path, and what to document.',
      'Use the maintenance tools to pull the latest ticket details before answering.',
      commentSynopsis
        ? 'Use the comment synopsis below. If you mention comments, summarize only what matters for the troubleshooting path.'
        : 'There are no ticket comments to summarize. Do not mention comments or say there are no comments.',
      'If photos are attached to this message, inspect them directly.',
      'Keep the answer concise. Prefer hypotheses, test sequence, likely parts, and gotchas over generic tool lists.',
      'Only include PPE/safety notes that are specifically relevant to the ticket. Keep stop/escalate conditions clear, but do not pad them.',
      'Do not recommend licensed, energized, refrigerant, chemical-label-sensitive, or hazardous-material work unless the correct qualified person is involved.',
      '',
      context,
    ].join('\n')
  }, [
    assignedToName,
    category,
    comments,
    description,
    locationLabel,
    photos.length,
    priority,
    status,
    submittedByName,
    ticketId,
    ticketNumber,
    title,
  ])

  async function openLeo() {
    setIsOpeningLeo(true)
    try {
      const existing = await Promise.all(
        photos.slice(0, Math.max(0, MAX_LEO_IMAGES - pendingLeoImages.length)).map(urlToAttachment)
      )
      const images = [...pendingLeoImages, ...existing.filter(Boolean) as ImageAttachment[]].slice(0, MAX_LEO_IMAGES)

      window.dispatchEvent(new CustomEvent('open-leo-drawer', {
        detail: {
          prompt: buildPrompt(),
          images,
        },
      }))
    } finally {
      setIsOpeningLeo(false)
    }
  }

  const uploadFile = useCallback(
    async (file: File) => {
      const id = `${Date.now()}-${file.name}`
      setUploading((prev) => [...prev, { id, name: file.name, status: 'uploading' }])
      setUploadError('')

      try {
        const attachment = await fileToAttachment(file)
        const urlData = await fetchApi<{ signedUrl: string; publicUrl: string }>(
          '/api/maintenance/tickets/upload-url',
          {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ fileName: file.name, contentType: file.type }),
          }
        )

        const putRes = await fetch(urlData.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        })
        if (!putRes.ok) throw new Error('Upload to storage failed')

        await fetchApi(`/api/maintenance/tickets/${ticketId}`, {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify({ photos: [urlData.publicUrl] }),
        })

        setPendingLeoImages((prev) => [...prev, attachment].slice(0, MAX_LEO_IMAGES))
        setUploading((prev) => prev.map((u) => u.id === id ? { ...u, status: 'done' } : u))
        queryClient.invalidateQueries({ queryKey: ['maintenance-ticket', ticketId] })
        queryClient.invalidateQueries({ queryKey: ['maintenance-ticket-activities', ticketId] })
        queryClient.invalidateQueries({ queryKey: ['maintenance-tickets'] })
        toast('Photo added to ticket', 'success')

        setTimeout(() => {
          setUploading((prev) => prev.filter((u) => u.id !== id))
        }, 1200)
      } catch (error) {
        logger.error({ error: String(error) }, 'Maintenance Leo photo upload failed')
        setUploading((prev) => prev.map((u) => u.id === id ? { ...u, status: 'error' } : u))
        setUploadError(error instanceof Error ? error.message : 'Photo upload failed')
      }
    },
    [queryClient, ticketId, toast]
  )

  const handleFiles = useCallback(
    (files: File[]) => {
      if (remainingPhotos <= 0) {
        setUploadError(`Maximum ${MAX_TICKET_PHOTOS} ticket photos reached`)
        return
      }

      files.slice(0, remainingPhotos).forEach((file) => {
        if (!file.type.match(/^image\//)) {
          setUploadError('Only image files are allowed')
          return
        }
        if (file.size > MAX_SIZE) {
          setUploadError('Each image must be 10MB or smaller')
          return
        }
        void uploadFile(file)
      })
    },
    [remainingPhotos, uploadFile]
  )

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70">
      <div className="p-3 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-slate-950 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">Ask Leo</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Use ticket context and photos for a second set of eyes.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openLeo}
            disabled={isOpeningLeo}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors cursor-pointer sm:w-auto"
          >
            {isOpeningLeo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
            {isOpeningLeo ? 'Opening...' : 'Open'}
          </button>
        </div>

        {remainingPhotos > 0 ? (
          <FileInput
            accept={[...ALLOWED_TYPES, 'image/*'].join(',')}
            capture="environment"
            multiple
            maxSize={MAX_SIZE}
            onFiles={handleFiles}
            compact
            className="border-slate-200 hover:border-primary-300 hover:bg-primary-50/30"
          >
            <div className="flex items-center gap-3 text-left">
              <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
                <Camera className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-800">Add photos for Leo</p>
                <p className="text-[11px] text-slate-400">
                  {photos.length} on ticket · up to {remainingPhotos} more
                </p>
              </div>
            </div>
          </FileInput>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Photo limit reached for this ticket.
          </div>
        )}

        <AnimatePresence initial={false}>
          {(uploading.length > 0 || uploadError) && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="space-y-2"
            >
              {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
              {uploading.map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-2 text-xs text-slate-600">
                  {item.status === 'uploading' && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-600" />}
                  {item.status === 'done' && <Check className="w-3.5 h-3.5 text-green-600" />}
                  {item.status === 'error' && <UploadCloud className="w-3.5 h-3.5 text-red-500" />}
                  <span className="truncate flex-1">{item.name}</span>
                  <span className="capitalize text-slate-400">{item.status}</span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}
