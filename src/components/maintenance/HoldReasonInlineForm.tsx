'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Pause, X } from 'lucide-react'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'
import { expandCollapse } from '@/lib/animations'

// ─── Types ───────────────────────────────────────────────────────────────────

type HoldReason = 'PARTS' | 'VENDOR' | 'ACCESS' | 'OTHER'

interface HoldReasonInlineFormProps {
  ticketId: string
  onComplete: () => void
  onCancel: () => void
}

// ─── Constants ───────────────────────────────────────────────────────────────

const HOLD_REASON_OPTIONS: { value: HoldReason; label: string; description: string }[] = [
  { value: 'PARTS', label: 'Waiting for Parts', description: 'Required materials or parts not yet available' },
  { value: 'VENDOR', label: 'Waiting for Vendor', description: 'Third-party vendor needs to be scheduled' },
  { value: 'ACCESS', label: 'Access Required', description: 'Location not accessible at this time' },
  { value: 'OTHER', label: 'Other', description: 'Another reason (describe in note below)' },
]

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HoldReasonInlineForm({
  ticketId,
  onComplete,
  onCancel,
}: HoldReasonInlineFormProps) {
  const [holdReason, setHoldReason] = useState<HoldReason | ''>('')
  const [holdNote, setHoldNote] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const canConfirm = holdReason !== '' && !isLoading

  async function handleConfirm() {
    if (!canConfirm) return
    setIsLoading(true)
    setError('')
    try {
      await fetchApi(`/api/maintenance/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: 'ON_HOLD',
          holdReason,
          holdNote: holdNote.trim() || undefined,
        }),
      })
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place on hold. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <motion.div
      key="hold-form"
      variants={expandCollapse}
      initial="collapsed"
      animate="expanded"
      exit="collapsed"
      className="overflow-hidden"
    >
      <div className="mt-2 p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-3">
        <div className="flex items-center gap-2">
          <Pause className="w-4 h-4 text-amber-600" />
          <p className="text-sm font-semibold text-amber-900">Place on Hold</p>
        </div>

        {/* Hold reason dropdown (required) */}
        <div>
          <label className="block text-xs font-medium text-amber-800 mb-1">
            Hold Reason <span className="text-red-500">*</span>
          </label>
          <select
            value={holdReason}
            onChange={(e) => setHoldReason(e.target.value as HoldReason | '')}
            className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer"
          >
            <option value="">Select a reason...</option>
            {HOLD_REASON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {holdReason && (
            <p className="text-xs text-amber-600 mt-1">
              {HOLD_REASON_OPTIONS.find((o) => o.value === holdReason)?.description}
            </p>
          )}
        </div>

        {/* Optional note */}
        <div>
          <label className="block text-xs font-medium text-amber-800 mb-1">
            Additional Note <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            value={holdNote}
            onChange={(e) => setHoldNote(e.target.value)}
            placeholder="Add context for the team..."
            rows={2}
            className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 placeholder:text-gray-400"
          />
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Pause className="w-3.5 h-3.5" />
            )}
            Confirm Hold
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        </div>
      </div>
    </motion.div>
  )
}
