'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { logger } from '@/lib/logger'
import { useToast } from '@/components/Toast'
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
  getEventMetadata,
  type CalendarEventData,
  type EventMetadata,
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
import { CreateEventProjectModal } from '@/components/events/CreateEventProjectModal'
import { EventSeriesDrawer } from '@/components/events/EventSeriesDrawer'
import { TemplateListDrawer } from '@/components/events/templates/TemplateListDrawer'
import { CreateFromTemplateWizard } from '@/components/events/templates/CreateFromTemplateWizard'
import type { AttendeeSelection } from './AttendeePicker'
import ConfirmDialog from '@/components/ConfirmDialog'
import RecurringEditDialog, { type RecurringEditMode } from './RecurringEditDialog'
import CancellationNotifyDialog from './CancellationNotifyDialog'
import NotifyAttendeesDialog from './NotifyAttendeesDialog'
import LocationConflictDialog from './LocationConflictDialog'
import { buildCampusShapeMap } from './CampusShapeIndicator'
import { useAthleticsCalendarEvents, useAthleticsSports } from '@/lib/hooks/useAthleticsCalendar'
import { useModules } from '@/lib/hooks/useModuleEnabled'
import { useQuery } from '@tanstack/react-query'
// queryOptions removed — userCampuses uses inline fetch
import { type CalendarFilter } from './CalendarFilterPopover'
import { useCalendarPrefetch } from '@/lib/hooks/useCalendarPrefetch'
import { Download } from 'lucide-react'
import { MotionConfig } from 'framer-motion'
import { useDragReschedule } from '@/lib/hooks/useDragReschedule'
import { useUserSchedule, type MeetWithPerson } from '@/lib/hooks/useMeetWith'
import CreateCalendarDrawer from './CreateCalendarDrawer'
import SlotChoiceModal from './SlotChoiceModal'
import EmptyCalendarState from './EmptyCalendarState'

