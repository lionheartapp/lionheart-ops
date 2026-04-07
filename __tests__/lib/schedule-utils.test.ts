import { describe, it, expect } from 'vitest'
import {
  formatDuration,
  parseHHMM,
  formatTime12,
  formatDateTo12,
  formatPreset,
  formatFileSize,
  toApiType,
  getBlockTypeConfig,
  getAllBlockTypes,
  DEFAULT_BLOCK_TYPES,
  TYPE_COLORS,
  VALID_API_TYPES,
  UNSECTIONED,
  DURATION_PRESETS,
} from '@/lib/schedule-utils'

// ── formatDuration ──────────────────────────────────────────────────────────

describe('formatDuration', () => {
  it('returns "0m" for zero minutes', () => {
    expect(formatDuration(0)).toBe('0m')
  })

  it('returns minutes only when less than 60', () => {
    expect(formatDuration(45)).toBe('45m')
  })

  it('returns hours only when evenly divisible', () => {
    expect(formatDuration(60)).toBe('1h')
    expect(formatDuration(120)).toBe('2h')
  })

  it('returns hours and minutes for mixed values', () => {
    expect(formatDuration(90)).toBe('1h 30m')
    expect(formatDuration(75)).toBe('1h 15m')
  })

  it('clamps negative values to 0m', () => {
    expect(formatDuration(-10)).toBe('0m')
  })

  it('handles large values', () => {
    expect(formatDuration(600)).toBe('10h')
    expect(formatDuration(605)).toBe('10h 5m')
  })
})

// ── parseHHMM ───────────────────────────────────────────────────────────────

describe('parseHHMM', () => {
  it('parses "08:30" correctly', () => {
    expect(parseHHMM('08:30')).toEqual({ hours: 8, minutes: 30 })
  })

  it('parses "13:45" correctly', () => {
    expect(parseHHMM('13:45')).toEqual({ hours: 13, minutes: 45 })
  })

  it('parses "00:00" (midnight)', () => {
    expect(parseHHMM('00:00')).toEqual({ hours: 0, minutes: 0 })
  })

  it('defaults to 08:00 for undefined', () => {
    expect(parseHHMM(undefined)).toEqual({ hours: 8, minutes: 0 })
  })

  it('defaults to 08:00 for null', () => {
    expect(parseHHMM(null)).toEqual({ hours: 8, minutes: 0 })
  })

  it('defaults to 08:00 for empty string', () => {
    expect(parseHHMM('')).toEqual({ hours: 8, minutes: 0 })
  })
})

// ── formatTime12 ────────────────────────────────────────────────────────────

describe('formatTime12', () => {
  it('formats morning time', () => {
    expect(formatTime12('08:30')).toBe('8:30 AM')
  })

  it('formats noon', () => {
    expect(formatTime12('12:00')).toBe('12:00 PM')
  })

  it('formats afternoon time', () => {
    expect(formatTime12('13:30')).toBe('1:30 PM')
  })

  it('formats midnight as 12:00 AM', () => {
    expect(formatTime12('00:00')).toBe('12:00 AM')
  })

  it('formats 11:59 PM', () => {
    expect(formatTime12('23:59')).toBe('11:59 PM')
  })

  it('pads single-digit minutes', () => {
    expect(formatTime12('09:05')).toBe('9:05 AM')
  })

  it('defaults to 8:00 AM for undefined', () => {
    expect(formatTime12(undefined)).toBe('8:00 AM')
  })
})

// ── formatDateTo12 ──────────────────────────────────────────────────────────

describe('formatDateTo12', () => {
  it('formats a Date to h:mm AM/PM', () => {
    const d = new Date(2026, 3, 7, 14, 30) // 2:30 PM
    expect(formatDateTo12(d)).toBe('2:30 PM')
  })

  it('handles midnight', () => {
    const d = new Date(2026, 3, 7, 0, 0)
    expect(formatDateTo12(d)).toBe('12:00 AM')
  })
})

// ── formatPreset ────────────────────────────────────────────────────────────

