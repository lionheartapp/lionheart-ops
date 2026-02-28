'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CalendarData } from '@/lib/hooks/useCalendar'

interface EventCreatePanelProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: EventFormData) => void
  isSubmitting: boolean
  calendars: CalendarData[]
  initialStart?: Date
  initialEnd?: Date
}

export interface EventFormData {
  calendarId: string
  title: string
  description: string
  startTime: string
  endTime: string
  isAllDay: boolean
  locationText: string
}

function toLocalDateTimeString(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function EventCreatePanel({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  calendars,
  initialStart,
  initialEnd,
}: EventCreatePanelProps) {
  const now = new Date()
  const defaultStart = initialStart || new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0)
  const defaultEnd = initialEnd || new Date(defaultStart.getTime() + 60 * 60 * 1000)

  const [form, setForm] = useState<EventFormData>({
    calendarId: calendars[0]?.id || '',
    title: '',
    description: '',
    startTime: toLocalDateTimeString(defaultStart),
    endTime: toLocalDateTimeString(defaultEnd),
    isAllDay: false,
    locationText: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.calendarId) return

    onSubmit({
      ...form,
      startTime: new Date(form.startTime).toISOString(),
      endTime: new Date(form.endTime).toISOString(),
    })
  }

  const selectedCalendar = calendars.find((c) => c.id === form.calendarId)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 z-40"
            onClick={onClose}
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">New Event</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Title */}
              <div>
                <input
                  type="text"
                  placeholder="Event title"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full text-lg font-medium text-gray-900 placeholder-gray-400 border-0 border-b-2 border-gray-200 focus:border-primary-500 focus:ring-0 pb-2 transition-colors"
                  autoFocus
                />
              </div>

              {/* Calendar selector */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Calendar</label>
                <div className="relative">
                  <select
                    value={form.calendarId}
                    onChange={(e) => setForm((p) => ({ ...p, calendarId: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white appearance-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
                  >
                    {calendars.map((cal) => (
                      <option key={cal.id} value={cal.id}>{cal.name}</option>
                    ))}
                  </select>
                  {selectedCalendar && (
                    <div
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full pointer-events-none"
                      style={{ backgroundColor: selectedCalendar.color }}
                    />
                  )}
                </div>
              </div>

              {/* All-day toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allDay"
                  checked={form.isAllDay}
                  onChange={(e) => setForm((p) => ({ ...p, isAllDay: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="allDay" className="text-sm text-gray-700">All-day event</label>
              </div>

              {/* Date/Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Start</label>
                  <input
                    type={form.isAllDay ? 'date' : 'datetime-local'}
                    value={form.isAllDay ? form.startTime.split('T')[0] : form.startTime}
                    onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">End</label>
                  <input
                    type={form.isAllDay ? 'date' : 'datetime-local'}
                    value={form.isAllDay ? form.endTime.split('T')[0] : form.endTime}
                    onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Location</label>
                <input
                  type="text"
                  placeholder="Add location"
                  value={form.locationText}
                  onChange={(e) => setForm((p) => ({ ...p, locationText: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Description</label>
                <textarea
                  placeholder="Add description"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 resize-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
                />
              </div>
            </form>

            {/* Footer */}
            <div className="p-5 border-t border-gray-100 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !form.title.trim()}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Event
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
