'use client'

import { useMemo } from 'react'
import { parseISO, format, addMinutes } from 'date-fns'
import { MapPin, User } from 'lucide-react'
import type { EventScheduleBlock } from '@/lib/hooks/useEventProject'
import type { EventScheduleSection } from '@/lib/hooks/useEventSchedule'

// ─── Types ───────────────────────────────────────────────────────────────────

interface BlockTypeConfig {
  value: string
  label: string
  dotColor: string
  color: string
  bg: string
  isCustom?: boolean
  hexColor?: string
}

interface ScheduleTimelineViewProps {
  blocks: EventScheduleBlock[]
  sections: EventScheduleSection[]
  allTypes: BlockTypeConfig[]
  selectedDateStr: string
  onEditBlock?: (block: EventScheduleBlock) => void
}

interface TimelineBlock {
  block: EventScheduleBlock
  startMinute: number // minutes from midnight
  durationMinutes: number
  sectionId: string | null
  parallelIndex?: number  // for side-by-side blocks in parallel sections
  parallelTotal?: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseHHMM(time24: string | undefined | null): { hours: number; minutes: number } {
  const safe = time24 || '08:00'
  const [h, m] = safe.split(':').map(Number)
  return { hours: h || 0, minutes: m || 0 }
}

function minuteToTime(minute: number): string {
  const hours = Math.floor(minute / 60)
  const mins = minute % 60
  const period = hours >= 12 ? 'PM' : 'AM'
  const h12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  return `${h12}:${String(mins).padStart(2, '0')} ${period}`
}

function getBlockTypeConfig(type: string, allTypes: BlockTypeConfig[]): BlockTypeConfig {
  return allTypes.find((t) => t.value === type) ?? allTypes[0]
}

function getTypeColor(typeConfig: BlockTypeConfig): string {
  if (typeConfig.hexColor) return typeConfig.hexColor
  // Map Tailwind class names to hex colors
  const colorMap: Record<string, string> = {
    'bg-blue-500': '#3b82f6',
    'bg-green-500': '#22c55e',
    'bg-amber-500': '#f59e0b',
    'bg-slate-400': '#94a3b8',
    'bg-purple-500': '#a855f7',
    'bg-orange-500': '#f97316',
    'bg-red-500': '#ef4444',
    'bg-pink-500': '#ec4899',
    'bg-indigo-500': '#6366f1',
    'bg-slate-500': '#64748b',
  }
  return colorMap[typeConfig.dotColor] || '#94a3b8'
}

function getTypeBgColor(typeConfig: BlockTypeConfig): string {
  if (typeConfig.hexColor) return `${typeConfig.hexColor}12`
  const bgMap: Record<string, string> = {
    'bg-blue-100': '#dbeafe',
    'bg-green-100': '#dcfce7',
    'bg-amber-100': '#fef3c7',
    'bg-slate-100': '#f1f5f9',
    'bg-purple-100': '#f3e8ff',
    'bg-orange-100': '#ffedd5',
    'bg-red-100': '#fee2e2',
    'bg-pink-100': '#fce7f3',
    'bg-indigo-100': '#e0e7ff',
    'bg-slate-200': '#e2e8f0',
  }
  return bgMap[typeConfig.bg] || '#f1f5f9'
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PIXELS_PER_MINUTE = 2.5 // each minute = 2.5px height
const HOUR_MARKER_HEIGHT = PIXELS_PER_MINUTE * 60 // 150px per hour
const LEFT_GUTTER_WIDTH = 72 // time labels column width

// ─── Component ───────────────────────────────────────────────────────────────

export function ScheduleTimelineView({
  blocks,
  sections,
  allTypes,
  selectedDateStr,
  onEditBlock,
}: ScheduleTimelineViewProps) {
  // Build timeline data — compute actual start times per block
  const { timelineBlocks, startHour, endHour } = useMemo(() => {
    const result: TimelineBlock[] = []

    // Group blocks by section
    const sectionBlockMap = new Map<string, EventScheduleBlock[]>()
    const unsectioned: EventScheduleBlock[] = []

    for (const block of blocks) {
      if (block.sectionId) {
        const list = sectionBlockMap.get(block.sectionId) || []
        list.push(block)
        sectionBlockMap.set(block.sectionId, list)
      } else {
        unsectioned.push(block)
      }
    }

    // Process sections
    for (const section of sections) {
      const sectionBlocks = sectionBlockMap.get(section.id) || []
      if (sectionBlocks.length === 0) continue

      const { hours, minutes } = parseHHMM(section.startTime)
      const sectionStartMin = hours * 60 + minutes

      if (section.layout === 'parallel') {
        // Parallel blocks start at the same time, side by side
        sectionBlocks.forEach((block, i) => {
          const startMs = parseISO(block.startsAt).getTime()
          const endMs = parseISO(block.endsAt).getTime()
          const durMins = Math.max(Math.round((endMs - startMs) / 60000), 1)

          result.push({
            block,
            startMinute: sectionStartMin,
            durationMinutes: durMins,
            sectionId: section.id,
            parallelIndex: i,
            parallelTotal: sectionBlocks.length,
          })
        })
      } else {
        // Sequential blocks — chain them
        let cursor = sectionStartMin
        for (const block of sectionBlocks) {
          const startMs = parseISO(block.startsAt).getTime()
          const endMs = parseISO(block.endsAt).getTime()
          const durMins = Math.max(Math.round((endMs - startMs) / 60000), 1)

          result.push({
            block,
            startMinute: cursor,
            durationMinutes: durMins,
            sectionId: section.id,
          })
          cursor += durMins
        }
      }
    }

    // Unsectioned blocks use their stored times
    for (const block of unsectioned) {
      const start = parseISO(block.startsAt)
      const end = parseISO(block.endsAt)
      const startMin = start.getHours() * 60 + start.getMinutes()
      const durMins = Math.max(Math.round((end.getTime() - start.getTime()) / 60000), 1)

      result.push({
        block,
        startMinute: startMin,
        durationMinutes: durMins,
        sectionId: null,
      })
    }

    // Compute visible hour range
    if (result.length === 0) {
      return { timelineBlocks: result, startHour: 8, endHour: 18 }
    }

    const minMin = Math.min(...result.map((b) => b.startMinute))
    const maxMin = Math.max(...result.map((b) => b.startMinute + b.durationMinutes))

    const sHour = Math.max(0, Math.floor(minMin / 60) - 1)
    const eHour = Math.min(24, Math.ceil(maxMin / 60) + 1)

    return { timelineBlocks: result, startHour: sHour, endHour: eHour }
  }, [blocks, sections])

  const totalMinutes = (endHour - startHour) * 60
  const totalHeight = totalMinutes * PIXELS_PER_MINUTE

  // Collision resolution — push blocks down when min-height causes overlap
  const { adjustedPositions, adjustedTotalHeight } = useMemo(() => {
    const MIN_HEIGHT = 32
    const GAP = 2

    type PosEntry = {
      id: string
      rawTop: number
      height: number
      adjustedTop: number
      colKey: string
    }

    const entries: PosEntry[] = timelineBlocks.map((tb) => {
      const rawTop = (tb.startMinute - startHour * 60) * PIXELS_PER_MINUTE
      const height = Math.max(tb.durationMinutes * PIXELS_PER_MINUTE, MIN_HEIGHT)

      // Group by horizontal lane for collision detection
      const colKey =
        tb.parallelTotal && tb.parallelTotal > 1 && tb.parallelIndex !== undefined
          ? `parallel-${tb.sectionId}-${tb.parallelIndex}`
          : 'main'

      return { id: tb.block.id, rawTop, height, adjustedTop: rawTop, colKey }
    })

    // Group by column, then sort and resolve overlaps within each
    const columns = new Map<string, PosEntry[]>()
    for (const entry of entries) {
      const col = columns.get(entry.colKey) || []
      col.push(entry)
      columns.set(entry.colKey, col)
    }

    Array.from(columns.values()).forEach((col) => {
      col.sort((a, b) => a.rawTop - b.rawTop)
      for (let i = 1; i < col.length; i++) {
        const prevBottom = col[i - 1].adjustedTop + col[i - 1].height + GAP
        if (col[i].adjustedTop < prevBottom) {
          col[i].adjustedTop = prevBottom
        }
      }
    })

    const posMap = new Map<string, { top: number; height: number }>()
    let maxBottom = totalHeight
    for (const entry of entries) {
      posMap.set(entry.id, { top: entry.adjustedTop, height: entry.height })
      maxBottom = Math.max(maxBottom, entry.adjustedTop + entry.height)
    }

    return { adjustedPositions: posMap, adjustedTotalHeight: maxBottom + 20 }
  }, [timelineBlocks, startHour, totalHeight])

  // Generate hour markers
  const hourMarkers: number[] = []
  for (let h = startHour; h <= endHour; h++) {
    hourMarkers.push(h)
  }

  // Now-line computation
  const now = new Date()
  const nowDateStr = format(now, 'yyyy-MM-dd')
  const isToday = nowDateStr === selectedDateStr
  const nowMinute = now.getHours() * 60 + now.getMinutes()
  const showNowLine = isToday && nowMinute >= startHour * 60 && nowMinute <= endHour * 60

  return (
    <div className="relative" style={{ minHeight: adjustedTotalHeight }}>
      {/* Hour grid lines and labels */}
      {hourMarkers.map((hour) => {
        const top = (hour - startHour) * HOUR_MARKER_HEIGHT
        return (
          <div key={hour} className="absolute left-0 right-0" style={{ top }}>
            {/* Time label */}
            <div
              className="absolute text-xs font-medium text-slate-400 tabular-nums"
              style={{ width: LEFT_GUTTER_WIDTH, top: -8 }}
            >
              {minuteToTime(hour * 60)}
            </div>
            {/* Grid line */}
            <div
              className="absolute border-t border-slate-100"
              style={{ left: LEFT_GUTTER_WIDTH, right: 0 }}
            />
          </div>
        )
      })}

      {/* Half-hour dotted lines */}
      {hourMarkers.slice(0, -1).map((hour) => {
        const top = (hour - startHour) * HOUR_MARKER_HEIGHT + HOUR_MARKER_HEIGHT / 2
        return (
          <div
            key={`half-${hour}`}
            className="absolute border-t border-dashed border-slate-50"
            style={{ top, left: LEFT_GUTTER_WIDTH, right: 0 }}
          />
        )
      })}

      {/* Now indicator */}
      {showNowLine && (
        <div
          className="absolute z-20"
          style={{
            top: (nowMinute - startHour * 60) * PIXELS_PER_MINUTE,
            left: LEFT_GUTTER_WIDTH - 6,
            right: 0,
          }}
        >
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow-sm flex-shrink-0" />
            <div className="flex-1 border-t-2 border-red-500" />
          </div>
        </div>
      )}

      {/* Timeline blocks */}
      {timelineBlocks.map((tb) => {
        const displayType = (tb.block.metadata as Record<string, unknown>)?.customType as string | undefined
        const typeConfig = getBlockTypeConfig(displayType || tb.block.type, allTypes)
        const accentColor = getTypeColor(typeConfig)
        const bgColor = getTypeBgColor(typeConfig)

        const pos = adjustedPositions.get(tb.block.id)
        const top = pos?.top ?? (tb.startMinute - startHour * 60) * PIXELS_PER_MINUTE
        const height = pos?.height ?? Math.max(tb.durationMinutes * PIXELS_PER_MINUTE, 32)

        // Calculate left/width for parallel blocks
        let leftPercent = 0
        let widthPercent = 100
        if (tb.parallelTotal && tb.parallelTotal > 1 && tb.parallelIndex !== undefined) {
          const gap = 1 // 1% gap between parallel blocks
          widthPercent = (100 - gap * (tb.parallelTotal - 1)) / tb.parallelTotal
          leftPercent = tb.parallelIndex * (widthPercent + gap)
        }

        const isCompact = height < 60
        const leadName = tb.block.lead
          ? [tb.block.lead.firstName, tb.block.lead.lastName].filter(Boolean).join(' ') || tb.block.lead.email
          : null

        return (
          <div
            key={tb.block.id}
            className="absolute z-10 group"
            style={{
              top,
              height,
              left: `calc(${LEFT_GUTTER_WIDTH}px + ${leftPercent}%)`,
              width: `calc(${widthPercent}% - ${LEFT_GUTTER_WIDTH}px * ${widthPercent / 100})`,
            }}
          >
            <div
              onClick={() => onEditBlock?.(tb.block)}
              className="h-full mx-0.5 rounded-xl border cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] overflow-hidden flex"
              style={{
                backgroundColor: bgColor,
                borderColor: `${accentColor}30`,
              }}
            >
              {/* Left accent bar */}
              <div
                className="w-1 flex-shrink-0 rounded-l-xl"
                style={{ backgroundColor: accentColor }}
              />

              {/* Content */}
              <div className={`flex-1 min-w-0 ${isCompact ? 'px-3 py-1 flex items-center gap-3' : 'px-3.5 py-2.5'}`}>
                <div className={`flex items-center gap-2 ${isCompact ? '' : 'mb-1'}`}>
                  <span className={`font-semibold text-slate-900 truncate ${isCompact ? 'text-xs' : 'text-sm'}`}>
                    {tb.block.title}
                  </span>
                  {isCompact && (
                    <span className="text-[10px] text-slate-500 flex-shrink-0 tabular-nums">
                      {minuteToTime(tb.startMinute)} – {minuteToTime(tb.startMinute + tb.durationMinutes)}
                    </span>
                  )}
                </div>

                {!isCompact && (
                  <>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1.5">
                      <span className="tabular-nums">
                        {minuteToTime(tb.startMinute)} – {minuteToTime(tb.startMinute + tb.durationMinutes)}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span>{tb.durationMinutes}m</span>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      {tb.block.locationText && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{tb.block.locationText}</span>
                        </div>
                      )}
                      {leadName && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <User className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{leadName}</span>
                        </div>
                      )}
                    </div>

                    {tb.block.description && height > 100 && (
                      <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2">{tb.block.description}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {/* Empty state */}
      {timelineBlocks.length === 0 && (
        <div className="flex items-center justify-center" style={{ height: totalHeight }}>
          <p className="text-sm text-slate-400">No blocks scheduled for this day</p>
        </div>
      )}
    </div>
  )
}
