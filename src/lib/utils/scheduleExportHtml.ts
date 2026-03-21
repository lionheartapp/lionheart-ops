import { parseISO, format } from 'date-fns'
import type { BlockTypeConfig } from '@/lib/types/event-project'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExportOptions {
  audience: 'staff' | 'attendee'
  excludedTypes: string[]
  showDescriptions: boolean
  showLocations: boolean
  showLeadNames: boolean
}

export interface ScheduleSection {
  id: string
  title: string
  startTime: string
  layout: 'sequential' | 'parallel'
  sortOrder: number
}

export interface ScheduleBlock {
  id: string
  type: string
  title: string
  description?: string | null
  startsAt: string
  endsAt: string
  locationText?: string | null
  sectionId?: string | null
  sortOrder: number
  metadata?: Record<string, unknown> | null
  lead?: { firstName?: string | null; lastName?: string | null; email: string } | null
}

export interface DayScheduleData {
  dateStr: string
  blocks: ScheduleBlock[]
  sections: ScheduleSection[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseHHMM(time24: string | undefined | null): { hours: number; minutes: number } {
  const safe = time24 || '08:00'
  const [h, m] = safe.split(':').map(Number)
  return { hours: h || 0, minutes: m || 0 }
}

function getBlockTypeConfig(type: string, allTypes: BlockTypeConfig[]): BlockTypeConfig {
  return allTypes.find((t) => t.value === type) ?? allTypes[0]
}

function getAccentColor(typeConfig: BlockTypeConfig): string {
  if (typeConfig.hexColor) return typeConfig.hexColor
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

function formatMinute(min: number): string {
  const hours = Math.floor(min / 60)
  const mins = min % 60
  const period = hours >= 12 ? 'PM' : 'AM'
  const h12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  return `${h12}:${String(mins).padStart(2, '0')} ${period}`
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

interface ComputedBlock {
  block: ScheduleBlock
  startTime: string
  endTime: string
  durationMinutes: number
  typeConfig: BlockTypeConfig
  accentColor: string
}

function computeSchedule(
  blocks: ScheduleBlock[],
  sections: ScheduleSection[],
  allTypes: BlockTypeConfig[],
): { sectionData: { section: ScheduleSection; blocks: ComputedBlock[] }[]; unsectioned: ComputedBlock[] } {
  const sectionBlockMap = new Map<string, ScheduleBlock[]>()
  const unsectionedBlocks: ScheduleBlock[] = []

  for (const block of blocks) {
    if (block.sectionId) {
      const list = sectionBlockMap.get(block.sectionId) || []
      list.push(block)
      sectionBlockMap.set(block.sectionId, list)
    } else {
      unsectionedBlocks.push(block)
    }
  }

  const sectionData = sections.map((section) => {
    const sBlocks = sectionBlockMap.get(section.id) || []
    const { hours, minutes } = parseHHMM(section.startTime)
    let cursorMin = hours * 60 + minutes

    const computed: ComputedBlock[] = sBlocks.map((block) => {
      const startMs = parseISO(block.startsAt).getTime()
      const endMs = parseISO(block.endsAt).getTime()
      const durMins = Math.max(Math.round((endMs - startMs) / 60000), 1)

      const startMin = section.layout === 'parallel' ? hours * 60 + minutes : cursorMin
      const endMin = startMin + durMins
      if (section.layout !== 'parallel') cursorMin = endMin

      const displayType = (block.metadata as Record<string, unknown>)?.customType as string | undefined
      const typeConfig = getBlockTypeConfig(displayType || block.type, allTypes)

      return {
        block,
        startTime: formatMinute(startMin),
        endTime: formatMinute(endMin),
        durationMinutes: durMins,
        typeConfig,
        accentColor: getAccentColor(typeConfig),
      }
    })

    return { section, blocks: computed }
  })

  const unsectioned = unsectionedBlocks.map((block) => {
    const start = parseISO(block.startsAt)
    const end = parseISO(block.endsAt)
    const durMins = Math.max(Math.round((end.getTime() - start.getTime()) / 60000), 1)
    const displayType = (block.metadata as Record<string, unknown>)?.customType as string | undefined
    const typeConfig = getBlockTypeConfig(displayType || block.type, allTypes)

    return {
      block,
      startTime: format(start, 'h:mm a'),
      endTime: format(end, 'h:mm a'),
      durationMinutes: durMins,
      typeConfig,
      accentColor: getAccentColor(typeConfig),
    }
  })

  return { sectionData, unsectioned }
}

// ─── HTML Generators ─────────────────────────────────────────────────────────

function shouldShowBlock(cb: ComputedBlock, options: ExportOptions): boolean {
  if (options.audience === 'staff') return true
  const displayType = (cb.block.metadata as Record<string, unknown>)?.customType as string | undefined
  const effectiveType = displayType || cb.block.type
  return !options.excludedTypes.includes(effectiveType)
}

function renderBlockDetails(cb: ComputedBlock, options: ExportOptions): string {
  const isStaff = options.audience === 'staff'
  const showLoc = isStaff || options.showLocations
  const showLead = isStaff || options.showLeadNames
  const showDesc = isStaff || options.showDescriptions

  const details: string[] = []

  if (showLoc && cb.block.locationText) {
    details.push(`<span style="font-size:11px;color:#64748b;display:flex;align-items:center;gap:4px">&#x1F4CD; ${escapeHtml(cb.block.locationText)}</span>`)
  }

  const leadName = cb.block.lead
    ? [cb.block.lead.firstName, cb.block.lead.lastName].filter(Boolean).join(' ') || cb.block.lead.email
    : null
  if (showLead && leadName) {
    details.push(`<span style="font-size:11px;color:#64748b;display:flex;align-items:center;gap:4px">&#x1F464; ${escapeHtml(leadName)}</span>`)
  }

  let html = ''
  if (details.length > 0) {
    html += `<div style="display:flex;gap:16px;margin-top:4px;flex-wrap:wrap">${details.join('')}</div>`
  }

  if (showDesc && cb.block.description) {
    html += `<div style="font-size:11px;color:#94a3b8;margin-top:4px;font-style:italic;line-height:1.5">${escapeHtml(cb.block.description)}</div>`
  }

  return html
}

function renderBlockRow(cb: ComputedBlock, options: ExportOptions): string {
  return `
    <div style="display:flex;align-items:flex-start;gap:0;padding:10px 0;border-bottom:1px solid #f1f5f9;page-break-inside:avoid">
      <div style="width:130px;flex-shrink:0;padding-right:16px">
        <div style="font-size:12px;font-weight:600;color:#334155;white-space:nowrap">${escapeHtml(cb.startTime)} &ndash; ${escapeHtml(cb.endTime)}</div>
        <div style="font-size:10px;color:#94a3b8;margin-top:2px">${formatDuration(cb.durationMinutes)}</div>
      </div>
      <div style="width:3px;min-height:32px;border-radius:3px;flex-shrink:0;margin-right:12px;align-self:stretch;background-color:${cb.accentColor}"></div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center">
          <span style="font-size:13px;font-weight:600;color:#0f172a">${escapeHtml(cb.block.title)}</span>
          <span style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;margin-left:8px">${escapeHtml(cb.typeConfig.label)}</span>
        </div>
        ${renderBlockDetails(cb, options)}
      </div>
    </div>`
}

function renderParallelCard(cb: ComputedBlock, options: ExportOptions): string {
  const showLoc = options.audience === 'staff' || options.showLocations
  const showDesc = options.audience === 'staff' || options.showDescriptions

  let extras = ''
  if (showLoc && cb.block.locationText) {
    extras += `<div style="font-size:11px;color:#64748b;margin-top:4px;display:flex;align-items:center;gap:4px">&#x1F4CD; ${escapeHtml(cb.block.locationText)}</div>`
  }
  if (showDesc && cb.block.description) {
    extras += `<div style="font-size:11px;color:#94a3b8;margin-top:4px;font-style:italic">${escapeHtml(cb.block.description)}</div>`
  }

  return `
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;border-left:3px solid ${cb.accentColor}">
      <div style="font-size:13px;font-weight:600;color:#0f172a">${escapeHtml(cb.block.title)}</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:2px">${escapeHtml(cb.startTime)} &ndash; ${escapeHtml(cb.endTime)} &middot; ${formatDuration(cb.durationMinutes)}</div>
      ${extras}
    </div>`
}

function renderSection(
  section: ScheduleSection,
  blocks: ComputedBlock[],
  options: ExportOptions,
): string {
  const visible = blocks.filter((b) => shouldShowBlock(b, options))
  if (visible.length === 0) return ''

  const firstStart = visible[0].startTime
  const lastEnd = section.layout === 'parallel'
    ? visible.reduce((latest, b) => b.endTime > latest ? b.endTime : latest, visible[0].endTime)
    : visible[visible.length - 1].endTime

  const parallelBadge = section.layout === 'parallel'
    ? `<span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#6366f1;background:#e0e7ff;padding:2px 7px;border-radius:100px">Breakout</span>`
    : ''

  const bodyHtml = section.layout === 'parallel'
    ? `<div style="display:grid;grid-template-columns:repeat(${Math.min(visible.length, 3)}, 1fr);gap:8px;padding:6px 0">${visible.map((cb) => renderParallelCard(cb, options)).join('')}</div>`
    : visible.map((cb) => renderBlockRow(cb, options)).join('')

  return `
    <div style="margin-bottom:20px;page-break-inside:avoid">
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;margin-bottom:6px;border-bottom:1px solid #e2e8f0">
        <span style="font-size:14px;font-weight:700;color:#0f172a">${escapeHtml(section.title)}</span>
        <span style="font-size:11px;color:#94a3b8;font-weight:500">${escapeHtml(firstStart)} &ndash; ${escapeHtml(lastEnd)}</span>
        ${parallelBadge}
      </div>
      ${bodyHtml}
    </div>`
}

function renderDayPage(day: DayScheduleData, allTypes: BlockTypeConfig[], options: ExportOptions): string {
  const dateLabel = format(new Date(day.dateStr + 'T12:00:00'), 'EEEE, MMMM d, yyyy')
  const { sectionData, unsectioned } = computeSchedule(day.blocks, day.sections, allTypes)

  const audienceLabel = options.audience === 'staff' ? 'Staff Version' : 'Attendee Version'

  let body = ''

  for (const { section, blocks } of sectionData) {
    body += renderSection(section, blocks, options)
  }

  const visibleUnsectioned = unsectioned.filter((b) => shouldShowBlock(b, options))
  if (visibleUnsectioned.length > 0) {
    const hasNamedSections = sectionData.some(({ blocks }) =>
      blocks.some((b) => shouldShowBlock(b, options)),
    )
    body += `<div style="margin-bottom:20px">`
    if (hasNamedSections) {
      body += `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;margin-bottom:6px;border-bottom:1px solid #e2e8f0"><span style="font-size:14px;font-weight:700;color:#0f172a">Other</span></div>`
    }
    body += visibleUnsectioned.map((cb) => renderBlockRow(cb, options)).join('')
    body += `</div>`
  }

  return `
    <div class="day-page">
      <div style="text-align:center;margin-bottom:28px;padding-bottom:16px;border-bottom:2px solid #e2e8f0">
        <h1 style="font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.02em">Daily Schedule</h1>
        <div style="font-size:13px;color:#64748b;margin-top:4px;font-weight:500">${escapeHtml(dateLabel)}</div>
        <div style="display:inline-block;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;background:#f1f5f9;padding:3px 10px;border-radius:100px;margin-top:8px">${audienceLabel}</div>
      </div>
      ${body}
      <div style="margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;text-align:center;font-size:10px;color:#94a3b8">
        Generated ${format(new Date(), "MMM d, yyyy 'at' h:mm a")} &middot; Lionheart
      </div>
    </div>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function generateScheduleHTML(
  days: DayScheduleData[],
  allTypes: BlockTypeConfig[],
  options: ExportOptions,
): string {
  const dayPages = days.map((day) => renderDayPage(day, allTypes, options)).join('')

  return `<!DOCTYPE html>
<html>
<head>
  <title>Schedule Export</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #1e293b;
      background: white;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    @page {
      size: letter;
      margin: 0.6in 0.7in;
    }

    .day-page + .day-page {
      page-break-before: always;
    }

    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  ${dayPages}
</body>
</html>`
}
