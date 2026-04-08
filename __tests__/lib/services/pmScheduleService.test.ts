import { describe, it, expect } from 'vitest'
import { addDays, addWeeks, addMonths, addYears, startOfDay } from 'date-fns'
import {
  computeNextDueDate,
  CreatePmScheduleSchema,
  UpdatePmScheduleSchema,
  PM_STATUS,
} from '@/lib/services/pmScheduleService'
import type { PmRecurrenceType } from '@/lib/types/pm-schedule'

// ── computeNextDueDate ──────────────────────────────────────────────────────

describe('computeNextDueDate', () => {
  const base = new Date('2026-06-15T14:30:00Z')
  const baseDay = startOfDay(base)

  it('DAILY adds 1 day', () => {
    const result = computeNextDueDate(base, 'DAILY')
    expect(result).toEqual(addDays(baseDay, 1))
  })

  it('WEEKLY adds 1 week', () => {
    const result = computeNextDueDate(base, 'WEEKLY')
    expect(result).toEqual(addWeeks(baseDay, 1))
  })

  it('BIWEEKLY adds 2 weeks', () => {
    const result = computeNextDueDate(base, 'BIWEEKLY')
    expect(result).toEqual(addWeeks(baseDay, 2))
  })

  it('QUARTERLY adds 3 months', () => {
    const result = computeNextDueDate(base, 'QUARTERLY')
    expect(result).toEqual(addMonths(baseDay, 3))
  })

  it('SEMIANNUAL adds 6 months', () => {
    const result = computeNextDueDate(base, 'SEMIANNUAL')
    expect(result).toEqual(addMonths(baseDay, 6))
  })

  it('ANNUAL adds 1 year', () => {
    const result = computeNextDueDate(base, 'ANNUAL')
    expect(result).toEqual(addYears(baseDay, 1))
  })

  it('CUSTOM uses intervalDays when provided', () => {
    const result = computeNextDueDate(base, 'CUSTOM', 45)
    expect(result).toEqual(addDays(baseDay, 45))
  })

  it('CUSTOM defaults to 30 days when intervalDays is null', () => {
    const result = computeNextDueDate(base, 'CUSTOM', null)
    expect(result).toEqual(addDays(baseDay, 30))
  })

  it('CUSTOM defaults to 30 days when intervalDays is undefined', () => {
    const result = computeNextDueDate(base, 'CUSTOM')
    expect(result).toEqual(addDays(baseDay, 30))
  })

  it('MONTHLY without months array adds 1 month', () => {
    const result = computeNextDueDate(base, 'MONTHLY')
    expect(result).toEqual(addMonths(baseDay, 1))
  })

  it('MONTHLY with empty months array adds 1 month', () => {
    const result = computeNextDueDate(base, 'MONTHLY', null, [])
    expect(result).toEqual(addMonths(baseDay, 1))
  })

  it('MONTHLY with months array picks next matching month in same year', () => {
    // base is June (month 6), months [3, 9, 12] → next is September
    const result = computeNextDueDate(base, 'MONTHLY', null, [3, 9, 12])
    expect(result).toEqual(new Date(2026, 8, 1)) // Sep 1, 2026
  })

  it('MONTHLY with months array wraps to next year when no later month', () => {
    // base is June (month 6), months [1, 3, 5] → all before June, wrap to Jan next year
    const result = computeNextDueDate(base, 'MONTHLY', null, [1, 3, 5])
    expect(result).toEqual(new Date(2027, 0, 1)) // Jan 1, 2027
  })

  it('MONTHLY with unsorted months array still works correctly', () => {
    // base is June (month 6), months [12, 3, 9] → sorted [3, 9, 12] → next is 9
    const result = computeNextDueDate(base, 'MONTHLY', null, [12, 3, 9])
    expect(result).toEqual(new Date(2026, 8, 1)) // Sep 1, 2026
  })

  it('MONTHLY with single month wraps if month already passed', () => {
    // base is June (month 6), months [2] → wrap to Feb next year
    const result = computeNextDueDate(base, 'MONTHLY', null, [2])
    expect(result).toEqual(new Date(2027, 1, 1)) // Feb 1, 2027
  })

  it('MONTHLY with month equal to base month wraps to next year', () => {
    // base is June (month 6), months [6] → no month > 6, wraps to June next year
    const result = computeNextDueDate(base, 'MONTHLY', null, [6])
    expect(result).toEqual(new Date(2027, 5, 1)) // Jun 1, 2027
  })

  it('normalizes base date to start of day', () => {
    // Use times well within a single calendar day regardless of timezone
    const morning = new Date('2026-06-15T10:00:00')
    const afternoon = new Date('2026-06-15T16:30:00')
    const result1 = computeNextDueDate(morning, 'DAILY')
    const result2 = computeNextDueDate(afternoon, 'DAILY')
    expect(result1).toEqual(result2)
  })

  it('unknown recurrence type defaults to addMonths(1)', () => {
    const result = computeNextDueDate(base, 'UNKNOWN' as PmRecurrenceType)
    expect(result).toEqual(addMonths(baseDay, 1))
  })
})

