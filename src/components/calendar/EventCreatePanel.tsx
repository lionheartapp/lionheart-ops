'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Loader2, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CalendarData, CalendarEventData } from '@/lib/hooks/useCalendar'
import { useCampusLocations, type CampusLocationOption } from '@/lib/hooks/useCampusLocations'
import { FloatingInput, FloatingSelect, FloatingTextarea } from '@/components/ui/FloatingInput'

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
  buildingId: string | null
  areaId: string | null
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

// ── Custom Time Picker ──────────────────────────────────────────────
function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const currentLabel = TIME_OPTIONS.find((o) => o.value === value)?.label || value

  // Auto-scroll to selected item when dropdown opens
  useEffect(() => {
    if (open && listRef.current) {
      const idx = TIME_OPTIONS.findIndex((o) => o.value === value)
      if (idx >= 0) {
        const itemHeight = 36
        listRef.current.scrollTop = Math.max(0, idx * itemHeight - 72) // center-ish
      }
    }
  }, [open, value])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 min-h-0 px-3 py-1.5 bg-gray-100 rounded-full text-sm font-medium text-gray-900 hover:bg-gray-200 transition-colors cursor-pointer"
      >
        {currentLabel}
        <ChevronDown className="w-3 h-3 text-gray-400" />
      </button>

      {open && (
        <div
          ref={listRef}
          className="absolute top-full left-0 mt-1 w-36 max-h-52 overflow-y-auto bg-white rounded-xl shadow-lg border border-gray-200 z-50 py-1"
        >
          {TIME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                opt.value === value
                  ? 'bg-primary-50 text-primary-700 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Location Combobox ───────────────────────────────────────────────
function LocationCombobox({
  value,
  buildingId,
  areaId,
  onChange,
}: {
  value: string
  buildingId: string | null
  areaId: string | null
  onChange: (locationText: string, buildingId: string | null, areaId: string | null) => void
}) {
  const { data: locations = [] } = useCampusLocations()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync input display with external value
  useEffect(() => {
    setQuery(value)
  }, [value])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const filtered = locations.filter((loc) =>
    loc.label.toLowerCase().includes(query.toLowerCase())
  )

  const handleSelect = (loc: CampusLocationOption) => {
    onChange(loc.label, loc.buildingId, loc.areaId)
    setQuery(loc.label)
    setOpen(false)
  }

  const handleFreeText = () => {
    onChange(query, null, null)
    setOpen(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (!open) setOpen(true)
    // If user clears or changes text away from a campus location, reset IDs
    if (buildingId || areaId) {
      onChange(val, null, null)
    }
  }

  const showDropdown = open && query.length > 0

  return (
    <div ref={containerRef} className="relative" role="combobox" aria-expanded={open} aria-haspopup="listbox">
      <input
        ref={inputRef}
        type="text"
        placeholder="Location"
        value={query}
        onChange={handleInputChange}
        onFocus={() => { if (query.length > 0 || locations.length > 0) setOpen(true) }}
        className="peer w-full px-3.5 py-3.5 text-sm text-gray-900 placeholder-transparent outline-none border border-gray-300 rounded-lg bg-white transition-colors focus:border-gray-900 focus:ring-1 focus:ring-gray-900/10"
        aria-label="Event location"
        aria-autocomplete="list"
      />
      <label className="absolute left-3 -top-2.5 px-1 bg-white text-xs text-gray-500 font-medium pointer-events-none transition-all duration-200 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:text-gray-400 peer-focus:-top-2.5 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:font-medium peer-focus:text-gray-600">
        Location
      </label>

      {open && (locations.length > 0 || query.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white rounded-xl shadow-lg border border-gray-200 z-50 py-1" role="listbox">
          {/* Campus locations section */}
          {filtered.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Campus Locations
              </div>
              {filtered.map((loc) => {
                const isSelected = loc.buildingId === buildingId && loc.areaId === areaId && (loc.buildingId !== null || loc.areaId !== null)
                return (
                  <button
                    key={`${loc.buildingId}-${loc.areaId}`}
                    type="button"
                    onClick={() => handleSelect(loc)}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      isSelected
                        ? 'bg-primary-50 text-primary-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {loc.label}
                  </button>
                )
              })}
            </>
          )}

          {/* Free-text option */}
          {query.trim().length > 0 && (
            <>
              {filtered.length > 0 && <div className="border-t border-gray-100 my-1" />}
              <button
                type="button"
                onClick={handleFreeText}
                className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Use &ldquo;{query}&rdquo; as custom location
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────
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
    buildingId: null,
    areaId: null,
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
          buildingId: (event as unknown as Record<string, unknown>).buildingId as string | null ?? null,
          areaId: (event as unknown as Record<string, unknown>).areaId as string | null ?? null,
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
          buildingId: null,
          areaId: null,
        })
      }
    }
  }, [isOpen, calendars, initialStart, initialEnd, event])

  const [timeError, setTimeError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.calendarId) return

    const start = new Date(form.startTime)
    const end = new Date(form.endTime)
    if (!form.isAllDay && end <= start) {
      setTimeError('End time must be after start time')
      return
    }
    setTimeError(null)

    onSubmit({
      ...form,
      startTime: new Date(form.startTime).toISOString(),
      endTime: new Date(form.endTime).toISOString(),
      buildingId: form.buildingId || null,
      areaId: form.areaId || null,
    })
  }

  const selectedCalendar = calendars.find((c) => c.id === form.calendarId)
  const startDate = getDatePart(form.startTime)
  const endDate = getDatePart(form.endTime)
  const showEndDate = endDate !== startDate

  const startDateRef = useRef<HTMLInputElement>(null)
  const endDateRef = useRef<HTMLInputElement>(null)
  const endDateAddRef = useRef<HTMLInputElement>(null)

  const setStartTime = useCallback((time: string) => {
    setForm((p) => ({ ...p, startTime: `${getDatePart(p.startTime)}T${time}` }))
  }, [])

  const setEndTime = useCallback((time: string) => {
    setForm((p) => ({ ...p, endTime: `${getDatePart(p.endTime)}T${time}` }))
  }, [])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-40"
            onClick={onClose}
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:right-4 sm:top-4 sm:bottom-4 sm:max-w-[420px] bg-white shadow-2xl z-50 flex flex-col sm:rounded-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                {isEditing ? 'Edit Event' : 'Create New Event'}
              </span>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 pt-3 pb-6 space-y-5">
              {/* Title */}
              <FloatingInput
                id="event-title"
                label="Event title"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                autoFocus
              />

              {/* Calendar selector */}
              <div className="relative">
                {selectedCalendar && (
                  <div
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full pointer-events-none z-10"
                    style={{ backgroundColor: selectedCalendar.color }}
                  />
                )}
                <FloatingSelect
                  id="event-calendar"
                  label="Calendar"
                  value={form.calendarId}
                  onChange={(e) => setForm((p) => ({ ...p, calendarId: e.target.value }))}
                  className={selectedCalendar ? '!pl-8' : ''}
                >
                  {calendars.map((cal) => (
                    <option key={cal.id} value={cal.id}>{cal.name}</option>
                  ))}
                </FloatingSelect>
              </div>

              {/* All-day toggle */}
              <label htmlFor="allDay" className="flex items-center justify-between cursor-pointer">
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

              {/* Date & Time */}
              <div className="space-y-3">
                {/* Single-day mode */}
                {!showEndDate && (
                  <>
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
                    {!form.isAllDay && (
                      <div className="flex items-center gap-2">
                        <TimePicker
                          value={getTimePart(form.startTime)}
                          onChange={setStartTime}
                        />
                        <span className="text-gray-300 text-sm">&ndash;</span>
                        <TimePicker
                          value={getTimePart(form.endTime)}
                          onChange={setEndTime}
                        />
                      </div>
                    )}
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
                  </>
                )}

                {/* Multi-day mode */}
                {showEndDate && (
                  <>
                    <div className="flex items-center gap-3 flex-wrap">
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
                      {!form.isAllDay && (
                        <TimePicker
                          value={getTimePart(form.startTime)}
                          onChange={setStartTime}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
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
                      {!form.isAllDay && (
                        <TimePicker
                          value={getTimePart(form.endTime)}
                          onChange={setEndTime}
                        />
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Time validation error */}
              {timeError && (
                <p className="text-xs text-red-600">{timeError}</p>
              )}

              {/* Location */}
              <LocationCombobox
                value={form.locationText}
                buildingId={form.buildingId}
                areaId={form.areaId}
                onChange={(locationText, buildingId, areaId) =>
                  setForm((p) => ({ ...p, locationText, buildingId, areaId }))
                }
              />

              {/* Description */}
              <FloatingTextarea
                id="event-description"
                label="Description"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={3}
              />
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
