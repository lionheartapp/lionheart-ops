import { describe, it, expect } from 'vitest'
import {
  generateScheduleHTML,
  type ExportOptions,
  type DayScheduleData,
} from '@/lib/utils/scheduleExportHtml'
import type { BlockTypeConfig } from '@/lib/types/event-project'

const defaultOptions: ExportOptions = {
  audience: 'staff',
  excludedTypes: [],
  showDescriptions: true,
  showLocations: true,
  showLeadNames: true,
}

const defaultTypes: BlockTypeConfig[] = [
  { value: 'session', label: 'Session', dotColor: 'bg-blue-500', color: 'text-blue-700', bg: 'bg-blue-50', hexColor: '#3b82f6' },
  { value: 'break', label: 'Break', dotColor: 'bg-green-500', color: 'text-green-700', bg: 'bg-green-50', hexColor: '#22c55e' },
]

function makeBlock(overrides: Partial<import('@/lib/utils/scheduleExportHtml').ScheduleBlock> = {}): import('@/lib/utils/scheduleExportHtml').ScheduleBlock {
  return {
    id: 'block-1',
    type: 'session',
    title: 'Keynote Address',
    startsAt: '2026-04-10T09:00:00.000Z',
    endsAt: '2026-04-10T10:00:00.000Z',
    sortOrder: 0,
    ...overrides,
  }
}

describe('generateScheduleHTML', () => {
  it('returns valid HTML document', () => {
    const days: DayScheduleData[] = [{
      dateStr: '2026-04-10',
      blocks: [makeBlock()],
      sections: [],
    }]

    const html = generateScheduleHTML(days, defaultTypes, defaultOptions)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html>')
    expect(html).toContain('</html>')
    expect(html).toContain('Schedule Export')
  })

  it('includes the day date label', () => {
    const days: DayScheduleData[] = [{
      dateStr: '2026-04-10',
      blocks: [makeBlock()],
      sections: [],
    }]

    const html = generateScheduleHTML(days, defaultTypes, defaultOptions)
    expect(html).toContain('Friday')
    expect(html).toContain('April')
    expect(html).toContain('2026')
  })

  it('renders block titles', () => {
    const days: DayScheduleData[] = [{
      dateStr: '2026-04-10',
      blocks: [makeBlock({ title: 'Opening Ceremony' })],
      sections: [],
    }]

    const html = generateScheduleHTML(days, defaultTypes, defaultOptions)
    expect(html).toContain('Opening Ceremony')
  })

  it('escapes HTML in block titles', () => {
    const days: DayScheduleData[] = [{
      dateStr: '2026-04-10',
      blocks: [makeBlock({ title: '<script>alert("xss")</script>' })],
      sections: [],
    }]

    const html = generateScheduleHTML(days, defaultTypes, defaultOptions)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('shows staff version label for staff audience', () => {
    const days: DayScheduleData[] = [{
      dateStr: '2026-04-10',
      blocks: [makeBlock()],
      sections: [],
    }]

    const html = generateScheduleHTML(days, defaultTypes, { ...defaultOptions, audience: 'staff' })
    expect(html).toContain('Staff Version')
  })

  it('shows attendee version label for attendee audience', () => {
    const days: DayScheduleData[] = [{
      dateStr: '2026-04-10',
      blocks: [makeBlock()],
      sections: [],
    }]

    const html = generateScheduleHTML(days, defaultTypes, { ...defaultOptions, audience: 'attendee' })
    expect(html).toContain('Attendee Version')
  })

  it('filters excluded types for attendee audience', () => {
    const days: DayScheduleData[] = [{
      dateStr: '2026-04-10',
      blocks: [
        makeBlock({ id: 'b1', title: 'Keynote', type: 'session' }),
        makeBlock({ id: 'b2', title: 'Staff Prep', type: 'break' }),
      ],
      sections: [],
    }]

    const html = generateScheduleHTML(days, defaultTypes, {
      ...defaultOptions,
      audience: 'attendee',
      excludedTypes: ['break'],
    })
    expect(html).toContain('Keynote')
    expect(html).not.toContain('Staff Prep')
  })

  it('shows all blocks for staff regardless of excludedTypes', () => {
    const days: DayScheduleData[] = [{
      dateStr: '2026-04-10',
      blocks: [
        makeBlock({ id: 'b1', title: 'Keynote', type: 'session' }),
        makeBlock({ id: 'b2', title: 'Staff Prep', type: 'break' }),
      ],
      sections: [],
    }]

    const html = generateScheduleHTML(days, defaultTypes, {
      ...defaultOptions,
      audience: 'staff',
      excludedTypes: ['break'],
    })
    expect(html).toContain('Keynote')
    expect(html).toContain('Staff Prep')
  })

  it('renders location text when showLocations is true', () => {
    const days: DayScheduleData[] = [{
      dateStr: '2026-04-10',
      blocks: [makeBlock({ locationText: 'Main Hall' })],
      sections: [],
    }]

    const html = generateScheduleHTML(days, defaultTypes, defaultOptions)
    expect(html).toContain('Main Hall')
  })

  it('renders section titles', () => {
    const days: DayScheduleData[] = [{
      dateStr: '2026-04-10',
      blocks: [makeBlock({ sectionId: 'sec-1' })],
      sections: [{
        id: 'sec-1',
        title: 'Morning Session',
        startTime: '09:00',
        layout: 'sequential',
        sortOrder: 0,
      }],
    }]

    const html = generateScheduleHTML(days, defaultTypes, defaultOptions)
    expect(html).toContain('Morning Session')
  })

  it('renders multiple days with page break', () => {
    const days: DayScheduleData[] = [
      { dateStr: '2026-04-10', blocks: [makeBlock()], sections: [] },
      { dateStr: '2026-04-11', blocks: [makeBlock({ id: 'b2', title: 'Day 2 Talk' })], sections: [] },
    ]

    const html = generateScheduleHTML(days, defaultTypes, defaultOptions)
    expect(html).toContain('Day 2 Talk')
    // Both day-page divs present
    const matches = html.match(/class="day-page"/g)
    expect(matches).toHaveLength(2)
  })

  it('renders lead name when showLeadNames is true', () => {
    const days: DayScheduleData[] = [{
      dateStr: '2026-04-10',
      blocks: [makeBlock({
        lead: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
      })],
      sections: [],
    }]

    const html = generateScheduleHTML(days, defaultTypes, defaultOptions)
    expect(html).toContain('Jane Doe')
  })

  it('uses CSS print styles', () => {
    const days: DayScheduleData[] = [{
      dateStr: '2026-04-10',
      blocks: [makeBlock()],
      sections: [],
    }]

    const html = generateScheduleHTML(days, defaultTypes, defaultOptions)
    expect(html).toContain('@media print')
    expect(html).toContain('@page')
  })
})
