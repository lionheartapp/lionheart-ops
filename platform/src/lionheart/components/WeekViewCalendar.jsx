import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getEventBlockClasses, getEventAllDayClasses } from '../utils/eventColors'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7) // 7:00 - 20:00

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null
  const [h, m] = timeStr.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/** Get minutes from midnight for event start; events without time are "all-day" (returns -1) */
function getStartMinutes(ev) {
  if (!ev.time) return -1
  return parseTime(ev.time) ?? -1
}

function getEndMinutes(ev) {
  if (!ev.endTime) {
    const start = getStartMinutes(ev)
    return start >= 0 ? start + 60 : -1
  }
  return parseTime(ev.endTime) ?? -1
}

/** Events for a given date string in the week. Includes all-day and timed. */
function getEventsForDate(events, dateStr) {
  return (events || []).filter((e) => e.date === dateStr)
}

function formatDayLabel(d) {
  const day = WEEKDAYS[d.getDay()]
  const date = d.getDate()
  const month = d.getMonth() + 1
  const year = d.getFullYear()
  return `${day} ${date.toString().padStart(2, '0')} ${month.toString().padStart(2, '0')} ${year}`
}

/** Assign overlap columns so events side-stack instead of hiding each other. Returns events with overlapCol and overlapTotal. */
function assignOverlapColumns(evts) {
  const sorted = [...evts].sort((a, b) => a.startMin - b.startMin)
  const columns = [] // columns[i] = last event's endMin in that column
  const assignments = new Map() // evKey -> { overlapCol, overlapTotal }

  for (const ev of sorted) {
    const endMin = ev.startMin + ev.duration
    const evKey = ev.id + '-' + ev.startMin
    let placed = false
    for (let c = 0; c < columns.length; c++) {
      if (columns[c] <= ev.startMin) {
        columns[c] = endMin
        assignments.set(evKey, { overlapCol: c, overlapTotal: columns.length })
        placed = true
        break
      }
    }
    if (!placed) {
      columns.push(endMin)
      assignments.set(evKey, { overlapCol: columns.length - 1, overlapTotal: columns.length })
    }
  }
  return evts.map((ev) => {
    const a = assignments.get(ev.id + '-' + ev.startMin) || { overlapCol: 0, overlapTotal: 1 }
    return { ...ev, overlapCol: a.overlapCol, overlapTotal: a.overlapTotal }
  })
}

function EventOverlay({ weekDays, timedEvents, dayStartHour, dayEndHour, hourHeight, onEventSelect }) {
  const GAP = 2
  const n = weekDays.length
  return (
    <div className="absolute left-0 right-0 top-[44px] bottom-0 pointer-events-none" style={{ minHeight: hourHeight * (dayEndHour - dayStartHour) }}>
      <div className="relative w-full h-full">
        {weekDays.map(({ dateStr }, dayIdx) => {
          const evts = assignOverlapColumns(timedEvents[dateStr] || [])
          const dayWidth = `(100% - 3.5rem) / ${n} - 6px`
          return evts.map((ev) => {
            const top = ((ev.startMin - dayStartHour * 60) / 60) * hourHeight
            const height = Math.max(28, (ev.duration / 60) * hourHeight)
            const widthVal = `calc((${dayWidth}) / ${ev.overlapTotal} - ${GAP}px)`
            const leftVal = ev.overlapTotal > 1
              ? `calc(3.5rem + ${dayIdx} * (100% - 3.5rem) / ${n} + ${ev.overlapCol} / ${ev.overlapTotal} * (${dayWidth}) + 2px)`
              : `calc(3.5rem + ${dayIdx} * (100% - 3.5rem) / ${n} + 2px)`
            return (
              <div
                key={ev.id + '-' + ev.startMin}
                className={`absolute pointer-events-auto cursor-pointer rounded-lg border-2 overflow-hidden shadow-sm ${getEventBlockClasses(ev)}`}
                style={{
                  left: leftVal,
                  width: widthVal,
                  top: top + 2 + 'px',
                  height: height - 2 + 'px',
                  minHeight: 28,
                  zIndex: ev.overlapTotal > 1 ? 5 + ev.overlapCol : 1,
                }}
                onClick={() => onEventSelect?.(ev)}
              >
                <div className="px-2 py-1.5 h-full flex flex-col min-w-0">
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm truncate">{ev.name}</div>
                  <div className="text-[11px] text-zinc-600 dark:text-zinc-300 truncate mt-0.5">
                    {ev.time}
                    {ev.endTime ? ' – ' + ev.endTime : ''}
                    {ev.location ? ' · ' + ev.location : ''}
                  </div>
                </div>
              </div>
            )
          })
        })}
      </div>
    </div>
  )
}

