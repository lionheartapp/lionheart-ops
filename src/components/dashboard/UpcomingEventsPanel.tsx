'use client'

/**
 * UpcomingEventsPanel
 *
 * Warm editorial rebuild of the dashboard's Upcoming Events widget.
 * The hero element is a 14-day timeline strip that gives the widget
 * visual identity even when empty — so the "nothing scheduled" state
 * still communicates *what this thing is* at a glance.
 *
 * Design influences (pulled from docs/design-references/):
 *   - Notion: warm neutrals (#fdfcfb / #1a1915 / #6a6864), whisper
 *     borders at 6% black, multi-layer sub-0.05 shadows.
 *   - Superhuman: tight display line-heights, warm cream secondary
 *     buttons, dark confident primary CTA (no saturated brand blue
 *     in the chrome).
 *   - Cal.com: monochrome restraint — the frame stays neutral, the
 *     event color chips carry the only saturation.
 */

import { useMemo } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { AlertTriangle, ArrowRight, Loader2, Plus, RefreshCw } from 'lucide-react'
import type { CalendarEventData } from '@/lib/hooks/useCalendar'

// ─── Design tokens (kept inline so this component is self-contained) ────────

const SURFACE = '#fdfcfb'
const BORDER = 'rgba(17, 15, 10, 0.06)'
const TEXT_PRIMARY = '#1a1915'
const TEXT_SECONDARY = '#6a6864'
const TEXT_MUTED = '#a8a49d'
const WARM_CHIP = '#f6f4f0'
const WARM_CHIP_HOVER = '#ede9e0'
const HAIRLINE = 'rgba(17, 15, 10, 0.05)'

const CARD_SHADOW =
  '0 0.8px 2.9px rgba(0,0,0,0.02), 0 2px 7.8px rgba(0,0,0,0.027), 0 4px 18px rgba(0,0,0,0.04)'

// ─── Types ───────────────────────────────────────────────────────────────────

