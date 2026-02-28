'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  useCalendars,
  useCalendarEvents,
  useCalendarNavigation,
  useCreateCalendar,
  useCreateEvent,
  useDeleteEvent,
  type CalendarEventData,
} from '@/lib/hooks/useCalendar'
import CalendarToolbar from './CalendarToolbar'
import CalendarSidebar from './CalendarSidebar'
import MonthView from './MonthView'
import WeekView from './WeekView'
import DayView from './DayView'
import AgendaView from './AgendaView'
import EventDetailPanel from './EventDetailPanel'
import EventCreatePanel, { type EventFormData } from './EventCreatePanel'
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react'

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

  const createCalendar = useCreateCalendar()
  const createEvent = useCreateEvent()
  const deleteEvent = useDeleteEvent()

  // Quick-create calendar state
  const [showCreateCalendar, setShowCreateCalendar] = useState(false)
  const [newCalendarName, setNewCalendarName] = useState('')
  const [newCalendarType, setNewCalendarType] = useState('GENERAL')

  const handleCreateCalendar = async () => {
    if (!newCalendarName.trim()) return
    const slug = newCalendarName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    await createCalendar.mutateAsync({
      name: newCalendarName.trim(),
      slug,
      calendarType: newCalendarType,
    })
    setNewCalendarName('')
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

  const handleSubmitEvent = useCallback(async (data: EventFormData) => {
    await createEvent.mutateAsync(data as unknown as Record<string, unknown>)
    setIsCreateOpen(false)
  }, [createEvent])

  const handleDeleteEvent = useCallback(async (eventId: string) => {
    if (!confirm('Delete this event?')) return
    await deleteEvent.mutateAsync(eventId)
    setSelectedEvent(null)
  }, [deleteEvent])

  // Sidebar visibility
  const [sidebarOpen, setSidebarOpen] = useState(true)

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
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCreateCalendar(false)}
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
    <div className="flex h-[calc(100vh-8rem)] gap-0">
      {/* Sidebar */}
      <div className={`flex-shrink-0 border-r border-gray-200 bg-white transition-all duration-300 overflow-hidden ${
        sidebarOpen ? 'w-56 p-3' : 'w-0'
      }`}>
        {sidebarOpen && (
          <CalendarSidebar
            calendars={calendars}
            visibleCalendarIds={visibleCalendarIds}
            onToggleCalendar={toggleCalendar}
          />
        )}
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 p-4">
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

        {/* View */}
        <div className="flex-1 min-h-0">
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
      </div>

      {/* Panels */}
      <EventDetailPanel
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onEdit={(event) => {
          setSelectedEvent(null)
          // TODO: Open edit panel
        }}
        onDelete={handleDeleteEvent}
      />

      <EventCreatePanel
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleSubmitEvent}
        isSubmitting={createEvent.isPending}
        calendars={calendars}
        initialStart={createInitialStart}
        initialEnd={createInitialEnd}
      />
    </div>
  )
}
