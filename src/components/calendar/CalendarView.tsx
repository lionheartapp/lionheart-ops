'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import {
  useCalendars,
  useCalendarEvents,
  useCalendarNavigation,
  useCreateCalendar,
  useUpdateCalendar,
  useDeleteCalendar,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  useCategories,
  useCreateCategory,
  useRsvp,
  type CalendarEventData,
} from '@/lib/hooks/useCalendar'
import CalendarToolbar from './CalendarToolbar'
import MonthView from './MonthView'
import WeekView from './WeekView'
import DayView from './DayView'
import AgendaView from './AgendaView'
import MobileMonthView from './MobileMonthView'
import EventDetailPanel from './EventDetailPanel'
import EventCreatePanel, { type EventFormData } from './EventCreatePanel'
import PlanEventDrawer from './PlanEventDrawer'
import type { AttendeeSelection } from './AttendeePicker'
import ConfirmDialog from '@/components/ConfirmDialog'
import RecurringEditDialog, { type RecurringEditMode } from './RecurringEditDialog'
import CancellationNotifyDialog from './CancellationNotifyDialog'
import NotifyAttendeesDialog from './NotifyAttendeesDialog'
import LocationConflictDialog from './LocationConflictDialog'
import { buildCampusShapeMap } from './CampusShapeIndicator'
import { useAthleticsCalendarEvents, useAthleticsSports } from '@/lib/hooks/useAthleticsCalendar'
import { useModules } from '@/lib/hooks/useModuleEnabled'
import { type CalendarFilter } from './CalendarFilterPopover'
import { useCalendarPrefetch } from '@/lib/hooks/useCalendarPrefetch'
import { FloatingInput, FloatingDropdown } from '@/components/ui/FloatingInput'
import { Calendar as CalendarIcon, Loader2, Check, X, Download, Users, CalendarDays } from 'lucide-react'
import { IllustrationCalendar } from '@/components/illustrations'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import { useDragReschedule } from '@/lib/hooks/useDragReschedule'
import { useUserSchedule, type MeetWithPerson } from '@/lib/hooks/useMeetWith'

const COLOR_PRESETS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Slate', value: '#64748b' },
]

