'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Loader2, Clock, Calendar, MapPin, AlignLeft, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CalendarData, CalendarEventData } from '@/lib/hooks/useCalendar'

interface EventCreatePanelProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: EventFormData) => void
  isSubmitting: boolean
  calendars: CalendarData[]
  initialStart?: Date
  initialEnd?: Date
  error?: string | null
  event?: CalendarEventData | null
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
  const snappedMin = Math.round(date.getMinutes() / 15) * 15
  const h = snappedMin === 60 ? (date.getHours() + 1) % 24 : date.getHours()
  const m = snappedMin === 60 ? 0 : snappedMin
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(h)}:${pad(m)}`
}

function getDatePart(dt: string): string {
  return dt.split('T')[0]
}

function getTimePart(dt: string): string {
  return dt.split('T')[1] || '12:00'
}

function formatDateDisplay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
  const dayNum = date.getDate()
  const monthName = date.toLocaleDateString('en-US', { month: 'long' })
  return `${dayName}, ${dayNum} ${monthName}`
}

// 96 time slots at 15-minute intervals
const TIME_OPTIONS: { value: string; label: string }[] = []
for (let h = 0; h < 24; h++) {
  for (const m of [0, 15, 30, 45]) {
    const value = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    const ampm = h < 12 ? 'AM' : 'PM'
    const label = `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
    TIME_OPTIONS.push({ value, label })
  }
}

