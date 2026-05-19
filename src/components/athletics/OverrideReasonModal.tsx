'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Textarea } from '@/components/ui/Textarea'

interface OverrideReasonModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
  conflictTitle?: string
}

export default function OverrideReasonModal({
  isOpen,
  onClose,
  onConfirm,
  conflictTitle,
}: OverrideReasonModalProps) {
  const [reason, setReason] = useState('')

  if (!isOpen) return null

  const handleConfirm = () => {
    if (!reason.trim()) return
    onConfirm(reason.trim())
    setReason('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal — bottom sheet on mobile, centered on desktop */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md mx-0 sm:mx-4 p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Override Conflict</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {conflictTitle
                ? `This will create an overlap with "${conflictTitle}." The original booker will be notified.`
                : 'This will create a scheduling overlap. The affected booker will be notified.'}
            </p>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">
            Reason <span className="text-red-400">*</span>
          </label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this override needed? e.g., Varsity playoff game takes priority"
            rows={3}
            autoFocus
          />
        </div>

        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-full hover:bg-gray-50 active:scale-[0.97] transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!reason.trim()}
            className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-full hover:bg-amber-700 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Override & Book
          </button>
        </div>
      </div>
    </div>
  )
}
