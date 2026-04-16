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
import { AlertTriangle, ArrowRight, Layers, Loader2, RefreshCw } from 'lucide-react'
import type { CalendarEventData } from '@/lib/hooks/useCalendar'
import type { EventProject } from '@/lib/hooks/useEventProject'
import CreateEventMenu, { type EventCreateMode } from '@/components/events/CreateEventMenu'

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

/**
 * Unified shape for anything that can show up in the "Next two weeks" list.
 * A discriminated union keeps the data types honest — calendar meetings and
 * event projects share very different underlying schemas but only a small
 * set of fields matter for the panel's compact renderer.
 */
export type UpcomingItem =
  | { kind: 'meeting'; data: CalendarEventData }
  | { kind: 'project'; data: EventProject }

/** Pull a JS Date out of either kind. */
function getItemStart(item: UpcomingItem): Date {
  return new Date(item.kind === 'meeting' ? item.data.startTime : item.data.startsAt)
}
function getItemEnd(item: UpcomingItem): Date {
  return new Date(item.kind === 'meeting' ? item.data.endTime : item.data.endsAt)
}
function getItemTitle(item: UpcomingItem): string {
  return item.data.title
}
function getItemLocation(item: UpcomingItem): string | null {
  return item.kind === 'meeting'
    ? (item.data.locationText ?? null)
    : (item.data.locationText ?? null)
}
/**
 * The saturated color chip for an item. Meetings use the calendar/category
 * color; projects use a neutral slate so the list still reads as two
 * visually-distinct categories (informal meeting vs. formal event project).
 */
function getItemColor(item: UpcomingItem): string {
  if (item.kind === 'meeting') {
    return item.data.category?.color || item.data.calendar.color || '#6366f1'
  }
  // Projects: use a single shared color so the whole "event project" category
  // reads coherently. #6366f1 matches the indigo used throughout the UI.
  return '#6366f1'
}
/** Bottom-line subtitle: the calendar name for meetings, "Event project" for projects. */
function getItemSubtitle(item: UpcomingItem): string {
  return item.kind === 'meeting' ? item.data.calendar.name : 'Event project'
}

