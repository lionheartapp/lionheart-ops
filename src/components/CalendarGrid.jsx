import { useMemo } from 'react'
import { getEventPillClasses } from '../utils/eventColors'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function toDateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Expand recurring events into one entry per occurrence for the given month. Each entry is { ...event, date } so the calendar shows a dot; use event.id to look up the real event. */
function expandRecurringForMonth(events, year, month) {
  if (!events?.length) return []
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const monthStart = first.getTime()
  const monthEnd = last.getTime()
  const result = []

  for (const ev of events) {
    const evDate = ev.date
    if (!evDate) continue
    const [y, m, d] = evDate.split('-').map(Number)
    const start = new Date(y, (m || 1) - 1, d || 1)
    if (start.getTime() > monthEnd) continue

    if (!ev.repeatEnabled || ev.repeatRule === 'none') {
      if (start.getTime() >= monthStart && start.getTime() <= monthEnd) {
        result.push({ ...ev, date: evDate })
      }
      continue
    }

    const rule = ev.repeatRule || 'daily'
    const endDate = ev.repeatEndDate ? new Date(ev.repeatEndDate) : new Date(start)
    if (rule === 'daily') {
      endDate.setDate(endDate.getDate() + 60)
    } else if (rule === 'weekly' || rule === 'weekdays') {
      endDate.setDate(endDate.getDate() + 56)
    } else {
      endDate.setDate(endDate.getDate() + 365)
    }

    const startWeekday = start.getDay()
    let cur = new Date(start)

    while (cur.getTime() <= monthEnd) {
      if (cur.getTime() >= monthStart) {
        const dateStr = toDateStr(cur.getFullYear(), cur.getMonth(), cur.getDate())
        if (rule === 'daily') {
          result.push({ ...ev, date: dateStr })
        } else if (rule === 'weekly') {
          result.push({ ...ev, date: dateStr })
        } else if (rule === 'weekdays') {
          const wd = cur.getDay()
          if (wd >= 1 && wd <= 5) result.push({ ...ev, date: dateStr })
        } else {
          result.push({ ...ev, date: dateStr })
        }
      }
      if (rule === 'daily') {
        cur.setDate(cur.getDate() + 1)
      } else if (rule === 'weekly') {
        cur.setDate(cur.getDate() + 7)
      } else if (rule === 'weekdays') {
        cur.setDate(cur.getDate() + 1)
        if (cur.getDay() === 0) cur.setDate(cur.getDate() + 1)
      } else {
        cur.setDate(cur.getDate() + 1)
      }
      if (cur.getTime() > endDate.getTime()) break
    }
  }
  return result
}

export default function CalendarGrid({ year, month, events, onDaySelect, onEventSelect, className = '' }) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPad = firstDay.getDay()
  const daysInMonth = lastDay.getDate()
  const totalCells = startPad + daysInMonth
  const rows = Math.ceil(totalCells / 7)

  const days = useMemo(() => {
    const d = []
    for (let i = 0; i < startPad; i++) d.push(null)
    for (let i = 1; i <= daysInMonth; i++) d.push(i)
    const remainder = rows * 7 - d.length
    for (let i = 0; i < remainder; i++) d.push(null)
    return d
  }, [startPad, daysInMonth, rows])

  const expandedEvents = useMemo(
    () => expandRecurringForMonth(events, year, month),
    [events, year, month]
  )

  const getEventsForDay = (day) => {
    if (!day) return []
    const dateStr = toDateStr(year, month, day)
    return expandedEvents.filter((e) => e.date === dateStr)
  }

  const today = new Date()
  const isToday = (day) =>
    day &&
    year === today.getFullYear() &&
    month === today.getMonth() &&
    day === today.getDate()

  return (
    <div
      className={`grid grid-cols-7 gap-px bg-zinc-200 dark:bg-zinc-700 rounded-xl overflow-hidden ${className}`}
      style={{
        gridTemplateRows: `auto repeat(${rows}, minmax(0, 1fr))`,
      }}
    >
      {WEEKDAYS.map((wd) => (
        <div
          key={wd}
          className="bg-zinc-100 dark:bg-zinc-800/80 py-2 text-center text-xs font-semibold text-zinc-500 dark:text-zinc-400"
        >
          {wd}
        </div>
      ))}
      {days.map((day, i) => {
        const dayEvents = getEventsForDay(day)
        const todayActive = isToday(day)
        const handleDayClick = () => {
          if (!day) return
          onDaySelect?.(year, month, day)
        }
        const handleDotClick = (e, ev) => {
          e.stopPropagation()
          if (!onEventSelect) return
          const parent = (events || []).find((x) => x.id === ev.id)
          onEventSelect(parent || ev)
        }
        return (
          <div
            key={i}
            role="button"
            tabIndex={!day ? -1 : 0}
            onClick={handleDayClick}
            onKeyDown={(e) => !day ? null : e.key === 'Enter' && handleDayClick()}
            className={`min-h-[60px] p-2 flex flex-col items-stretch justify-start bg-white dark:bg-zinc-800/80 hover:bg-blue-500/10 dark:hover:bg-blue-500/10 transition-colors text-left cursor-pointer ${
              !day ? 'invisible' : ''
            }`}
          >
            <span
              className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full shrink-0 self-center ${
                todayActive ? 'bg-blue-500 text-white' : 'text-zinc-700 dark:text-zinc-300'
              }`}
            >
              {day || ''}
            </span>
            {dayEvents.length > 0 && (
              <div className="mt-1.5 flex flex-col gap-0.5 w-full min-w-0">
                {dayEvents.slice(0, 2).map((ev) => {
                  const label = (ev.name || 'Event').split('|').pop()?.trim() || ev.name || 'Event'
                  const short = label.length > 10 ? label.slice(0, 10) + '…' : label
                  return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={(e) => handleDotClick(e, ev)}
                    className={`w-full min-h-[6px] h-5 px-1.5 rounded py-0.5 text-left text-[10px] font-medium truncate transition-colors focus:outline-none focus:ring-2 focus:ring-inset ${getEventPillClasses(ev)}`}
                    title={ev.name}
                    aria-label={`View ${ev.name}`}
                  >
                    {short}
                  </button>
                  )
                })}
                {dayEvents.length > 2 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDayClick()
                    }}
                    className="text-[10px] text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium text-left"
                  >
                    +{dayEvents.length - 2} more
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