export default function CalendarView() {
  const {
    currentDate,
    setCurrentDate,
    view,
    changeView,
    goToToday,
    goNext,
    goPrev,
    getDateRange,
  } = useCalendarNavigation()

  // Plan Event stepper state
  const [planEventOpen, setPlanEventOpen] = useState(false)
  const [planEventInitialStart, setPlanEventInitialStart] = useState<Date | undefined>()
  const [planEventInitialEnd, setPlanEventInitialEnd] = useState<Date | undefined>()

  // Open the Plan Event stepper (from toolbar or choice modal)
  const handlePlanEvent = useCallback(() => {
    setPlanEventInitialStart(undefined)
    setPlanEventInitialEnd(undefined)
    setPlanEventOpen(true)
  }, [])

  // Choice modal — shown when user clicks an empty calendar slot
  const [choiceModalOpen, setChoiceModalOpen] = useState(false)
  const [choiceModalStart, setChoiceModalStart] = useState<Date | undefined>()
  const [choiceModalEnd, setChoiceModalEnd] = useState<Date | undefined>()

  const openChoiceModal = useCallback((start?: Date, end?: Date) => {
    setChoiceModalStart(start)
    setChoiceModalEnd(end)
    setChoiceModalOpen(true)
  }, [])

  const handleChoiceMeeting = useCallback(() => {
    setChoiceModalOpen(false)
    setCreateMode('meeting')
    setCreateInitialStart(choiceModalStart)
    setCreateInitialEnd(choiceModalEnd)
    setIsCreateOpen(true)
  }, [choiceModalStart, choiceModalEnd])

  const handleChoicePlanEvent = useCallback(() => {
    setChoiceModalOpen(false)
    setPlanEventInitialStart(choiceModalStart)
    setPlanEventInitialEnd(choiceModalEnd)
    setPlanEventOpen(true)
  }, [choiceModalStart, choiceModalEnd])

  // Detect mobile for auto-switching month → agenda
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const queryClient = useQueryClient()
  const { data: calendars = [], isLoading: calendarsLoading } = useCalendars()

  // Track visible calendars
  const [visibleCalendarIds, setVisibleCalendarIds] = useState<Set<string>>(new Set())

  // Initialize visible calendars when they load, and auto-add new calendars
  useEffect(() => {
    if (calendars.length > 0) {
      setVisibleCalendarIds((prev) => {
        if (prev.size === 0) {
          // First load — show all active calendars
          return new Set(calendars.filter((c) => c.isActive).map((c) => c.id))
        }
        // Subsequent loads — add any new calendar IDs that weren't in the set before
        const knownIds = new Set([...prev, ...calendars.filter((c) => !c.isActive).map((c) => c.id)])
        const newIds = calendars.filter((c) => c.isActive && !knownIds.has(c.id)).map((c) => c.id)
        if (newIds.length === 0) return prev
        const next = new Set(prev)
        newIds.forEach((id) => next.add(id))
        return next
      })
    }
  }, [calendars]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCalendar = useCallback((calendarId: string) => {
    setVisibleCalendarIds((prev) => {
      const next = new Set(prev)
      if (next.has(calendarId)) next.delete(calendarId)
      else next.add(calendarId)
      return next
    })
  }, [])

  // Category hooks
  const { data: categories = [] } = useCategories()
  const createCategory = useCreateCategory()

  // Campus → shape index map (deterministic: sorted campus IDs → shape indices)
  const campusShapeMap = useMemo(() => buildCampusShapeMap(calendars), [calendars])

  // Mutation hooks (declared before useEffect that references them)
  const createCalendar = useCreateCalendar()
  const updateCalendar = useUpdateCalendar()
  const deleteCalendarMutation = useDeleteCalendar()
  const createEvent = useCreateEvent()
  const updateEvent = useUpdateEvent()
  const deleteEvent = useDeleteEvent()

  // Sync calendar data to the Sidebar via CustomEvent
  useEffect(() => {
    if (calendars.length > 0) {
      window.dispatchEvent(
        new CustomEvent('calendar-sidebar-data', {
          detail: {
            calendars: calendars.map((c) => ({
              id: c.id,
              name: c.name,
              color: c.color,
              calendarType: c.calendarType,
              isActive: c.isActive,
              createdById: c.createdById ?? null,
              campus: c.campus ?? null,
            })),
            visibleIds: Array.from(visibleCalendarIds),
          },
        })
      )
    }
  }, [calendars, visibleCalendarIds])

  // Listen for toggle/update/delete events from the Sidebar
  useEffect(() => {
    const handleToggle = (e: Event) => {
      const event = e as CustomEvent<{ calendarId: string }>
      if (event.detail?.calendarId) {
        toggleCalendar(event.detail.calendarId)
      }
    }
    const handleCreateRequest = () => {
      setShowCreateCalendar(true)
    }
    const handleCalendarUpdate = (e: Event) => {
      const event = e as CustomEvent<{ calendarId: string; data: Record<string, unknown> }>
      if (event.detail?.calendarId) {
        updateCalendar.mutate({ id: event.detail.calendarId, ...event.detail.data })
      }
    }
    const handleCalendarDelete = (e: Event) => {
      const event = e as CustomEvent<{ calendarId: string }>
      if (event.detail?.calendarId) {
        deleteCalendarMutation.mutate(event.detail.calendarId)
      }
    }
    window.addEventListener('calendar-toggle', handleToggle)
    window.addEventListener('calendar-create-request', handleCreateRequest)
    window.addEventListener('calendar-update', handleCalendarUpdate)
    window.addEventListener('calendar-delete', handleCalendarDelete)
    return () => {
      window.removeEventListener('calendar-toggle', handleToggle)
      window.removeEventListener('calendar-create-request', handleCreateRequest)
      window.removeEventListener('calendar-update', handleCalendarUpdate)
      window.removeEventListener('calendar-delete', handleCalendarDelete)
    }
  }, [toggleCalendar, updateCalendar, deleteCalendarMutation])

  // Fetch ALL events for the date range (API returns all active calendars when no IDs given)
  // then filter client-side by visible calendars — avoids waterfall waiting for calendars to load
  const { start, end } = getDateRange()
  const { data: allEvents = [], isLoading: eventsLoading, isFetching: eventsFetching } = useCalendarEvents(
    [],
    start,
    end,
    true
  )
  const activeCalendarIds = Array.from(visibleCalendarIds)
  const events = activeCalendarIds.length > 0
    ? allEvents.filter((e) => activeCalendarIds.includes(e.calendarId))
    : []

  // ── Athletics calendar overlay ──────────────────────────────────────
  const [visibleAthleticsCampusIds, setVisibleAthleticsCampusIds] = useState<Set<string>>(new Set())
  const [calendarFilter, setCalendarFilter] = useState<CalendarFilter>({
    categoryIds: new Set(),
    campusIds: new Set(),
    schoolLevels: new Set(),
    sportIds: new Set(),
    teamLevels: new Set(),
  })

  // Listen for athletics-calendar-toggle from Sidebar
  useEffect(() => {
    const handleToggle = (e: Event) => {
      const event = e as CustomEvent<{ campusId: string; visible: boolean }>
      if (event.detail?.campusId) {
        setVisibleAthleticsCampusIds((prev) => {
          const next = new Set(prev)
          if (event.detail.visible) next.add(event.detail.campusId)
          else next.delete(event.detail.campusId)
          return next
        })
      }
    }
    window.addEventListener('athletics-calendar-toggle', handleToggle)
    return () => window.removeEventListener('athletics-calendar-toggle', handleToggle)
  }, [])

  const athleticsCampusArray = useMemo(() => Array.from(visibleAthleticsCampusIds), [visibleAthleticsCampusIds])
  const anyAthleticsVisible = athleticsCampusArray.length > 0

  const { data: athleticsEvents = [] } = useAthleticsCalendarEvents(
    athleticsCampusArray,
    start.toISOString(),
    end.toISOString(),
    anyAthleticsVisible,
  )
  const { data: athleticsSports = [] } = useAthleticsSports(anyAthleticsVisible)

  // Build unique campus list from calendars that have campus info
  const athleticsCampuses = useMemo(() => {
    if (!anyAthleticsVisible) return []
    const seen = new Map<string, string>()
    for (const cal of calendars) {
      const campus = cal.campus as { id: string; name: string } | null | undefined
      if (campus && visibleAthleticsCampusIds.has(campus.id) && !seen.has(campus.id)) {
        seen.set(campus.id, campus.name)
      }
    }
    return Array.from(seen, ([id, name]) => ({ id, name }))
  }, [calendars, visibleAthleticsCampusIds, anyAthleticsVisible])

  // Apply athletics filters
  const filteredAthleticsEvents = useMemo(() => {
    if (!anyAthleticsVisible) return []
    let result = athleticsEvents
    const { campusIds, schoolLevels, sportIds, teamLevels } = calendarFilter
    if (campusIds.size > 0) {
      result = result.filter((e) => {
        const meta = e.metadata as any
        return meta?.campusId && campusIds.has(meta.campusId)
      })
    }
    if (schoolLevels.size > 0) {
      result = result.filter((e) => {
        const meta = e.metadata as any
        // Map gradeLevel values to display labels
        const level = meta?.schoolLevel || meta?.teamLevel
        return level && schoolLevels.has(level)
      })
    }
    if (sportIds.size > 0) {
      result = result.filter((e) => {
        const meta = e.metadata as any
        return meta?.sportId && sportIds.has(meta.sportId)
      })
    }
    if (teamLevels.size > 0) {
      result = result.filter((e) => {
        const meta = e.metadata as any
        return meta?.teamLevel && teamLevels.has(meta.teamLevel)
      })
    }
    return result
  }, [athleticsEvents, calendarFilter, anyAthleticsVisible])

  // Search filter state
  const [searchQuery, setSearchQuery] = useState('')

  const filteredEvents = useMemo(() => {
    let result = events
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((e) => e.title.toLowerCase().includes(q))
    }
    if (calendarFilter.categoryIds.size > 0) {
      result = result.filter((e) => e.categoryId && calendarFilter.categoryIds.has(e.categoryId))
    }
    // Merge athletics events (already filtered by athletics filter)
    if (filteredAthleticsEvents.length > 0) {
      // Apply search filter to athletics events too
      let athEvents = filteredAthleticsEvents
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        athEvents = athEvents.filter((e) => e.title.toLowerCase().includes(q))
      }
      result = [...result, ...athEvents]
    }
    return result
  }, [events, searchQuery, calendarFilter.categoryIds, filteredAthleticsEvents])

  // Meet-with state
  const [meetWithPeople, setMeetWithPeople] = useState<MeetWithPerson[]>([])

  // Listen for meet-with-change events from Sidebar
  useEffect(() => {
    const handleMeetWithChange = (e: Event) => {
      const event = e as CustomEvent<{ people: MeetWithPerson[] }>
      if (event.detail?.people) {
        setMeetWithPeople(event.detail.people)
      }
    }
    window.addEventListener('meet-with-change', handleMeetWithChange)
    return () => window.removeEventListener('meet-with-change', handleMeetWithChange)
  }, [])

  // Fetch schedules for all meet-with people
  const schedule0 = useUserSchedule(meetWithPeople[0]?.id ?? null, start, end)
  const schedule1 = useUserSchedule(meetWithPeople[1]?.id ?? null, start, end)
  const schedule2 = useUserSchedule(meetWithPeople[2]?.id ?? null, start, end)
  const schedule3 = useUserSchedule(meetWithPeople[3]?.id ?? null, start, end)
  const schedule4 = useUserSchedule(meetWithPeople[4]?.id ?? null, start, end)

  const meetWithEvents = useMemo(() => {
    const map = new Map<string, CalendarEventData[]>()
    const schedules = [schedule0, schedule1, schedule2, schedule3, schedule4]
    meetWithPeople.forEach((person, i) => {
      if (schedules[i]?.data) {
        map.set(person.id, schedules[i].data!)
      }
    })
    return map
  }, [meetWithPeople, schedule0.data, schedule1.data, schedule2.data, schedule3.data, schedule4.data])

  // Event interaction state
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventData | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createMode, setCreateMode] = useState<'event' | 'meeting'>('event')
  const [createInitialStart, setCreateInitialStart] = useState<Date | undefined>()
  const [createInitialEnd, setCreateInitialEnd] = useState<Date | undefined>()

  // Edit event state
  const [editingEvent, setEditingEvent] = useState<CalendarEventData | null>(null)

  // Compute initial attendees from meet-with people for the create panel
  const meetWithAttendees: AttendeeSelection[] = useMemo(() => {
    return meetWithPeople.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      avatar: p.avatar,
    }))
  }, [meetWithPeople])

  // Search params for deep-linking (create, RSVP)
  const searchParams = useSearchParams()

  // Handle ?rsvp= query param from email links
  const rsvpParam = searchParams.get('rsvp')
  const eventIdParam = searchParams.get('eventId')
  const rsvpAutoMutation = useRsvp()
  const [rsvpAutoTriggered, setRsvpAutoTriggered] = useState(false)

  // Auto-open create panel when navigated with ?create=true
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setCreateMode('meeting')
      setIsCreateOpen(true)
      window.history.replaceState({}, '', '/calendar')
    }
  }, [searchParams])

  // Auto-RSVP from email link (?eventId=X&rsvp=accept|maybe|decline)
  useEffect(() => {
    if (!eventIdParam || !rsvpParam || rsvpAutoTriggered) return
    const targetEvent = allEvents.find(e => e.id === eventIdParam)
    if (targetEvent) {
      setSelectedEvent(targetEvent)
      if (rsvpParam === 'accept') {
        setRsvpAutoTriggered(true)
        rsvpAutoMutation.mutate({ eventId: eventIdParam, status: 'ACCEPTED' })
      }
      // For maybe/decline, the EventDetailPanel's RSVP dialog handles it
      // We just need to open the panel - the user clicks the button from there
      setRsvpAutoTriggered(true)
    }
  }, [eventIdParam, rsvpParam, allEvents, rsvpAutoTriggered]) // eslint-disable-line react-hooks/exhaustive-deps

  // Quick-create calendar state
  const [showCreateCalendar, setShowCreateCalendar] = useState(false)
  const [newCalendarName, setNewCalendarName] = useState('')
  const [newCalendarType, setNewCalendarType] = useState('GENERAL')
  const [newCalendarColor, setNewCalendarColor] = useState('#3b82f6')

  const handleCreateCalendar = async () => {
    if (!newCalendarName.trim()) return
    const slug = newCalendarName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    await createCalendar.mutateAsync({
      name: newCalendarName.trim(),
      slug,
      calendarType: newCalendarType,
      color: newCalendarColor,
    })
    setNewCalendarName('')
    setNewCalendarColor('#3b82f6')
    setShowCreateCalendar(false)
  }

  const handleEventClick = useCallback((event: CalendarEventData) => {
    setSelectedEvent(event)
  }, [])

  const handleDateClick = useCallback((date: Date) => {
    if (view === 'month') {
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), new Date().getHours() + 1, 0)
      const end = new Date(start.getTime() + 60 * 60 * 1000)
      openChoiceModal(start, end)
    }
  }, [view, openChoiceModal])

  const handleSlotClick = useCallback((slotStart: Date, slotEnd: Date) => {
    openChoiceModal(slotStart, slotEnd)
  }, [openChoiceModal])

  const handleCreateEvent = useCallback(() => {
    setCreateMode('meeting')
    setCreateInitialStart(undefined)
    setCreateInitialEnd(undefined)
    setIsCreateOpen(true)
  }, [])

  const [formError, setFormError] = useState<string | null>(null)

  // Location conflict override flow
  const [conflictWarning, setConflictWarning] = useState<{
    conflictingEventTitle: string
    conflictingStart: string
    conflictingEnd: string
    bufferMinutes: number
    location: string
  } | null>(null)
  const [pendingConflictPayload, setPendingConflictPayload] = useState<{
    type: 'create' | 'update'
    payload: Record<string, unknown>
  } | null>(null)

  const handleSubmitEvent = useCallback(async (data: EventFormData) => {
    setFormError(null)
    try {
      const { categoryId, rrule, buildingId, areaId, attendeeIds, ...rest } = data
      const payload: Record<string, unknown> = {
        ...rest,
        ...(categoryId ? { categoryId } : {}),
        ...(rrule ? { rrule } : {}),
        ...(buildingId ? { buildingId } : {}),
        ...(areaId ? { areaId } : {}),
        ...(attendeeIds && attendeeIds.length > 0 ? { attendeeIds } : {}),
      }
      await createEvent.mutateAsync(payload)
      setIsCreateOpen(false)
    } catch (err: unknown) {
      const apiErr = err as Error & { code?: string; details?: Record<string, unknown> }
      if (apiErr.code === 'LOCATION_CONFLICT' && apiErr.details) {
        setConflictWarning(apiErr.details as typeof conflictWarning)
        const { categoryId, rrule, buildingId, areaId, attendeeIds, ...rest } = data
        setPendingConflictPayload({
          type: 'create',
          payload: {
            ...rest,
            ...(categoryId ? { categoryId } : {}),
            ...(rrule ? { rrule } : {}),
            ...(buildingId ? { buildingId } : {}),
            ...(areaId ? { areaId } : {}),
            ...(attendeeIds && attendeeIds.length > 0 ? { attendeeIds } : {}),
          },
        })
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to create event'
      setFormError(message)
      console.error('Event creation failed:', err)
    }
  }, [createEvent])

  const handleUpdateEvent = useCallback(async (data: EventFormData) => {
    if (!editingEvent) return
    setFormError(null)
    try {
      const { categoryId, calendarId, rrule, buildingId, areaId, ...rest } = data
      const payload: Record<string, unknown> = {
        id: editingEvent.id,
        ...rest,
        ...(categoryId ? { categoryId } : {}),
        ...(rrule ? { rrule } : {}),
        ...(buildingId ? { buildingId } : {}),
        ...(areaId ? { areaId } : {}),
      }
      await updateEvent.mutateAsync(payload as { id: string } & Record<string, unknown>)
      setIsCreateOpen(false)
      setEditingEvent(null)
    } catch (err: unknown) {
      const apiErr = err as Error & { code?: string; details?: Record<string, unknown> }
      if (apiErr.code === 'LOCATION_CONFLICT' && apiErr.details) {
        setConflictWarning(apiErr.details as typeof conflictWarning)
        const { categoryId, calendarId, rrule, buildingId, areaId, ...rest } = data
        setPendingConflictPayload({
          type: 'update',
          payload: {
            id: editingEvent.id,
            ...rest,
            ...(categoryId ? { categoryId } : {}),
            ...(rrule ? { rrule } : {}),
            ...(buildingId ? { buildingId } : {}),
            ...(areaId ? { areaId } : {}),
          },
        })
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to update event'
      setFormError(message)
      console.error('Event update failed:', err)
    }
  }, [updateEvent, editingEvent])

  const handleOverrideConflict = useCallback(async () => {
    if (!pendingConflictPayload) return
    setConflictWarning(null)
    try {
      if (pendingConflictPayload.type === 'create') {
        await createEvent.mutateAsync({ ...pendingConflictPayload.payload, skipConflictCheck: true })
      } else {
        await updateEvent.mutateAsync({ ...pendingConflictPayload.payload, skipConflictCheck: true } as unknown as { id: string } & Record<string, unknown>)
      }
      setIsCreateOpen(false)
      setEditingEvent(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save event'
      setFormError(message)
    }
    setPendingConflictPayload(null)
  }, [pendingConflictPayload, createEvent, updateEvent])

  const handleCancelConflict = useCallback(() => {
    setConflictWarning(null)
    setPendingConflictPayload(null)
  }, [])

  // Delete flow state — multi-step for recurring events
  const [pendingDelete, setPendingDelete] = useState<CalendarEventData | null>(null)
  const [deleteRecurringMode, setDeleteRecurringMode] = useState<RecurringEditMode | null>(null)
  const [showCancellationNotify, setShowCancellationNotify] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDeleteEvent = useCallback((event: CalendarEventData) => {
    setPendingDelete(event)
    setDeleteRecurringMode(null)
    setDeleteError(null)
  }, [])

  // Drag-and-drop reschedule + resize
  const { reschedule } = useDragReschedule()

  // Multi-step modal flow state
  const [pendingChange, setPendingChange] = useState<{
    event: CalendarEventData
    newStart: string
    newEnd: string
    type: 'drag' | 'resize'
  } | null>(null)
  const [recurringMode, setRecurringMode] = useState<RecurringEditMode | null>(null)
  const [showNotifyDialog, setShowNotifyDialog] = useState(false)
  const [pendingEditMode, setPendingEditMode] = useState<RecurringEditMode>('all')
  const isRecurring = (event: CalendarEventData) => !!(event.rrule || event.parentEventId)

  // Execute the pending change (called after notify dialog)
  const executePendingChange = useCallback((notify: boolean) => {
    if (!pendingChange) return
    reschedule({
      event: pendingChange.event,
      newStartTime: pendingChange.newStart,
      newEndTime: pendingChange.newEnd,
      editMode: pendingEditMode,
      notify,
    })
    setPendingChange(null)
    setPendingEditMode('all')
    setShowNotifyDialog(false)
  }, [pendingChange, pendingEditMode, reschedule])

  const handleDragReschedule = useCallback((event: CalendarEventData, deltaMinutes: number, deltaDays: number) => {
    const start = new Date(event.startTime)
    const end = new Date(event.endTime)
    const newStart = new Date(start.getTime() + deltaMinutes * 60_000 + deltaDays * 86_400_000)
    const newEnd = new Date(end.getTime() + deltaMinutes * 60_000 + deltaDays * 86_400_000)

    const change = {
      event,
      newStart: newStart.toISOString(),
      newEnd: newEnd.toISOString(),
      type: 'drag' as const,
    }
    setPendingChange(change)
    // Recurring → RecurringEditDialog first, then notify dialog
    // Non-recurring → show notify dialog directly
    if (!isRecurring(event)) {
      setPendingEditMode('all')
      setShowNotifyDialog(true)
    }
  }, [])

  const handleResize = useCallback((event: CalendarEventData, deltaMinutes: number) => {
    const newEnd = new Date(new Date(event.endTime).getTime() + deltaMinutes * 60_000)

    const change = {
      event,
      newStart: event.startTime,
      newEnd: newEnd.toISOString(),
      type: 'resize' as const,
    }
    setPendingChange(change)
    // Recurring → RecurringEditDialog first, then notify dialog
    // Non-recurring → show notify dialog directly
    if (!isRecurring(event)) {
      setPendingEditMode('all')
      setShowNotifyDialog(true)
    }
  }, [])

  // Called after recurring dialog confirms a mode — show notify dialog next
  const handleRecurringConfirm = useCallback((mode: RecurringEditMode) => {
    setPendingEditMode(mode)
    setRecurringMode(null)
    setShowNotifyDialog(true)
  }, [])

  const cancelPendingChange = useCallback(() => {
    setPendingChange(null)
    setRecurringMode(null)
    setPendingEditMode('all')
    setShowNotifyDialog(false)
  }, [])

  // Called when RecurringEditDialog picks a mode for delete
  const handleDeleteRecurringConfirm = useCallback((mode: RecurringEditMode) => {
    setDeleteRecurringMode(mode)
  }, [])

  const confirmDeleteEvent = useCallback(async () => {
    if (!pendingDelete) return
    try {
      setDeleteError(null)
      const editMode = isRecurring(pendingDelete) ? (deleteRecurringMode || 'all') : 'all'
      await deleteEvent.mutateAsync({ id: pendingDelete.id, editMode })
      setSelectedEvent(null)
      setPendingDelete(null)
      setDeleteRecurringMode(null)
      setShowCancellationNotify(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete event'
      console.error('Delete event failed:', msg)

      // Ghost event — already deleted or doesn't exist. Refresh the calendar.
      if (msg.toLowerCase().includes('not found')) {
        queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
        setSelectedEvent(null)
        setPendingDelete(null)
        setDeleteRecurringMode(null)
        return
      }

      setDeleteError(msg)
    }
  }, [deleteEvent, pendingDelete, deleteRecurringMode, queryClient])

  const cancelPendingDelete = useCallback(() => {
    setPendingDelete(null)
    setDeleteRecurringMode(null)
    setDeleteError(null)
  }, [])

  // Prefetch adjacent time ranges for instant navigation
  useCalendarPrefetch(currentDate, view, !calendarsLoading, athleticsCampusArray)

  // Keyboard navigation: T=Today, M=Month, W=Week, D=Day, A=Agenda, N=New event
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs, textareas, or contenteditable
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      // Don't trigger with modifier keys (except shift)
      if (e.ctrlKey || e.metaKey || e.altKey) return

      switch (e.key.toLowerCase()) {
        case 't':
          goToToday()
          break
        case 'm':
          changeView('month')
          break
        case 'w':
          changeView('week')
          break
        case 'd':
          changeView('day')
          break
        case 'a':
          changeView('agenda')
          break
        case 'n':
          handleCreateEvent()
          break
        case 'arrowleft':
          goPrev()
          break
        case 'arrowright':
          goNext()
          break
        default:
          return
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goToToday, changeView, handleCreateEvent, goPrev, goNext])

  // Show skeletons only on cold load (no cached data yet)
  const showSkeletons = eventsLoading && allEvents.length === 0

  // Empty state — no calendars (don't flash while still loading)
  if (!calendarsLoading && calendars.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-center">
        <div>
          <IllustrationCalendar className="w-52 h-44 mx-auto mb-2" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No calendars yet</h2>
          <p className="text-gray-500 mb-6 max-w-sm">
            Create your first calendar to start organizing events for your school.
          </p>
          {!showCreateCalendar ? (
            <button
              onClick={() => setShowCreateCalendar(true)}
              className="px-5 py-2.5 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 transition-colors"
            >
              Create Calendar
            </button>
          ) : (
            <div className="max-w-sm mx-auto space-y-5 text-left">
              <FloatingInput
                id="empty-cal-name"
                label="Calendar name"
                value={newCalendarName}
                onChange={(e) => setNewCalendarName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreateCalendar()}
              />
              <FloatingDropdown
                id="empty-cal-type"
                label="Type"
                value={newCalendarType}
                onChange={(v) => setNewCalendarType(v)}
                options={[
                  { value: 'GENERAL', label: 'General' },
                  { value: 'ACADEMIC', label: 'Academic' },
                  { value: 'STAFF', label: 'Staff' },
                  { value: 'ATHLETICS', label: 'Athletics' },
                  { value: 'PARENT_FACING', label: 'Parent-Facing' },
                  { value: 'TIMETABLE', label: 'Timetable' },
                ]}
              />
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Color</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setNewCalendarColor(c.value)}
                      className="w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-400"
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    >
                      {newCalendarColor === c.value && (
                        <Check className="w-3.5 h-3.5 text-white" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowCreateCalendar(false); setNewCalendarColor('#3b82f6') }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCalendar}
                  disabled={!newCalendarName.trim() || createCalendar.isPending}
                  className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-gray-900 rounded-full hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {createCalendar.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="flex flex-col flex-1 min-h-0 -mx-4 sm:-mx-10 -mt-4 sm:-mt-6 lg:-mt-8">
      {/* Header area — stays fixed, white bg, shadow at bottom edge */}
      <div className="flex-shrink-0 bg-white px-4 sm:px-10 pt-5 sm:pt-6 pb-5 sm:pb-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)] relative z-10">
        <CalendarToolbar
          currentDate={currentDate}
          view={view}
          onViewChange={changeView}
          onNavigateBack={goPrev}
          onNavigateForward={goNext}
          onToday={goToToday}
          onCreateEvent={handleCreateEvent}
          onPlanEvent={handlePlanEvent}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          categories={categories}
          calendarFilter={calendarFilter}
          onCalendarFilterChange={setCalendarFilter}
          athleticsVisible={anyAthleticsVisible}
          campuses={athleticsCampuses}
          sports={athleticsSports}
        />

        {/* Export CSV button */}
        <div className="flex justify-end mt-2">
          <button
            onClick={() => {
              window.open('/api/settings/export/events', '_blank')
            }}
            className="px-4 py-1.5 rounded-full border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 active:scale-[0.97] transition-colors duration-200 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>

      </div>

      {/* Thin shimmer bar for background refetch */}
      {eventsFetching && !eventsLoading && (
        <div className="absolute top-0 inset-x-0 h-0.5 bg-primary-200 overflow-hidden z-20">
          <div className="h-full w-1/3 bg-primary-400 animate-[shimmer_1.5s_infinite]" />
        </div>
      )}

      {/* Screen reader loading announcement */}
      <div className="sr-only" aria-live="polite">{eventsLoading ? 'Loading calendar events' : ''}</div>

      {/* Scrollable view area — white background fills to bottom */}
      <div className="flex-1 min-h-0 flex flex-col bg-white overflow-hidden">
          {view === 'month' && (
            isMobile ? (
              <MobileMonthView
                currentDate={currentDate}
                events={filteredEvents}
                onEventClick={handleEventClick}
                campusShapeMap={campusShapeMap}
                isLoading={showSkeletons}
              />
            ) : (
              <MonthView
                currentDate={currentDate}
                events={filteredEvents}
                onEventClick={handleEventClick}
                onDateClick={handleDateClick}
                campusShapeMap={campusShapeMap}
                meetWithPeople={meetWithPeople}
                meetWithEvents={meetWithEvents}
                isLoading={showSkeletons}
              />
            )
          )}
          {view === 'week' && (
            <WeekView
              currentDate={currentDate}
              events={filteredEvents}
              onEventClick={handleEventClick}
              onSlotClick={handleSlotClick}
              onDragReschedule={handleDragReschedule}
              onResize={handleResize}
              campusShapeMap={campusShapeMap}
              meetWithPeople={meetWithPeople}
              meetWithEvents={meetWithEvents}
              isLoading={showSkeletons}
            />
          )}
          {view === 'day' && (
            <DayView
              currentDate={currentDate}
              events={filteredEvents}
              onEventClick={handleEventClick}
              onSlotClick={handleSlotClick}
              onDragReschedule={handleDragReschedule}
              onResize={handleResize}
              campusShapeMap={campusShapeMap}
              meetWithPeople={meetWithPeople}
              meetWithEvents={meetWithEvents}
              isLoading={showSkeletons}
            />
          )}
          {view === 'agenda' && (
            <AgendaView
              currentDate={currentDate}
              events={filteredEvents}
              onEventClick={handleEventClick}
              campusShapeMap={campusShapeMap}
              isLoading={showSkeletons}
            />
          )}
      </div>

      {/* Panels */}
      <EventDetailPanel
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onEdit={(event) => {
          setSelectedEvent(null)
          setEditingEvent(event)
          setCreateMode('event')
          setFormError(null)
          setIsCreateOpen(true)
        }}
        onDelete={handleDeleteEvent}
      />

      <EventCreatePanel
        isOpen={isCreateOpen}
        mode={editingEvent ? 'event' : createMode}
        onClose={() => { setIsCreateOpen(false); setEditingEvent(null); setFormError(null); setCreateMode('event') }}
        onSubmit={editingEvent ? handleUpdateEvent : handleSubmitEvent}
        isSubmitting={editingEvent ? updateEvent.isPending : createEvent.isPending}
        calendars={calendars}
        categories={categories}
        onCreateCategory={(data) => createCategory.mutateAsync(data)}
        initialStart={createInitialStart}
        initialEnd={createInitialEnd}
        error={formError}
        event={editingEvent}
        initialAttendees={!editingEvent && meetWithPeople.length > 0 ? meetWithAttendees : undefined}
      />

      {/* Create Calendar Drawer */}
      <AnimatePresence>
        {showCreateCalendar && calendars.length > 0 && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40"
              onClick={() => { setShowCreateCalendar(false); setNewCalendarName(''); setNewCalendarColor('#3b82f6') }}
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:right-4 sm:top-4 sm:bottom-4 sm:max-w-[420px] ui-glass-overlay z-50 flex flex-col sm:rounded-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-3">
                <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                  New Calendar
                </span>
                <button
                  onClick={() => { setShowCreateCalendar(false); setNewCalendarName(''); setNewCalendarColor('#3b82f6') }}
                  className="p-2.5 rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 pt-3 pb-6 space-y-5">
                <FloatingInput
                  id="drawer-cal-name"
                  label="Calendar name"
                  value={newCalendarName}
                  onChange={(e) => setNewCalendarName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateCalendar()}
                />
                <FloatingDropdown
                  id="drawer-cal-type"
                  label="Type"
                  value={newCalendarType}
                  onChange={(v) => setNewCalendarType(v)}
                  options={[
                    { value: 'GENERAL', label: 'General' },
                    { value: 'ACADEMIC', label: 'Academic' },
                    { value: 'STAFF', label: 'Staff' },
                    { value: 'ATHLETICS', label: 'Athletics' },
                    { value: 'PARENT_FACING', label: 'Parent-Facing' },
                    { value: 'TIMETABLE', label: 'Timetable' },
                  ]}
                />
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Color</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setNewCalendarColor(c.value)}
                        className="w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-400"
                        style={{ backgroundColor: c.value }}
                        title={c.name}
                      >
                        {newCalendarColor === c.value && (
                          <Check className="w-3.5 h-3.5 text-white" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 pb-6 pt-2 space-y-3">
                <button
                  onClick={handleCreateCalendar}
                  disabled={!newCalendarName.trim() || createCalendar.isPending}
                  className="w-full py-3.5 text-sm font-semibold text-white bg-gray-900 rounded-full hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {createCalendar.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Calendar
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreateCalendar(false); setNewCalendarName(''); setNewCalendarColor('#3b82f6') }}
                  className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors py-1"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Recurring event delete mode dialog — shown first for recurring events */}
      <RecurringEditDialog
        isOpen={!!pendingDelete && isRecurring(pendingDelete) && !deleteRecurringMode}
        onClose={cancelPendingDelete}
        onConfirm={handleDeleteRecurringConfirm}
        title="Delete recurring event"
        confirmLabel="OK"
        variant="danger"
      />

      {/* Delete event confirmation — shown after mode selection (recurring) or immediately (non-recurring) */}
      <ConfirmDialog
        isOpen={!!pendingDelete && (!isRecurring(pendingDelete) || !!deleteRecurringMode)}
        onClose={cancelPendingDelete}
        onConfirm={confirmDeleteEvent}
        title="Delete event"
        message={
          deleteRecurringMode === 'this'
            ? 'This occurrence will be removed. Other instances of this recurring event will not be affected.'
            : deleteRecurringMode === 'thisAndFollowing'
              ? 'This and all following occurrences will be removed. Earlier instances will remain.'
              : 'Are you sure you want to delete this event? This action cannot be undone.'
        }
        confirmText="Delete"
        variant="danger"
        isLoading={deleteEvent.isPending}
        loadingText="Deleting..."
      >
        {deleteError && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {deleteError}
          </div>
        )}
      </ConfirmDialog>

      {/* Cancellation notification dialog — shown after successful delete */}
      <CancellationNotifyDialog
        isOpen={showCancellationNotify}
        onClose={() => setShowCancellationNotify(false)}
      />

      {/* Recurring event edit mode dialog (drag/resize) */}
      <RecurringEditDialog
        isOpen={!!pendingChange && isRecurring(pendingChange.event) && !showNotifyDialog}
        onClose={cancelPendingChange}
        onConfirm={handleRecurringConfirm}
      />

      {/* Notify attendees dialog — shown after drag/resize (and after recurring mode selection) */}
      <NotifyAttendeesDialog
        isOpen={showNotifyDialog && !!pendingChange}
        onClose={cancelPendingChange}
        onSend={() => executePendingChange(true)}
        onDontSend={() => executePendingChange(false)}
      />

      {/* Location conflict warning — shown when event overlaps buffer at same location */}
      <LocationConflictDialog
        isOpen={!!conflictWarning}
        conflict={conflictWarning}
        onClose={handleCancelConflict}
        onOverride={handleOverrideConflict}
      />

      {/* Plan Event multi-step drawer */}
      <PlanEventDrawer
        isOpen={planEventOpen}
        onClose={() => setPlanEventOpen(false)}
        initialStart={planEventInitialStart}
        initialEnd={planEventInitialEnd}
      />

      {/* Create choice modal — shown when user clicks an empty calendar slot */}
      <AnimatePresence>
        {choiceModalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-50"
              onClick={() => setChoiceModalOpen(false)}
            />
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            >
              <div className="bg-white rounded-2xl shadow-2xl border border-gray-200/80 w-80 overflow-hidden pointer-events-auto">
                {/* Header */}
                <div className="px-5 pt-5 pb-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">What are you creating?</h3>
                      {choiceModalStart && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {choiceModalStart.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setChoiceModalOpen(false)}
                      className="p-1.5 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Options */}
                <div className="p-3 space-y-2">
                  <button
                    onClick={handleChoiceMeeting}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Schedule Meeting</p>
                      <p className="text-xs text-gray-500 mt-0.5">Informal — added instantly, no approval</p>
                    </div>
                  </button>

                  <button
                    onClick={handleChoicePlanEvent}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-primary-50 border border-transparent hover:border-primary-100 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-200 transition-colors">
                      <CalendarDays className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Plan Event</p>
                      <p className="text-xs text-gray-500 mt-0.5">Formal — AV, facilities &amp; admin approval</p>
                    </div>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
    </MotionConfig>
  )
}
