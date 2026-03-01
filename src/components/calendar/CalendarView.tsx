'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
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
  type CalendarEventData,
} from '@/lib/hooks/useCalendar'
import CalendarToolbar from './CalendarToolbar'
import MonthView from './MonthView'
import WeekView from './WeekView'
import DayView from './DayView'
import AgendaView from './AgendaView'
import EventDetailPanel from './EventDetailPanel'
import EventCreatePanel, { type EventFormData } from './EventCreatePanel'
import { Calendar as CalendarIcon, Loader2, Check } from 'lucide-react'

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

  const { data: calendars = [], isLoading: calendarsLoading } = useCalendars()

  // Track visible calendars
  const [visibleCalendarIds, setVisibleCalendarIds] = useState<Set<string>>(new Set())

  // Initialize visible calendars when they load
  useMemo(() => {
    if (calendars.length > 0 && visibleCalendarIds.size === 0) {
      setVisibleCalendarIds(new Set(calendars.filter((c) => c.isActive).map((c) => c.id)))
    }
  }, [calendars])

  const toggleCalendar = useCallback((calendarId: string) => {
    setVisibleCalendarIds((prev) => {
      const next = new Set(prev)
      if (next.has(calendarId)) next.delete(calendarId)
      else next.add(calendarId)
      return next
    })
  }, [])

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

  // Fetch events for the current date range
  const { start, end } = getDateRange()
  const activeCalendarIds = Array.from(visibleCalendarIds)
  const { data: events = [], isLoading: eventsLoading } = useCalendarEvents(
    activeCalendarIds,
    start,
    end,
    activeCalendarIds.length > 0
  )

  // Event interaction state
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventData | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createInitialStart, setCreateInitialStart] = useState<Date | undefined>()
  const [createInitialEnd, setCreateInitialEnd] = useState<Date | undefined>()

  // Edit event state
  const [editingEvent, setEditingEvent] = useState<CalendarEventData | null>(null)

  // Auto-open create panel when navigated with ?create=true
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setIsCreateOpen(true)
      window.history.replaceState({}, '', '/calendar')
    }
  }, [searchParams])

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
      // Switch to day view for that date
      setCurrentDate(date)
      changeView('day')
    }
  }, [view, setCurrentDate, changeView])

  const handleSlotClick = useCallback((slotStart: Date, slotEnd: Date) => {
    setCreateInitialStart(slotStart)
    setCreateInitialEnd(slotEnd)
    setIsCreateOpen(true)
  }, [])

  const handleCreateEvent = useCallback(() => {
    setCreateInitialStart(undefined)
    setCreateInitialEnd(undefined)
    setIsCreateOpen(true)
  }, [])

  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmitEvent = useCallback(async (data: EventFormData) => {
    setFormError(null)
    try {
      await createEvent.mutateAsync(data as unknown as Record<string, unknown>)
      setIsCreateOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create event'
      setFormError(message)
      console.error('Event creation failed:', err)
    }
  }, [createEvent])

  const handleUpdateEvent = useCallback(async (data: EventFormData) => {
    if (!editingEvent) return
    setFormError(null)
    try {
      await updateEvent.mutateAsync({ id: editingEvent.id, ...data } as { id: string } & Record<string, unknown>)
      setIsCreateOpen(false)
      setEditingEvent(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update event'
      setFormError(message)
      console.error('Event update failed:', err)
    }
  }, [updateEvent, editingEvent])

  const handleDeleteEvent = useCallback(async (eventId: string) => {
    if (!confirm('Delete this event?')) return
    await deleteEvent.mutateAsync(eventId)
    setSelectedEvent(null)
  }, [deleteEvent])

  if (calendarsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    )
  }

  // Empty state — no calendars
  if (calendars.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-center">
        <div>
          <CalendarIcon className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No calendars yet</h2>
          <p className="text-gray-500 mb-6 max-w-sm">
            Create your first calendar to start organizing events for your school.
          </p>
          {!showCreateCalendar ? (
            <button
              onClick={() => setShowCreateCalendar(true)}
              className="px-5 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              Create Calendar
            </button>
          ) : (
            <div className="max-w-sm mx-auto space-y-3 text-left">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                <input
                  type="text"
                  placeholder="e.g. School Events"
                  value={newCalendarName}
                  onChange={(e) => setNewCalendarName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateCalendar()}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                <select
                  value={newCalendarType}
                  onChange={(e) => setNewCalendarType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
                >
                  <option value="GENERAL">General</option>
                  <option value="ACADEMIC">Academic</option>
                  <option value="STAFF">Staff</option>
                  <option value="ATHLETICS">Athletics</option>
                  <option value="PARENT_FACING">Parent-Facing</option>
                  <option value="TIMETABLE">Timetable</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setNewCalendarColor(c.value)}
                      className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-400"
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
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCalendar}
                  disabled={!newCalendarName.trim() || createCalendar.isPending}
                  className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
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
    <div className="flex flex-col h-[calc(100vh-6rem)] sm:h-[calc(100vh-7rem)] lg:h-[calc(100vh-8.5rem)] -mx-4 sm:-mx-10">
      {/* Header area — stays fixed, inherits page gray bg, shadow at bottom edge */}
      <div className="flex-shrink-0 px-10 pt-4 pb-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)] relative z-10">
        <CalendarToolbar
          currentDate={currentDate}
          view={view}
          onViewChange={changeView}
          onNavigateBack={goPrev}
          onNavigateForward={goNext}
          onToday={goToToday}
          onCreateEvent={handleCreateEvent}
        />

        {/* Loading overlay */}
        {eventsLoading && (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="w-4 h-4 text-primary-400 animate-spin" />
          </div>
        )}
      </div>

      {/* Scrollable view area — white background fills to bottom */}
      <div className="flex-1 min-h-0 flex flex-col bg-white overflow-hidden">
          {view === 'month' && (
            <MonthView
              currentDate={currentDate}
              events={events}
              onEventClick={handleEventClick}
              onDateClick={handleDateClick}
            />
          )}
          {view === 'week' && (
            <WeekView
              currentDate={currentDate}
              events={events}
              onEventClick={handleEventClick}
              onSlotClick={handleSlotClick}
            />
          )}
          {view === 'day' && (
            <DayView
              currentDate={currentDate}
              events={events}
              onEventClick={handleEventClick}
              onSlotClick={handleSlotClick}
            />
          )}
          {view === 'agenda' && (
            <AgendaView
              currentDate={currentDate}
              events={events}
              onEventClick={handleEventClick}
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
          setFormError(null)
          setIsCreateOpen(true)
        }}
        onDelete={handleDeleteEvent}
      />

      <EventCreatePanel
        isOpen={isCreateOpen}
        onClose={() => { setIsCreateOpen(false); setEditingEvent(null); setFormError(null) }}
        onSubmit={editingEvent ? handleUpdateEvent : handleSubmitEvent}
        isSubmitting={editingEvent ? updateEvent.isPending : createEvent.isPending}
        calendars={calendars}
        initialStart={createInitialStart}
        initialEnd={createInitialEnd}
        error={formError}
        event={editingEvent}
      />

      {/* Create Calendar Modal */}
      {showCreateCalendar && calendars.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => { setShowCreateCalendar(false); setNewCalendarName('') }}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">New Calendar</h3>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
              <input
                type="text"
                placeholder="e.g. School Events"
                value={newCalendarName}
                onChange={(e) => setNewCalendarName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreateCalendar()}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select
                value={newCalendarType}
                onChange={(e) => setNewCalendarType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
              >
                <option value="GENERAL">General</option>
                <option value="ACADEMIC">Academic</option>
                <option value="STAFF">Staff</option>
                <option value="ATHLETICS">Athletics</option>
                <option value="PARENT_FACING">Parent-Facing</option>
                <option value="TIMETABLE">Timetable</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Color</label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setNewCalendarColor(c.value)}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-400"
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
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => { setShowCreateCalendar(false); setNewCalendarName(''); setNewCalendarColor('#3b82f6') }}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCalendar}
                disabled={!newCalendarName.trim() || createCalendar.isPending}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-[#0B1320] rounded-lg hover:bg-[#161f2e] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {createCalendar.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
