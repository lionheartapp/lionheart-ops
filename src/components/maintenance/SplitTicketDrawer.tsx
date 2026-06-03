'use client'

import { FormEvent, useState } from 'react'
import { Loader2, SplitSquareHorizontal } from 'lucide-react'
import DetailDrawer from '@/components/DetailDrawer'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { CATEGORY_LABELS, PRIORITY_LABELS } from '@/lib/constants/maintenance'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'

type SplitTicketResult = {
  id: string
  ticketNumber: string
  title: string
}

interface SplitTicketDrawerProps {
  open: boolean
  ticketId: string
  sourceTitle: string
  sourcePriority: string
  sourceCategory: string
  hasPhotos: boolean
  hasAsset: boolean
  onClose: () => void
  onSplit: (ticket: SplitTicketResult) => void
}

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABELS).map(([value, label]) => ({
  value,
  label,
}))

export default function SplitTicketDrawer({
  open,
  ticketId,
  sourceTitle,
  sourcePriority,
  sourceCategory,
  hasPhotos,
  hasAsset,
  onClose,
  onSplit,
}: SplitTicketDrawerProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(sourceCategory)
  const [priority, setPriority] = useState(sourcePriority)
  const [keepPhotos, setKeepPhotos] = useState(false)
  const [keepAsset, setKeepAsset] = useState(hasAsset)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = title.trim().length > 0 && category && priority && !isSubmitting

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canSubmit) return

    setIsSubmitting(true)
    setError('')

    try {
      const ticket = await fetchApi<SplitTicketResult>(`/api/maintenance/tickets/${ticketId}/split`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          category,
          priority,
          keepPhotos,
          keepAsset,
        }),
      })

      onSplit(ticket)
      setTitle('')
      setDescription('')
      setCategory(sourceCategory)
      setPriority(sourcePriority)
      setKeepPhotos(false)
      setKeepAsset(hasAsset)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not split ticket.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DetailDrawer
      isOpen={open}
      onClose={onClose}
      title="Split Work Order"
      width="lg"
      footer={
        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-3 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 py-3 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </span>
            ) : (
              'Create Ticket'
            )}
          </button>
        </form>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
              <SplitSquareHorizontal className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Create a separate work order</p>
              <p className="text-xs text-slate-500 mt-1">
                This keeps the original ticket open and adds an internal note linking both tickets.
              </p>
              <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                Source: {sourceTitle}
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            New ticket title <span className="text-red-500">*</span>
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="e.g. Replace broken faucet handle"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Description
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="Add the details that belong only to this work order."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Category
            </label>
            <Select value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Priority
            </label>
            <Select value={priority} onChange={setPriority} options={PRIORITY_OPTIONS} />
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <Checkbox
            checked={keepPhotos}
            onChange={(e) => setKeepPhotos(e.target.checked)}
            label="Copy original photos"
            description={hasPhotos ? 'Use when the same photos help explain this separate issue.' : 'No photos are available on the source ticket.'}
            disabled={!hasPhotos}
          />
          <Checkbox
            checked={keepAsset}
            onChange={(e) => setKeepAsset(e.target.checked)}
            label="Link same asset"
            description={hasAsset ? 'Use when both work orders refer to the same asset.' : 'No asset is linked to the source ticket.'}
            disabled={!hasAsset}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </p>
        )}
      </form>
    </DetailDrawer>
  )
}
