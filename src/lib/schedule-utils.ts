import { format, parseISO, addMinutes } from 'date-fns'
import type { BlockTypeConfig } from '@/lib/types/event-project'
import type { EventScheduleBlock } from '@/lib/hooks/useEventProject'
import type { EventScheduleSection } from '@/lib/hooks/useEventSchedule'

// ─── Color palette for custom types ──────────────────────────────────────────

export const TYPE_COLORS = [
  { name: 'Red', value: '#ef4444', dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-100' },
  { name: 'Orange', value: '#f97316', dot: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-100' },
  { name: 'Amber', value: '#f59e0b', dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-100' },
  { name: 'Green', value: '#22c55e', dot: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-100' },
  { name: 'Blue', value: '#3b82f6', dot: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-100' },
  { name: 'Purple', value: '#a855f7', dot: 'bg-purple-500', text: 'text-purple-700', bg: 'bg-purple-100' },
  { name: 'Pink', value: '#ec4899', dot: 'bg-pink-500', text: 'text-pink-700', bg: 'bg-pink-100' },
  { name: 'Indigo', value: '#6366f1', dot: 'bg-indigo-500', text: 'text-indigo-700', bg: 'bg-indigo-100' },
  { name: 'Slate', value: '#64748b', dot: 'bg-slate-500', text: 'text-slate-700', bg: 'bg-slate-200' },
]

// ─── Block type config ────────────────────────────────────────────────────────

export const DEFAULT_BLOCK_TYPES: BlockTypeConfig[] = [
  { value: 'SESSION', label: 'Session', dotColor: 'bg-blue-500', color: 'text-blue-700', bg: 'bg-blue-100' },
  { value: 'ACTIVITY', label: 'Activity', dotColor: 'bg-green-500', color: 'text-green-700', bg: 'bg-green-100' },
  { value: 'MEAL', label: 'Meal', dotColor: 'bg-amber-500', color: 'text-amber-700', bg: 'bg-amber-100' },
  { value: 'FREE_TIME', label: 'Free Time', dotColor: 'bg-slate-400', color: 'text-slate-600', bg: 'bg-slate-100' },
  { value: 'TRAVEL', label: 'Travel', dotColor: 'bg-purple-500', color: 'text-purple-700', bg: 'bg-purple-100' },
  { value: 'SETUP', label: 'Setup', dotColor: 'bg-orange-500', color: 'text-orange-700', bg: 'bg-orange-100' },
]

// Valid API enum values
export const VALID_API_TYPES = ['SESSION', 'ACTIVITY', 'MEAL', 'FREE_TIME', 'TRAVEL', 'SETUP'] as const
export type ApiBlockType = (typeof VALID_API_TYPES)[number]

/** Load custom types from localStorage for this event */
export function loadCustomTypes(eventProjectId: string): BlockTypeConfig[] {
  try {
    const raw = localStorage.getItem(`schedule-custom-types-${eventProjectId}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveCustomTypes(eventProjectId: string, types: BlockTypeConfig[]) {
  try {
    localStorage.setItem(`schedule-custom-types-${eventProjectId}`, JSON.stringify(types))
  } catch {
    /* ignore */
  }
}

export function getAllBlockTypes(eventProjectId: string, customTypes: BlockTypeConfig[]): BlockTypeConfig[] {
  return [...DEFAULT_BLOCK_TYPES, ...customTypes]
}

export function getBlockTypeConfig(type: string, allTypes: BlockTypeConfig[]): BlockTypeConfig {
  return allTypes.find((t) => t.value === type) ?? DEFAULT_BLOCK_TYPES[0]
}

/** Map custom type value to the closest valid API enum. Custom types use ACTIVITY as fallback. */
export function toApiType(typeValue: string): ApiBlockType {
  if ((VALID_API_TYPES as readonly string[]).includes(typeValue)) return typeValue as ApiBlockType
  return 'ACTIVITY'
}

/** Format minutes into a human-readable duration like "1h 30m" or "45m" */
export function formatDuration(mins: number): string {
  const safeMins = mins < 0 ? 0 : mins
  const h = Math.floor(safeMins / 60)
  const m = safeMins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

// ─── Duration presets ────────────────────────────────────────────────────────

export const DURATION_PRESETS = [5, 10, 15, 30, 45, 60, 90, 120] as const

/** Sentinel value for blocks not assigned to any section */
export const UNSECTIONED = '__unsectioned__'

// ─── Time computation utilities ──────────────────────────────────────────────

export interface ComputedBlockTime {
  computedStart: Date
  computedEnd: Date
}

/** Parse "HH:mm" into { hours, minutes }. Falls back to 08:00 if undefined/invalid. */
export function parseHHMM(time24: string | undefined | null): { hours: number; minutes: number } {
  const safe = time24 || '08:00'
  const [h, m] = safe.split(':').map(Number)
  return { hours: h || 0, minutes: m || 0 }
}

/** Format "08:00" -> "8:00 AM", "13:30" -> "1:30 PM" */
export function formatTime12(time24: string | undefined | null): string {
  const { hours, minutes } = parseHHMM(time24)
  const period = hours >= 12 ? 'PM' : 'AM'
  const h12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  return `${h12}:${String(minutes).padStart(2, '0')} ${period}`
}

/** Format a Date to "h:mm AM/PM" */
export function formatDateTo12(d: Date): string {
  return format(d, 'h:mm a')
}

/**
 * Compute sequential start/end times for blocks within a section.
 * Block 1 starts at sectionStartTime, Block 2 starts when Block 1 ends, etc.
 *
 * IMPORTANT: Uses only the section's startTime string + block durations for
 * positioning. Does NOT use block.startsAt for positioning because server-side
 * code (e.g. PCO sync) stores times as UTC while the client interprets them
 * in local time, causing timezone mismatches. Durations (endsAt - startsAt)
 * are timezone-independent and safe to use.
 */
export function computeBlockTimes(
  sectionStartTime: string | undefined | null,
  dateStr: string,
  blocks: EventScheduleBlock[],
): Map<string, ComputedBlockTime> {
  const result = new Map<string, ComputedBlockTime>()
  const { hours, minutes } = parseHHMM(sectionStartTime)
  const sectionStart = new Date(`${dateStr}T00:00:00`)
  sectionStart.setHours(hours, minutes, 0, 0)

  // Detect pre-items via metadata (not date comparison, which is timezone-sensitive).
  // Pre-items are always sorted first, so scan from the front.
  let preTotalMins = 0
  for (const block of blocks) {
    const meta = (block.metadata as Record<string, unknown>) || {}
    if (meta.servicePosition !== 'pre' && meta.pcoServicePosition !== 'pre') break
    const s = parseISO(block.startsAt)
    const e = parseISO(block.endsAt)
    preTotalMins += Math.max(Math.round((e.getTime() - s.getTime()) / 60000), 1)
  }

  // Pre-items start before the section time; non-pre blocks start at section time.
  let cursor: Date = preTotalMins > 0
    ? addMinutes(new Date(sectionStart), -preTotalMins)
    : new Date(sectionStart)

  for (const block of blocks) {
    const startsAt = parseISO(block.startsAt)
    const endsAt = parseISO(block.endsAt)
    const durationMs = endsAt.getTime() - startsAt.getTime()
    const durationMins = Math.max(Math.round(durationMs / 60000), 1)

    const computedStart = new Date(cursor)
    const computedEnd = addMinutes(computedStart, durationMins)

    result.set(block.id, { computedStart, computedEnd })
    cursor = computedEnd
  }

  return result
}

/**
 * Compute a smart default start time for a new section:
 * End time of the last block in the previous section (by sortOrder).
 * Falls back to "08:00" if no prior sections/blocks.
 */
export function computeSmartDefaultStartTime(
  sections: EventScheduleSection[],
  sectionedBlocks: Record<string, EventScheduleBlock[]>,
  dateStr: string,
): string {
  if (sections.length === 0) return '08:00'

  // Walk sections in sortOrder, find the last one with blocks
  const sorted = [...sections].sort((a, b) => a.sortOrder - b.sortOrder)
  for (let i = sorted.length - 1; i >= 0; i--) {
    const section = sorted[i]
    const blocks = sectionedBlocks[section.id]
    if (blocks && blocks.length > 0) {
      if (section.layout === 'parallel') {
        // Parallel: end = startTime + max(block durations)
        const { hours, minutes } = parseHHMM(section.startTime)
        const start = new Date(`${dateStr}T00:00:00`)
        start.setHours(hours, minutes, 0, 0)
        const maxDuration = blocks.reduce((max, b) => {
          const s = new Date(b.startsAt).getTime()
          const e = new Date(b.endsAt).getTime()
          return Math.max(max, Math.round((e - s) / 60000))
        }, 0)
        const end = new Date(start.getTime() + maxDuration * 60000)
        const h = String(end.getHours()).padStart(2, '0')
        const m = String(end.getMinutes()).padStart(2, '0')
        return `${h}:${m}`
      }
      const times = computeBlockTimes(section.startTime, dateStr, blocks)
      const lastBlock = blocks[blocks.length - 1]
      const lastTime = times.get(lastBlock.id)
      if (lastTime) {
        const h = String(lastTime.computedEnd.getHours()).padStart(2, '0')
        const m = String(lastTime.computedEnd.getMinutes()).padStart(2, '0')
        return `${h}:${m}`
      }
    }
  }

  // No blocks in any section — use last section's startTime as base
  const lastSection = sorted[sorted.length - 1]
  return lastSection?.startTime || '08:00'
}

export function formatPreset(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = mins / 60
  if (Number.isInteger(h)) return `${h}h`
  return `${Math.floor(h)}h ${mins % 60}m`
}

// ─── File helpers ─────────────────────────────────────────────────────────────
// Note: getFileIcon uses JSX (lucide-react icons) — it lives in the BlockFilesTab
// component file instead, since it returns React elements.

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