interface UpcomingEventsPanelProps {
  events: CalendarEventData[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onEventClick: (event: CalendarEventData) => void
  onCreateEvent: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface DayCell {
  date: Date
  isToday: boolean
  eventCount: number
  eventColors: string[]
}

function buildTimeline(events: CalendarEventData[]): DayCell[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const cells: DayCell[] = []
  for (let i = 0; i < 14; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)

    const dayEvents = events.filter((event) => {
      const eventDate = new Date(event.startTime)
      eventDate.setHours(0, 0, 0, 0)
      return eventDate.getTime() === date.getTime()
    })

    cells.push({
      date,
      isToday: i === 0,
      eventCount: dayEvents.length,
      eventColors: dayEvents
        .slice(0, 3)
        .map((e) => e.category?.color || e.calendar.color || '#6366f1'),
    })
  }
  return cells
}

function formatDateRange(cells: DayCell[]): string {
  if (cells.length === 0) return ''
  const start = cells[0].date
  const end = cells[cells.length - 1].date
  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${startStr} – ${endStr}`
}

function formatEventRow(event: CalendarEventData) {
  const startDate = new Date(event.startTime)
  const endDate = new Date(event.endTime)
  const weekday = startDate
    .toLocaleDateString('en-US', { weekday: 'short' })
    .toUpperCase()
  const dayNum = startDate.getDate()
  const startTime = startDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  const endTime = endDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  return { weekday, dayNum, timeRange: `${startTime} – ${endTime}`, startDate }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function UpcomingEventsPanel({
  events,
  loading,
  error,
  onRetry,
  onEventClick,
  onCreateEvent,
}: UpcomingEventsPanelProps) {
  const timeline = useMemo(() => buildTimeline(events), [events])
  const dateRange = useMemo(() => formatDateRange(timeline), [timeline])
  const todayCount = timeline[0]?.eventCount ?? 0
  const totalCount = events.length

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex flex-col h-full min-h-0 rounded-3xl overflow-hidden"
      style={{
        backgroundColor: SURFACE,
        border: `1px solid ${BORDER}`,
        boxShadow: CARD_SHADOW,
      }}
      aria-label="Upcoming events"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 px-7 pt-7 pb-5">
        <div className="flex items-start justify-between gap-4 mb-1">
          <div className="min-w-0">
            <h2
              className="text-2xl font-semibold leading-[1.05]"
              style={{
                color: TEXT_PRIMARY,
                letterSpacing: '-0.025em',
              }}
            >
              The next two weeks
            </h2>
            <p
              className="mt-1.5 text-[13px] font-medium"
              style={{ color: TEXT_SECONDARY }}
            >
              {dateRange}
              {totalCount > 0 && (
                <>
                  <span className="mx-2" style={{ color: TEXT_MUTED }}>
                    ·
                  </span>
                  {totalCount} {totalCount === 1 ? 'event' : 'events'}
                  {todayCount > 0 && (
                    <>
                      <span className="mx-2" style={{ color: TEXT_MUTED }}>
                        ·
                      </span>
                      <span style={{ color: TEXT_PRIMARY }} className="font-semibold">
                        {todayCount} today
                      </span>
                    </>
                  )}
                </>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onCreateEvent}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold transition-all duration-200 cursor-pointer hover:-translate-y-px"
            style={{
              backgroundColor: TEXT_PRIMARY,
              color: '#ffffff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.04)',
            }}
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            Event
          </button>
        </div>
      </header>

      {/* ── Timeline strip — the visual anchor of the widget ──────────── */}
      <div className="flex-shrink-0 px-7 pb-6">
        <Timeline cells={timeline} />
      </div>

      {/* ── Divider hairline ──────────────────────────────────────────── */}
      <div className="flex-shrink-0 mx-7" style={{ borderTop: `1px solid ${HAIRLINE}` }} />

      {/* ── Content: list, empty state, loading, error ────────────────── */}
      <div className="relative flex-1 min-h-0">
        {/* Fade-out mask at the bottom for long lists */}
        {events.length > 3 && (
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-20 z-10"
            style={{
              background: `linear-gradient(to top, ${SURFACE} 0%, rgba(253,252,251,0) 100%)`,
            }}
          />
        )}

        <div className="h-full overflow-y-auto dashboard-scroll px-7 pt-2 pb-8">
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={onRetry} />
          ) : events.length === 0 ? (
            <EmptyState onCreateEvent={onCreateEvent} />
          ) : (
            <EventList events={events} onEventClick={onEventClick} />
          )}
        </div>
      </div>
    </motion.section>
  )
}

// ─── Timeline strip ─────────────────────────────────────────────────────────

function Timeline({ cells }: { cells: DayCell[] }) {
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}
      role="list"
      aria-label="14-day timeline"
    >
      {cells.map((cell, idx) => {
        const label = cell.date
          .toLocaleDateString('en-US', { weekday: 'short' })
          .slice(0, 2)
        const dayNum = cell.date.getDate()

        return (
          <motion.div
            key={idx}
            role="listitem"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: idx * 0.015, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative flex flex-col items-center justify-between py-2 px-0.5 rounded-xl text-center transition-colors duration-200"
            style={{
              backgroundColor: cell.isToday ? TEXT_PRIMARY : 'transparent',
              color: cell.isToday ? '#ffffff' : TEXT_PRIMARY,
              minHeight: '62px',
            }}
          >
            <span
              className="text-[9px] font-semibold uppercase tracking-[0.12em]"
              style={{
                color: cell.isToday ? 'rgba(255,255,255,0.7)' : TEXT_MUTED,
              }}
            >
              {label}
            </span>
            <span className="text-[15px] font-semibold leading-none">{dayNum}</span>
            {/* Dot row — up to 3 filled chips by event color, or one hollow dot */}
            <div className="flex items-center gap-[3px] h-1.5">
              {cell.eventCount === 0 ? (
                <span
                  className="block w-[3px] h-[3px] rounded-full"
                  style={{
                    backgroundColor: cell.isToday
                      ? 'rgba(255,255,255,0.4)'
                      : 'rgba(17,15,10,0.12)',
                  }}
                />
              ) : (
                cell.eventColors.slice(0, 3).map((color, i) => (
                  <span
                    key={i}
                    className="block w-[5px] h-[5px] rounded-full"
                    style={{
                      backgroundColor: cell.isToday ? '#ffffff' : color,
                    }}
                  />
                ))
              )}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── Event list ─────────────────────────────────────────────────────────────

function EventList({
  events,
  onEventClick,
}: {
  events: CalendarEventData[]
  onEventClick: (event: CalendarEventData) => void
}) {
  return (
    <ul role="list" className="pb-12">
      {events.map((event, idx) => {
        const { weekday, dayNum, timeRange, startDate } = formatEventRow(event)
        const isToday = startDate.toDateString() === new Date().toDateString()
        const color = event.category?.color || event.calendar.color || '#6366f1'

        return (
          <motion.li
            key={event.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.25,
              delay: idx * 0.03,
              ease: [0.25, 0.1, 0.25, 1],
            }}
          >
            <button
              type="button"
              onClick={() => onEventClick(event)}
              className="group w-full flex items-start gap-4 py-4 px-2 -mx-2 rounded-xl transition-colors duration-200 text-left cursor-pointer"
              style={{ borderBottom: `1px solid ${HAIRLINE}` }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = '#f8f6f2')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = 'transparent')
              }
            >
              {/* Date chip */}
              <div className="flex-shrink-0 w-11 text-center">
                <div
                  className="text-[9px] font-bold uppercase tracking-[0.1em]"
                  style={{ color: isToday ? color : TEXT_MUTED }}
                >
                  {isToday ? 'TODAY' : weekday}
                </div>
                <div
                  className="text-xl font-semibold leading-[1.1] mt-0.5"
                  style={{ color: TEXT_PRIMARY }}
                >
                  {dayNum}
                </div>
              </div>

              {/* Calendar color bar */}
              <div
                className="flex-shrink-0 w-[3px] rounded-full self-stretch my-0.5"
                style={{ backgroundColor: color }}
              />

              {/* Main content */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-[15px] font-semibold truncate"
                  style={{
                    color: TEXT_PRIMARY,
                    letterSpacing: '-0.005em',
                  }}
                >
                  {event.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="text-[12.5px] font-medium"
                    style={{ color: TEXT_SECONDARY }}
                  >
                    {timeRange}
                  </span>
                  {event.locationText && (
                    <>
                      <span style={{ color: TEXT_MUTED }}>·</span>
                      <span
                        className="text-[12.5px] truncate"
                        style={{ color: TEXT_SECONDARY }}
                      >
                        {event.locationText}
                      </span>
                    </>
                  )}
                </div>
                <p
                  className="text-[11.5px] mt-0.5 truncate"
                  style={{ color: TEXT_MUTED }}
                >
                  {event.calendar.name}
                </p>
              </div>

              {/* Chevron */}
              <ArrowRight
                className="flex-shrink-0 w-4 h-4 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                style={{ color: TEXT_MUTED }}
              />
            </button>
          </motion.li>
        )
      })}
    </ul>
  )
}

// ─── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ onCreateEvent }: { onCreateEvent: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="flex flex-col items-center justify-center text-center px-6 py-12"
    >
      <p
        className="text-[17px] font-semibold leading-[1.3]"
        style={{
          color: TEXT_PRIMARY,
          letterSpacing: '-0.015em',
        }}
      >
        Your calendar is open
      </p>
      <p
        className="mt-2 max-w-xs text-[13.5px] leading-[1.55]"
        style={{ color: TEXT_SECONDARY }}
      >
        Nothing scheduled yet. Create your first event and the rhythm of your
        school year starts here.
      </p>

      <div className="flex items-center gap-2 mt-6">
        <button
          type="button"
          onClick={onCreateEvent}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[13px] font-semibold transition-all duration-200 cursor-pointer hover:-translate-y-px"
          style={{
            backgroundColor: TEXT_PRIMARY,
            color: '#ffffff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.04)',
          }}
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          Create event
        </button>
        <Link
          href="/settings?tab=integrations"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[13px] font-semibold transition-colors duration-200 cursor-pointer"
          style={{
            backgroundColor: WARM_CHIP,
            color: TEXT_PRIMARY,
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = WARM_CHIP_HOVER)
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = WARM_CHIP)
          }
        >
          Sync a calendar
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Loading state ──────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2
        className="w-5 h-5 animate-spin"
        style={{ color: TEXT_MUTED }}
      />
    </div>
  )
}

// ─── Error state ────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-12">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
        style={{ backgroundColor: 'rgba(220, 38, 38, 0.08)' }}
      >
        <AlertTriangle className="w-5 h-5" style={{ color: '#b91c1c' }} />
      </div>
      <p
        className="text-[14px] font-semibold"
        style={{ color: TEXT_PRIMARY }}
      >
        Couldn&rsquo;t load events
      </p>
      <p
        className="mt-1 text-[12.5px] max-w-xs"
        style={{ color: TEXT_SECONDARY }}
      >
        {message || 'Something went wrong fetching your calendar.'}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-semibold transition-colors duration-200 cursor-pointer"
        style={{
          backgroundColor: WARM_CHIP,
          color: TEXT_PRIMARY,
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = WARM_CHIP_HOVER)
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = WARM_CHIP)
        }
      >
        <RefreshCw className="w-3 h-3" />
        Try again
      </button>
    </div>
  )
}