// ── PM_STATUS constants ─────────────────────────────────────────────────────

describe('PM_STATUS', () => {
  it('has active and paused values', () => {
    expect(PM_STATUS.ACTIVE).toBe('active')
    expect(PM_STATUS.PAUSED).toBe('paused')
  })
})

// ── CreatePmScheduleSchema ──────────────────────────────────────────────────

describe('CreatePmScheduleSchema', () => {
  const validInput = {
    name: 'HVAC Filter Replacement',
    recurrenceType: 'MONTHLY' as const,
  }

  it('parses valid minimal input', () => {
    expect(() => CreatePmScheduleSchema.parse(validInput)).not.toThrow()
  })

  it('parses full input with all optional fields', () => {
    const full = {
      ...validInput,
      description: 'Replace HVAC filters',
      intervalDays: null,
      months: [3, 6, 9, 12],
      advanceNoticeDays: 14,
      checklistItems: ['Remove old filter', 'Install new filter'],
      assetId: 'asset-1',
      buildingId: 'bld-1',
      areaId: 'area-1',
      roomId: 'room-1',
      schoolId: 'school-1',
      defaultTechnicianId: 'user-1',
      avoidSchoolYear: true,
    }
    expect(() => CreatePmScheduleSchema.parse(full)).not.toThrow()
  })

  it('rejects empty name', () => {
    expect(() =>
      CreatePmScheduleSchema.parse({ ...validInput, name: '' })
    ).toThrow()
  })

  it('requires name', () => {
    expect(() =>
      CreatePmScheduleSchema.parse({ recurrenceType: 'DAILY' })
    ).toThrow()
  })

  it('requires recurrenceType', () => {
    expect(() =>
      CreatePmScheduleSchema.parse({ name: 'Test' })
    ).toThrow()
  })

  it('rejects invalid recurrenceType', () => {
    expect(() =>
      CreatePmScheduleSchema.parse({ name: 'Test', recurrenceType: 'HOURLY' })
    ).toThrow()
  })

  it('requires intervalDays for CUSTOM type', () => {
    expect(() =>
      CreatePmScheduleSchema.parse({ name: 'Test', recurrenceType: 'CUSTOM' })
    ).toThrow()
  })

  it('accepts CUSTOM with intervalDays', () => {
    expect(() =>
      CreatePmScheduleSchema.parse({ name: 'Test', recurrenceType: 'CUSTOM', intervalDays: 45 })
    ).not.toThrow()
  })

  it('rejects CUSTOM with intervalDays = 0', () => {
    expect(() =>
      CreatePmScheduleSchema.parse({ name: 'Test', recurrenceType: 'CUSTOM', intervalDays: 0 })
    ).toThrow()
  })

  it('defaults months to empty array', () => {
    const result = CreatePmScheduleSchema.parse(validInput)
    expect(result.months).toEqual([])
  })

  it('defaults advanceNoticeDays to 7', () => {
    const result = CreatePmScheduleSchema.parse(validInput)
    expect(result.advanceNoticeDays).toBe(7)
  })

  it('defaults checklistItems to empty array', () => {
    const result = CreatePmScheduleSchema.parse(validInput)
    expect(result.checklistItems).toEqual([])
  })

  it('rejects months outside 1-12 range', () => {
    expect(() =>
      CreatePmScheduleSchema.parse({ ...validInput, months: [0] })
    ).toThrow()
    expect(() =>
      CreatePmScheduleSchema.parse({ ...validInput, months: [13] })
    ).toThrow()
  })

  it('rejects negative advanceNoticeDays', () => {
    expect(() =>
      CreatePmScheduleSchema.parse({ ...validInput, advanceNoticeDays: -1 })
    ).toThrow()
  })
})

// ── UpdatePmScheduleSchema ──────────────────────────────────────────────────

describe('UpdatePmScheduleSchema', () => {
  it('parses empty object (all optional)', () => {
    expect(() => UpdatePmScheduleSchema.parse({})).not.toThrow()
  })

  it('parses partial update with name only', () => {
    const result = UpdatePmScheduleSchema.parse({ name: 'New Name' })
    expect(result.name).toBe('New Name')
  })

  it('accepts isActive field', () => {
    const result = UpdatePmScheduleSchema.parse({ isActive: false })
    expect(result.isActive).toBe(false)
  })

  it('allows changing recurrenceType', () => {
    const result = UpdatePmScheduleSchema.parse({ recurrenceType: 'WEEKLY' })
    expect(result.recurrenceType).toBe('WEEKLY')
  })
})
