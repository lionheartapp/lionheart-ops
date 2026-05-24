'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CalendarData, CalendarEventData, CalendarCategoryData } from '@/lib/hooks/useCalendar'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'
import { useActiveSchool } from '@/lib/hooks/useActiveSchool'
import { FloatingInput, FloatingTextarea, FloatingDropdown, type DropdownOption } from '@/components/ui/FloatingInput'
import { Input } from '@/components/ui/Input'
import RecurrenceBuilder from './RecurrenceBuilder'
import AttendeePicker, { type AttendeeSelection } from './AttendeePicker'
import ExternalConflictDialog, { type ExternalConflict } from './ExternalConflictDialog'
import { fetchApi } from '@/lib/api-client'
import { TimePicker } from './TimePicker'
import { LocationCombobox } from './LocationCombobox'

interface EventCreatePanelProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: EventFormData) => void
  isSubmitting: boolean
  calendars: CalendarData[]
  categories?: CalendarCategoryData[]
  onCreateCategory?: (data: { name: string; color: string }) => Promise<CalendarCategoryData>
  initialStart?: Date
  initialEnd?: Date
  error?: string | null
  event?: CalendarEventData | null
  initialAttendees?: AttendeeSelection[]
  /** Controls copy — 'meeting' swaps "event" language for "meeting" language */
  mode?: 'event' | 'meeting'
}

export interface EventFormData {
  calendarId: string
  categoryId: string
  title: string
  description: string
  startTime: string
  endTime: string
  isAllDay: boolean
  locationText: string
  buildingId: string | null
  areaId: string | null
  rrule: string | null
  attendeeIds?: string[]
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

// ── Main Component ──────────────────────────────────────────────────
const CATEGORY_COLOR_PRESETS = [
  '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#14b8a6',
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#6a6864',
]

const COLOR_NAMES: Record<string, string> = {
  '#ef4444': 'Red',
  '#f97316': 'Orange',
  '#f59e0b': 'Amber',
  '#22c55e': 'Green',
  '#14b8a6': 'Teal',
  '#3b82f6': 'Blue',
  '#6366f1': 'Indigo',
  '#a855f7': 'Purple',
  '#ec4899': 'Pink',
  '#6a6864': 'Slate',
}

export default function EventCreatePanel({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  calendars,
  categories = [],
  onCreateCategory,
  initialStart,
  initialEnd,
  error,
  event,
  initialAttendees,
  mode = 'event',
}: EventCreatePanelProps) {
  const isEditing = !!event
  const isMeeting = mode === 'meeting'
  const { activeSchoolId } = useActiveSchool()
  const focusTrapRef = useFocusTrap(isOpen)

  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const now = new Date()
  const defaultStart = initialStart || new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0)
  const defaultEnd = initialEnd || new Date(defaultStart.getTime() + 60 * 60 * 1000)

  const [form, setForm] = useState<EventFormData>({
    calendarId: calendars[0]?.id || '',
    categoryId: '',
    title: '',
    description: '',
    startTime: toLocalDateTimeString(defaultStart),
    endTime: toLocalDateTimeString(defaultEnd),
    isAllDay: false,
    locationText: '',
    buildingId: null,
    areaId: null,
    rrule: null,
  })

  // Attendee state
  const [attendees, setAttendees] = useState<AttendeeSelection[]>([])

  // Inline category creation state
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#3b82f6')
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const userSelectedCategoryRef = useRef(false)