export default function EventCreatePanel({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  calendars,
  initialStart,
  initialEnd,
  error,
  event,
}: EventCreatePanelProps) {
  const isEditing = !!event
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

  // Reset form when panel opens or calendars change
  useEffect(() => {
    if (isOpen) {
      if (event) {
        setForm({
          calendarId: event.calendarId,
          title: event.title,
          description: event.description || '',
          startTime: toLocalDateTimeString(new Date(event.startTime)),
          endTime: toLocalDateTimeString(new Date(event.endTime)),
          isAllDay: event.isAllDay,
          locationText: event.locationText || '',
        })
      } else {
        const start = initialStart || new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), new Date().getHours() + 1, 0)
        const end = initialEnd || new Date(start.getTime() + 60 * 60 * 1000)
        setForm({
          calendarId: calendars[0]?.id || '',
          title: '',
          description: '',
          startTime: toLocalDateTimeString(start),
          endTime: toLocalDateTimeString(end),
          isAllDay: false,
          locationText: '',
        })
      }
    }
  }, [isOpen, calendars, initialStart, initialEnd, event])

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
  const startDate = getDatePart(form.startTime)
  const endDate = getDatePart(form.endTime)
  const showEndDate = endDate !== startDate

  const startDateRef = useRef<HTMLInputElement>(null)
  const endDateRef = useRef<HTMLInputElement>(null)
  const endDateAddRef = useRef<HTMLInputElement>(null)

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
            className="fixed right-4 top-4 bottom-4 w-full max-w-[420px] bg-white shadow-2xl z-50 flex flex-col rounded-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                {isEditing ? 'Edit Event' : 'New Event'}
              </span>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 pb-6">
              {/* Title */}
              <div className="mb-5">
                <input
                  type="text"
                  placeholder="Event title"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full text-xl font-semibold text-gray-900 placeholder-gray-300 border-0 focus:ring-0 bg-transparent p-0"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                {/* Calendar selector — icon row */}
                <div className="flex items-center gap-4 py-3">
                  <Calendar className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <div className="relative flex-1">
                    {selectedCalendar && (
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full pointer-events-none z-10"
                        style={{ backgroundColor: selectedCalendar.color }}
                      />
                    )}
                    <select
                      value={form.calendarId}
                      onChange={(e) => setForm((p) => ({ ...p, calendarId: e.target.value }))}
                      className="w-full pl-5 pr-7 py-1.5 border-0 border-b border-gray-100 text-sm text-gray-900 bg-transparent appearance-none focus:ring-0 focus:border-gray-300 rounded-none"
                    >
                      {calendars.map((cal) => (
                        <option key={cal.id} value={cal.id}>{cal.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* All-day toggle — icon row */}
                <div className="flex items-center gap-4 py-3">
                  <div className="w-5 h-5 flex-shrink-0" />
                  <label htmlFor="allDay" className="flex items-center justify-between flex-1 cursor-pointer">
                    <span className="text-sm text-gray-700">All-day</span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        id="allDay"
                        checked={form.isAllDay}
                        onChange={(e) => setForm((p) => ({ ...p, isAllDay: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 rounded-full peer-checked:bg-gray-900 transition-colors" />
                      <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4" />
                    </div>
                  </label>
                </div>

                {/* Date & Time — icon row */}
                <div className="flex items-start gap-4 py-3">
                  <Clock className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    {/* Date line */}
                    <div className="inline-block">
                      <button
                        type="button"
                        onClick={() => startDateRef.current?.showPicker()}
                        className="text-sm text-gray-900 cursor-pointer hover:text-gray-600 bg-transparent border-0 p-0"
                      >
                        {formatDateDisplay(startDate)}
                      </button>
                      <input
                        ref={startDateRef}
                        type="date"
                        value={startDate}
                        onChange={(e) => setForm((p) => ({ ...p, startTime: `${e.target.value}T${getTimePart(p.startTime)}` }))}
                        className="sr-only"
                      />
                    </div>
                    {/* Time pills row */}
                    {!form.isAllDay && (
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <select
                            value={getTimePart(form.startTime)}
                            onChange={(e) => setForm((p) => ({ ...p, startTime: `${getDatePart(p.startTime)}T${e.target.value}` }))}
                            className="appearance-none min-h-0 px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-900 border-0 focus:ring-2 focus:ring-gray-200 pr-7 cursor-pointer"
                          >
                            {TIME_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                        </div>
                        <span className="text-gray-300 text-sm">&ndash;</span>
                        <div className="relative">
                          <select
                            value={getTimePart(form.endTime)}
                            onChange={(e) => setForm((p) => ({ ...p, endTime: `${getDatePart(p.endTime)}T${e.target.value}` }))}
                            className="appearance-none min-h-0 px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-900 border-0 focus:ring-2 focus:ring-gray-200 pr-7 cursor-pointer"
                            >
                              {TIME_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                          </div>
                        </div>
                      )}
                    {/* End date (shown if different from start) */}
                    {showEndDate && (
                      <div>
                        <button
                          type="button"
                          onClick={() => endDateRef.current?.showPicker()}
                          className="text-sm text-gray-500 cursor-pointer hover:text-gray-700 bg-transparent border-0 p-0"
                        >
                          to {formatDateDisplay(endDate)}
                        </button>
                        <input
                          ref={endDateRef}
                          type="date"
                          value={endDate}
                          onChange={(e) => setForm((p) => ({ ...p, endTime: `${e.target.value}T${getTimePart(p.endTime)}` }))}
                          className="sr-only"
                        />
                      </div>
                    )}
                    {/* Always-accessible end date picker (when same day) */}
                    {!showEndDate && (
                      <div className="inline-block">
                        <button
                          type="button"
                          onClick={() => endDateAddRef.current?.showPicker()}
                          className="text-xs text-gray-400 cursor-pointer hover:text-gray-500 bg-transparent border-0 p-0"
                        >
                          + end date
                        </button>
                        <input
                          ref={endDateAddRef}
                          type="date"
                          value={endDate}
                          onChange={(e) => setForm((p) => ({ ...p, endTime: `${e.target.value}T${getTimePart(p.endTime)}` }))}
                          className="sr-only"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Location — icon row */}
                <div className="flex items-center gap-4 py-3">
                  <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Add location"
                    value={form.locationText}
                    onChange={(e) => setForm((p) => ({ ...p, locationText: e.target.value }))}
                    className="flex-1 text-sm text-gray-900 placeholder-gray-400 border-0 border-b border-gray-100 focus:ring-0 focus:border-gray-300 bg-transparent px-0 py-1.5 rounded-none"
                  />
                </div>

                {/* Description — icon row */}
                <div className="flex items-start gap-4 py-3">
                  <AlignLeft className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                  <textarea
                    placeholder="Add description"
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    rows={3}
                    className="flex-1 text-sm text-gray-900 placeholder-gray-400 border-0 border-b border-gray-100 focus:ring-0 focus:border-gray-300 bg-transparent px-0 py-1.5 resize-none rounded-none"
                  />
                </div>
              </div>
            </form>

            {/* Error */}
            {error && (
              <div className="mx-6 mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Footer */}
            <div className="px-6 pb-6 pt-2 space-y-3">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !form.title.trim()}
                className="w-full py-3.5 text-sm font-semibold text-white bg-gray-900 rounded-full hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isEditing ? 'Save Changes' : 'Create Event'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors py-1"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