// Back-compat: keep the `CalendarEventData` shape accepted for callers that
// haven't migrated yet. Internally we always normalize to UpcomingItem[].
interface UpcomingEventsPanelProps {
  /**
   * Unified list of calendar meetings + event projects. If provided, takes
   * precedence over `events`. Prefer this — it lets the dashboard surface
   * both informal meetings and formal event projects in one sorted list.
   */
  items?: UpcomingItem[]
  /** @deprecated Pass `items` instead. Retained for back-compat. */
  events?: CalendarEventData[]
  loading: boolean
  error: string | null
  onRetry: () => void
  /** Called when a calendar meeting row is clicked. */
  onEventClick: (event: CalendarEventData) => void
  /** Called when an event-project row is clicked. Optional — if omitted, projects are non-interactive. */
  onProjectClick?: (project: EventProject) => void
  /**
   * Called when a user picks a create mode from the "+ Event" menu.
   * The caller is responsible for dispatching the right flow (AI planner,
   * single-event modal, series drawer, template drawer, etc.).
   */
  onCreateSelect: (mode: EventCreateMode) => void
  /** Whether the current user can see admin-only create modes (recurring, template). */
  isAdmin: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface DayCell {
  date: Date
  isToday: boolean
  eventCount: number
  eventColors: string[]
}

function buildTimeline(items: UpcomingItem[]): DayCell[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const cells: DayCell[] = []
  for (let i = 0; i < 14; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)

    const dayItems = items.filter((item) => {
      const itemDate = getItemStart(item)
      itemDate.setHours(0, 0, 0, 0)
      return itemDate.getTime() === date.getTime()
    })

    cells.push({
      date,
      isToday: i === 0,
      eventCount: dayItems.length,
      eventColors: dayItems.slice(0, 3).map(getItemColor),
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

interface ItemRowInfo {
  weekday: string
  dayNum: number
  timeRange: string
  startDate: Date
}

function formatItemRow(item: UpcomingItem): ItemRowInfo {
  const startDate = getItemStart(item)
  const endDate = getItemEnd(item)
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
  items,
  events,
  loading,
  error,
  onRetry,
  onEventClick,
  onProjectClick,
  onCreateSelect,
  isAdmin,
}: UpcomingEventsPanelProps) {
  // Normalize inputs into a single `UpcomingItem[]` sorted by start time.
  // New callers should pass `items`; `events` is kept for back-compat and
  // is shimmed into `UpcomingItem[]` as meeting-kind rows.
  const normalizedItems = useMemo<UpcomingItem[]>(() => {
    const source: UpcomingItem[] = items
      ? [...items]
      : (events ?? []).map((e) => ({ kind: 'meeting' as const, data: e }))
    return source.sort(
      (a, b) => getItemStart(a).getTime() - getItemStart(b).getTime(),
    )
  }, [items, events])

  const timeline = useMemo(() => buildTimeline(normalizedItems), [normalizedItems])
  const dateRange = useMemo(() => formatDateRange(timeline), [timeline])
  const todayCount = timeline[0]?.eventCount ?? 0
  const totalCount = normalizedItems.length

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
      <header className="flex-shrink-0 px-4 sm:px-7 pt-5 sm:pt-7 pb-4 sm:pb-5">
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

          {/* Shared dropdown — same 5 create modes as the Events Hub header
              so AI / Recurring / Multi-day / Template are never hidden from
              the dashboard. `size="sm"` matches this panel's header scale. */}
          <div className="flex-shrink-0">
            <CreateEventMenu
              isAdmin={isAdmin}
              onSelect={onCreateSelect}
              size="sm"
              align="right"
            />
          </div>
        </div>
      </header>

      {/* ── Timeline strip — the visual anchor of the widget ──────────── */}
      <div className="flex-shrink-0 px-4 sm:px-7 pb-4 sm:pb-6">
        <Timeline cells={timeline} />
      </div>

      {/* ── Divider hairline ──────────────────────────────────────────── */}
      <div className="flex-shrink-0 mx-4 sm:mx-7" style={{ borderTop: `1px solid ${HAIRLINE}` }} />

      {/* ── Content: list, empty state, loading, error ────────────────── */}
      <div className="relative flex-1 min-h-0">
        {/* Fade-out mask at the bottom for long lists */}
        {normalizedItems.length > 3 && (
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-20 z-10"
            style={{
              background: `linear-gradient(to top, ${SURFACE} 0%, rgba(253,252,251,0) 100%)`,
            }}
          />
        )}

        <div className="h-full overflow-y-auto dashboard-scroll px-4 sm:px-7 pt-2 pb-8">
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={onRetry} />
          ) : normalizedItems.length === 0 ? (
            <EmptyState onCreateSelect={onCreateSelect} isAdmin={isAdmin} />
          ) : (
            <ItemList
              items={normalizedItems}
              onEventClick={onEventClick}
              onProjectClick={onProjectClick}
            />
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
      className="overflow-x-auto -mx-2 px-2 scrollbar-none"
      role="list"
      aria-label="14-day timeline"
    >
      <div
        className="grid gap-1 sm:gap-1.5"
        style={{ gridTemplateColumns: 'repeat(14, minmax(40px, 1fr))', minWidth: '560px' }}
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
                minHeight: '58px',
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
    </div>
  )
}

// ─── Item list (meetings + event projects, unified) ─────────────────────────

interface ItemListProps {
  items: UpcomingItem[]
  onEventClick: (event: CalendarEventData) => void
  onProjectClick?: (project: EventProject) => void
}

function ItemList({ items, onEventClick, onProjectClick }: ItemListProps) {
  return (
    <ul role="list" className="pb-12">
      {items.map((item, idx) => {
        const { weekday, dayNum, timeRange, startDate } = formatItemRow(item)
        const isToday = startDate.toDateString() === new Date().toDateString()
        const color = getItemColor(item)
        const title = getItemTitle(item)
        const location = getItemLocation(item)
        const subtitle = getItemSubtitle(item)
        const key =
          item.kind === 'meeting'
            ? `meeting-${item.data.id}`
            : `project-${item.data.id}`

        // Meetings are always clickable. Projects are only clickable if the
        // caller supplied an `onProjectClick` — otherwise we render the row
        // as a non-interactive div to avoid giving users a button that does
        // nothing.
        const isInteractive =
          item.kind === 'meeting' || typeof onProjectClick === 'function'
        const handleClick = () => {
          if (item.kind === 'meeting') {
            onEventClick(item.data)
          } else if (onProjectClick) {
            onProjectClick(item.data)
          }
        }

        const content = (
          <>
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

            {/* Calendar / project color bar */}
            <div
              className="flex-shrink-0 w-[3px] rounded-full self-stretch my-0.5"
              style={{ backgroundColor: color }}
            />

            {/* Main content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p
                  className="text-[15px] font-semibold truncate"
                  style={{
                    color: TEXT_PRIMARY,
                    letterSpacing: '-0.005em',
                  }}
                >
                  {title}
                </p>
                {item.kind === 'project' && (
                  <span
                    className="inline-flex items-center gap-1 flex-shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-[0.08em]"
                    style={{
                      backgroundColor: 'rgba(99, 102, 241, 0.08)',
                      color: '#4f46e5',
                    }}
                    aria-label="Event project"
                  >
                    <Layers className="w-2.5 h-2.5" />
                    Project
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="text-[12.5px] font-medium"
                  style={{ color: TEXT_SECONDARY }}
                >
                  {timeRange}
                </span>
                {location && (
                  <>
                    <span style={{ color: TEXT_MUTED }}>·</span>
                    <span
                      className="text-[12.5px] truncate"
                      style={{ color: TEXT_SECONDARY }}
                    >
                      {location}
                    </span>
                  </>
                )}
              </div>
              <p
                className="text-[11.5px] mt-0.5 truncate"
                style={{ color: TEXT_MUTED }}
              >
                {subtitle}
              </p>
            </div>

            {/* Chevron — only shown on interactive rows */}
            {isInteractive && (
              <ArrowRight
                className="flex-shrink-0 w-4 h-4 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                style={{ color: TEXT_MUTED }}
              />
            )}
          </>
        )

        return (
          <motion.li
            key={key}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.25,
              delay: idx * 0.03,
              ease: [0.25, 0.1, 0.25, 1],
            }}
          >
            {isInteractive ? (
              <button
                type="button"
                onClick={handleClick}
                className="group w-full flex items-start gap-4 py-4 px-2 -mx-2 rounded-xl transition-colors duration-200 text-left cursor-pointer"
                style={{ borderBottom: `1px solid ${HAIRLINE}` }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = '#f8f6f2')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = 'transparent')
                }
              >
                {content}
              </button>
            ) : (
              <div
                className="group w-full flex items-start gap-4 py-4 px-2 -mx-2 rounded-xl text-left"
                style={{ borderBottom: `1px solid ${HAIRLINE}` }}
              >
                {content}
              </div>
            )}
          </motion.li>
        )
      })}
    </ul>
  )
}

// ─── Empty state ────────────────────────────────────────────────────────────

function EmptyState({
  onCreateSelect,
  isAdmin,
}: {
  onCreateSelect: (mode: EventCreateMode) => void
  isAdmin: boolean
}) {
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
        {/* Full create menu so the empty state doesn't quietly hide AI /
            recurring / template options behind a generic "Create event". */}
        <CreateEventMenu
          isAdmin={isAdmin}
          onSelect={onCreateSelect}
          align="left"
          label="Create event"
        />
        <Link
          href="/settings?tab=integrations"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[13px] font-semibold transition-colors duration-200 cursor-pointer"
          style={{
            backgroundColor: WARM_CHIP,
            color: TEXT_PRIMARY,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = WARM_CHIP_HOVER
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = WARM_CHIP
          }}
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