  // Reset form when panel opens (not on calendar refetch — that would clear user input)
  const calendarIdsKey = calendars.map((c) => c.id).join(',')
  useEffect(() => {
    if (isOpen) {
      setShowNewCategory(false)
      setNewCatName('')
      setNewCatColor('#3b82f6')
      setCategoryError(null)
      userSelectedCategoryRef.current = false
      if (event) {
        setForm({
          calendarId: event.calendarId,
          categoryId: event.categoryId || '',
          title: event.title,
          description: event.description || '',
          startTime: toLocalDateTimeString(new Date(event.startTime)),
          endTime: toLocalDateTimeString(new Date(event.endTime)),
          isAllDay: event.isAllDay,
          locationText: event.locationText || '',
          buildingId: event.building?.id ?? null,
          areaId: event.area?.id ?? null,
          rrule: event.rrule ?? null,
        })
        // Populate attendees from existing event
        setAttendees(
          (event.attendees || []).map((a) => ({
            id: a.user.id,
            firstName: a.user.firstName ?? null,
            lastName: a.user.lastName ?? null,
            email: '',
            avatar: a.user.avatar ?? null,
          }))
        )
      } else {
        const start = initialStart || new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), new Date().getHours() + 1, 0)
        const end = initialEnd || new Date(start.getTime() + 60 * 60 * 1000)
        // Meetings → personal calendar.
        // Events → user's school calendar > org master > first non-personal.
        const personalCalendar = calendars.find((c) => c.calendarType === 'PERSONAL')
        const schoolCalendar = activeSchoolId
          ? calendars.find((c) => c.calendarType !== 'PERSONAL' && (c.campus?.id === activeSchoolId || c.school?.id === activeSchoolId))
          : null
        const defaultCalendar = schoolCalendar ?? calendars.find((c) => c.isDefault) ?? calendars.find((c) => c.calendarType !== 'PERSONAL')
        setForm({
          calendarId: (isMeeting ? personalCalendar?.id : defaultCalendar?.id) ?? calendars[0]?.id ?? '',
          categoryId: '',
          title: '',
          description: '',
          startTime: toLocalDateTimeString(start),
          endTime: toLocalDateTimeString(end),
          isAllDay: false,
          locationText: '',
          buildingId: null,
          areaId: null,
          rrule: null,
        })
        // Pre-populate from initialAttendees (meet-with people)
        setAttendees(initialAttendees || [])
      }
    }
  }, [isOpen, calendarIdsKey, initialStart, initialEnd, event, initialAttendees]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select category when calendar changes: match school name to category name
  useEffect(() => {
    if (event) return // Don't auto-select when editing
    if (userSelectedCategoryRef.current) return // Don't overwrite user's selection
    const selectedCal = calendars.find((c) => c.id === form.calendarId)
    if (selectedCal?.school?.name && categories.length > 0) {
      const matchingCategory = categories.find(
        (cat) => cat.name.toLowerCase() === selectedCal.school!.name.toLowerCase()
      )
      if (matchingCategory) {
        setForm((p) => ({ ...p, categoryId: matchingCategory.id }))
        return
      }
    }
    // Don't clear categoryId if user already picked one
  }, [form.calendarId, calendars, categories, event])

  const [timeError, setTimeError] = useState<string | null>(null)

  // ─── External calendar conflict check ───────────────────────────────
  const [conflictData, setConflictData] = useState<ExternalConflict[]>([])
  const [showConflictDialog, setShowConflictDialog] = useState(false)
  const [pendingSubmitData, setPendingSubmitData] = useState<EventFormData | null>(null)
  const [checkingConflicts, setCheckingConflicts] = useState(false)

  const buildFormData = (): EventFormData | null => {
    if (!form.title.trim() || !form.calendarId) return null
    const start = new Date(form.startTime)
    const end = new Date(form.endTime)
    if (!form.isAllDay && end <= start) {
      setTimeError('End time must be after start time')
      return null
    }
    setTimeError(null)
    return {
      ...form,
      categoryId: form.categoryId || '',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      buildingId: form.buildingId || null,
      areaId: form.areaId || null,
      rrule: form.rrule || null,
      attendeeIds: attendees.length > 0 ? attendees.map((a) => a.id) : undefined,
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const data = buildFormData()
    if (!data) return

    // Check for conflicts with the user's connected external calendars.
    // Skip if this is an edit (the user already accepted the time when creating).
    if (!isEditing) {
      setCheckingConflicts(true)
      try {
        const params = new URLSearchParams({ startsAt: data.startTime, endsAt: data.endTime })
        const result = await fetchApi<{ conflicts: ExternalConflict[] }>(
          `/api/calendar-events/external/conflicts?${params}`
        )
        if (result.conflicts && result.conflicts.length > 0) {
          setConflictData(result.conflicts)
          setPendingSubmitData(data)
          setShowConflictDialog(true)
          setCheckingConflicts(false)
          return // Wait for the user to confirm or cancel
        }
      } catch {
        // Network error or user has no connected calendars — proceed without blocking.
      }
      setCheckingConflicts(false)
    }

    onSubmit(data)
  }

  const handleConflictContinue = () => {
    setShowConflictDialog(false)
    if (pendingSubmitData) {
      onSubmit(pendingSubmitData)
      setPendingSubmitData(null)
    }
  }

  const handleConflictCancel = () => {
    setShowConflictDialog(false)
    setPendingSubmitData(null)
    setConflictData([])
  }

  const selectedCalendar = calendars.find((c) => c.id === form.calendarId)
  const startDate = getDatePart(form.startTime)
  const endDate = getDatePart(form.endTime)
  const showEndDate = endDate !== startDate

  const startDateRef = useRef<HTMLInputElement>(null)
  const endDateRef = useRef<HTMLInputElement>(null)
  const endDateAddRef = useRef<HTMLInputElement>(null)

  // Safe showPicker with fallback for browsers that don't support it
  const safePick = (ref: React.RefObject<HTMLInputElement | null>) => {
    const el = ref.current
    if (!el) return
    if (typeof el.showPicker === 'function') {
      try { el.showPicker() } catch { el.click() }
    } else {
      el.click()
    }
  }

  const setStartTime = useCallback((time: string) => {
    setForm((p) => ({ ...p, startTime: `${getDatePart(p.startTime)}T${time}` }))
  }, [])

  const setEndTime = useCallback((time: string) => {
    setForm((p) => ({ ...p, endTime: `${getDatePart(p.endTime)}T${time}` }))
  }, [])

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          <motion.div
            ref={focusTrapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-panel-title"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:right-4 sm:top-4 sm:bottom-4 sm:max-w-[420px] bg-white shadow-2xl z-50 flex flex-col sm:rounded-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <span id="create-panel-title" className="text-xs text-slate-400 uppercase tracking-wide font-medium">
                {isEditing ? (isMeeting ? 'Edit Meeting' : 'Edit Event') : (isMeeting ? 'Schedule Meeting' : 'Create New Event')}
              </span>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 pt-3 pb-6 space-y-5">
              {/* Title */}
              <FloatingInput
                id="event-title"
                label={isMeeting ? 'Meeting title' : 'Event title'}
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                required
                autoFocus
              />

              {/* Calendar selector — hidden in meeting mode (always personal calendar) */}
              {!isMeeting && (
                <FloatingDropdown
                  id="event-calendar"
                  label="Calendar"
                  value={form.calendarId}
                  onChange={(v) => setForm((p) => ({ ...p, calendarId: v }))}
                  required
                  options={calendars
                    .filter((cal) => cal.calendarType !== 'PERSONAL')
                    .map((cal) => ({
                      value: cal.id,
                      label: cal.name,
                      color: cal.color,
                    }))}
                />
              )}

              {/* Category selector — hidden in meeting mode */}
              {!isMeeting && (categories.length > 0 || onCreateCategory) && (
                <div>
                  {!showNewCategory ? (
                    <FloatingDropdown
                      id="event-category"
                      label="Category"
                      value={form.categoryId}
                      onChange={(v) => {
                        if (v === '__new__') {
                          setShowNewCategory(true)
                        } else {
                          userSelectedCategoryRef.current = true
                          setForm((p) => ({ ...p, categoryId: v }))
                        }
                      }}
                      options={[
                        { value: '', label: 'No category' },
                        ...categories.map((cat) => ({
                          value: cat.id,
                          label: cat.name,
                          color: cat.color,
                        })),
                        ...(onCreateCategory ? [{ value: '__new__', label: '+ New Category' }] : []),
                      ]}
                    />
                  ) : (
                    <div className="space-y-2.5 p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">New Category</span>
                        <button
                          type="button"
                          onClick={() => setShowNewCategory(false)}
                          className="text-xs text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                        >
                          Cancel
                        </button>
                      </div>
                      <Input
                        type="text"
                        placeholder="Category name"
                        aria-label="Category name"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        className="w-full text-sm"
                        autoFocus
                      />
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {CATEGORY_COLOR_PRESETS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setNewCatColor(c)}
                            className="w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary-400"
                            style={{ backgroundColor: c }}
                            aria-label={COLOR_NAMES[c] || c}
                          >
                            {newCatColor === c && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled={!newCatName.trim() || creatingCategory}
                        onClick={async () => {
                          if (!onCreateCategory || !newCatName.trim()) return
                          setCreatingCategory(true)
                          setCategoryError(null)
                          try {
                            const created = await onCreateCategory({ name: newCatName.trim(), color: newCatColor })
                            setForm((p) => ({ ...p, categoryId: created.id }))
                            userSelectedCategoryRef.current = true
                            setShowNewCategory(false)
                            setNewCatName('')
                            setNewCatColor('#3b82f6')
                          } catch (err) {
                            setCategoryError(err instanceof Error ? err.message : 'Failed to create category')
                          } finally {
                            setCreatingCategory(false)
                          }
                        }}
                        className="w-full py-2 text-xs font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 disabled:opacity-50 transition-colors"
                      >
                        {creatingCategory ? 'Creating...' : 'Create Category'}
                      </button>
                      {categoryError && <p className="text-xs text-red-600">{categoryError}</p>}
                    </div>
                  )}
                </div>
              )}

              {/* All-day toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={form.isAllDay}
                onClick={() => setForm((p) => ({ ...p, isAllDay: !p.isAllDay }))}
                className="flex w-full items-center justify-between cursor-pointer text-left"
              >
                <span className="text-sm text-slate-700">All-day</span>
                <div className="relative">
                  <div className={`w-9 h-5 rounded-full transition-colors ${form.isAllDay ? 'bg-slate-900' : 'bg-slate-200'}`} />
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${form.isAllDay ? 'translate-x-4' : ''}`} />
                </div>
              </button>

              {/* Date & Time */}
              <div className="space-y-3">
                {/* Single-day mode */}
                {!showEndDate && (
                  <>
                    <div className="inline-block">
                      <button
                        type="button"
                        onClick={() => safePick(startDateRef)}
                        className="text-sm text-slate-900 cursor-pointer hover:text-slate-600 bg-transparent border-0 p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                      >
                        {formatDateDisplay(startDate)}
                      </button>
                      <Input
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
                        <span className="text-slate-300 text-sm">&ndash;</span>
                        <TimePicker
                          value={getTimePart(form.endTime)}
                          onChange={setEndTime}
                        />
                      </div>
                    )}
                    <div className="inline-block">
                      <button
                        type="button"
                        onClick={() => safePick(endDateAddRef)}
                        className="text-xs text-slate-400 cursor-pointer hover:text-slate-500 bg-transparent border-0 p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                      >
                        + end date
                      </button>
                      <Input
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
                        onClick={() => safePick(startDateRef)}
                        className="text-sm text-slate-900 cursor-pointer hover:text-slate-600 bg-transparent border-0 p-0"
                      >
                        {formatDateDisplay(startDate)}
                      </button>
                      <Input
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
                        onClick={() => safePick(endDateRef)}
                        className="text-sm text-slate-500 cursor-pointer hover:text-slate-700 bg-transparent border-0 p-0"
                      >
                        to {formatDateDisplay(endDate)}
                      </button>
                      <Input
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

              {/* Recurrence */}
              <RecurrenceBuilder
                value={form.rrule}
                onChange={(rrule) => setForm((p) => ({ ...p, rrule }))}
                eventStartDate={getDatePart(form.startTime)}
              />

              {/* Location */}
              <LocationCombobox
                value={form.locationText}
                buildingId={form.buildingId}
                areaId={form.areaId}
                onChange={(locationText, buildingId, areaId) =>
                  setForm((p) => ({ ...p, locationText, buildingId, areaId }))
                }
              />

              {/* Attendees — dropdown variant in meeting mode */}
              <AttendeePicker
                value={attendees}
                onChange={setAttendees}
                variant={isMeeting ? 'dropdown' : 'search'}
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
                disabled={isSubmitting || checkingConflicts || !form.title.trim() || !form.calendarId}
                className="w-full py-3.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {(isSubmitting || checkingConflicts) && <Loader2 className="w-4 h-4 animate-spin" />}
                {checkingConflicts ? 'Checking conflicts…' : isEditing ? 'Save Changes' : (isMeeting ? 'Schedule Meeting' : 'Create Event')}
              </button>
              {!form.calendarId && form.title.trim() && (
                <p className="text-xs text-amber-600 text-center">Please select a calendar</p>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors py-1"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>

    <ExternalConflictDialog
      isOpen={showConflictDialog}
      conflicts={conflictData}
      onCancel={handleConflictCancel}
      onContinue={handleConflictContinue}
      proposedTitle={form.title.trim()}
    />
    </>
  )
}
