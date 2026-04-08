import { describe, it, expect } from 'vitest'
import {
  CreateEventProjectSchema,
  UpdateEventProjectSchema,
  CreateScheduleSectionSchema,
  CreateScheduleBlockSchema,
  CreateEventTaskSchema,
  PRESET_TEAM_ROLES,
  EVENT_MEMBER_PERMISSION_KEYS,
  EVENT_MEMBER_PERMISSION_META,
  AddEventTeamMemberSchema,
  CreateEventSeriesSchema,
} from '@/lib/types/event-project'

// ── CreateEventProjectSchema ─────────────────────────────────────────────────

describe('CreateEventProjectSchema', () => {
  const validInput = {
    title: 'Spring Camp 2026',
    startsAt: '2026-06-01T08:00:00Z',
    endsAt: '2026-06-03T17:00:00Z',
  }

  it('accepts valid input', () => {
    const result = CreateEventProjectSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('rejects empty title', () => {
    const result = CreateEventProjectSchema.safeParse({ ...validInput, title: '' })
    expect(result.success).toBe(false)
  })

  it('rejects title over 200 characters', () => {
    const result = CreateEventProjectSchema.safeParse({ ...validInput, title: 'A'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('accepts optional fields', () => {
    const result = CreateEventProjectSchema.safeParse({
      ...validInput,
      description: 'A camp event',
      expectedAttendance: 100,
      isMultiDay: true,
      locationText: 'Main Campus',
    })
    expect(result.success).toBe(true)
  })

  it('coerces date strings to Date objects', () => {
    const result = CreateEventProjectSchema.safeParse(validInput)
    if (result.success) {
      expect(result.data.startsAt).toBeInstanceOf(Date)
      expect(result.data.endsAt).toBeInstanceOf(Date)
    }
  })

  it('defaults isMultiDay to false', () => {
    const result = CreateEventProjectSchema.safeParse(validInput)
    if (result.success) {
      expect(result.data.isMultiDay).toBe(false)
    }
  })
})

// ── UpdateEventProjectSchema ─────────────────────────────────────────────────

describe('UpdateEventProjectSchema', () => {
  it('accepts partial updates', () => {
    const result = UpdateEventProjectSchema.safeParse({ title: 'Updated Title' })
    expect(result.success).toBe(true)
  })

  it('accepts nullable fields', () => {
    const result = UpdateEventProjectSchema.safeParse({
      description: null,
      expectedAttendance: null,
      venueName: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty object', () => {
    const result = UpdateEventProjectSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})

// ── CreateScheduleSectionSchema ──────────────────────────────────────────────

describe('CreateScheduleSectionSchema', () => {
  it('accepts valid input', () => {
    const result = CreateScheduleSectionSchema.safeParse({
      title: 'Morning Session',
      date: '2026-06-01',
    })
    expect(result.success).toBe(true)
  })

  it('defaults startTime to 08:00', () => {
    const result = CreateScheduleSectionSchema.safeParse({
      title: 'Session',
      date: '2026-06-01',
    })
    if (result.success) {
      expect(result.data.startTime).toBe('08:00')
    }
  })

  it('defaults layout to sequential', () => {
    const result = CreateScheduleSectionSchema.safeParse({
      title: 'Session',
      date: '2026-06-01',
    })
    if (result.success) {
      expect(result.data.layout).toBe('sequential')
    }
  })

  it('rejects invalid time format', () => {
    const result = CreateScheduleSectionSchema.safeParse({
      title: 'Session',
      date: '2026-06-01',
      startTime: '8:00', // should be HH:mm
    })
    expect(result.success).toBe(false)
  })

  it('accepts parallel layout', () => {
    const result = CreateScheduleSectionSchema.safeParse({
      title: 'Breakout',
      date: '2026-06-01',
      layout: 'parallel',
    })
    expect(result.success).toBe(true)
  })
})

// ── CreateScheduleBlockSchema ────────────────────────────────────────────────

describe('CreateScheduleBlockSchema', () => {
  it('accepts valid block', () => {
    const result = CreateScheduleBlockSchema.safeParse({
      type: 'SESSION',
      title: 'Keynote',
      startsAt: '2026-06-01T09:00:00Z',
      endsAt: '2026-06-01T10:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid block type', () => {
    const result = CreateScheduleBlockSchema.safeParse({
      type: 'INVALID_TYPE',
      title: 'Test',
      startsAt: '2026-06-01T09:00:00Z',
      endsAt: '2026-06-01T10:00:00Z',
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid block types', () => {
    for (const type of ['SESSION', 'ACTIVITY', 'MEAL', 'FREE_TIME', 'TRAVEL', 'SETUP']) {
      const result = CreateScheduleBlockSchema.safeParse({
        type,
        title: 'Test',
        startsAt: '2026-06-01T09:00:00Z',
        endsAt: '2026-06-01T10:00:00Z',
      })
      expect(result.success, `type=${type}`).toBe(true)
    }
  })
})

// ── CreateEventTaskSchema ────────────────────────────────────────────────────

describe('CreateEventTaskSchema', () => {
  it('accepts valid task', () => {
    const result = CreateEventTaskSchema.safeParse({ title: 'Book venue' })
    expect(result.success).toBe(true)
  })

  it('defaults status to TODO', () => {
    const result = CreateEventTaskSchema.safeParse({ title: 'Task' })
    if (result.success) {
      expect(result.data.status).toBe('TODO')
    }
  })

  it('defaults priority to NORMAL', () => {
    const result = CreateEventTaskSchema.safeParse({ title: 'Task' })
    if (result.success) {
      expect(result.data.priority).toBe('NORMAL')
    }
  })

  it('rejects invalid status', () => {
    const result = CreateEventTaskSchema.safeParse({ title: 'Task', status: 'INVALID' })
    expect(result.success).toBe(false)
  })
})

// ── Constants ────────────────────────────────────────────────────────────────

describe('PRESET_TEAM_ROLES', () => {
  it('has expected roles', () => {
    expect(PRESET_TEAM_ROLES).toContain('Coordinator')
    expect(PRESET_TEAM_ROLES).toContain('Chaperone')
    expect(PRESET_TEAM_ROLES).toContain('Driver')
  })
})

describe('EVENT_MEMBER_PERMISSION_KEYS', () => {
  it('has 8 permission keys', () => {
    expect(EVENT_MEMBER_PERMISSION_KEYS).toHaveLength(8)
  })

  it('every key has metadata', () => {
    for (const key of EVENT_MEMBER_PERMISSION_KEYS) {
      expect(EVENT_MEMBER_PERMISSION_META[key]).toBeDefined()
      expect(EVENT_MEMBER_PERMISSION_META[key].label).toBeTruthy()
      expect(EVENT_MEMBER_PERMISSION_META[key].description).toBeTruthy()
    }
  })
})

// ── AddEventTeamMemberSchema ─────────────────────────────────────────────────

describe('AddEventTeamMemberSchema', () => {
  it('accepts valid member', () => {
    const result = AddEventTeamMemberSchema.safeParse({
      userId: 'user-123',
      role: 'Coordinator',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty userId', () => {
    const result = AddEventTeamMemberSchema.safeParse({
      userId: '',
      role: 'Coordinator',
    })
    expect(result.success).toBe(false)
  })

  it('accepts permission booleans', () => {
    const result = AddEventTeamMemberSchema.safeParse({
      userId: 'user-123',
      role: 'AV Tech',
      canManageSchedule: true,
      canViewBudget: false,
    })
    expect(result.success).toBe(true)
  })
})

// ── CreateEventSeriesSchema ──────────────────────────────────────────────────

describe('CreateEventSeriesSchema', () => {
  it('accepts valid series', () => {
    const result = CreateEventSeriesSchema.safeParse({ title: 'Weekly Chapel' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid defaultStartTime format', () => {
    const result = CreateEventSeriesSchema.safeParse({
      title: 'Series',
      defaultStartTime: '9am',
    })
    expect(result.success).toBe(false)
  })

  it('accepts HH:mm format', () => {
    const result = CreateEventSeriesSchema.safeParse({
      title: 'Series',
      defaultStartTime: '09:00',
    })
    expect(result.success).toBe(true)
  })
})
