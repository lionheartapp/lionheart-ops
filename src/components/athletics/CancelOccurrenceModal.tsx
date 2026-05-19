'use client'

import { useState } from 'react'
import { CloudRain, Calendar, Bell } from 'lucide-react'
import { Select } from '@/components/ui/Select'

interface CancelOccurrenceModalProps {
  isOpen: boolean
  onClose: () => void
  /** The specific date being cancelled */
  date: Date
  eventTitle: string
  spaceName?: string
  isOutdoor?: boolean
  isAdmin?: boolean
  onCancel: (opts: {
    reason: string
    notify: boolean
    reschedule: boolean
    cancelAllOutdoor: boolean
  }) => void
}

const CANCEL_REASONS = [
  { value: 'weather', label: 'Weather' },
  { value: 'field_condition', label: 'Field condition' },
  { value: 'scheduling_change', label: 'Scheduling change' },
  { value: 'other', label: 'Other' },
]

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

export default function CancelOccurrenceModal({
  isOpen,
  onClose,
  date,
  eventTitle,
  spaceName,
  isOutdoor = false,
  isAdmin = false,
  onCancel,
}: CancelOccurrenceModalProps) {
  const [reason, setReason] = useState('weather')
  const [notify, setNotify] = useState(true)
  const [reschedule, setReschedule] = useState(false)
  const [cancelAllOutdoor, setCancelAllOutdoor] = useState(false)

  if (!isOpen) return null

  const handleConfirm = () => {
    onCancel({ reason, notify, reschedule, cancelAllOutdoor })
    setReason('weather')
    setNotify(true)
    setReschedule(false)
    setCancelAllOutdoor(false)
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
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <CloudRain className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Cancel Practice</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {eventTitle} on {formatDate(date)}
              {spaceName && ` at ${spaceName}`}
            </p>
          </div>
        </div>

        <div className="space-y-4 mb-5">
          {/* Reason */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Reason</label>
            <Select
              value={reason}
              onChange={setReason}
              options={CANCEL_REASONS}
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-sm text-slate-700">Notify team members</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={reschedule}
                onChange={(e) => setReschedule(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-sm text-slate-700">Reschedule to another date</span>
              </div>
            </label>

            {/* Bulk outdoor cancellation — admin only, weather reason, outdoor space */}
            {isAdmin && isOutdoor && reason === 'weather' && (
              <label className="flex items-center gap-2.5 cursor-pointer bg-amber-50 border border-amber-100 rounded-lg p-3 -mx-1">
                <input
                  type="checkbox"
                  checked={cancelAllOutdoor}
                  onChange={(e) => setCancelAllOutdoor(e.target.checked)}
                  className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <span className="text-sm font-medium text-amber-800">Cancel all outdoor practices today</span>
                  <p className="text-xs text-amber-600 mt-0.5">Affects all teams with outdoor bookings on this date</p>
                </div>
              </label>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-full hover:bg-gray-50 active:scale-[0.97] transition-all cursor-pointer"
          >
            Keep Practice
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-full hover:bg-red-700 active:scale-[0.97] transition-all cursor-pointer"
          >
            Cancel Practice
          </button>
        </div>
      </div>
    </div>
  )
}
