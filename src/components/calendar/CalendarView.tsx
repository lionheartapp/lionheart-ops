'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { logger } from '@/lib/logger'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/lib/hooks/useAuth'
import { useActiveSchool } from '@/lib/hooks/useActiveSchool'
import type { EventCreateMode } from '@/components/events/CreateEventMenu'
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
import EventCreatePanel from './EventCreatePanel'
import PlanEventDrawer from './PlanEventDrawer'
import { CreateEventProjectModal } from '@/components/events/CreateEventProjectModal'
import { EventSeriesDrawer } from '@/components/events/EventSeriesDrawer'
import { TemplateListDrawer } from '@/components/events/templates/TemplateListDrawer'
import { CreateFromTemplateWizard } from '@/components/events/templates/CreateFromTemplateWizard'
import type { AttendeeSelection } from './AttendeePicker'
import ConfirmDialog from '@/components/ConfirmDialog'
import RecurringEditDialog from './RecurringEditDialog'
import CancellationNotifyDialog from './CancellationNotifyDialog'
import NotifyAttendeesDialog from './NotifyAttendeesDialog'
import LocationConflictDialog from './LocationConflictDialog'
import { buildCampusShapeMap } from './CampusShapeIndicator'
import { useExternalCalendarEvents } from '@/lib/hooks/useExternalCalendar'
import { useModuleEnabled } from '@/lib/hooks/useModuleEnabled'
import { useQuery } from '@tanstack/react-query'
import { type CalendarFilter } from './CalendarFilterPopover'
import CalendarFilterPanel from './CalendarFilterPanel'
import { useCalendarPrefetch } from '@/lib/hooks/useCalendarPrefetch'
import { useCalendarRealtime } from '@/lib/hooks/useCalendarRealtime'
import { useSmartSearch } from '@/lib/hooks/useSmartSearch'
import { Download } from 'lucide-react'
import { MotionConfig } from 'framer-motion'
import { useDragReschedule } from '@/lib/hooks/useDragReschedule'
import { useUserSchedule, type MeetWithPerson } from '@/lib/hooks/useMeetWith'
import CreateCalendarDrawer from './CreateCalendarDrawer'
import SlotChoiceModal from './SlotChoiceModal'
import EmptyCalendarState from './EmptyCalendarState'
import { useCalendarEventCrud } from '@/lib/hooks/useCalendarEventCrud'
import { useCalendarDeleteFlow } from '@/lib/hooks/useCalendarDeleteFlow'
import { useCalendarDragResize } from '@/lib/hooks/useCalendarDragResize'
import { useAthleticsOverlay } from '@/lib/hooks/useAthleticsOverlay'

