'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import { logger } from '@/lib/logger'

import DetailDrawer from '@/components/DetailDrawer'
import ErrorCard from '@/components/ErrorCard'
import AnimatedCounter from '@/components/motion/AnimatedCounter'
// ChatPanel moved to global LeoDrawer (sidebar sparkle icon)
import { staggerContainer, cardEntrance, listItem, fadeInUp, dropdownVariants, buttonTap, EASE_OUT_CUBIC } from '@/lib/animations'
import { readResourceItems } from '@/lib/utils/resourceItems'
import { FloatingInput, FloatingTextarea, FloatingDropdown } from '@/components/ui/FloatingInput'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import SinceYesterdayWidget from '@/components/dashboard/SinceYesterdayWidget'
import { Plus, ChevronDown, Calendar, Building2, Headphones, Loader2, MapPin, Users, Video, Zap, AlertTriangle, RefreshCw, CheckCircle2, XCircle, ChevronRight, CalendarRange, Wrench, StickyNote, CheckSquare } from 'lucide-react'
import { NotificationDrawer, NotificationBellIcon, useUnreadCount } from '@/components/NotificationBell'
import { IllustrationTickets } from '@/components/illustrations'
import { useAuth } from '@/lib/hooks/useAuth'
import { useActiveSchool } from '@/lib/hooks/useActiveSchool'
import { getAuthHeaders } from '@/lib/api-client'
import EventCreatePanel, { type EventFormData } from '@/components/calendar/EventCreatePanel'
import SubmitRequestWizard from '@/components/maintenance/SubmitRequestWizard'
import SupportRequestDrawer from '@/components/forms/SupportRequestDrawer'
import EventDetailPanel from '@/components/calendar/EventDetailPanel'
import { useCalendars, useCalendarEvents, useCategories, useCreateEvent, useCreateCategory, type CalendarEventData } from '@/lib/hooks/useCalendar'
import { useCalendarRealtime } from '@/lib/hooks/useCalendarRealtime'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { getGreeting, getStatusIcon, getStatusLabel, getPriorityColor, formatDate } from '@/lib/dashboard-utils'
import { httpErrorMessage } from '@/lib/errors/http-message'
import { LeoItemDrawerContent } from '@/components/dashboard/DrawerContents'
import OnboardingChecklistWidget from '@/components/onboarding/ChecklistWidget'
import UpcomingEventsPanel, { type UpcomingItem } from '@/components/dashboard/UpcomingEventsPanel'
import { EVENT_CREATE_OPTIONS, type EventCreateMode } from '@/components/events/CreateEventMenu'
import { useEventProjects } from '@/lib/hooks/useEventProject'
import { CreateEventProjectModal } from '@/components/events/CreateEventProjectModal'
import { EventSeriesDrawer } from '@/components/events/EventSeriesDrawer'
import { TemplateListDrawer } from '@/components/events/templates/TemplateListDrawer'
import { CreateFromTemplateWizard } from '@/components/events/templates/CreateFromTemplateWizard'
import { useExternalCalendarEvents } from '@/lib/hooks/useExternalCalendar'
import PlanningSeasonWidget from '@/components/dashboard/PlanningSeasonWidget'
import WeatherWidget from '@/components/dashboard/WeatherWidget'
import TasksFocusWidget from '@/components/dashboard/TasksFocusWidget'
import TodayCommandCenter from '@/components/dashboard/TodayCommandCenter'
import YearPlanPrompt from '@/components/events/YearPlanPrompt'
import { usePendingGateApprovals, type EventProject } from '@/lib/hooks/useEventProject'
import { usePermissions, isOnTeam } from '@/lib/hooks/usePermissions'
import { useToast } from '@/components/Toast'
import { useMyTasks, usePersonalTasks } from '@/lib/hooks/useMyTasks'
import MyTasksDrawer from '@/components/dashboard/MyTasksDrawer'
import CreateDropdownMenu from '@/components/dashboard/CreateDropdownMenu'
import FacilityRequestsBanner from '@/components/dashboard/FacilityRequestsBanner'
import PagePadding from '@/components/PagePadding'
import { format } from 'date-fns'

interface TicketData {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  category: string
  locationText: string | null
  createdAt: string
  assignedTo?: { firstName: string | null; lastName: string | null; email: string } | null
}

interface EventData {
  id: string
  title: string
  description: string | null
  room: string | null
  startsAt: string
  endsAt: string
  status: string
  requiresAV: boolean
  avRequirements: string | null
  avEquipmentList: Array<{ item: string; quantity: number }> | null
}

// (The old inline DashboardErrorCard has been promoted to
// `@/components/ErrorCard` — audit ref M1 — so every dashboard widget,
// events page, inventory page, etc. uses the same retry affordance.)

