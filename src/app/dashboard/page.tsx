'use client'

import { useEffect, useState, useCallback, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import DashboardLayout from '@/components/DashboardLayout'
import DetailDrawer from '@/components/DetailDrawer'
import AnimatedCounter from '@/components/motion/AnimatedCounter'
import ChatPanel from '@/components/ai/ChatPanel'
import { staggerContainer, cardEntrance, listItem, fadeInUp, dropdownVariants, buttonTap, EASE_OUT_CUBIC } from '@/lib/animations'
import { FloatingInput, FloatingTextarea, FloatingSelect } from '@/components/ui/FloatingInput'
import { Plus, Clock, AlertCircle, CheckCircle, ChevronDown, ChevronRight, Calendar, Sparkles, Building2, Headphones, Loader2, MapPin, Users, Package, Wrench, Monitor, Video, Zap, Check, ArrowLeft } from 'lucide-react'
import { IllustrationTickets } from '@/components/illustrations'
import { useAuth } from '@/lib/hooks/useAuth'
import { getAuthHeaders } from '@/lib/api-client'
import AttendeePicker, { type AttendeeSelection } from '@/components/calendar/AttendeePicker'
import EventCreatePanel, { type EventFormData } from '@/components/calendar/EventCreatePanel'
import { useCalendars, useCategories, useCreateEvent, useCreateCategory } from '@/lib/hooks/useCalendar'

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

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, org, isReady, logout } = useAuth()

  // Calendar hooks — power the Schedule Meeting form (EventCreatePanel)
  const { data: calendarList = [] } = useCalendars()
  const { data: calendarCategories = [] } = useCategories()
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
  const [ticketCount, setTicketCount] = useState(0)

  // Events data (for admin + AV dashboard modes)
  const [events, setEvents] = useState<EventData[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)

  // Event stepper state (mode: 'stepper' = Plan Event, 'quick' = Schedule Meeting)
  const [eventStepperOpen, setEventStepperOpen] = useState(false)
  const [eventStepperMode, setEventStepperMode] = useState<'stepper' | 'quick'>('stepper')
  const [eventStep, setEventStep] = useState(1)
  const [stepperForm, setStepperForm] = useState({
    title: '',
    description: '',
    room: '',
    startsAt: '',
    endsAt: '',
    attendees: [] as AttendeeSelection[],
    requiresAV: false,
    avRequirements: '',
    requiresFacilitySetup: false,
    facilityNotes: '',
    setupNeeds: [] as string[],
  })
  const [eventStepperSaving, setEventStepperSaving] = useState(false)
  const [eventStepperError, setEventStepperError] = useState('')

  // Leo item click drawer state
  const [leoDrawerOpen, setLeoDrawerOpen] = useState(false)
  const [leoDrawerType, setLeoDrawerType] = useState<string>('')
  const [leoDrawerItem, setLeoDrawerItem] = useState<Record<string, unknown> | null>(null)
  const [leoDrawerDetail, setLeoDrawerDetail] = useState<Record<string, unknown> | null>(null)
  const [leoDrawerLoading, setLeoDrawerLoading] = useState(false)

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

  // Fetch tickets — filtered by category based on dashboardMode
  const fetchTickets = useCallback(async (mode?: string) => {
    setTicketsLoading(true)
    try {
      const dashMode = mode ?? user.dashboardMode
      let url = '/api/tickets?limit=10'
      if (dashMode === 'maintenance') url += '&category=MAINTENANCE'
      else if (dashMode === 'it') url += '&category=IT'
      const res = await fetch(url, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        if (data.ok) {
          const allTickets = Array.isArray(data.data) ? data.data : data.data?.tickets || []
          setTickets(allTickets)
          setTicketCount(allTickets.filter((t: TicketData) => t.status !== 'RESOLVED').length)
        }
      }
    } catch {
      // Silently fail — show empty state
    } finally {
      setTicketsLoading(false)
    }
  }, [user.dashboardMode])

  // Fetch events — for admin (upcoming this week) and AV (requires AV support)
  const fetchEvents = useCallback(async (mode?: string) => {
    setEventsLoading(true)
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
      if (res.ok) {
        const data = await res.json()
        if (data.ok) {
          const allEvents = Array.isArray(data.data) ? data.data : []
          setEvents(allEvents)
        }
      }
    } catch {
      // Silently fail
    } finally {
      setEventsLoading(false)
    }
  }, [user.dashboardMode])

  useEffect(() => {
    if (!isReady || !org.id) return
    const mode = user.dashboardMode
    if (mode === 'admin' || mode === 'av') {
      fetchEvents(mode)
    } else {
      fetchTickets(mode)
    }
  }, [isReady, org.id, user.dashboardMode, fetchTickets, fetchEvents])

  const openCreateDrawer = useCallback((category: 'MAINTENANCE' | 'IT') => {
    setCreateCategory(category)
    setCreateForm({ title: '', description: '', locationText: '', priority: 'NORMAL' })
    setCreateError('')
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
      console.error('Failed to update ticket:', err)
    } finally {
      setEditSaving(false)
    }
  }

  const openEventStepper = useCallback((mode: 'stepper' | 'quick') => {
    const now = new Date()
    now.setMinutes(0, 0, 0)
    now.setHours(now.getHours() + 1)
    const end = new Date(now.getTime() + 60 * 60 * 1000)
    const toLocal = (d: Date) => {
      const pad = (n: number) => n.toString().padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
    setStepperForm({
      title: '', description: '', room: '',
      startsAt: toLocal(now), endsAt: toLocal(end),
      attendees: [],
      requiresAV: false, avRequirements: '',
      requiresFacilitySetup: false, facilityNotes: '', setupNeeds: [],
    })
    setEventStep(1)
    setEventStepperError('')
    setEventStepperMode(mode)
    setIsCreateDropdownOpen(false)
    setEventStepperOpen(true)
  }, [])

  // Auto-open Plan Event stepper when navigated here with ?planEvent=1
  // (e.g. from the calendar toolbar "Plan Event" option)
  useEffect(() => {
    if (!isReady) return
    if (searchParams.get('planEvent') === '1') {
      openEventStepper('stepper')
      router.replace('/dashboard', { scroll: false })
    }
  }, [isReady, searchParams, openEventStepper, router])

  const handleStepperSubmit = useCallback(async () => {
    if (!stepperForm.title.trim() || !stepperForm.startsAt || !stepperForm.endsAt) {
      setEventStepperError('Title, start time, and end time are required.')
      return
    }
    if (new Date(stepperForm.endsAt) <= new Date(stepperForm.startsAt)) {
      setEventStepperError('End time must be after start time.')
      return
    }
    setEventStepperSaving(true)
    setEventStepperError('')

    // Build facility description addon
    let fullDescription = stepperForm.description.trim()
    const facilityParts: string[] = []
    if (stepperForm.requiresFacilitySetup) {
      if (stepperForm.setupNeeds.length > 0) facilityParts.push(`Setup needed: ${stepperForm.setupNeeds.join(', ')}`)
      if (stepperForm.facilityNotes.trim()) facilityParts.push(`Notes: ${stepperForm.facilityNotes.trim()}`)
    }
    if (facilityParts.length > 0) {
      fullDescription = fullDescription ? `${fullDescription}\n\n[Facility] ${facilityParts.join('. ')}` : `[Facility] ${facilityParts.join('. ')}`
    }

    try {
      const isQuick = eventStepperMode === 'quick'
      const res = await fetch('/api/events', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: stepperForm.title.trim(),
          description: fullDescription || null,
          room: stepperForm.room.trim() || null,
          startsAt: new Date(stepperForm.startsAt).toISOString(),
          endsAt: new Date(stepperForm.endsAt).toISOString(),
          requiresAV: stepperForm.requiresAV,
          avRequirements: stepperForm.avRequirements.trim() || null,
          attendeeIds: stepperForm.attendees.map((a) => a.id),
          ...(isQuick ? { status: 'CONFIRMED' } : {}),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.ok) {
          setEventStepperOpen(false)
          fetchEvents()
          return
        }
        setEventStepperError(data.error?.message || 'Failed to create event.')
      } else {
        const data = await res.json().catch(() => ({}))
        setEventStepperError(data.error?.message || 'Failed to create event.')
      }
    } catch {
      setEventStepperError('Failed to create event. Please try again.')
    } finally {
      setEventStepperSaving(false)
    }
  }, [stepperForm, eventStepperMode, fetchEvents])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[aria-expanded]') && !target.closest('.relative')) {
        setIsCreateDropdownOpen(false)
      }
    }

    if (isCreateDropdownOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [isCreateDropdownOpen])

  if (!isReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <AlertCircle className="w-5 h-5 text-red-500" aria-hidden="true" />
      case 'IN_PROGRESS':
        return <Clock className="w-5 h-5 text-primary-500" aria-hidden="true" />
      case 'RESOLVED':
        return <CheckCircle className="w-5 h-5 text-green-500" aria-hidden="true" />
      default:
        return <Clock className="w-5 h-5 text-gray-400" aria-hidden="true" />
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'OPEN': return 'Open'
      case 'IN_PROGRESS': return 'In Progress'
      case 'RESOLVED': return 'Resolved'
      default: return status
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-700'
      case 'HIGH':
        return 'bg-red-100 text-red-700'
      case 'NORMAL':
        return 'bg-yellow-100 text-yellow-700'
      case 'LOW':
        return 'bg-green-100 text-green-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <DashboardLayout
      userName={user.name || 'User'}
      userEmail={user.email || 'user@school.edu'}
      userAvatar={user.avatar || undefined}
      organizationName={org.name || 'School'}
      organizationLogoUrl={org.logoUrl || undefined}
      schoolLabel={user.schoolScope || org.schoolType || org.name || 'School'}
      teamLabel={user.team || user.role || 'Team'}
      onLogout={logout}
    >
      <MotionConfig reducedMotion="user">
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Greeting Section with Create Dropdown Button */}
      <motion.div
        className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-shrink-0"
        initial="hidden"
        animate="visible"
        variants={staggerContainer(0.08, 0.05)}
      >
        <motion.div variants={fadeInUp}>
          <p className="text-gray-600 text-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            {getGreeting()}, {user.name?.split(' ')[0] || 'there'}
          </h1>
        </motion.div>
        <motion.div variants={fadeInUp} className="relative self-start sm:self-center">
          <motion.button
            onClick={() => setIsCreateDropdownOpen(!isCreateDropdownOpen)}
            className="px-4 sm:px-6 py-3 min-h-[44px] bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 transition flex items-center gap-2"
            aria-label="Create new request"
            aria-expanded={isCreateDropdownOpen}
            whileTap={buttonTap}
          >
            <Plus className="w-5 h-5" aria-hidden="true" />
            Create
            <ChevronDown className={`w-4 h-4 transition-transform ${isCreateDropdownOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </motion.button>

          {/* Create Dropdown Menu */}
          <AnimatePresence>
          {isCreateDropdownOpen && (
            <motion.div
              className="absolute right-0 mt-2 w-64 ui-glass-dropdown z-mobilenav"
              variants={dropdownVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {/* Meetings Section */}
              <div className="p-3 space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-1">Meetings</p>
                <button
                  onClick={() => openMeetingPanel()}
                  className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-primary-50 transition text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  <Users className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">Schedule Meeting</p>
                    <p className="text-xs text-gray-600">Informal — added instantly, no approval</p>
                  </div>
                </button>
              </div>

              {/* Divider */}
              <div className="px-3">
                <div className="h-px bg-gray-200" />
              </div>

              {/* Events Section */}
              <div className="p-3 space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-1">School Events</p>
                <button
                  onClick={() => openEventStepper('stepper')}
                  className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-primary-50 transition text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  <Calendar className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">Plan Event</p>
                    <p className="text-xs text-gray-600">Formal — AV, facilities &amp; admin approval</p>
                  </div>
                </button>
                <div className="w-full flex items-start gap-3 p-3 rounded-lg text-left opacity-50 cursor-not-allowed">
                  <Sparkles className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-500">AI Event Planner <span className="ml-1 text-[10px] font-semibold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Soon</span></p>
                    <p className="text-xs text-gray-400">Plan an event with AI assistance</p>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="px-3">
                <div className="h-px bg-gray-200" />
              </div>

              {/* Support Section */}
              <div className="p-3 space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2">Support</p>
                <button
                  onClick={() => openCreateDrawer('MAINTENANCE')}
                  className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-primary-50 transition text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  <Building2 className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">Facilities Request</p>
                    <p className="text-xs text-gray-600">Submit a facilities request</p>
                  </div>
                </button>
                <button
                  onClick={() => openCreateDrawer('IT')}
                  className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-primary-50 transition text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  <Headphones className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">IT Request</p>
                    <p className="text-xs text-gray-600">Submit an IT support request</p>
                  </div>
                </button>
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      {/* Dashboard Panels Grid */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 overflow-hidden"
        style={{ gridTemplateRows: 'minmax(0, 1fr)' }}
        initial="hidden"
        animate="visible"
        variants={staggerContainer(0.1, 0.15)}
      >
        {/* Main Panel — My Tasks / Upcoming Events / Requests (mode-aware) */}
        <motion.div variants={cardEntrance} className="lg:col-span-2 ui-glass-hover p-6 focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2 min-h-0 overflow-y-auto overflow-x-hidden">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              {user.dashboardMode === 'admin' ? 'Upcoming Events' :
               user.dashboardMode === 'maintenance' ? 'Maintenance Requests' :
               user.dashboardMode === 'it' ? 'IT Requests' :
               user.dashboardMode === 'av' ? 'Upcoming A/V Events' :
               'My Tasks'}
            </h2>
          </div>

          {/* Compact stats row — labels and values adapt per mode */}
          <div className="flex gap-3 mb-6">
            {user.dashboardMode === 'admin' && (
              <>
                <div className="flex-1 bg-gradient-to-br from-primary-50/80 to-primary-100/80 backdrop-blur-sm rounded-xl p-3 border border-primary-200/30 shadow-sm text-center">
                  <p className="text-2xl font-bold text-primary-600">
                    <AnimatedCounter value={events.filter(e => new Date(e.startsAt).toDateString() === new Date().toDateString()).length} duration={0.8} />
                  </p>
                  <p className="text-[10px] text-gray-600 mt-0.5">Events Today</p>
                </div>
                <div className="flex-1 bg-gradient-to-br from-blue-50/80 to-blue-100/80 backdrop-blur-sm rounded-xl p-3 border border-blue-200/30 shadow-sm text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    <AnimatedCounter value={events.length} duration={0.8} />
                  </p>
                  <p className="text-[10px] text-gray-600 mt-0.5">Events This Week</p>
                </div>
              </>
            )}
            {user.dashboardMode === 'av' && (
              <>
                <div className="flex-1 bg-gradient-to-br from-primary-50/80 to-primary-100/80 backdrop-blur-sm rounded-xl p-3 border border-primary-200/30 shadow-sm text-center">
                  <p className="text-2xl font-bold text-primary-600">
                    <AnimatedCounter value={events.length} duration={0.8} />
                  </p>
                  <p className="text-[10px] text-gray-600 mt-0.5">Upcoming A/V Events</p>
                </div>
                <div className="flex-1 bg-gradient-to-br from-blue-50/80 to-blue-100/80 backdrop-blur-sm rounded-xl p-3 border border-blue-200/30 shadow-sm text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    <AnimatedCounter value={events.filter(e => e.avEquipmentList && e.avEquipmentList.length > 0).length} duration={0.8} />
                  </p>
                  <p className="text-[10px] text-gray-600 mt-0.5">Equipment Ready</p>
                </div>
              </>
            )}
            {(user.dashboardMode === 'maintenance' || user.dashboardMode === 'it') && (
              <>
                <div className="flex-1 bg-gradient-to-br from-primary-50/80 to-primary-100/80 backdrop-blur-sm rounded-xl p-3 border border-primary-200/30 shadow-sm text-center">
                  <p className="text-2xl font-bold text-primary-600">
                    <AnimatedCounter value={tickets.filter(t => t.status === 'OPEN').length} duration={0.8} />
                  </p>
                  <p className="text-[10px] text-gray-600 mt-0.5">Open Requests</p>
                </div>
                <div className="flex-1 bg-gradient-to-br from-blue-50/80 to-blue-100/80 backdrop-blur-sm rounded-xl p-3 border border-blue-200/30 shadow-sm text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    <AnimatedCounter value={tickets.filter(t => t.status === 'IN_PROGRESS').length} duration={0.8} />
                  </p>
                  <p className="text-[10px] text-gray-600 mt-0.5">In Progress</p>
                </div>
              </>
            )}
            {user.dashboardMode !== 'admin' && user.dashboardMode !== 'av' && user.dashboardMode !== 'maintenance' && user.dashboardMode !== 'it' && (
              <>
                <div className="flex-1 bg-gradient-to-br from-primary-50/80 to-primary-100/80 backdrop-blur-sm rounded-xl p-3 border border-primary-200/30 shadow-sm text-center">
                  <p className="text-2xl font-bold text-primary-600">
                    <AnimatedCounter value={ticketCount} duration={0.8} />
                  </p>
                  <p className="text-[10px] text-gray-600 mt-0.5">Active Requests</p>
                </div>
                <div className="flex-1 bg-gradient-to-br from-blue-50/80 to-blue-100/80 backdrop-blur-sm rounded-xl p-3 border border-blue-200/30 shadow-sm text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    <AnimatedCounter value={tickets.length} duration={0.8} />
                  </p>
                  <p className="text-[10px] text-gray-600 mt-0.5">Total Tasks</p>
                </div>
              </>
            )}
          </div>

          {/* ── Events Panel (admin or av mode) ── */}
          {(user.dashboardMode === 'admin' || user.dashboardMode === 'av') ? (
            eventsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-16">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-base font-semibold text-gray-700 mb-1">
                  {user.dashboardMode === 'av' ? 'No A/V events scheduled' : 'No upcoming events'}
                </p>
                <p className="text-sm text-gray-500">
                  {user.dashboardMode === 'av'
                    ? 'Events that require A/V support will appear here.'
                    : 'Upcoming confirmed events will appear here.'}
                </p>
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
                        {user.dashboardMode === 'av'
                          ? <Video className="w-5 h-5 text-primary-600" aria-hidden="true" />
                          : <Calendar className="w-5 h-5 text-primary-600" aria-hidden="true" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{event.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{dateLabel} · {timeStr}</p>
                        {event.room && (
                          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3 flex-shrink-0" aria-hidden="true" />{event.room}
                          </p>
                        )}
                        {/* AV mode: show parsed equipment list or pending badge */}
                        {user.dashboardMode === 'av' && (
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
                        )}
                      </div>
                      <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${isToday ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
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
            ) : tickets.length === 0 ? (
              <div className="text-center py-16">
                <IllustrationTickets className="w-48 h-40 mx-auto mb-2" />
                <p className="text-base font-semibold text-gray-700 mb-1">No tasks yet</p>
                <p className="text-sm text-gray-500 mb-4">Submit a maintenance request or create a task to get started.</p>
                <button
                  onClick={() => openCreateDrawer('MAINTENANCE')}
                  className="px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors active:scale-[0.97] cursor-pointer"
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
                        <p className="font-medium text-gray-900 truncate">{ticket.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{formatDate(ticket.createdAt)}</p>
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
        </motion.div>

        {/* Right Rail — Embedded Leo AI Assistant */}
        <motion.div
          variants={cardEntrance}
          className="min-h-0 overflow-hidden"
        >
          <ChatPanel variant="embedded" />
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
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-gray-900 rounded-full hover:bg-gray-800 disabled:opacity-50 transition active:scale-[0.97]"
            >
              {editSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => setIsEditMode(false)}
              className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition active:scale-[0.97]"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={editForm.priority}
                  onChange={(e) => setEditForm(prev => ({ ...prev, priority: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {selectedTicket.description && (
                <p className="text-gray-600 text-sm">{selectedTicket.description}</p>
              )}
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Status</p>
                  <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    selectedTicket.status === 'OPEN' ? 'bg-red-100 text-red-700' :
                    selectedTicket.status === 'IN_PROGRESS' ? 'bg-primary-100 text-primary-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {getStatusLabel(selectedTicket.status)}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Priority</p>
                  <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(selectedTicket.priority)}`}>
                    {selectedTicket.priority}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Category</p>
                  <p className="text-gray-600">{selectedTicket.category}</p>
                </div>
                {selectedTicket.locationText && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Location</p>
                    <p className="text-gray-600">{selectedTicket.locationText}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Created</p>
                  <p className="text-gray-600">{new Date(selectedTicket.createdAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                </div>
              </div>
            </div>
          )
        ) : (
          <p className="text-gray-400 text-sm">Select a task to view details.</p>
        )}
      </DetailDrawer>

      {/* Create Ticket Drawer */}
      <DetailDrawer
        isOpen={createCategory !== null}
        onClose={() => setCreateCategory(null)}
        title={createCategory === 'IT' ? 'New IT Request' : 'New Facilities Request'}
        width="md"
        footer={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCreateCategory(null)}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateSubmit}
              disabled={createSaving}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-full hover:bg-gray-800 transition disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 flex items-center justify-center gap-2"
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
          <FloatingSelect
            id="create-priority"
            label="Priority"
            value={createForm.priority}
            onChange={(e) => setCreateForm(f => ({ ...f, priority: e.target.value }))}
          >
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </FloatingSelect>

          {createError && (
            <p className="text-sm text-red-600">{createError}</p>
          )}
        </div>
      </DetailDrawer>

      {/* ─── Plan Event Stepper Drawer ────────────────────────────────────── */}
      {(() => {
        const stepLabels = ['Details', 'A/V Needs', 'Facility', 'Review']
        const stepIcons = [Calendar, Video, Building2, CheckCircle]

        const canAdvance = () => {
          if (eventStep === 1) return stepperForm.title.trim().length > 0 && !!stepperForm.startsAt && !!stepperForm.endsAt
          return true
        }

        const approvalChain: { label: string; color: string; bgColor: string; borderColor: string; icon: ReactNode; always: boolean }[] = [
          { label: 'Events Coordinator', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', icon: <Calendar className="w-4 h-4 text-blue-500" />, always: true },
          ...(stepperForm.requiresAV ? [{ label: 'A/V Production Team', color: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-200', icon: <Video className="w-4 h-4 text-purple-500" />, always: false }] : []),
          ...(stepperForm.requiresFacilitySetup ? [{ label: 'Facilities Team', color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', icon: <Building2 className="w-4 h-4 text-amber-500" />, always: false }] : []),
        ]

        const setupOptions = ['Extra seating / chairs', 'Stage or podium setup', 'Table arrangement', 'Cleaning before event', 'Outdoor setup required']

        const toggleSetupNeed = (need: string) => {
          setStepperForm(f => ({
            ...f,
            setupNeeds: f.setupNeeds.includes(need) ? f.setupNeeds.filter(n => n !== need) : [...f.setupNeeds, need]
          }))
        }

        const drawerTitle = `Plan Event${eventStep < 4 ? ` — Step ${eventStep} of 3` : ' — Review'}`

        const footer = (
          <div className="space-y-3">
            {eventStepperError && (
              <p className="text-sm text-red-600 text-center">{eventStepperError}</p>
            )}
            <div className="flex items-center gap-3">
              {eventStep > 1 ? (
                <button
                  onClick={() => { setEventStep(s => s - 1); setEventStepperError('') }}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              ) : (
                <button
                  onClick={() => setEventStepperOpen(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
                >
                  Cancel
                </button>
              )}
              {eventStep === 4 ? (
                <button
                  onClick={handleStepperSubmit}
                  disabled={eventStepperSaving || !canAdvance()}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-full hover:bg-gray-800 transition disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 flex items-center justify-center gap-2"
                >
                  {eventStepperSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit for Approval
                </button>
              ) : (
                <button
                  onClick={() => { if (canAdvance()) { setEventStep(s => s + 1); setEventStepperError('') } else { setEventStepperError('Please fill in the required fields.') } }}
                  disabled={!canAdvance()}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-full hover:bg-gray-800 transition disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 flex items-center justify-center gap-1.5"
                >
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )

        return (
          <DetailDrawer
            isOpen={eventStepperOpen}
            onClose={() => setEventStepperOpen(false)}
            title={drawerTitle}
            width="lg"
            footer={footer}
          >
            <div className="space-y-6">
              {/* Step Progress Indicator */}
              <div className="flex items-center gap-0">
                {stepLabels.map((label, i) => {
                  const stepNum = i + 1
                  const isComplete = eventStep > stepNum
                  const isCurrent = eventStep === stepNum
                  const StepIcon = stepIcons[i]
                  return (
                    <div key={label} className={`flex items-center ${i < stepLabels.length - 1 ? 'flex-1' : ''}`}>
                      <div className="flex flex-col items-center gap-1">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${isComplete ? 'bg-green-500 shadow-sm' : isCurrent ? 'bg-gray-900 shadow-md ring-4 ring-gray-900/10' : 'bg-gray-100'}`}>
                          {isComplete ? (
                            <Check className="w-4 h-4 text-white" />
                          ) : (
                            <StepIcon className={`w-4 h-4 ${isCurrent ? 'text-white' : 'text-gray-400'}`} />
                          )}
                        </div>
                        <span className={`text-[10px] font-medium whitespace-nowrap ${isCurrent ? 'text-gray-900' : isComplete ? 'text-green-600' : 'text-gray-400'}`}>{label}</span>
                      </div>
                      {i < stepLabels.length - 1 && (
                        <div className={`flex-1 h-0.5 mb-4 mx-1 transition-colors duration-300 ${eventStep > stepNum ? 'bg-green-400' : 'bg-gray-200'}`} />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* ── Step 1: Event Details ─── */}
              {eventStep === 1 && (
                <AnimatePresence mode="wait">
                  <motion.div key="step-1" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-4">
                    <FloatingInput
                      id="stepper-title"
                      label="Event Title"
                      required
                      value={stepperForm.title}
                      onChange={(e) => setStepperForm(f => ({ ...f, title: e.target.value }))}
                    />
                    <FloatingInput
                      id="stepper-room"
                      label="Room / Location"
                      placeholder="e.g. Main Auditorium, Gym, Room 204"
                      value={stepperForm.room}
                      onChange={(e) => setStepperForm(f => ({ ...f, room: e.target.value }))}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="stepper-starts" className="block text-xs font-medium text-gray-600 mb-1">Start Time <span className="text-red-500">*</span></label>
                        <input
                          id="stepper-starts"
                          type="datetime-local"
                          value={stepperForm.startsAt}
                          onChange={(e) => setStepperForm(f => ({ ...f, startsAt: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900"
                        />
                      </div>
                      <div>
                        <label htmlFor="stepper-ends" className="block text-xs font-medium text-gray-600 mb-1">End Time <span className="text-red-500">*</span></label>
                        <input
                          id="stepper-ends"
                          type="datetime-local"
                          value={stepperForm.endsAt}
                          onChange={(e) => setStepperForm(f => ({ ...f, endsAt: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900"
                        />
                      </div>
                    </div>
                    <FloatingTextarea
                      id="stepper-description"
                      label="Description"
                      value={stepperForm.description}
                      onChange={(e) => setStepperForm(f => ({ ...f, description: e.target.value }))}
                      rows={2}
                    />
                    <AttendeePicker
                      value={stepperForm.attendees}
                      onChange={(attendees) => setStepperForm(f => ({ ...f, attendees }))}
                    />
                  </motion.div>
                </AnimatePresence>
              )}

              {/* ── Step 2: A/V Needs ─── */}
              {eventStep === 2 && (
                <AnimatePresence mode="wait">
                  <motion.div key="step-2" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-4">
                    <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 flex items-start gap-2.5">
                      <Video className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-purple-800">Does this event need audio/visual support from the A/V Production team?</p>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer select-none p-3 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition">
                      <div className="relative flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={stepperForm.requiresAV}
                          onChange={(e) => setStepperForm(f => ({ ...f, requiresAV: e.target.checked, avRequirements: e.target.checked ? f.avRequirements : '' }))}
                          className="sr-only peer"
                          id="stepper-requires-av"
                        />
                        <div className="w-10 h-6 bg-gray-200 rounded-full peer-checked:bg-purple-600 transition-colors" />
                        <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">This event requires A/V support</p>
                        <p className="text-xs text-gray-500">Projectors, microphones, livestream, recording, etc.</p>
                      </div>
                    </label>
                    {stepperForm.requiresAV && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                        <label htmlFor="stepper-av-req" className="block text-sm font-medium text-gray-700">Describe your A/V needs</label>
                        <textarea
                          id="stepper-av-req"
                          value={stepperForm.avRequirements}
                          onChange={(e) => setStepperForm(f => ({ ...f, avRequirements: e.target.value }))}
                          placeholder="e.g. 1 projector, 2 wireless mics, livestream to YouTube, recording equipment…"
                          rows={4}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
                        />
                        <p className="text-xs text-gray-400 flex items-center gap-1.5">
                          <Zap className="w-3 h-3 text-purple-400" />
                          AI will automatically parse your description into a structured equipment list.
                        </p>
                      </motion.div>
                    )}
                    {!stepperForm.requiresAV && (
                      <p className="text-sm text-gray-400 text-center py-4">No A/V support needed — you can skip this step.</p>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}

              {/* ── Step 3: Facility Needs ─── */}
              {eventStep === 3 && (
                <AnimatePresence mode="wait">
                  <motion.div key="step-3" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-4">
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start gap-2.5">
                      <Building2 className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-amber-800">Does this event require any physical setup or facility support from the Maintenance team?</p>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer select-none p-3 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition">
                      <div className="relative flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={stepperForm.requiresFacilitySetup}
                          onChange={(e) => setStepperForm(f => ({ ...f, requiresFacilitySetup: e.target.checked, setupNeeds: e.target.checked ? f.setupNeeds : [], facilityNotes: e.target.checked ? f.facilityNotes : '' }))}
                          className="sr-only peer"
                          id="stepper-requires-facility"
                        />
                        <div className="w-10 h-6 bg-gray-200 rounded-full peer-checked:bg-amber-500 transition-colors" />
                        <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">This event needs facility setup</p>
                        <p className="text-xs text-gray-500">Seating, staging, cleaning, room arrangement, etc.</p>
                      </div>
                    </label>
                    {stepperForm.requiresFacilitySetup && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                        <p className="text-sm font-medium text-gray-700">What setup is needed? <span className="text-gray-400 font-normal">(select all that apply)</span></p>
                        <div className="grid grid-cols-2 gap-2">
                          {setupOptions.map(opt => (
                            <label key={opt} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition text-sm font-medium select-none ${stepperForm.setupNeeds.includes(opt) ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                              <input type="checkbox" checked={stepperForm.setupNeeds.includes(opt)} onChange={() => toggleSetupNeed(opt)} className="sr-only" />
                              <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition ${stepperForm.setupNeeds.includes(opt) ? 'bg-amber-500' : 'border border-gray-300 bg-white'}`}>
                                {stepperForm.setupNeeds.includes(opt) && <Check className="w-2.5 h-2.5 text-white" />}
                              </div>
                              {opt}
                            </label>
                          ))}
                        </div>
                        <FloatingTextarea
                          id="stepper-facility-notes"
                          label="Additional facility notes"
                          value={stepperForm.facilityNotes}
                          onChange={(e) => setStepperForm(f => ({ ...f, facilityNotes: e.target.value }))}
                          rows={2}
                        />
                      </motion.div>
                    )}
                    {!stepperForm.requiresFacilitySetup && (
                      <p className="text-sm text-gray-400 text-center py-4">No facility setup needed — you can skip this step.</p>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}

              {/* ── Step 4: Review & Approval ─── */}
              {eventStep === 4 && (
                <AnimatePresence mode="wait">
                  <motion.div key="step-4" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-5">
                    {/* Event summary */}
                    <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-600" />
                        Event Summary
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Title</span>
                          <span className="font-medium text-gray-900 max-w-[60%] text-right">{stepperForm.title || '—'}</span>
                        </div>
                        {stepperForm.room && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Location</span>
                            <span className="font-medium text-gray-900">{stepperForm.room}</span>
                          </div>
                        )}
                        {stepperForm.startsAt && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Date & Time</span>
                            <span className="font-medium text-gray-900">
                              {new Date(stepperForm.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })},{' '}
                              {new Date(stepperForm.startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              {stepperForm.endsAt ? ` – ${new Date(stepperForm.endsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}
                            </span>
                          </div>
                        )}
                        {stepperForm.attendees.length > 0 && (
                          <div className="flex justify-between items-start">
                            <span className="text-gray-500">Attendees</span>
                            <span className="font-medium text-gray-900 text-right max-w-[60%]">
                              {stepperForm.attendees.map(a => a.firstName || a.email.split('@')[0]).join(', ')}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-500">A/V Support</span>
                          <span className={`font-medium ${stepperForm.requiresAV ? 'text-purple-700' : 'text-gray-400'}`}>{stepperForm.requiresAV ? 'Required' : 'Not needed'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Facility Setup</span>
                          <span className={`font-medium ${stepperForm.requiresFacilitySetup ? 'text-amber-700' : 'text-gray-400'}`}>{stepperForm.requiresFacilitySetup ? 'Required' : 'Not needed'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Approval chain */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-gray-600" />
                        Approval Required Before Publishing
                      </h3>
                      <p className="text-xs text-gray-500 mb-3">Your event will go through the following review before it appears on the main calendar:</p>
                      <div className="space-y-2">
                        {approvalChain.map((approver, i) => (
                          <div key={approver.label} className={`flex items-center gap-3 p-3 rounded-xl border ${approver.bgColor} ${approver.borderColor}`}>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center ${approver.bgColor} border ${approver.borderColor} flex-shrink-0`}>
                              {approver.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold ${approver.color}`}>{approver.label}</p>
                              {approver.always && <p className="text-xs text-gray-500">Always required for all events</p>}
                              {!approver.always && approver.label.includes('A/V') && <p className="text-xs text-gray-500">Required because A/V support was requested</p>}
                              {!approver.always && approver.label.includes('Facilities') && <p className="text-xs text-gray-500">Required because facility setup was requested</p>}
                            </div>
                            <div className="flex-shrink-0 flex items-center gap-1">
                              {i < approvalChain.length - 1 ? (
                                <span className="text-xs text-gray-400 font-medium">Step {i + 1}</span>
                              ) : (
                                <span className="text-xs text-green-600 font-semibold">→ Published</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-xs text-gray-400 flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        Approval usually takes 1–2 business days.
                      </p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </DetailDrawer>
        )
      })()}

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
      />
    </DashboardLayout>
  )
}

// ─── Leo Item Drawer Content ──────────────────────────────────────────────────

function LeoItemDrawerContent({
  type,
  item,
  detail,
}: {
  type: string
  item: Record<string, unknown>
  detail: Record<string, unknown> | null
}) {
  if (type === 'events') return <EventDrawerContent item={item} detail={detail} />
  if (type === 'tickets') return <TicketDrawerContent item={item} />
  if (type === 'users') return <UserDrawerContent item={item} />
  if (type === 'inventory') return <InventoryDrawerContent item={item} />
  return <GenericDrawerContent item={item} />
}

function EventDrawerContent({ item, detail }: { item: Record<string, unknown>; detail: Record<string, unknown> | null }) {
  // Merge Leo's item data with full API detail (if fetched)
  const title = (detail?.title ?? item.title) as string
  const description = (detail?.description ?? item.description) as string | undefined
  const locationText = (detail?.locationText ?? item.location) as string | undefined
  const startTime = detail?.startTime as string | undefined
  const endTime = detail?.endTime as string | undefined
  const calendarName = (detail?.calendar as Record<string, unknown>)?.name as string ?? item.calendar as string ?? ''
  const calendarColor = (detail?.calendar as Record<string, unknown>)?.color as string ?? '#3B82F6'
  const createdBy = detail?.createdBy as Record<string, unknown> | undefined
  const attendees = detail?.attendees as Array<Record<string, unknown>> | undefined
  const host = item.host as string | undefined
  const date = item.date as string | undefined
  const time = item.time as string | undefined
  const hasOrganizer = createdBy != null || host != null

  const formatEventTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    } catch { return '' }
  }

  const formatEventDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    } catch { return '' }
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h3 className="text-xl font-bold text-gray-900">{title}</h3>
        {description && (
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">{description}</p>
        )}
      </div>

      {/* Date & Time */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <Calendar className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-900">
              {startTime ? formatEventDate(startTime) : date || 'Date not set'}
            </p>
            <p className="text-sm text-gray-500">
              {startTime && endTime
                ? `${formatEventTime(startTime)} – ${formatEventTime(endTime)}`
                : time || ''
              }
            </p>
          </div>
        </div>

        {/* Location */}
        {locationText && (
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-900">{locationText}</p>
          </div>
        )}

        {/* Calendar */}
        {calendarName && (
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: calendarColor }} />
            </div>
            <p className="text-sm text-gray-700">{calendarName}</p>
          </div>
        )}
      </div>

      {hasOrganizer && (
        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Organizer</p>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {createdBy
                ? String(createdBy.firstName || createdBy.name || 'U').charAt(0).toUpperCase()
                : (host || 'U').charAt(0).toUpperCase()
              }
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {createdBy
                  ? String([createdBy.firstName, createdBy.lastName].filter(Boolean).join(' ') || createdBy.name || createdBy.email || '')
                  : (host || '')
                }
              </p>
              {createdBy?.email != null && (
                <p className="text-xs text-gray-500">{String(createdBy.email)}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Attendees */}
      {attendees && attendees.length > 0 && (
        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
            Attendees ({attendees.length})
          </p>
          <div className="space-y-2">
            {attendees.map((att, i) => {
              const u = att.user as Record<string, unknown>
              const name = String([u.firstName, u.lastName].filter(Boolean).join(' ') || u.name || 'User')
              const status = att.responseStatus as string
              return (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {u.avatar ? (
                      <img src={String(u.avatar)} alt={name} className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-bold text-gray-600">
                        {name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-700 flex-1">{name}</span>
                  {status && status !== 'PENDING' && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      status === 'ACCEPTED' ? 'bg-green-100 text-green-700' :
                      status === 'DECLINED' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {status.charAt(0) + status.slice(1).toLowerCase()}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Equipment / Metadata */}
      {!!(detail?.metadata && typeof detail.metadata === 'object' && (detail.metadata as Record<string, unknown>).equipment_list) && (
        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Equipment</p>
          <div className="space-y-1.5">
            {(((detail.metadata as Record<string, unknown>).equipment_list) as Array<Record<string, unknown>>).map((eq, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{String(eq.item)}</span>
                <span className="text-gray-400 font-medium">×{Number(eq.quantity)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TicketDrawerContent({ item }: { item: Record<string, unknown> }) {
  const statusColors: Record<string, string> = {
    OPEN: 'bg-red-100 text-red-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    RESOLVED: 'bg-green-100 text-green-700',
  }
  const priorityColors: Record<string, string> = {
    CRITICAL: 'bg-red-100 text-red-700',
    HIGH: 'bg-orange-100 text-orange-700',
    NORMAL: 'bg-yellow-100 text-yellow-700',
    LOW: 'bg-green-100 text-green-700',
  }

  return (
    <div className="space-y-5">
      <h3 className="text-xl font-bold text-gray-900">{String(item.title)}</h3>
      <div className="flex flex-wrap gap-2">
        {!!item.status && (
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[String(item.status)] || 'bg-gray-100 text-gray-600'}`}>
            {String(item.status).replace(/_/g, ' ')}
          </span>
        )}
        {!!item.priority && (
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${priorityColors[String(item.priority)] || 'bg-gray-100 text-gray-600'}`}>
            {String(item.priority)}
          </span>
        )}
      </div>
      <div className="space-y-3 text-sm">
        {!!item.category && (
          <div><span className="font-medium text-gray-700">Category:</span> <span className="text-gray-600">{String(item.category)}</span></div>
        )}
        {!!item.location && (
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">{String(item.location)}</span>
          </div>
        )}
        {!!item.assignee && (
          <div><span className="font-medium text-gray-700">Assigned to:</span> <span className="text-gray-600">{String(item.assignee)}</span></div>
        )}
        {!!item.created && (
          <div><span className="font-medium text-gray-700">Created:</span> <span className="text-gray-600">{String(item.created)}</span></div>
        )}
        {!!item.id && (
          <div><span className="font-medium text-gray-700">ID:</span> <span className="text-gray-400">{String(item.id)}</span></div>
        )}
      </div>
    </div>
  )
}

function UserDrawerContent({ item }: { item: Record<string, unknown> }) {
  const nameStr = String(item.name || 'U')
  const initials = nameStr
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-primary-500 flex items-center justify-center text-white text-xl font-bold">
          {initials}
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">{nameStr}</h3>
          {!!item.email && <p className="text-sm text-gray-500">{String(item.email)}</p>}
        </div>
      </div>
      <div className="space-y-3 text-sm pt-2 border-t border-gray-100">
        {!!item.role && (
          <div><span className="font-medium text-gray-700">Role:</span> <span className="text-gray-600">{String(item.role)}</span></div>
        )}
        {!!item.team && (
          <div><span className="font-medium text-gray-700">Team:</span> <span className="text-gray-600">{String(item.team)}</span></div>
        )}
        {!!item.status && (
          <div>
            <span className="font-medium text-gray-700">Status:</span>{' '}
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${item.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {String(item.status)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function InventoryDrawerContent({ item }: { item: Record<string, unknown> }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200/50 flex items-center justify-center">
          <Package className="w-6 h-6 text-amber-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-900">{String(item.name)}</h3>
      </div>
      <div className="flex gap-3">
        {item.quantity !== undefined && (
          <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
            <p className="text-2xl font-bold text-gray-900">{Number(item.quantity)}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
        )}
        {item.available !== undefined && (
          <div className="flex-1 bg-green-50 rounded-xl p-3 text-center border border-green-100">
            <p className="text-2xl font-bold text-green-700">{Number(item.available)}</p>
            <p className="text-xs text-gray-500">Available</p>
          </div>
        )}
      </div>
      <div className="space-y-3 text-sm">
        {!!item.category && (
          <div><span className="font-medium text-gray-700">Category:</span> <span className="text-gray-600">{String(item.category)}</span></div>
        )}
        {!!item.location && (
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">{String(item.location)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function GenericDrawerContent({ item }: { item: Record<string, unknown> }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-gray-900">{String(item.title ?? item.name ?? 'Details')}</h3>
      {!!item.subtitle && <p className="text-sm text-gray-600">{String(item.subtitle)}</p>}
      {!!item.detail && <p className="text-sm text-gray-500">{String(item.detail)}</p>}
      {!!item.badge && (
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
          {String(item.badge)}
        </span>
      )}
    </div>
  )
}
