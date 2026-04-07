'use client'

import { Check, Loader2 } from 'lucide-react'
import { FloatingInput, FloatingDropdown } from '@/components/ui/FloatingInput'
import { IllustrationCalendar } from '@/components/illustrations'
import { COLOR_PRESETS, CALENDAR_TYPE_OPTIONS } from './calendar-constants'

interface EmptyCalendarStateProps {
  showCreateForm: boolean
  onShowCreateForm: () => void
  calendarName: string
  onCalendarNameChange: (name: string) => void
  calendarType: string
  onCalendarTypeChange: (type: string) => void
  calendarColor: string
  onCalendarColorChange: (color: string) => void
  onCreateCalendar: () => void
  onCancel: () => void
  isPending: boolean
}

export default function EmptyCalendarState({
  showCreateForm,
  onShowCreateForm,
  calendarName,
  onCalendarNameChange,
  calendarType,
  onCalendarTypeChange,
  calendarColor,
  onCalendarColorChange,
  onCreateCalendar,
  onCancel,
  isPending,
}: EmptyCalendarStateProps) {
  return (
    <div className="flex items-center justify-center h-96 text-center">
      <div>
        <IllustrationCalendar className="w-52 h-44 mx-auto mb-2" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">No calendars yet</h2>
        <p className="text-slate-500 mb-6 max-w-sm">
          Create your first calendar to start organizing events for your school.
        </p>
        {!showCreateForm ? (
          <button
            onClick={onShowCreateForm}
            className="px-5 py-2.5 bg-slate-900 text-white font-medium rounded-full hover:bg-slate-800 transition-colors"
          >
            Create Calendar
          </button>
        ) : (
          <div className="max-w-sm mx-auto space-y-5 text-left">
            <FloatingInput
              id="empty-cal-name"
              label="Calendar name"
              value={calendarName}
              onChange={(e) => onCalendarNameChange(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && onCreateCalendar()}
            />
            <FloatingDropdown
              id="empty-cal-type"
              label="Type"
              value={calendarType}
              onChange={(v) => onCalendarTypeChange(v)}
              options={CALENDAR_TYPE_OPTIONS}
            />
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">Color</label>
              <div className="flex items-center gap-2 flex-wrap">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => onCalendarColorChange(c.value)}
                    className="w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-400"
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  >
                    {calendarColor === c.value && (
                      <Check className="w-3.5 h-3.5 text-white" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-full hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onCreateCalendar}
                disabled={!calendarName.trim() || isPending}
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
