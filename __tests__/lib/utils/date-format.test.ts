import { describe, it, expect } from 'vitest'
import { formatDateRange, formatDate, formatDateWithTime } from '@/lib/utils/date-format'

describe('formatDateRange', () => {
  it('formats same-day range as single date', () => {
    const d = new Date(2026, 2, 15) // March 15, 2026
    expect(formatDateRange(d, d)).toBe('March 15, 2026')
  })

  it('formats same-month range with dash between days', () => {
    const start = new Date(2026, 2, 15) // March 15
    const end = new Date(2026, 2, 18)   // March 18
    expect(formatDateRange(start, end)).toBe('March 15–18, 2026')
  })

  it('formats same-year different-month range', () => {
    const start = new Date(2026, 2, 15) // March 15
    const end = new Date(2026, 3, 2)    // April 2
    expect(formatDateRange(start, end)).toBe('March 15 – April 2, 2026')
  })

  it('formats different-year range with short month names', () => {
    const start = new Date(2025, 11, 30) // Dec 30, 2025
    const end = new Date(2026, 0, 2)     // Jan 2, 2026
    expect(formatDateRange(start, end)).toBe('Dec 30, 2025 – Jan 2, 2026')
  })
})

describe('formatDate', () => {
  it('formats a date as full month name + day + year', () => {
    const d = new Date(2026, 2, 15)
    expect(formatDate(d)).toBe('March 15, 2026')
  })

  it('formats January correctly', () => {
    const d = new Date(2026, 0, 1)
    expect(formatDate(d)).toBe('January 1, 2026')
  })

  it('formats December correctly', () => {
    const d = new Date(2026, 11, 25)
    expect(formatDate(d)).toBe('December 25, 2026')
  })
})

describe('formatDateWithTime', () => {
  it('includes time in AM format', () => {
    const d = new Date(2026, 2, 15, 9, 0)
    expect(formatDateWithTime(d)).toBe('March 15, 2026 at 9:00 AM')
  })

  it('includes time in PM format', () => {
    const d = new Date(2026, 2, 15, 14, 30)
    expect(formatDateWithTime(d)).toBe('March 15, 2026 at 2:30 PM')
  })

  it('handles midnight as 12:00 AM', () => {
    const d = new Date(2026, 2, 15, 0, 0)
    expect(formatDateWithTime(d)).toBe('March 15, 2026 at 12:00 AM')
  })

  it('handles noon as 12:00 PM', () => {
    const d = new Date(2026, 2, 15, 12, 0)
    expect(formatDateWithTime(d)).toBe('March 15, 2026 at 12:00 PM')
  })
})
