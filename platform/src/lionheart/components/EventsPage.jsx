import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import CalendarGrid from './CalendarGrid'
import WeekViewCalendar from './WeekViewCalendar'
import { filterEventsNeedingAV, filterEventsNeedingFacilities } from '../data/eventsData'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function getWeekStart(d) {
  const date = new Date(d)
  const day = date.getDay()
  date.setDate(date.getDate() - day)
  date.setHours(0, 0, 0, 0)
  return date
}

export default function EventsPage({
  events,
  setEvents,
  currentUser,
  onCreateEvent,
  onCreateSmartEvent,
  onOpenEventInfo,
  onEditEvent,
  liveEvent,
  currentUserTeamIds = [],
}) {
  const allEvents = events ?? []
  const [calendarView, setCalendarView] = useState('week') // 'day' | 'week' | 'month'
  const [calendarFilter, setCalendarFilter] = useState('all') // 'all' | 'av' | 'facilities'
  const [date, setDate] = useState(() => new Date())
  const [selectedEventId, setSelectedEventId] = useState(null)

  const year = date.getFullYear()
  const month = date.getMonth()
  const weekStart = useMemo(() => getWeekStart(date), [date])

  const prevMonth = () => setDate(new Date(year, month - 1))
  const nextMonth = () => setDate(new Date(year, month + 1))
  const prevWeek = () => setDate((d) => { const x = new Date(d); x.setDate(x.getDate() - 7); return x })
  const nextWeek = () => setDate((d) => { const x = new Date(d); x.setDate(x.getDate() + 7); return x })
  const prevDay = () => setDate((d) => { const x = new Date(d); x.setDate(x.getDate() - 1); return x })
  const nextDay = () => setDate((d) => { const x = new Date(d); x.setDate(x.getDate() + 1); return x })
  const goToday = () => setDate(new Date())

  const eventList = useMemo(() => {
    if (calendarFilter === 'av') return filterEventsNeedingAV(allEvents)
    if (calendarFilter === 'facilities') return filterEventsNeedingFacilities(allEvents)
    return allEvents
  }, [allEvents, calendarFilter])

  const openEventInfo = (ev) => {
    setSelectedEventId(ev?.id ?? null)
    onOpenEventInfo?.(ev)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col min-h-0 flex-1 gap-6"
    >
      <section className="glass-card overflow-hidden flex flex-col flex-1 min-h-0">
          {/* Calendar filter: All | A/V | Facilities — only show when user is in those teams */}
          {(currentUserTeamIds?.includes('av') || currentUserTeamIds?.includes('facilities')) && (
            <div className="px-4 pt-4 flex items-center gap-2 shrink-0">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Show:</span>
              {['all', 'av', 'facilities'].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setCalendarFilter(f)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                    calendarFilter === f
                      ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {f === 'all' ? 'All events' : f === 'av' ? 'Needs A/V' : 'Needs Facilities'}
                </button>
              ))}
            </div>
          )}
          {/* Single nav bar: arrows+Today | Day/Week/Month tabs (center) | date range */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 dark:border-blue-950/40 flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-1 shrink-0">
              {calendarView === 'month' ? (
                <>
                  <button type="button" onClick={prevMonth} className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700" aria-label="Previous month">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button type="button" onClick={goToday} className="px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700">Today</button>
                  <button type="button" onClick={nextMonth} className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700" aria-label="Next month">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              ) : calendarView === 'day' ? (
                <>
                  <button type="button" onClick={prevDay} className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700" aria-label="Previous day">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button type="button" onClick={goToday} className="px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700">Today</button>
                  <button type="button" onClick={nextDay} className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700" aria-label="Next day">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={prevWeek} className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700" aria-label="Previous week">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button type="button" onClick={goToday} className="px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700">Today</button>
                  <button type="button" onClick={nextWeek} className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700" aria-label="Next week">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
            <div className="flex rounded-lg bg-zinc-100 dark:bg-zinc-800 p-0.5 border border-zinc-200 dark:border-zinc-700 flex-1 justify-center mx-4">
              {(['day', 'week', 'month']).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCalendarView(v)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                    calendarView === v
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="shrink-0 text-sm font-medium text-zinc-600 dark:text-zinc-400 min-w-[120px] text-right">
              {calendarView === 'month'
                ? `${MONTHS[month]} ${year}`
                : (() => {
                    const d0 = calendarView === 'day' ? date : weekStart
                    const count = calendarView === 'day' ? 1 : 7
                    const d1 = new Date(d0)
                    d1.setDate(d1.getDate() + count - 1)
                    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                    const fmt = (x) => `${days[x.getDay()]} ${x.getDate()}`
                    return count === 1 ? fmt(d0) : `${fmt(d0)} – ${fmt(d1)} ${d1.getFullYear()}`
                  })()}
            </div>
          </div>
          <div className="p-4 flex-1 min-h-0 flex flex-col">
            {calendarView === 'month' && (
              <CalendarGrid
                year={year}
                month={month}
                events={eventList}
                onDaySelect={(y, m, d) => {
                  setDate(new Date(y, m, d))
                  setCalendarView('day')
                }}
                onEventSelect={(ev) => openEventInfo(ev)}
                className="flex-1 min-h-0"
              />
            )}
            {calendarView === 'week' && (
              <WeekViewCalendar
                weekStart={weekStart}
                onPrevWeek={prevWeek}
                onNextWeek={nextWeek}
                onToday={goToday}
                events={eventList}
                onEventSelect={(ev) => openEventInfo(ev)}
                className="flex-1 min-h-0"
                hideNav
              />
            )}
            {calendarView === 'day' && (
              <WeekViewCalendar
                weekStart={date}
                onPrevWeek={() => setDate((d) => { const x = new Date(d); x.setDate(x.getDate() - 1); return x })}
                onNextWeek={() => setDate((d) => { const x = new Date(d); x.setDate(x.getDate() + 1); return x })}
                onToday={goToday}
                events={eventList}
                onEventSelect={(ev) => openEventInfo(ev)}
                className="flex-1 min-h-0"
                singleDay
                hideNav
              />
            )}
          </div>
        </section>

      </motion.div>
  )
}