export default function CalendarView() {
  useCalendarRealtime()
  const { toast } = useToast()
  const router = useRouter()
  const { isAdmin, user: authUser } = useAuth()
  const { activeSchoolId } = useActiveSchool()
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

  /**
   * Unified dispatcher for the 5 event-project create modes. Called by the
   * toolbar's "+ Create" dropdown so the calendar surface exposes the same
   * options (including "With AI (Leo)") as /events and the dashboard.
   */
  const handleCreateEventProject = useCallback((mode: EventCreateMode) => {
    if (mode === 'single') {
      setSingleEventOpen(true)
      return
    }
    if (mode === 'multiday') {
      setMultiDayEventOpen(true)
      return
    }
    if (mode === 'recurring') {
      setRecurringEventOpen(true)
      return
    }
    if (mode === 'template') {
      setTemplateDrawerOpen(true)
      return
    }
  }, [router])

  // Event interaction state
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventData | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createMode, setCreateMode] = useState<'event' | 'meeting'>('event')
  const [createInitialStart, setCreateInitialStart] = useState<Date | undefined>()
  const [createInitialEnd, setCreateInitialEnd] = useState<Date | undefined>()

  // Edit event state
  const [editingEvent, setEditingEvent] = useState<CalendarEventData | null>(null)

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

  // Track visible calendars — persisted in localStorage so toggling survives
  // page reloads and is instant (client-side only, never hits the DB).
  const visibilityStorageKey = authUser.id ? `calendar-visibility:${authUser.id}` : null

  const [visibleCalendarIds, setVisibleCalendarIdsRaw] = useState<Set<string>>(() => {
    if (typeof window === 'undefined' || !visibilityStorageKey) return new Set()
    try {
      const raw = localStorage.getItem(visibilityStorageKey)
      if (raw) return new Set(JSON.parse(raw) as string[])
    } catch { /* corrupted — fall through to empty */ }
    return new Set()
  })

  // Wrap setter to persist to localStorage on every change
  const setVisibleCalendarIds = useCallback(
    (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      setVisibleCalendarIdsRaw((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        if (visibilityStorageKey) {
          try {
            localStorage.setItem(visibilityStorageKey, JSON.stringify([...next]))
          } catch { /* quota exceeded — silently skip */ }
        }
        return next
      })
    },
    [visibilityStorageKey],
  )

  // Initialize visible calendars when they load, and auto-add new calendars
  useEffect(() => {
    if (calendars.length > 0) {
      setVisibleCalendarIds((prev) => {
        if (prev.size === 0) {
          // First load with no persisted state — auto-select:
          //   1. The org master calendar (isDefault)
          //   2. The user's own school/campus calendar (matching activeSchoolId)
          //   3. The user's personal "My Schedule"
          // Other school calendars stay unchecked until the user toggles them.
          const auto = calendars.filter((c) => {
            if (!c.isActive) return false
            if (c.isDefault) return true
            if (c.calendarType === 'PERSONAL') return true
            if (activeSchoolId && (c.campus?.id === activeSchoolId || c.school?.id === activeSchoolId)) return true
            // If no school selected (All Schools / org-wide user), show all school calendars
            if (!activeSchoolId && c.calendarType !== 'PERSONAL') return true
            return false
          })
          return new Set(auto.map((c) => c.id))
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
  }, [calendars, setVisibleCalendarIds, activeSchoolId])

  const toggleCalendar = useCallback((calendarId: string) => {
    setVisibleCalendarIds((prev) => {
      const next = new Set(prev)
      if (next.has(calendarId)) next.delete(calendarId)
      else next.add(calendarId)
      return next
    })
  }, [setVisibleCalendarIds])

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
  const deleteEventMutation = useDeleteEvent()

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
  const currentUserId = authUser?.id
  const calendarFiltered = activeCalendarIds.length > 0
    ? allEvents.filter((e) =>
        activeCalendarIds.includes(e.calendarId) ||
        e.attendees?.some((a) => a.user.id === currentUserId)
      )
    : []
  // Apply school/campus filter from the global sidebar selector. We match
  // either the calendar's campus (typical for grade-division scoping) or
  // its school (institution-level scoping). Calendars with neither stay
  // visible — they're org-wide and should appear in every school view.
  const events = activeSchoolId
    ? calendarFiltered.filter((e) => {
        const cal = e.calendar
        if (!cal.campus && !cal.school) return true // org-wide
        if (cal.campus?.id === activeSchoolId) return true
        if (cal.school?.id === activeSchoolId) return true
        return false
      })
    : calendarFiltered

  // ── Athletics calendar overlay ──────────────────────────────────────
  const { enabled: athleticsEnabled } = useModuleEnabled('athletics')

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

  const filterStorageKey = authUser.id ? `calendar-filter:${authUser.id}` : null

  const [calendarFilter, setCalendarFilterRaw] = useState<CalendarFilter>(() => {
    const empty: CalendarFilter = {
      categoryIds: new Set(),
      campusIds: new Set(),
      schoolIds: new Set(),
      schoolLevels: new Set(),
      sportIds: new Set(),
      teamLevels: new Set(),
      hiddenExternalCalendarIds: new Set(),
    }
    if (typeof window === 'undefined' || !filterStorageKey) return empty
    try {
      const raw = localStorage.getItem(filterStorageKey)
      if (!raw) return empty
      const parsed = JSON.parse(raw)
      return {
        categoryIds: new Set(parsed.categoryIds || []),
        campusIds: new Set(parsed.campusIds || []),
        schoolIds: new Set(parsed.schoolIds || []),
        schoolLevels: new Set(parsed.schoolLevels || []),
        sportIds: new Set(parsed.sportIds || []),
        teamLevels: new Set(parsed.teamLevels || []),
        hiddenExternalCalendarIds: new Set(parsed.hiddenExternalCalendarIds || []),
      }
    } catch {
      return empty
    }
  })

  const setCalendarFilter = useCallback((next: CalendarFilter) => {
    setCalendarFilterRaw(next)
    if (!filterStorageKey) return
    try {
      localStorage.setItem(filterStorageKey, JSON.stringify({
        categoryIds: [...next.categoryIds],
        campusIds: [...next.campusIds],
        schoolIds: [...next.schoolIds],
        schoolLevels: [...next.schoolLevels],
        sportIds: [...next.sportIds],
        teamLevels: [...next.teamLevels],
        hiddenExternalCalendarIds: [...next.hiddenExternalCalendarIds],
      }))
    } catch { /* quota exceeded — silently skip */ }
  }, [filterStorageKey])

  const {
    anyAthleticsVisible,
    filteredAthleticsEvents,
    athleticsCampuses,
    athleticsSports,
    athleticsCampusArray,
    visibleAthleticsCampusIds,
    setVisibleAthleticsCampusIds,
  } = useAthleticsOverlay({
    calendars,
    start,
    end,
    calendarFilter,
  })

  // Current user's external (Google/Microsoft) calendar events, rendered as
  // read-only "busy" blocks. Safe to always-on — endpoint returns an empty
  // array for users who haven't connected any calendars.
  const { data: externalEvents = [] } = useExternalCalendarEvents(
    start.toISOString(),
    end.toISOString(),
    true,
  )

  // Build unique list of external calendars from synced events for the filter popover
  const externalCalendarList = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; provider: string }>()
    for (const e of externalEvents) {
      if (!seen.has(e.calendarId)) {
        const meta = e.metadata as { provider?: string; sourceCalendarName?: string } | null
        const rawName = e.calendar?.name || meta?.sourceCalendarName || ''
        // Clean up raw Google calendar names — strip URLs, emails, encoded strings
        let displayName = rawName
        if (!displayName || displayName.startsWith('http') || displayName.includes('%')) {
          displayName = 'Calendar'
        } else if (displayName.includes('@')) {
          // Show just the local part of email addresses
          displayName = displayName.split('@')[0]
        }
        seen.set(e.calendarId, {
          id: e.calendarId,
          name: displayName,
          provider: meta?.provider || 'google_calendar',
        })
      }
    }
    return Array.from(seen.values())
  }, [externalEvents])

  // Search filter state
  const [searchQuery, setSearchQuery] = useState('')

  // Filter panel state (persisted in localStorage)
  const filterPanelStorageKey = authUser.id ? `calendar-filter-panel:${authUser.id}` : null
  const [showFilterPanel, setShowFilterPanel] = useState(() => {
    if (typeof window === 'undefined' || !filterPanelStorageKey) return false
    try {
      return localStorage.getItem(filterPanelStorageKey) === 'true'
    } catch { return false }
  })
  const toggleFilterPanel = useCallback(() => {
    setShowFilterPanel((prev) => {
      const next = !prev
      if (filterPanelStorageKey) {
        try { localStorage.setItem(filterPanelStorageKey, String(next)) } catch { /* quota */ }
      }
      return next
    })
  }, [filterPanelStorageKey])

  // Schools query for the filter panel
  const { data: schools = [] } = useQuery<Array<{ id: string; name: string; color?: string | null }>>({
    queryKey: ['schools'],
    queryFn: async () => {
      const res = await fetch('/api/settings/schools', { credentials: 'include' })
      const json = await res.json()
      return json.ok ? json.data : []
    },
    staleTime: 5 * 60_000,
  })

  // AI-powered smart search — parses natural language queries into structured filters
  const smartSearchContext = useMemo(() => ({
    schools,
    campuses: userCampuses.map((c) => ({ id: c.id, name: c.name })),
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    sports: athleticsSports.map((s) => ({ id: s.id, name: s.name })),
  }), [schools, userCampuses, categories, athleticsSports])

  const { aiFilter, isProcessing: aiSearchProcessing, clearAiFilter } = useSmartSearch(
    searchQuery,
    smartSearchContext,
  )

  const filteredEvents = useMemo(() => {
    let result = events
    const q = searchQuery.trim().toLowerCase()

    // When AI filter is active, use its titleSearch for text matching
    // and apply structured filters. Otherwise, use plain text search.
    if (aiFilter) {
      const aiTitle = aiFilter.titleSearch?.toLowerCase()
      if (aiTitle) {
        result = result.filter((e) => e.title.toLowerCase().includes(aiTitle))
      }

      // AI-parsed category filter
      if (aiFilter.categoryIds?.length) {
        const catSet = new Set(aiFilter.categoryIds)
        result = result.filter((e) => e.categoryId && catSet.has(e.categoryId))
      }

      // AI-parsed school filter
      if (aiFilter.schoolIds?.length) {
        const schoolSet = new Set(aiFilter.schoolIds)
        result = result.filter((e) => {
          const schoolId = (e as unknown as Record<string, unknown>).schoolId as string | undefined
          if (schoolId) return schoolSet.has(schoolId)
          return true
        })
      }

      // AI-parsed date range filter
      if (aiFilter.dateRange) {
        const rangeStart = new Date(aiFilter.dateRange.start).getTime()
        const rangeEnd = new Date(aiFilter.dateRange.end).getTime()
        result = result.filter((e) => {
          const eventStart = new Date(e.startTime).getTime()
          return eventStart >= rangeStart && eventStart <= rangeEnd
        })
      }
    } else {
      // Plain text title search (no AI)
      if (q) {
        result = result.filter((e) => e.title.toLowerCase().includes(q))
      }
    }

    // Manual filter: category (only when AI filter isn't already handling categories)
    if (!aiFilter?.categoryIds?.length && calendarFilter.categoryIds.size > 0) {
      result = result.filter((e) => e.categoryId && calendarFilter.categoryIds.has(e.categoryId))
    }

    // Manual filter: school (only when AI filter isn't already handling schools)
    if (!aiFilter?.schoolIds?.length && calendarFilter.schoolIds.size > 0) {
      result = result.filter((e) => {
        const schoolId = (e as unknown as Record<string, unknown>).schoolId as string | undefined
        if (schoolId) return calendarFilter.schoolIds.has(schoolId)
        return true
      })
    }

    // Merge athletics events (controlled by visibleAthleticsCampusIds via Filters popover)
    if (filteredAthleticsEvents.length > 0) {
      let athEvents = filteredAthleticsEvents

      // Apply AI school level / sport / team level filters to athletics
      if (aiFilter?.schoolLevels?.length) {
        const lvlSet = new Set(aiFilter.schoolLevels)
        athEvents = athEvents.filter((e) => {
          const lvl = (e as unknown as Record<string, unknown>).schoolLevel as string | undefined
          return lvl ? lvlSet.has(lvl) : true
        })
      }
      if (aiFilter?.sportIds?.length) {
        const sportSet = new Set(aiFilter.sportIds)
        athEvents = athEvents.filter((e) => {
          const sportId = (e as unknown as Record<string, unknown>).sportId as string | undefined
          return sportId ? sportSet.has(sportId) : true
        })
      }
      if (aiFilter?.teamLevels?.length) {
        const tlSet = new Set(aiFilter.teamLevels)
        athEvents = athEvents.filter((e) => {
          const tl = (e as unknown as Record<string, unknown>).teamLevel as string | undefined
          return tl ? tlSet.has(tl) : true
        })
      }

      const titleQ = aiFilter?.titleSearch?.toLowerCase() || (aiFilter ? '' : q)
      if (titleQ) {
        athEvents = athEvents.filter((e) => e.title.toLowerCase().includes(titleQ))
      }
      result = [...result, ...athEvents]
    }

    // Merge user's external (Google/Microsoft) calendar events, filtering
    // out any calendars the user has hidden via the Filters popover.
    if (externalEvents.length > 0) {
      const hidden = calendarFilter.hiddenExternalCalendarIds
      let extEvents = externalEvents
      if (hidden && hidden.size > 0) {
        extEvents = extEvents.filter((e) => !hidden.has(e.calendarId))
      }
      const titleQ = aiFilter?.titleSearch?.toLowerCase() || (aiFilter ? '' : q)
      if (titleQ) {
        extEvents = extEvents.filter((e) => e.title.toLowerCase().includes(titleQ))
      }
      result = [...result, ...extEvents]
    }

    return result
  }, [events, searchQuery, calendarFilter, filteredAthleticsEvents, externalEvents, aiFilter])

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

  // Deep-link: open event detail when navigated with ?eventId=X (no rsvp needed)
  const [deepLinkHandled, setDeepLinkHandled] = useState(false)
  useEffect(() => {
    if (!eventIdParam || rsvpParam || deepLinkHandled || eventsLoading) return

    // Try to find it in the already-loaded events first
    const local = allEvents.find(e => e.id === eventIdParam)
    if (local) {
      setSelectedEvent(local)
      setDeepLinkHandled(true)
      window.history.replaceState({}, '', '/calendar')
      return
    }

    // Not in current range — fetch directly from the API
    let cancelled = false
    ;(async () => {
      try {
        const { fetchApi } = await import('@/lib/api-client')
        const event = await fetchApi<CalendarEventData>(`/api/calendar-events/${eventIdParam}`)
        if (!cancelled) {
          setSelectedEvent(event)
          setDeepLinkHandled(true)
          window.history.replaceState({}, '', '/calendar')
        }
      } catch {
        // Event not found or no access — just clear the param
        if (!cancelled) {
          setDeepLinkHandled(true)
          window.history.replaceState({}, '', '/calendar')
        }
      }
    })()
    return () => { cancelled = true }
  }, [eventIdParam, rsvpParam, deepLinkHandled, eventsLoading, allEvents]) // eslint-disable-line react-hooks/exhaustive-deps

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
    // All events (including external Google/Microsoft) open the detail panel
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

  // ── Event CRUD hook ──────────────────────────────────────────────────
  const {
    handleSubmitEvent,
    handleUpdateEvent,
    handleOverrideConflict,
    handleCancelConflict,
    conflictWarning,
    formError,
    setFormError,
  } = useCalendarEventCrud({
    createEvent,
    updateEvent,
    editingEvent,
    toast,
    onCreateSuccess: () => setIsCreateOpen(false),
    onUpdateSuccess: () => {
      setIsCreateOpen(false)
      setEditingEvent(null)
    },
  })

  // ── Delete flow hook ─────────────────────────────────────────────────
  const {
    pendingDelete,
    deleteRecurringMode,
    showCancellationNotify,
    deleteError,
    handleDeleteEvent,
    handleDeleteRecurringConfirm,
    confirmDeleteEvent,
    cancelPendingDelete,
    setShowCancellationNotify,
    isRecurring,
  } = useCalendarDeleteFlow({
    deleteEvent: deleteEventMutation,
    queryClient,
    onDeleted: () => setSelectedEvent(null),
  })

  // ── Drag-and-drop reschedule + resize hook ───────────────────────────
  const { reschedule } = useDragReschedule()
  const {
    pendingChange,
    showNotifyDialog,
    isRecurring: isDragRecurring,
    executePendingChange,
    handleDragReschedule,
    handleResize,
    handleRecurringConfirm,
    cancelPendingChange,
  } = useCalendarDragResize({ reschedule })

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
    <div className="flex flex-col flex-1 min-h-0 -mx-4 sm:-mx-10 -mt-4 sm:-mt-6 lg:-mt-8 -mb-10">
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
          onCreateEventProject={handleCreateEventProject}
          isAdmin={isAdmin}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          aiFilter={aiFilter}
          aiSearchProcessing={aiSearchProcessing}
          onClearAiFilter={clearAiFilter}
          categories={categories}
          calendarFilter={calendarFilter}
          onCalendarFilterChange={setCalendarFilter}
          athleticsVisible={anyAthleticsVisible}
          userCampuses={athleticsEnabled ? userCampuses : []}
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
          externalCalendars={externalCalendarList}
          filterPanelOpen={showFilterPanel}
          onToggleFilterPanel={toggleFilterPanel}
        />

        {/* Export CSV — subtle text link, not a prominent button */}
        <div className="flex justify-end mt-1">
          <button
            onClick={() => {
              window.open('/api/settings/export/events', '_blank')
            }}
            className="px-3 py-1.5 text-stone-400 hover:text-stone-600 text-xs font-medium transition-colors duration-200 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export
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
      <div className="flex-1 min-h-0 flex bg-white overflow-hidden relative z-0">
        {/* Filter side panel */}
        <CalendarFilterPanel
          isOpen={showFilterPanel}
          onClose={toggleFilterPanel}
          filter={calendarFilter}
          onFilterChange={setCalendarFilter}
          calendars={calendars}
          visibleCalendarIds={visibleCalendarIds}
          onToggleCalendar={toggleCalendar}
          onBulkToggleCalendars={(ids, visible) => {
            setVisibleCalendarIds((prev) => {
              const next = new Set(prev)
              for (const id of ids) {
                if (visible) next.add(id)
                else next.delete(id)
              }
              return next
            })
          }}
          categories={categories}
          externalCalendars={externalCalendarList}
          athleticsVisible={anyAthleticsVisible}
          userCampuses={athleticsEnabled ? userCampuses : []}
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
          sports={athleticsSports}
        />

        {/* Calendar content */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
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
        isLoading={deleteEventMutation.isPending}
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
        isOpen={!!pendingChange && isDragRecurring(pendingChange.event) && !showNotifyDialog}
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