describe('formatPreset', () => {
  it('formats minutes < 60 as Xm', () => {
    expect(formatPreset(5)).toBe('5m')
    expect(formatPreset(30)).toBe('30m')
    expect(formatPreset(45)).toBe('45m')
  })

  it('formats exact hours', () => {
    expect(formatPreset(60)).toBe('1h')
    expect(formatPreset(120)).toBe('2h')
  })

  it('formats mixed hours and minutes', () => {
    expect(formatPreset(90)).toBe('1h 30m')
  })
})

// ── formatFileSize ──────────────────────────────────────────────────────────

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B')
  })

  it('formats kilobytes', () => {
    expect(formatFileSize(2048)).toBe('2 KB')
  })

  it('formats megabytes', () => {
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB')
  })

  it('handles zero', () => {
    expect(formatFileSize(0)).toBe('0 B')
  })

  it('rounds KB correctly', () => {
    expect(formatFileSize(1536)).toBe('2 KB') // 1.5 KB rounds to 2
  })
})

// ── toApiType ───────────────────────────────────────────────────────────────

describe('toApiType', () => {
  it('passes through valid API types', () => {
    for (const t of VALID_API_TYPES) {
      expect(toApiType(t)).toBe(t)
    }
  })

  it('maps unknown custom types to ACTIVITY', () => {
    expect(toApiType('CUSTOM_WORSHIP')).toBe('ACTIVITY')
    expect(toApiType('random')).toBe('ACTIVITY')
    expect(toApiType('')).toBe('ACTIVITY')
  })
})

// ── getBlockTypeConfig ──────────────────────────────────────────────────────

describe('getBlockTypeConfig', () => {
  it('returns matching config for known type', () => {
    const config = getBlockTypeConfig('MEAL', DEFAULT_BLOCK_TYPES)
    expect(config.value).toBe('MEAL')
    expect(config.label).toBe('Meal')
  })

  it('returns first default for unknown type', () => {
    const config = getBlockTypeConfig('NONEXISTENT', DEFAULT_BLOCK_TYPES)
    expect(config.value).toBe('SESSION')
  })

  it('finds custom types when included in allTypes', () => {
    const custom = { value: 'CUSTOM', label: 'Custom', dotColor: 'bg-red-500', color: 'text-red-700', bg: 'bg-red-100' }
    const allTypes = [...DEFAULT_BLOCK_TYPES, custom]
    expect(getBlockTypeConfig('CUSTOM', allTypes).label).toBe('Custom')
  })
})

// ── getAllBlockTypes ─────────────────────────────────────────────────────────

describe('getAllBlockTypes', () => {
  it('returns defaults when no custom types', () => {
    const result = getAllBlockTypes('event-1', [])
    expect(result).toEqual(DEFAULT_BLOCK_TYPES)
  })

  it('appends custom types after defaults', () => {
    const custom = { value: 'CUSTOM', label: 'Custom', dotColor: 'bg-red-500', color: 'text-red-700', bg: 'bg-red-100' }
    const result = getAllBlockTypes('event-1', [custom])
    expect(result.length).toBe(DEFAULT_BLOCK_TYPES.length + 1)
    expect(result[result.length - 1].value).toBe('CUSTOM')
  })
})

// ── Constants ───────────────────────────────────────────────────────────────

describe('constants', () => {
  it('TYPE_COLORS has 9 entries', () => {
    expect(TYPE_COLORS).toHaveLength(9)
  })

  it('DEFAULT_BLOCK_TYPES has 6 entries', () => {
    expect(DEFAULT_BLOCK_TYPES).toHaveLength(6)
  })

  it('VALID_API_TYPES matches DEFAULT_BLOCK_TYPES values', () => {
    const defaultValues = DEFAULT_BLOCK_TYPES.map((t) => t.value)
    expect([...VALID_API_TYPES]).toEqual(defaultValues)
  })

  it('UNSECTIONED is a specific sentinel string', () => {
    expect(UNSECTIONED).toBe('__unsectioned__')
  })

  it('DURATION_PRESETS are sorted ascending', () => {
    const sorted = [...DURATION_PRESETS].sort((a, b) => a - b)
    expect([...DURATION_PRESETS]).toEqual(sorted)
  })
})