export default function WeekViewCalendar({
  weekStart,
  onPrevWeek,
  onNextWeek,
  onToday,
  events = [],
  onEventSelect,
  className = '',
  singleDay = false,
  hideNav = false,
}) {
  const weekDays = useMemo(() => {
    const days = []
    const d = new Date(weekStart)
    const count = singleDay ? 1 : 7
    for (let i = 0; i < count; i++) {
      days.push({
        date: new Date(d),
        dateStr: toDateStr(d),
        label: formatDayLabel(d),
        shortLabel: WEEKDAYS[d.getDay()].slice(0, 3),
      })
      d.setDate(d.getDate() + 1)
    }
    return days
  }, [weekStart, singleDay])

  const now = new Date()
  const todayStr = toDateStr(now)
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const allDayEvents = useMemo(() => {
    const byDate = {}
    weekDays.forEach(({ dateStr }) => {
      byDate[dateStr] = getEventsForDate(events, dateStr).filter((e) => !e.time)
    })
    return byDate
  }, [events, weekDays])

  const timedEvents = useMemo(() => {
    const byDate = {}
    weekDays.forEach(({ dateStr }) => {
      byDate[dateStr] = getEventsForDate(events, dateStr)
        .filter((e) => e.time)
        .map((e) => ({
          ...e,
          startMin: getStartMinutes(e),
          endMin: getEndMinutes(e),
          duration: Math.max(30, getEndMinutes(e) - getStartMinutes(e)),
        }))
    })
    return byDate
  }, [events, weekDays])

  const hourHeight = 48 // px per hour
  const dayStartHour = 7
  const dayEndHour = 21

  return (
    <div className={`flex flex-col h-full min-h-0 ${className}`}>
      {!hideNav && (
        <div className="flex items-center justify-between gap-4 mb-4 shrink-0">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onPrevWeek}
              className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onToday}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              Today
            </button>
            <button
              type="button"
              onClick={onNextWeek}
              className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              aria-label="Next week"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {singleDay
              ? `${weekDays[0].label}`
              : `${weekDays[0].shortLabel} ${weekDays[0].date.getDate()} – ${weekDays[weekDays.length - 1].shortLabel} ${weekDays[weekDays.length - 1].date.getDate()} ${
                  weekDays[0].date.getMonth() !== weekDays[weekDays.length - 1].date.getMonth()
                    ? `${weekDays[weekDays.length - 1].date.getMonth() + 1}${'/'}`
                    : ''
                }${weekDays[weekDays.length - 1].date.getFullYear()}`
            }
          </p>
        </div>
      )}

      {/* All-day row */}
      {(Object.values(allDayEvents).some((arr) => arr.length > 0)) && (
        <div
          className="grid gap-px bg-zinc-200 dark:bg-zinc-700 rounded-t-lg overflow-hidden shrink-0 mb-px"
          style={{ gridTemplateColumns: `3.5rem repeat(${weekDays.length}, 1fr)` }}
        >
          <div className="bg-zinc-100 dark:bg-zinc-800/80 py-2 px-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            All day
          </div>
          {weekDays.map(({ dateStr, shortLabel }) => (
            <div
              key={dateStr}
              className="bg-white dark:bg-zinc-800/80 p-1 min-h-[36px]"
            >
              {allDayEvents[dateStr]?.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onEventSelect?.(ev)}
                  className={`w-full text-left px-2 py-1 rounded text-xs font-medium truncate ${getEventAllDayClasses(ev)}`}
                >
                  {ev.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-700 relative">
        <div className="relative min-w-0" style={{ minHeight: hourHeight * (dayEndHour - dayStartHour) + 44 }}>
          {/* Hour labels + day columns */}
          <div
            className="grid sticky top-0 bg-zinc-50 dark:bg-zinc-900/95 z-10 border-b border-zinc-200 dark:border-zinc-700"
            style={{ gridTemplateColumns: `3.5rem repeat(${weekDays.length}, 1fr)` }}
          >
            <div className="w-14 shrink-0 py-2" />
            {weekDays.map(({ dateStr, shortLabel, date }) => (
              <div
                key={dateStr}
                className={`py-2 px-1 text-center text-xs font-semibold ${
                  dateStr === todayStr
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-500/10'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                <div>{shortLabel}</div>
                <div className="text-[10px] font-normal">{date.getDate()}</div>
              </div>
            ))}
          </div>

          {/* Time slots */}
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="grid border-b border-zinc-100 dark:border-zinc-800/80"
              style={{ height: hourHeight, gridTemplateColumns: `3.5rem repeat(${weekDays.length}, 1fr)` }}
            >
              <div className="w-14 shrink-0 py-0.5 pr-2 text-right text-xs text-zinc-400 dark:text-zinc-500">
                {hour === 12 ? '12:00' : hour > 12 ? `${hour - 12}:00` : `${hour}:00`}
                {hour >= 12 ? ' PM' : ' AM'}
              </div>
              {weekDays.map(({ dateStr }) => {
                const isToday = dateStr === todayStr
                const showNow = isToday && currentMinutes >= hour * 60 && currentMinutes < (hour + 1) * 60
                return (
                  <div
                    key={dateStr}
                    className={`relative border-l border-zinc-100 dark:border-zinc-800/50 ${
                      isToday ? 'bg-blue-500/5 dark:bg-blue-500/10' : 'bg-white dark:bg-zinc-900/50'
                    }`}
                  >
                    {showNow && (
                      <div
                        className="absolute left-0 right-0 h-0.5 bg-blue-500 z-20"
                        style={{
                          top: `${((currentMinutes - hour * 60) * (1 / 60)) * 100}%`,
                        }}
                      >
                        <span className="absolute -left-12 top-1/2 -translate-y-1/2 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-white dark:bg-zinc-900 pr-1">
                          {now.getHours() > 12 ? now.getHours() - 12 : now.getHours()}:
                          {String(now.getMinutes()).padStart(2, '0')}
                          {now.getHours() >= 12 ? ' PM' : ' AM'}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          {/* Event cards overlay - absolutely positioned */}
          <EventOverlay
            weekDays={weekDays}
            timedEvents={timedEvents}
            dayStartHour={dayStartHour}
            dayEndHour={dayEndHour}
            hourHeight={hourHeight}
            onEventSelect={onEventSelect}
          />
        </div>
      </div>
    </div>
  )
}
