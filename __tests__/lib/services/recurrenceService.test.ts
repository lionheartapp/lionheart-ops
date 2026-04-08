import { describe, it, expect } from 'vitest'
import { expandRecurrence, toHumanReadable, splitSeries } from '@/lib/services/recurrenceService'

// ── expandRecurrence ─────────────────────────────────────────────────────────

describe('expandRecurrence', () => {
  it('returns single instance for non-recurring event', () => {
    const event = {
      id: 'evt-1',
      title: 'One-off Meeting',
      startTime: new Date('2026-03-15T10:00:00Z'),
      endTime: new Date('2026-03-15T11:00:00Z'),
      isAllDay: false,
      rrule: null,
      timezone: 'UTC',
    }
    const rangeStart = new Date('2026-03-01')
    const rangeEnd = new Date('2026-03-31')

    const instances = expandRecurrence(event, rangeStart, rangeEnd)
    expect(instances).toHaveLength(1)
    expect(instances[0].id).toBe('evt-1')
    expect(instances[0].parentEventId).toBeNull()
    expect(instances[0].isException).toBe(false)
  })

  it('expands daily recurring event into multiple instances', () => {
    const event = {
      id: 'evt-2',
      title: 'Daily Standup',
      startTime: new Date('2026-03-01T09:00:00Z'),
      endTime: new Date('2026-03-01T09:30:00Z'),
      isAllDay: false,
      rrule: 'FREQ=DAILY;COUNT=5',
      timezone: 'UTC',
    }
    const rangeStart = new Date('2026-03-01')
    const rangeEnd = new Date('2026-03-31')

    const instances = expandRecurrence(event, rangeStart, rangeEnd)
    expect(instances).toHaveLength(5)
    expect(instances[0].parentEventId).toBe('evt-2')
  })

  it('preserves event duration for each instance', () => {
    const event = {
      id: 'evt-3',
      title: 'Weekly',
      startTime: new Date('2026-03-02T14:00:00Z'),
      endTime: new Date('2026-03-02T15:30:00Z'), // 90 min duration
      isAllDay: false,
      rrule: 'FREQ=WEEKLY;COUNT=3',
      timezone: 'UTC',
    }
    const instances = expandRecurrence(event, new Date('2026-03-01'), new Date('2026-04-30'))

    for (const inst of instances) {
      const durationMs = inst.endTime.getTime() - inst.startTime.getTime()
      expect(durationMs).toBe(90 * 60 * 1000) // 90 minutes
    }
  })

  it('excludes exception dates from virtual instances', () => {
    const event = {
      id: 'evt-4',
      title: 'Daily',
      startTime: new Date('2026-03-01T10:00:00Z'),
      endTime: new Date('2026-03-01T11:00:00Z'),
      isAllDay: false,
      rrule: 'FREQ=DAILY;COUNT=3',
      timezone: 'UTC',
      exceptions: [
        {
          id: 'exc-1',
          originalStart: new Date('2026-03-02T10:00:00Z'),
          startTime: new Date('2026-03-02T14:00:00Z'), // Rescheduled
          endTime: new Date('2026-03-02T15:00:00Z'),
          calendarStatus: 'ACTIVE',
        },
      ],
    }
    const instances = expandRecurrence(event, new Date('2026-03-01'), new Date('2026-03-31'))

    // Should have 2 virtual + 1 exception = 3 total
    expect(instances).toHaveLength(3)
    const exception = instances.find((i) => i.isException)
    expect(exception).toBeTruthy()
    expect(exception!.id).toBe('exc-1')
  })

  it('skips cancelled exceptions', () => {
    const event = {
      id: 'evt-5',
      title: 'Daily',
      startTime: new Date('2026-03-01T10:00:00Z'),
      endTime: new Date('2026-03-01T11:00:00Z'),
      isAllDay: false,
      rrule: 'FREQ=DAILY;COUNT=3',
      timezone: 'UTC',
      exceptions: [
        {
          id: 'exc-cancelled',
          originalStart: new Date('2026-03-02T10:00:00Z'),
          startTime: new Date('2026-03-02T10:00:00Z'),
          endTime: new Date('2026-03-02T11:00:00Z'),
          calendarStatus: 'CANCELLED',
        },
      ],
    }
    const instances = expandRecurrence(event, new Date('2026-03-01'), new Date('2026-03-31'))
    // Day 2 is excluded (exception date) and cancelled, so only 2 virtual instances
    expect(instances).toHaveLength(2)
    expect(instances.every((i) => !i.isException)).toBe(true)
  })

  it('sorts instances by start time', () => {
    const event = {
      id: 'evt-6',
      title: 'Daily',
      startTime: new Date('2026-03-01T10:00:00Z'),
      endTime: new Date('2026-03-01T11:00:00Z'),
      isAllDay: false,
      rrule: 'FREQ=DAILY;COUNT=5',
      timezone: 'UTC',
    }
    const instances = expandRecurrence(event, new Date('2026-03-01'), new Date('2026-03-31'))

    for (let i = 1; i < instances.length; i++) {
      expect(instances[i].startTime.getTime()).toBeGreaterThanOrEqual(
        instances[i - 1].startTime.getTime()
      )
    }
  })
})

// ── toHumanReadable ──────────────────────────────────────────────────────────

describe('toHumanReadable', () => {
  it('converts daily RRULE to text', () => {
    const text = toHumanReadable('FREQ=DAILY')
    expect(text.toLowerCase()).toContain('day')
  })

  it('converts weekly RRULE to text', () => {
    const text = toHumanReadable('FREQ=WEEKLY')
    expect(text.toLowerCase()).toContain('week')
  })

  it('returns the raw string for invalid RRULE', () => {
    const text = toHumanReadable('NOT_A_VALID_RRULE')
    expect(text).toBe('NOT_A_VALID_RRULE')
  })
})

// ── splitSeries ──────────────────────────────────────────────────────────────

describe('splitSeries', () => {
  it('returns original with UNTIL before split date', () => {
    const originalRrule = 'FREQ=WEEKLY'
    const splitDate = new Date('2026-04-01T10:00:00Z')
    const dtstart = new Date('2026-03-01T10:00:00Z')

    const { originalRrule: modified } = splitSeries(originalRrule, splitDate, dtstart)
    expect(modified).toContain('UNTIL=')
    expect(modified).toContain('FREQ=WEEKLY')
  })

  it('returns new RRULE starting at split date', () => {
    const originalRrule = 'FREQ=WEEKLY'
    const splitDate = new Date('2026-04-01T10:00:00Z')
    const dtstart = new Date('2026-03-01T10:00:00Z')

    const { newRrule } = splitSeries(originalRrule, splitDate, dtstart)
    expect(newRrule).toContain('FREQ=WEEKLY')
    expect(newRrule).toContain('DTSTART:')
  })

  it('preserves frequency across split', () => {
    const { originalRrule, newRrule } = splitSeries(
      'FREQ=DAILY',
      new Date('2026-04-15T10:00:00Z'),
      new Date('2026-04-01T10:00:00Z')
    )
    expect(originalRrule).toContain('FREQ=DAILY')
    expect(newRrule).toContain('FREQ=DAILY')
  })
})
