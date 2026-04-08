import { describe, it, expect } from 'vitest'
import {
  PM_RECURRENCE_TYPES,
  PM_RECURRENCE_LABELS,
} from '@/lib/types/pm-schedule'

describe('PM_RECURRENCE_TYPES', () => {
  it('has 8 recurrence types', () => {
    expect(PM_RECURRENCE_TYPES).toHaveLength(8)
  })

  it('includes expected types', () => {
    expect(PM_RECURRENCE_TYPES).toContain('DAILY')
    expect(PM_RECURRENCE_TYPES).toContain('WEEKLY')
    expect(PM_RECURRENCE_TYPES).toContain('MONTHLY')
    expect(PM_RECURRENCE_TYPES).toContain('QUARTERLY')
    expect(PM_RECURRENCE_TYPES).toContain('ANNUAL')
    expect(PM_RECURRENCE_TYPES).toContain('CUSTOM')
  })

  it('has no duplicates', () => {
    const unique = new Set(PM_RECURRENCE_TYPES)
    expect(unique.size).toBe(PM_RECURRENCE_TYPES.length)
  })
})

describe('PM_RECURRENCE_LABELS', () => {
  it('has a label for every recurrence type', () => {
    for (const type of PM_RECURRENCE_TYPES) {
      expect(PM_RECURRENCE_LABELS[type]).toBeTruthy()
    }
  })

  it('labels are human-readable strings', () => {
    expect(PM_RECURRENCE_LABELS.DAILY).toBe('Daily')
    expect(PM_RECURRENCE_LABELS.BIWEEKLY).toBe('Bi-Weekly')
    expect(PM_RECURRENCE_LABELS.SEMIANNUAL).toBe('Semi-Annual')
  })
})