export default function DashboardPage() {
  usePageTitle('Dashboard')
  useCalendarRealtime()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, org, isReady, isAdmin, logout } = useAuth()


  // ── Global "active school" viewpoint ─────────────────────────────────
  // Reference consumer: reads the Sidebar SchoolSelector's current pick and
  // threads `schoolId` into any data fetch that supports it. When the user
  // changes school, localStorage updates + the `active-school-changed` event
  // fires, which re-hydrates this hook and triggers the dependent fetches
  // below. For single-school orgs `isMultiSchool` is false and the selector
  // is hidden — so the dashboard reads identically to the legacy behavior.
  const {
    activeSchoolId,
    activeSchool,
    isMultiSchool,
  } = useActiveSchool()

  // Calendar hooks — power the Schedule Meeting form (EventCreatePanel)
  const { data: calendarList = [] } = useCalendars()
  const { data: calendarCategories = [] } = useCategories()

  // Upcoming calendar events — used for admin dashboard mode (same source as the calendar page)
  const upcomingStart = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d
  }, [])
  const upcomingEnd = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 14); d.setHours(23, 59, 59, 999); return d
  }, [])
  const calendarIds = useMemo(() => calendarList.map(c => c.id), [calendarList])
  const {
    data: upcomingCalEvents = [],
    isLoading: upcomingCalLoading,
    isError: upcomingCalError,
    refetch: refetchUpcomingCal,
  } = useCalendarEvents(
    calendarIds,
    upcomingStart,
    upcomingEnd,
    isReady && calendarIds.length > 0
  )

  // Pull upcoming event projects so the "Next two weeks" panel surfaces both
  // informal calendar meetings AND formal event projects in one merged list.
  // We filter client-side to the 14-day window to match the calendar fetch.
  const {
    data: upcomingProjects = [],
    isLoading: upcomingProjectsLoading,
    isError: upcomingProjectsError,
  } = useEventProjects(
    isReady ? { limit: 50 } : undefined,
  )

  // Pull external calendar events (Google/Microsoft) for the same window
  const { data: externalCalEvents = [] } = useExternalCalendarEvents(
    upcomingStart.toISOString(),
    upcomingEnd.toISOString(),
    isReady,
  )

  // Merge meetings + projects + external events into a single `UpcomingItem[]`
  // sorted by start, clamped to the same 14-day window used by the timeline.
  const upcomingItems = useMemo<UpcomingItem[]>(() => {
    const windowStart = upcomingStart.getTime()
    const windowEnd = upcomingEnd.getTime()

    const meetings: UpcomingItem[] = [...upcomingCalEvents, ...externalCalEvents].map((e) => ({
      kind: 'meeting' as const,
      data: e,
    }))

    const projects: UpcomingItem[] = upcomingProjects
      .filter((p) => {
        const starts = new Date(p.startsAt).getTime()
        return starts >= windowStart && starts <= windowEnd
      })
      .map((p) => ({ kind: 'project' as const, data: p }))

    return [...meetings, ...projects].sort(
      (a, b) =>
        new Date(
          a.kind === 'meeting' ? a.data.startTime : a.data.startsAt,
        ).getTime() -
        new Date(
          b.kind === 'meeting' ? b.data.startTime : b.data.startsAt,
        ).getTime(),
    )
  }, [upcomingCalEvents, externalCalEvents, upcomingProjects, upcomingStart, upcomingEnd])

  const todayUpcomingCount = useMemo(() => {
    const today = new Date()
    return upcomingItems.filter((item) => {
      const rawDate = item.kind === 'meeting' ? item.data.startTime : item.data.startsAt
      const itemDate = new Date(rawDate)
      return itemDate.toDateString() === today.toDateString()
    }).length
  }, [upcomingItems])

  const createCalendarEvent = useCreateEvent()
  const createCalendarCategory = useCreateCategory()

  // Schedule Meeting panel state (uses EventCreatePanel — same as calendar page)
  const [meetingPanelOpen, setMeetingPanelOpen] = useState(false)
  const [meetingPanelStart, setMeetingPanelStart] = useState<Date | undefined>()
  const [meetingPanelEnd, setMeetingPanelEnd] = useState<Date | undefined>()
  const [meetingPanelError, setMeetingPanelError] = useState<string | null>(null)

  const openMeetingPanel = useCallback((start?: Date, end?: Date) => {
    setMeetingPanelStart(start)
    setMeetingPanelEnd(end)
    setMeetingPanelError(null)
    setIsCreateDropdownOpen(false)
    setMeetingPanelOpen(true)
  }, [])

  const handleMeetingSubmit = useCallback(async (data: EventFormData) => {
    setMeetingPanelError(null)
    try {
      const { categoryId, rrule, buildingId, areaId, attendeeIds, ...rest } = data
      await createCalendarEvent.mutateAsync({
        ...rest,
        ...(categoryId ? { categoryId } : {}),
        ...(rrule ? { rrule } : {}),
        ...(buildingId ? { buildingId } : {}),
        ...(areaId ? { areaId } : {}),
        ...(attendeeIds && attendeeIds.length > 0 ? { attendeeIds } : {}),
      })
      setMeetingPanelOpen(false)
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? 'Something went wrong'
      setMeetingPanelError(msg)
    }
  }, [createCalendarEvent])
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isCreateDropdownOpen, setIsCreateDropdownOpen] = useState(false)
  const createDropdownRef = useRef<HTMLDivElement>(null)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isTasksDrawerOpen, setIsTasksDrawerOpen] = useState(false)
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null)
  const { data: myTasks } = useMyTasks()
  const { data: personalTasks } = usePersonalTasks()
  const openTaskCount = useMemo(() => {
    const eventOpen = myTasks?.filter((t) => t.status !== 'DONE').length ?? 0
    const personalOpen = personalTasks?.filter((t) => t.status !== 'DONE').length ?? 0
    return eventOpen + personalOpen
  }, [myTasks, personalTasks])
  const [eventsScrolled, setEventsScrolled] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventData | null>(null)
  const unreadCount = useUnreadCount()
  const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null)

  // Create ticket form state
  const [createCategory, setCreateCategory] = useState<'MAINTENANCE' | 'IT' | null>(null)
  const [createForm, setCreateForm] = useState({ title: '', description: '', locationText: '', priority: 'NORMAL' })
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState('')

  // Edit ticket state
  const [isEditMode, setIsEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', description: '', priority: 'NORMAL' as string })
  const [editSaving, setEditSaving] = useState(false)

  // Ticket data from API
  const [tickets, setTickets] = useState<TicketData[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(true)
  const [ticketsError, setTicketsError] = useState<string | null>(null)
  const [ticketCount, setTicketCount] = useState(0)

  // Events data (for admin + AV dashboard modes)
  const [events, setEvents] = useState<EventData[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsError, setEventsError] = useState<string | null>(null)

  // Event-project create flows (mirrors the Events Hub page so the dashboard's
  // "+ Event" dropdown has full parity with /events — no more hidden modes).
  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [projectModalMode, setProjectModalMode] = useState<'single' | 'multiday'>('single')
  const [seriesDrawerOpen, setSeriesDrawerOpen] = useState(false)
  const [templateDrawerOpen, setTemplateDrawerOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [yearPlanPromptOpen, setYearPlanPromptOpen] = useState(false)
  const [pendingCreateMode, setPendingCreateMode] = useState<EventCreateMode>('single')

  // Leo item click drawer state
  const [leoDrawerOpen, setLeoDrawerOpen] = useState(false)
  const [leoDrawerType, setLeoDrawerType] = useState<string>('')
  const [leoDrawerItem, setLeoDrawerItem] = useState<Record<string, unknown> | null>(null)
  const [leoDrawerDetail, setLeoDrawerDetail] = useState<Record<string, unknown> | null>(null)
  const [leoDrawerLoading, setLeoDrawerLoading] = useState(false)

  const [facilityProcessingIds, setFacilityProcessingIds] = useState<Set<string>>(new Set())

  // ── Facility Requests (pending event approvals for maintenance team) ──
  const { data: permFlags } = usePermissions()
  // Only show facility requests to users actually on the maintenance team —
  // general admins with canManageMaintenance see these on the Maintenance Hub instead.
  const canApproveFacilities = isOnTeam(permFlags, 'maintenance')
  const { data: pendingFacilityRequests } = usePendingGateApprovals('facilities', !!canApproveFacilities)
  const facilityRequestCount = pendingFacilityRequests?.length ?? 0
  const { toast } = useToast()

  const openTicketCount = useMemo(
    () => tickets.filter((t) => t.status === 'OPEN').length,
    [tickets],
  )
  const inProgressTicketCount = useMemo(
    () => tickets.filter((t) => t.status === 'IN_PROGRESS').length,
    [tickets],
  )
  const avNeedsEquipmentCount = useMemo(
    () => events.filter((event) => !event.avEquipmentList || event.avEquipmentList.length === 0).length,
    [events],
  )
  const taskAttention = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const tomorrowEnd = new Date(todayStart)
    tomorrowEnd.setDate(todayStart.getDate() + 2)
    tomorrowEnd.setMilliseconds(-1)

    const allTasks = [...(myTasks ?? []), ...(personalTasks ?? [])]
    const openTasks = allTasks.filter((task) => task.status !== 'DONE')
    const overdueTaskCount = openTasks.filter((task) => task.dueDate && new Date(task.dueDate) < todayStart).length
    const dueSoonTaskCount = openTasks.filter((task) => {
      if (!task.dueDate) return false
      const due = new Date(task.dueDate)
      return due >= todayStart && due <= tomorrowEnd
    }).length

    return { overdueTaskCount, dueSoonTaskCount }
  }, [myTasks, personalTasks])
  const highPriorityTicketCount = useMemo(
    () => tickets.filter((ticket) => ticket.status !== 'RESOLVED' && (ticket.priority === 'HIGH' || ticket.priority === 'CRITICAL')).length,
    [tickets],
  )
  const eventAttention = useMemo(() => {
    let conflictCount = 0
    let pendingEventApprovalCount = 0

    for (const project of upcomingProjects) {
      const metadata = project.metadata as { conflictReport?: { conflicts?: unknown[] } } | null
      const conflicts = metadata?.conflictReport?.conflicts
      if (Array.isArray(conflicts)) conflictCount += conflicts.length

      const gates = project.approvalGates
      if (!gates) continue
      if (Object.values(gates).some((gate) => gate?.status === 'PENDING')) {
        pendingEventApprovalCount += 1
      }
    }

    return { conflictCount, pendingEventApprovalCount }
  }, [upcomingProjects])

  const handleFacilityReject = async (projectId: string, reason: string) => {
    setFacilityProcessingIds((prev) => new Set(prev).add(projectId))
    try {
      const res = await fetch(`/api/events/projects/${projectId}/reject-gate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateType: 'facilities', reason }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error?.message || 'Failed to reject')
      }
      toast('Event sent back for revision', 'success')
      window.dispatchEvent(new Event('focus'))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to reject', 'error')
    } finally {
      setFacilityProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(projectId)
        return next
      })
    }
  }

  // Open tasks drawer via custom event (from sidebar) or query param (from navigation)
  useEffect(() => {
    const handleOpen = () => setIsTasksDrawerOpen(true)
    window.addEventListener('open-my-tasks-drawer', handleOpen)
    return () => window.removeEventListener('open-my-tasks-drawer', handleOpen)
  }, [])

  useEffect(() => {
    if (searchParams.get('openTasks') === 'true') {
      setIsTasksDrawerOpen(true)
      router.replace('/dashboard', { scroll: false })
    }
  }, [searchParams, router])

  // Listen for leo-item-click events from the StructuredList in Leo
  useEffect(() => {
    const handleLeoItemClick = async (e: Event) => {
      const { type, item } = (e as CustomEvent).detail
      setLeoDrawerType(type)
      setLeoDrawerItem(item)
      setLeoDrawerDetail(null)
      setLeoDrawerOpen(true)

      // Fetch full details for events
      if (type === 'events' && item.id) {
        setLeoDrawerLoading(true)
        try {
          const res = await fetch(`/api/calendar-events/${item.id}`, { credentials: 'include' })
          if (res.ok) {
            const data = await res.json()
            if (data.ok) setLeoDrawerDetail(data.data)
          }
        } catch { /* show what we have */ }
        finally { setLeoDrawerLoading(false) }
      }
    }

    window.addEventListener('leo-item-click', handleLeoItemClick)
    return () => window.removeEventListener('leo-item-click', handleLeoItemClick)
  }, [])

  // Fetch tickets — filtered by category based on dashboardMode, and by the
  // global school viewpoint when a specific school is selected. `schoolId` is
  // only appended when non-null so "All Schools" keeps legacy behavior.
  const fetchTickets = useCallback(async (mode?: string) => {
    setTicketsLoading(true)
    setTicketsError(null)
    try {
      const dashMode = mode ?? user.dashboardMode
      let url = '/api/tickets?limit=10'
      if (dashMode === 'maintenance') url += '&category=MAINTENANCE'
      else if (dashMode === 'it') url += '&category=IT'
      if (activeSchoolId) url += `&schoolId=${encodeURIComponent(activeSchoolId)}`
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) {
        setTicketsError(httpErrorMessage(res.status, 'load requests').message)
        return
      }
      const data = await res.json()
      if (!data?.ok) {
        setTicketsError(data?.error?.message ?? 'Failed to load requests')
        return
      }
      const allTickets = Array.isArray(data.data) ? data.data : data.data?.tickets || []
      setTickets(allTickets)
      setTicketCount(allTickets.filter((t: TicketData) => t.status !== 'RESOLVED').length)
    } catch (err) {
      logger.error({ error: String(err) }, 'fetchTickets failed')
      setTicketsError(httpErrorMessage(null, 'load requests').message)
    } finally {
      setTicketsLoading(false)
    }
  }, [user.dashboardMode, activeSchoolId])

  // Fetch events — for admin (upcoming this week) and AV (requires AV support)
  const fetchEvents = useCallback(async (mode?: string) => {
    setEventsLoading(true)
    setEventsError(null)
    try {
      const dashMode = mode ?? user.dashboardMode
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const weekEnd = new Date(today)
      weekEnd.setDate(today.getDate() + 14) // Next 2 weeks

      let url = '/api/events?limit=8'
      if (dashMode === 'admin') {
        url += `&status=CONFIRMED&fromDate=${today.toISOString()}&toDate=${weekEnd.toISOString()}`
      } else if (dashMode === 'av') {
        url += `&requiresAV=true&fromDate=${today.toISOString()}`
      }
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) {
        setEventsError(httpErrorMessage(res.status, 'load events').message)
        return
      }
      const data = await res.json()
      if (!data?.ok) {
        setEventsError(data?.error?.message ?? 'Failed to load events')
        return
      }
      const allEvents = Array.isArray(data.data) ? data.data : []
      setEvents(allEvents)
    } catch (err) {
      logger.error({ error: String(err) }, 'fetchEvents failed')
      setEventsError(httpErrorMessage(null, 'load events').message)
    } finally {
      setEventsLoading(false)
    }
  }, [user.dashboardMode])

  useEffect(() => {
    if (!isReady || !org.id) return
    const mode = user.dashboardMode
    if (mode === 'av') {
      // AV mode: formal Events with requiresAV flag (not in CalendarEvents)
      fetchEvents(mode)
    } else if (mode !== 'admin') {
      // admin mode uses useCalendarEvents (reactive hook, no manual fetch).
      // `fetchTickets`/`fetchEvents` include `activeSchoolId` in their closure
      // via useCallback deps, so this effect re-runs when the school changes.
      fetchTickets(mode)
    }
  }, [isReady, org.id, user.dashboardMode, fetchTickets, fetchEvents])

  const [showMaintenanceWizard, setShowMaintenanceWizard] = useState(false)
  const [supportDrawerModule, setSupportDrawerModule] = useState<'MAINTENANCE' | 'IT' | null>(null)

  const openCreateDrawer = useCallback((category: 'MAINTENANCE' | 'IT') => {
    // Use the new form-driven SupportRequestDrawer for both modules
    setSupportDrawerModule(category)
    setIsCreateDropdownOpen(false)
  }, [])

  const handleCreateSubmit = useCallback(async () => {
    if (!createForm.title.trim() || !createForm.locationText.trim()) {
      setCreateError('Title and location are required.')
      return
    }
    setCreateSaving(true)
    setCreateError('')
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: createForm.title.trim(),
          description: createForm.description.trim() || undefined,
          locationText: createForm.locationText.trim(),
          category: createCategory,
          priority: createForm.priority,
          source: 'MANUAL',
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.ok) {
          setCreateCategory(null)
          fetchTickets()
          return
        }
      }
      setCreateError('Failed to create request. Please try again.')
    } catch {
      setCreateError('Failed to create request. Please try again.')
    } finally {
      setCreateSaving(false)
    }
  }, [createForm, createCategory, fetchTickets])

  const handleSaveEdit = async () => {
    if (!selectedTicket) return
    setEditSaving(true)
    try {
      const res = await fetch(`/api/tickets/${selectedTicket.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (data.ok) {
        // Update the local ticket data
        setSelectedTicket({ ...selectedTicket, ...editForm })
        setIsEditMode(false)
        // Refresh the tickets list using the existing fetchTickets() pattern
        fetchTickets()
      }
    } catch (err) {
      logger.error({ error: String(err) }, 'Failed to update ticket')
    } finally {
      setEditSaving(false)
    }
  }

  /**
   * Dispatches the 5 EventCreateMode options to the correct flow. Mirrors the
   * routing used in /events (`handleOpenCreate`) so the dashboard's shared
   * CreateEventMenu never points users at a dead-end.
   *
   *   single     → CreateEventProjectModal (formal event project, one-time)
   *   multiday   → CreateEventProjectModal (formal event project, multi-day)
   *   recurring  → EventSeriesDrawer (admin-only)
   *   template   → TemplateListDrawer → CreateFromTemplateWizard
   */
  const proceedWithDashboardCreate = useCallback((mode: EventCreateMode) => {
    if (mode === 'recurring') {
      setSeriesDrawerOpen(true)
      return
    }
    setProjectModalMode(mode as 'single' | 'multiday')
    setProjectModalOpen(true)
  }, [])

  const handleUpcomingCreate = useCallback((mode: EventCreateMode) => {
    setIsCreateDropdownOpen(false)
    setPendingCreateMode(mode)
    setYearPlanPromptOpen(true)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (createDropdownRef.current && !createDropdownRef.current.contains(e.target as Node)) {
        setIsCreateDropdownOpen(false)
      }
    }

    if (isCreateDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isCreateDropdownOpen])

  // Audit ref M2: Escape closes the dropdown for keyboard users.
  useEscapeKey(isCreateDropdownOpen, () => setIsCreateDropdownOpen(false))

  if (!isReady) {
    // Audit ref H2: Replaced bare spinner with a layout-shaped skeleton so the
    // shell doesn't flash in after auth. role=status + sr-only label keeps AT
    // users informed while the visual skeleton mirrors the final grid.
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="min-h-screen px-6 py-8 bg-app-mist"
      >
        <span className="sr-only">Loading your dashboard…</span>
        <div className="max-w-7xl mx-auto">
          {/* Greeting row skeleton */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="space-y-3">
              <div className="h-4 w-44 rounded-full bg-white/60 animate-pulse" />
              <div className="h-9 w-72 rounded-lg bg-white/70 animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-white/70 animate-pulse" />
              <div className="w-32 h-11 rounded-full bg-white/70 animate-pulse" />
            </div>
          </div>

          {/* Stat-row skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-white/70 border border-white/50 rounded-xl p-5 space-y-3"
              >
                <div className="h-3 w-20 rounded bg-slate-200/80 animate-pulse" />
                <div className="h-7 w-16 rounded bg-slate-200/80 animate-pulse" />
                <div className="h-2 w-28 rounded bg-slate-200/60 animate-pulse" />
              </div>
            ))}
          </div>

          {/* Panel grid skeleton — matches the 2-column tickets/events layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="bg-white/70 border border-white/50 rounded-xl p-6 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="h-5 w-40 rounded bg-slate-200/80 animate-pulse" />
                  <div className="h-4 w-16 rounded bg-slate-200/60 animate-pulse" />
                </div>
                {Array.from({ length: 4 }).map((_, row) => (
                  <div key={row} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-200/80 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-3/4 rounded bg-slate-200/80 animate-pulse" />
                      <div className="h-2 w-1/3 rounded bg-slate-200/60 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <PagePadding>
    <>
      <MotionConfig reducedMotion="user">
      <div className="flex flex-col lg:h-full">
      {/* Greeting Section with Create Dropdown Button — pt/pb for hover glow breathing room */}
      <motion.div
        className="mb-4 sm:mb-6 pt-3 sm:pt-6 pb-1 sm:pb-2 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 flex-shrink-0 overflow-visible"
        initial="hidden"
        animate="visible"
        variants={staggerContainer(0.08, 0.05)}
      >
        <motion.div variants={fadeInUp}>
          <p className="text-slate-600 text-sm sm:text-base">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1 className="text-2xl sm:text-4xl font-bold leading-tight text-slate-900">
            {getGreeting()}, {user.name?.split(' ')[0] || 'there'}
          </h1>
          {isMultiSchool && (
            <p className="text-xs font-medium text-slate-500 mt-1">
              Viewing: <span className="text-slate-900">{activeSchool?.name ?? 'All Schools'}</span>
            </p>
          )}
        </motion.div>
        <motion.div variants={fadeInUp} className="flex items-center gap-2 sm:gap-3 self-start sm:self-end overflow-visible">
          {/* My Tasks button — matches bell style */}
          <motion.button
            onClick={() => setIsTasksDrawerOpen(true)}
            className="group/tasks relative p-3 min-h-[44px] min-w-[44px] rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 flex items-center justify-center cursor-pointer"
            style={{ background: 'rgba(255, 255, 255, 0.5)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgb(167, 202, 241)', boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.5)' }}
            aria-label={`My tasks${openTaskCount > 0 ? ` (${openTaskCount} open)` : ''}`}
            whileHover={{ boxShadow: '0 0 0 2px rgba(99, 102, 241, 0.5), 0 0 20px rgba(99, 102, 241, 0.25), inset 0 1px 2px rgba(255, 255, 255, 0.5)' }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <CheckSquare className="w-5 h-5 text-slate-800" />
            {openTaskCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-indigo-600 text-white text-[10px] font-bold px-1 ring-2 ring-white">
                {openTaskCount > 99 ? '99+' : openTaskCount}
              </span>
            )}
          </motion.button>

          {/* Notification Bell — aurora glow + bell ring on hover */}
          <motion.button
            onClick={() => setIsNotificationsOpen(true)}
            className="group/bell relative p-3 min-h-[44px] min-w-[44px] rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 flex items-center justify-center cursor-pointer"
            style={{ background: 'rgba(255, 255, 255, 0.5)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgb(167, 202, 241)', boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.5)' }}
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
            whileHover={{ boxShadow: '0 0 0 2px rgba(99, 102, 241, 0.5), 0 0 20px rgba(99, 102, 241, 0.25), inset 0 1px 2px rgba(255, 255, 255, 0.5)' }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <span className="group-hover/bell:animate-[bell-ring_0.6s_ease-in-out]" style={{ transformOrigin: 'top center', display: 'flex' }}>
              <NotificationBellIcon unreadCount={unreadCount} className="w-5 h-5 text-slate-800" />
            </span>
          </motion.button>

          <CreateDropdownMenu
            isOpen={isCreateDropdownOpen}
            onToggle={() => setIsCreateDropdownOpen(!isCreateDropdownOpen)}
            onClose={() => setIsCreateDropdownOpen(false)}
            isAdmin={isAdmin}
            onScheduleMeeting={() => openMeetingPanel()}
            onCreateEvent={handleUpcomingCreate}
            onCreateTicket={openCreateDrawer}
          />
        </motion.div>
      </motion.div>

      {canApproveFacilities && pendingFacilityRequests && pendingFacilityRequests.length > 0 && (
        <FacilityRequestsBanner requests={pendingFacilityRequests} />
      )}

      <TodayCommandCenter
        mode={user.dashboardMode}
        firstName={user.name?.split(' ')[0] || 'there'}
        schoolName={isMultiSchool ? (activeSchool?.name ?? 'All Schools') : undefined}
        openTaskCount={openTaskCount}
        unreadCount={unreadCount}
        upcomingCount={upcomingItems.length}
        todayEventCount={todayUpcomingCount}
        activeTicketCount={ticketCount}
        openTicketCount={openTicketCount}
        inProgressTicketCount={inProgressTicketCount}
        facilityRequestCount={facilityRequestCount}
        avEventCount={events.length}
        avNeedsEquipmentCount={avNeedsEquipmentCount}
        conflictCount={eventAttention.conflictCount}
        pendingEventApprovalCount={eventAttention.pendingEventApprovalCount}
        overdueTaskCount={taskAttention.overdueTaskCount}
        dueSoonTaskCount={taskAttention.dueSoonTaskCount}
        highPriorityTicketCount={highPriorityTicketCount}
        canApproveFacilities={canApproveFacilities}
        isAdmin={isAdmin}
        onOpenTasks={() => {
          setFocusedTaskId(null)
          setIsTasksDrawerOpen(true)
        }}
        onOpenLeo={() => window.dispatchEvent(new Event('open-leo-drawer'))}
      />

      {/* Dashboard Panels Grid — 2/3 left (activity) + 1/3 right (focus & weather) */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10"
        initial="hidden"
        animate="visible"
        variants={staggerContainer(0.1, 0.15)}
      >
        {/* Left column (2/3) — Since Yesterday + Next Two Weeks */}
        <motion.div variants={cardEntrance} className="lg:col-span-2 flex flex-col gap-6">
          <OnboardingChecklistWidget />
          <PlanningSeasonWidget />
          {/* SinceYesterdayWidget hidden for now */}

          {/* The next two weeks / mode-specific panel */}
          {user.dashboardMode === 'admin' ? (
            <UpcomingEventsPanel
              items={upcomingItems}
              loading={upcomingCalLoading || upcomingProjectsLoading}
              error={
                upcomingCalError
                  ? 'We couldn\u2019t reach the calendar service.'
                  : upcomingProjectsError
                    ? 'We couldn\u2019t load event projects.'
                    : null
              }
              onRetry={() => { void refetchUpcomingCal() }}
              onEventClick={(event) => setSelectedEvent(event)}
              onProjectClick={(project) => router.push(`/events/${project.id}`)}
              onCreateSelect={handleUpcomingCreate}
              isAdmin={isAdmin}
            />
          ) : (
            <div className="flex-1 min-h-0 ui-glass-hover flex flex-col overflow-hidden rounded-2xl">
            {/* Sticky header — stays pinned while events scroll */}
            <div className={`relative z-10 flex-shrink-0 pt-6 px-6 transition-shadow duration-200 ${eventsScrolled ? 'shadow-[0_4px_12px_-2px_rgba(226,233,242,0.8)]' : ''}`}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900">
                  {user.dashboardMode === 'maintenance' ? 'Maintenance Requests' :
                   user.dashboardMode === 'it' ? 'IT Requests' :
                   user.dashboardMode === 'av' ? 'Upcoming A/V Events' :
                   'My Tasks'}
                </h2>
              </div>

              {/* Compact stats row — labels and values adapt per mode */}
              <div className="flex gap-3 mb-6">
              {user.dashboardMode === 'av' && (
                <>
                  <div className="flex-1 rounded-xl p-3.5 bg-gradient-to-br from-violet-50/80 to-purple-50/80 border-l-[3px] border-violet-500 backdrop-blur-sm">
                    <p className="text-2xl font-bold text-slate-900">
                      <AnimatedCounter value={events.length} duration={0.8} />
                    </p>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5">A/V Events</p>
                  </div>
                  <div className="flex-1 rounded-xl p-3.5 bg-gradient-to-br from-emerald-50/80 to-teal-50/80 border-l-[3px] border-emerald-500 backdrop-blur-sm">
                    <p className="text-2xl font-bold text-slate-900">
                      <AnimatedCounter value={events.filter(e => e.avEquipmentList && e.avEquipmentList.length > 0).length} duration={0.8} />
                    </p>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5">Equipment Ready</p>
                  </div>
                </>
              )}
              {(user.dashboardMode === 'maintenance' || user.dashboardMode === 'it') && (
                <>
                  <div className="flex-1 rounded-xl p-3.5 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 border-l-[3px] border-blue-500 backdrop-blur-sm">
                    <p className="text-2xl font-bold text-slate-900">
                      <AnimatedCounter value={tickets.filter(t => t.status === 'OPEN').length} duration={0.8} />
                    </p>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5">Open Requests</p>
                  </div>
                  <div className="flex-1 rounded-xl p-3.5 bg-gradient-to-br from-amber-50/80 to-orange-50/80 border-l-[3px] border-amber-500 backdrop-blur-sm">
                    <p className="text-2xl font-bold text-slate-900">
                      <AnimatedCounter value={tickets.filter(t => t.status === 'IN_PROGRESS').length} duration={0.8} />
                    </p>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5">In Progress</p>
                  </div>
                </>
              )}
              {user.dashboardMode !== 'admin' && user.dashboardMode !== 'av' && user.dashboardMode !== 'maintenance' && user.dashboardMode !== 'it' && (
                <>
                  <div className="flex-1 rounded-xl p-3.5 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 border-l-[3px] border-blue-500 backdrop-blur-sm">
                    <p className="text-2xl font-bold text-slate-900">
                      <AnimatedCounter value={ticketCount} duration={0.8} />
                    </p>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5">Active Requests</p>
                  </div>
                  <div className="flex-1 rounded-xl p-3.5 bg-gradient-to-br from-indigo-50/80 to-violet-50/80 border-l-[3px] border-indigo-500 backdrop-blur-sm">
                    <p className="text-2xl font-bold text-slate-900">
                      <AnimatedCounter value={tickets.length} duration={0.8} />
                    </p>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5">Total Tasks</p>
                  </div>
                </>
              )}
            </div>
            </div>

            {/* Scrollable events area */}
            <div className="relative flex-1 min-h-0">
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white/90 to-transparent pointer-events-none z-10 rounded-b-2xl" />
            <div className="h-full overflow-y-auto dashboard-scroll px-6 pb-20" onScroll={(e) => setEventsScrolled(e.currentTarget.scrollTop > 0)}>
            {user.dashboardMode === 'av' ? (
              /* ── AV Events Panel — formal Events with requiresAV flag ── */
              eventsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                </div>
              ) : eventsError ? (
                <ErrorCard
                  resource="A/V events"
                  message={eventsError}
                  onRetry={() => fetchEvents()}
                />
              ) : events.length === 0 ? (
                <div className="text-center py-16">
                  <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-base font-semibold text-slate-700 mb-1">No A/V events scheduled</p>
                  <p className="text-sm text-slate-500">Events that require A/V support will appear here.</p>
                </div>
              ) : (
                <motion.ul className="space-y-3" role="list" initial="hidden" animate="visible" variants={staggerContainer(0.04, 0)}>
                  {events.map((event) => {
                    const startDate = new Date(event.startsAt)
                    const endDate = new Date(event.endsAt)
                    const isToday = startDate.toDateString() === new Date().toDateString()
                    const timeStr = `${startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – ${endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                    const dateLabel = isToday ? 'Today' : startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

                    return (
                      <motion.li
                        key={event.id}
                        variants={listItem}
                        className="flex items-start gap-4 p-3 rounded-lg hover:bg-primary-50 transition"
                      >
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                          <Video className="w-5 h-5 text-primary-600" aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 truncate">{event.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{dateLabel} · {timeStr}</p>
                          {event.room && (
                            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3 flex-shrink-0" aria-hidden="true" />{event.room}
                            </p>
                          )}
                          <div className="mt-2">
                            {event.avEquipmentList && event.avEquipmentList.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {event.avEquipmentList.map((eq, i) => (
                                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700">
                                    <Zap className="w-2.5 h-2.5" aria-hidden="true" />
                                    {eq.quantity > 1 ? `${eq.quantity}× ` : ''}{eq.item}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-100 text-yellow-700">
                                <Loader2 className="w-2.5 h-2.5 animate-spin" aria-hidden="true" />
                                Equipment list pending AI parsing…
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${isToday ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                          {isToday ? 'Today' : startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </motion.li>
                    )
                  })}
                </motion.ul>
              )
            ) : (
              /* ── Ticket Panel (maintenance, it, default) ── */
              ticketsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                </div>
              ) : ticketsError ? (
                <ErrorCard
                  resource={
                    user.dashboardMode === 'maintenance' ? 'maintenance requests' :
                    user.dashboardMode === 'it' ? 'IT requests' :
                    'tasks'
                  }
                  message={ticketsError}
                  onRetry={() => fetchTickets()}
                />
              ) : tickets.length === 0 ? (
                <div className="text-center py-16">
                  <IllustrationTickets className="w-48 h-40 mx-auto mb-2" />
                  <p className="text-base font-semibold text-slate-700 mb-1">No tasks yet</p>
                  <p className="text-sm text-slate-500 mb-4">Submit a maintenance request or create a task to get started.</p>
                  <button
                    onClick={() => openCreateDrawer('MAINTENANCE')}
                    className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors active:scale-[0.97] cursor-pointer"
                  >
                    Create First Task
                  </button>
                </div>
              ) : (
                <>
                  <motion.ul className="space-y-3" role="list" initial="hidden" animate="visible" variants={staggerContainer(0.04, 0)}>
                    {tickets.filter(t => t.status !== 'RESOLVED').slice(0, 8).map((ticket) => (
                      <motion.li
                        key={ticket.id}
                        variants={listItem}
                        className="flex items-center gap-4 p-3 rounded-lg hover:bg-primary-50 cursor-pointer transition"
                        onClick={() => { setSelectedTicket(ticket); setIsDetailOpen(true) }}
                      >
                        <div className="flex-shrink-0">
                          {getStatusIcon(ticket.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 truncate">{ticket.title}</p>
                          <p className="text-xs text-slate-500 mt-1">{formatDate(ticket.createdAt)}</p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority === 'NORMAL' ? 'Normal' : ticket.priority === 'CRITICAL' ? 'Critical' : ticket.priority}
                        </div>
                      </motion.li>
                    ))}
                  </motion.ul>

                  <button
                    onClick={() => openCreateDrawer('MAINTENANCE')}
                    className="mt-6 w-full py-2 text-primary-600 font-medium hover:bg-primary-50 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 transition flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Add task
                  </button>
                </>
              )
            )}
            </div>
            </div>
            </div>
          )}
        </motion.div>

        {/* Right column (1/3) — Today's Focus on top, Weather below */}
        <motion.div variants={cardEntrance} className="flex flex-col gap-6 self-start">
          <TasksFocusWidget firstName={user.name?.split(' ')[0] || 'there'} onViewAll={() => { setFocusedTaskId(null); setIsTasksDrawerOpen(true) }} onOpenTask={(id) => { setFocusedTaskId(id); setIsTasksDrawerOpen(true) }} />
          <WeatherWidget contextLabel={activeSchool?.name} />
        </motion.div>
      </motion.div>
      </div>
      </MotionConfig>

      {/* Detail Drawer */}
      <DetailDrawer
        isOpen={isDetailOpen}
        onClose={() => { setIsDetailOpen(false); setSelectedTicket(null); setIsEditMode(false) }}
        title={selectedTicket?.title || 'Task Details'}
        width="md"
        onEdit={() => {
          if (selectedTicket) {
            setEditForm({
              title: selectedTicket.title || '',
              description: selectedTicket.description || '',
              priority: selectedTicket.priority || 'NORMAL',
            })
            setIsEditMode(true)
          }
        }}
        footer={selectedTicket && isEditMode ? (
          <div className="flex gap-3">
            <button
              onClick={handleSaveEdit}
              disabled={editSaving}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 disabled:opacity-50 transition active:scale-[0.97]"
            >
              {editSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => setIsEditMode(false)}
              className="flex-1 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition active:scale-[0.97]"
            >
              Cancel
            </button>
          </div>
        ) : undefined}
      >
        {selectedTicket ? (
          isEditMode ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <Input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                />
              </div>
              <div>
                <FloatingDropdown
                  label="Priority"
                  value={editForm.priority}
                  onChange={(v) => setEditForm(prev => ({ ...prev, priority: v }))}
                  options={[
                    { value: 'LOW', label: 'Low' },
                    { value: 'NORMAL', label: 'Normal' },
                    { value: 'HIGH', label: 'High' },
                    { value: 'CRITICAL', label: 'Critical' },
                  ]}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {selectedTicket.description && (
                <p className="text-slate-600 text-sm">{selectedTicket.description}</p>
              )}
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-1">Status</p>
                  <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    selectedTicket.status === 'OPEN' ? 'bg-red-100 text-red-700' :
                    selectedTicket.status === 'IN_PROGRESS' ? 'bg-primary-100 text-primary-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {getStatusLabel(selectedTicket.status)}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-1">Priority</p>
                  <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(selectedTicket.priority)}`}>
                    {selectedTicket.priority}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-1">Category</p>
                  <p className="text-slate-600">{selectedTicket.category}</p>
                </div>
                {selectedTicket.locationText && (
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-1">Location</p>
                    <p className="text-slate-600">{selectedTicket.locationText}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-1">Created</p>
                  <p className="text-slate-600">{new Date(selectedTicket.createdAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                </div>
              </div>
            </div>
          )
        ) : (
          <p className="text-slate-400 text-sm">Select a task to view details.</p>
        )}
      </DetailDrawer>

      {/* Support Request Drawer (form-driven — replaces old hardcoded drawers) */}
      <SupportRequestDrawer
        isOpen={supportDrawerModule !== null}
        onClose={() => setSupportDrawerModule(null)}
        module={supportDrawerModule ?? 'MAINTENANCE'}
      />

      {/* Create Ticket Drawer (legacy — kept for backward compat, no longer opened by Create menu) */}
      <DetailDrawer
        isOpen={createCategory !== null}
        onClose={() => setCreateCategory(null)}
        title={createCategory === 'IT' ? 'New IT Request' : 'New Facilities Request'}
        width="md"
        footer={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCreateCategory(null)}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateSubmit}
              disabled={createSaving}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800 transition disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 flex items-center justify-center gap-2"
            >
              {createSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit Request
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <FloatingInput
            id="create-title"
            label="Title"
            required
            value={createForm.title}
            onChange={(e) => setCreateForm(f => ({ ...f, title: e.target.value }))}
          />
          <FloatingTextarea
            id="create-description"
            label="Description"
            value={createForm.description}
            onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))}
            rows={3}
          />
          <FloatingInput
            id="create-location"
            label="Location"
            required
            placeholder="e.g. Room 204, Main Building"
            value={createForm.locationText}
            onChange={(e) => setCreateForm(f => ({ ...f, locationText: e.target.value }))}
          />
          <FloatingDropdown
            id="create-priority"
            label="Priority"
            value={createForm.priority}
            onChange={(v) => setCreateForm(f => ({ ...f, priority: v }))}
            options={[
              { value: 'LOW', label: 'Low' },
              { value: 'NORMAL', label: 'Normal' },
              { value: 'HIGH', label: 'High' },
              { value: 'CRITICAL', label: 'Critical' },
            ]}
          />

          {createError && (
            <p className="text-sm text-red-600">{createError}</p>
          )}
        </div>
      </DetailDrawer>
      {/* ─── Maintenance Wizard (slide-in drawer) ───────────────────────── */}
      <AnimatePresence>
        {showMaintenanceWizard && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
              onClick={() => setShowMaintenanceWizard(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:right-4 sm:top-4 sm:bottom-4 sm:max-w-xl bg-white shadow-2xl z-50 flex flex-col sm:rounded-2xl overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto p-6">
                <SubmitRequestWizard
                  onComplete={() => {
                    setShowMaintenanceWizard(false)
                    fetchTickets(user.dashboardMode || 'staff')
                  }}
                  onCancel={() => setShowMaintenanceWizard(false)}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Year plan routing prompt */}
      <YearPlanPrompt
        isOpen={yearPlanPromptOpen}
        onClose={() => setYearPlanPromptOpen(false)}
        onYearPlan={() => {
          setYearPlanPromptOpen(false)
          router.push('/planning?action=create')
        }}
        onRegularEvent={() => {
          setYearPlanPromptOpen(false)
          proceedWithDashboardCreate(pendingCreateMode)
        }}
      />

      {/* ─── Event Project Create flows (same as Events Hub) ───────────────── */}
      <CreateEventProjectModal
        isOpen={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        initialMode={projectModalMode}
      />
      <EventSeriesDrawer
        isOpen={seriesDrawerOpen}
        onClose={() => setSeriesDrawerOpen(false)}
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

      {/* Leo Item Detail Drawer */}
      <DetailDrawer
        isOpen={leoDrawerOpen}
        onClose={() => { setLeoDrawerOpen(false); setLeoDrawerItem(null); setLeoDrawerDetail(null) }}
        title={leoDrawerType === 'events' ? 'Event Details' : leoDrawerType === 'tickets' ? 'Ticket Details' : leoDrawerType === 'users' ? 'User Details' : leoDrawerType === 'inventory' ? 'Inventory Details' : 'Details'}
        width="md"
      >
        {leoDrawerLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
          </div>
        ) : leoDrawerItem ? (
          <LeoItemDrawerContent type={leoDrawerType} item={leoDrawerItem} detail={leoDrawerDetail} />
        ) : null}
      </DetailDrawer>

      {/* ─── Schedule Meeting Panel ──────────────────────────────────────── */}
      {/* Uses the same EventCreatePanel as the Calendar page for consistency */}
      <EventCreatePanel
        isOpen={meetingPanelOpen}
        onClose={() => { setMeetingPanelOpen(false); setMeetingPanelError(null) }}
        onSubmit={handleMeetingSubmit}
        isSubmitting={createCalendarEvent.isPending}
        calendars={calendarList}
        categories={calendarCategories}
        onCreateCategory={(data) => createCalendarCategory.mutateAsync(data)}
        initialStart={meetingPanelStart}
        initialEnd={meetingPanelEnd}
        error={meetingPanelError}
        mode="meeting"
      />

      {/* Event Detail Panel — opens when clicking an event in the Upcoming Events list */}
      <EventDetailPanel
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onEdit={(event) => { setSelectedEvent(null); router.push('/calendar') }}
        onDelete={(event) => { setSelectedEvent(null); router.push('/calendar') }}
      />

      {/* Notification Drawer */}
      <NotificationDrawer isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />

      {/* My Tasks Drawer */}
      <MyTasksDrawer isOpen={isTasksDrawerOpen} onClose={() => { setIsTasksDrawerOpen(false); setFocusedTaskId(null) }} initialTaskId={focusedTaskId} />
    </>
    </PagePadding>
  )
}
