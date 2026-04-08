import { describe, it, expect } from 'vitest'
import {
  timezoneFromAddress,
  getTimezoneOffset,
  getOrgToday,
  getOrgNow,
  formatInTimezone,
  toOrgDateString,
  localDatetimeToISO,
  isoToLocalDatetime,
} from '@/lib/utils/timezone'

// ── timezoneFromAddress ──────────────────────────────────────────────────────

describe('timezoneFromAddress', () => {
  it('detects state from "City, ST ZIP" pattern', () => {
    expect(timezoneFromAddress('123 Main St, Springfield, IL 62701')).toBe('America/Chicago')
  })

  it('detects state from "City, ST" without ZIP', () => {
    expect(timezoneFromAddress('123 Main St, Springfield, IL')).toBe('America/Chicago')
  })

  it('detects Eastern timezone states', () => {
    expect(timezoneFromAddress('100 Broadway, New York, NY 10001')).toBe('America/New_York')
    expect(timezoneFromAddress('200 Peachtree, Atlanta, GA 30301')).toBe('America/New_York')
  })

  it('detects Mountain timezone states', () => {
    expect(timezoneFromAddress('500 Main, Denver, CO 80201')).toBe('America/Denver')
  })

  it('detects Pacific timezone states', () => {
    expect(timezoneFromAddress('100 Market, San Francisco, CA 94105')).toBe('America/Los_Angeles')
  })

  it('detects Arizona (no DST)', () => {
    expect(timezoneFromAddress('100 Central, Phoenix, AZ 85001')).toBe('America/Phoenix')
  })

  it('detects Hawaii', () => {
    expect(timezoneFromAddress('100 Kalakaua, Honolulu, HI 96815')).toBe('Pacific/Honolulu')
  })

  it('detects full state name when abbreviation pattern fails', () => {
    expect(timezoneFromAddress('Springfield, Illinois')).toBe('America/Chicago')
  })

  it('detects multi-word state names', () => {
    expect(timezoneFromAddress('Some address in New York')).toBe('America/New_York')
    expect(timezoneFromAddress('School in North Carolina')).toBe('America/New_York')
  })

  it('returns null for non-US addresses', () => {
    expect(timezoneFromAddress('10 Downing Street, London, UK')).toBeNull()
  })

  it('returns null for null input', () => {
    expect(timezoneFromAddress(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(timezoneFromAddress(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(timezoneFromAddress('')).toBeNull()
  })

  it('detects territories', () => {
    expect(timezoneFromAddress('San Juan, PR 00901')).toBe('America/Puerto_Rico')
  })
})

// ── getTimezoneOffset ────────────────────────────────────────────────────────

describe('getTimezoneOffset', () => {
  it('returns a valid offset format for known timezone', () => {
    const offset = getTimezoneOffset('America/New_York', new Date('2026-01-15T12:00:00Z'))
    // January → EST → -05:00
    expect(offset).toMatch(/^[+-]\d{2}:\d{2}$/)
  })

  it('returns fallback -06:00 for invalid timezone', () => {
    const offset = getTimezoneOffset('Invalid/Timezone')
    expect(offset).toBe('-06:00')
  })
})

// ── getOrgToday ──────────────────────────────────────────────────────────────

describe('getOrgToday', () => {
  it('returns year, month, day, and dateStr', () => {
    const refDate = new Date('2026-06-15T12:00:00Z')
    const result = getOrgToday('America/Chicago', refDate)
    expect(result.year).toBe(2026)
    expect(result.month).toBe(6)
    expect(result.day).toBe(15)
    expect(result.dateStr).toBe('2026-06-15')
  })

  it('dateStr is zero-padded', () => {
    const refDate = new Date('2026-01-05T12:00:00Z')
    const result = getOrgToday('America/Chicago', refDate)
    expect(result.dateStr).toBe('2026-01-05')
  })

  it('handles timezone date boundary (UTC vs local)', () => {
    // 2026-06-15T04:00:00Z = June 14 at 11:00 PM CDT
    const refDate = new Date('2026-06-15T04:00:00Z')
    const result = getOrgToday('America/Chicago', refDate)
    expect(result.day).toBe(14)
  })
})

// ── getOrgNow ────────────────────────────────────────────────────────────────

describe('getOrgNow', () => {
  it('returns a Date pinned to noon', () => {
    const refDate = new Date('2026-06-15T12:00:00Z')
    const result = getOrgNow('America/Chicago', refDate)
    expect(result.getHours()).toBe(12)
    expect(result.getMinutes()).toBe(0)
  })
})

// ── formatInTimezone ─────────────────────────────────────────────────────────

describe('formatInTimezone', () => {
  it('returns a localized string', () => {
    const date = new Date('2026-06-15T18:30:00Z')
    const result = formatInTimezone(date, 'America/New_York', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    // 18:30 UTC = 2:30 PM EDT
    expect(result).toContain('2:30')
    expect(result).toContain('PM')
  })
})

// ── toOrgDateString ──────────────────────────────────────────────────────────

describe('toOrgDateString', () => {
  it('returns YYYY-MM-DD in org timezone', () => {
    const date = new Date('2026-06-15T12:00:00Z')
    expect(toOrgDateString(date, 'America/Chicago')).toBe('2026-06-15')
  })
})

// ── localDatetimeToISO ───────────────────────────────────────────────────────

describe('localDatetimeToISO', () => {
  it('appends seconds and timezone offset', () => {
    const result = localDatetimeToISO('2026-06-15T14:30', 'America/Chicago')
    expect(result).toMatch(/^2026-06-15T14:30:00[+-]\d{2}:\d{2}$/)
  })
})

// ── isoToLocalDatetime ───────────────────────────────────────────────────────

describe('isoToLocalDatetime', () => {
  it('returns YYYY-MM-DDTHH:mm in org timezone', () => {
    const result = isoToLocalDatetime('2026-06-15T18:30:00Z', 'America/New_York')
    // 18:30 UTC = 14:30 EDT
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    expect(result).toContain('2026-06-15')
    expect(result).toContain('T14:30')
  })

  it('handles midnight edge case', () => {
    const result = isoToLocalDatetime('2026-06-15T04:00:00Z', 'America/New_York')
    // 04:00 UTC = 00:00 EDT
    expect(result).toContain('T00:00')
  })
})
