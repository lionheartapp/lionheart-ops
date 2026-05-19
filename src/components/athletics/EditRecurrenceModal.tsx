'use client'

import { Calendar, ChevronRight } from 'lucide-react'

type EditScope = 'this_only' | 'this_and_future' | 'all'

interface EditRecurrenceModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (scope: EditScope) => void
  eventDate?: Date
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

const OPTIONS: Array<{ value: EditScope; title: string; description: string }> = [
  {
    value: 'this_only',
    title: 'This occurrence only',
    description: 'Changes apply to this date. Other occurrences stay the same.',
  },
  {
    value: 'this_and_future',
    title: 'This and all future',
    description: 'Changes apply from this date forward. Past occurrences stay the same.',
  },
  {
    value: 'all',
    title: 'All occurrences',
    description: 'Changes apply to every occurrence in the series.',
  },
]

export default function EditRecurrenceModal({
  isOpen,
  onClose,
  onSelect,
  eventDate,
}: EditRecurrenceModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal — bottom sheet on mobile, centered on desktop */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-sm mx-0 sm:mx-4 overflow-hidden">
        <div className="p-5 pb-3">
          <div className="flex items-center gap-2.5 mb-1">
            <Calendar className="w-4 h-4 text-indigo-500" />
            <h3 className="text-base font-semibold text-slate-900">Edit Recurring Event</h3>
          </div>
          {eventDate && (
            <p className="text-sm text-slate-500 ml-6.5">
              {formatDate(eventDate)}
            </p>
          )}
        </div>

        <div className="border-t border-slate-100">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onSelect(opt.value)
                onClose()
              }}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-50 last:border-b-0"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">{opt.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{opt.description}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