export default function CalendarView() {
  const { toast } = useToast()
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

  // Plan Event stepper state (legacy — kept for slot-click choice modal)
  const [planEventOpen, setPlanEventOpen] = useState(false)
  const [planEventInitialStart, setPlanEventInitialStart] = useState<Date | undefined>()
  const [planEventInitialEnd, setPlanEventInitialEnd] = useState<Date | undefined>()

  // Unified event creation drawers (matches Events Hub)
  const [singleEventOpen, setSingleEventOpen] = useState(false)
  const [multiDayEventOpen, setMultiDayEventOpen] = useState(false)
  const [recurringEventOpen, setRecurringEventOpen] = useState(false)
  const [templateDrawerOpen, setTemplateDrawerOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

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

  // Pass calendar IDs to the API when available (avoids server-side getCalendars waterfall).
  // While calendars are still loading, pass [] so the API fetches all active calendars.
  const { start, end } = getDateRange()
  const allCalendarIds = calendars.length > 0 ? calendars.filter((c) => c.isActive).map((c) => c.id) : []
  const { data: allEvents = [], isLoading: eventsLoading, isFetching: eventsFetching } = useCalendarEvents(
    allCalendarIds,
    start,
    end,
    true
  )
  const activeCalendarIds = Array.from(visibleCalendarIds)
  const events = activeCalendarIds.length > 0
    ? allEvents.filter((e) => activeCalendarIds.includes(e.calendarId))
    : []

  // ── Athletics calendar overlay ──────────────────────────────────────
  // Fetch user's assigned campuses (scoped — falls back to all for admins)
  const { data: userCampuses = [] } = useQuery<Array<{ id: string; name: string; isPrimary: boolean }>>({
    queryKey: ['my-campuses'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me/campuses', { credentials: 'include' })
      const json = await res.json()
      return json.ok ? json.data : []
    },
    staleTime: 5 * 60_000,
  })

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
        const meta: EventMetadata | null = getEventMetadata(e)
        return meta?.campusId && campusIds.has(meta.campusId)
      })
    }
    if (schoolLevels.size > 0) {
      result = result.filter((e) => {
        const meta: EventMetadata | null = getEventMetadata(e)
        // Map gradeLevel values to display labels
        const level = meta?.schoolLevel || meta?.teamLevel
        return level && schoolLevels.has(level)
      })
    }
    if (sportIds.size > 0) {
      result = result.filter((e) => {
        const meta: EventMetadata | null = getEventMetadata(e)
        return meta?.sportId && sportIds.has(meta.sportId)
      })
    }
    if (teamLevels.size > 0) {
      result = result.filter((e) => {
        const meta: EventMetadata | null = getEventMetadata(e)
        return meta?.teamLevel && teamLevels.has(meta.teamLevel)
      })
    }
    return result
  }, [athleticsEvents, calendarFilter, anyAthleticsVisible])

  // Search filter state
  const [searchQuery, setSearchQuery] = useState('')

  const filteredEvents = useMemo(() => {
    let result = events
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      result = result.filter((e) => e.title.toLowerCase().includes(q))
    }

    // Filter regular events by category
    if (calendarFilter.categoryIds.size > 0) {
      result = result.filter((e) => e.categoryId && calendarFilter.categoryIds.has(e.categoryId))
    }

    // Merge athletics events (controlled by visibleAthleticsCampusIds via Filters popover)
    if (filteredAthleticsEvents.length > 0) {
      let athEvents = filteredAthleticsEvents
      if (q) {
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
      toast('Event created successfully', 'success')
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
      logger.error({ error: String(err) }, 'Event creation failed')
    }
  }, [createEvent, toast])

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
      toast('Event updated successfully', 'success')
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
      logger.error({ error: String(err) }, 'Event update failed')
    }
  }, [updateEvent, editingEvent, toast])

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
      logger.error({ error: msg }, 'Delete event failed')

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
      <EmptyCalendarState
        showCreateForm={showCreateCalendar}
        onShowCreateForm={() => setShowCreateCalendar(true)}
        calendarName={newCalendarName}
        onCalendarNameChange={setNewCalendarName}
        calendarType={newCalendarType}
        onCalendarTypeChange={setNewCalendarType}
        calendarColor={newCalendarColor}
        onCalendarColorChange={setNewCalendarColor}
        onCreateCalendar={handleCreateCalendar}
        onCancel={() => { setShowCreateCalendar(false); setNewCalendarColor('#3b82f6') }}
        isPending={createCalendar.isPending}
      />
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
          onCreateSingleEvent={() => setSingleEventOpen(true)}
          onCreateMultiDayEvent={() => setMultiDayEventOpen(true)}
          onCreateRecurringEvent={() => setRecurringEventOpen(true)}
          onCreateFromTemplate={() => setTemplateDrawerOpen(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          categories={categories}
          calendarFilter={calendarFilter}
          onCalendarFilterChange={setCalendarFilter}
          athleticsVisible={anyAthleticsVisible}
          userCampuses={userCampuses}
          visibleAthleticsCampusIds={visibleAthleticsCampusIds}
          onToggleAthleticsCampus={(campusId: string) => {
            setVisibleAthleticsCampusIds((prev) => {
              const next = new Set(prev)
              if (next.has(campusId)) next.delete(campusId)
              else next.add(campusId)
              return next
            })
          }}
          onToggleAllAthletics={(enabled: boolean) => {
            if (enabled) {
              setVisibleAthleticsCampusIds(new Set(userCampuses.map((c) => c.id)))
            } else {
              setVisibleAthleticsCampusIds(new Set())
            }
          }}
          campuses={athleticsCampuses}
          sports={athleticsSports}
        />

        {/* Export CSV button */}
        <div className="flex justify-end mt-2">
          <button
            onClick={() => {
              window.open('/api/settings/export/events', '_blank')
            }}
            className="px-4 py-1.5 rounded-full border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 active:scale-[0.97] transition-colors duration-200 flex items-center gap-1.5"
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
      <div className="flex-1 min-h-0 flex flex-col bg-white overflow-hidden relative z-0">
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
      <CreateCalendarDrawer
        isOpen={showCreateCalendar && calendars.length > 0}
        onClose={() => { setShowCreateCalendar(false); setNewCalendarName(''); setNewCalendarColor('#3b82f6') }}
        calendarName={newCalendarName}
        onCalendarNameChange={setNewCalendarName}
        calendarType={newCalendarType}
        onCalendarTypeChange={setNewCalendarType}
        calendarColor={newCalendarColor}
        onCalendarColorChange={setNewCalendarColor}
        onCreateCalendar={handleCreateCalendar}
        isPending={createCalendar.isPending}
      />

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

      {/* Unified event creation drawers (same as Events Hub) */}
      <CreateEventProjectModal
        isOpen={singleEventOpen}
        onClose={() => setSingleEventOpen(false)}
        initialMode="single"
      />
      <CreateEventProjectModal
        isOpen={multiDayEventOpen}
        onClose={() => setMultiDayEventOpen(false)}
        initialMode="multiday"
      />
      <EventSeriesDrawer
        isOpen={recurringEventOpen}
        onClose={() => setRecurringEventOpen(false)}
      />
      <TemplateListDrawer
        isOpen={templateDrawerOpen}
        onClose={() => setTemplateDrawerOpen(false)}
        onSelect={(templateId: string) => setSelectedTemplateId(templateId)}
      />
      {selectedTemplateId && (
        <CreateFromTemplateWizard
          templateId={selectedTemplateId}
          isOpen={!!selectedTemplateId}
          onClose={() => setSelectedTemplateId(null)}
        />
      )}

      {/* Create choice modal — shown when user clicks an empty calendar slot */}
      <SlotChoiceModal
        isOpen={choiceModalOpen}
        onClose={() => setChoiceModalOpen(false)}
        slotStart={choiceModalStart}
        onChooseMeeting={handleChoiceMeeting}
        onChoosePlanEvent={handleChoicePlanEvent}
      />
    </div>
    </MotionConfig>
  )
}
