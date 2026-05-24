import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  getGreeting,
  getStatusLabel,
  getPriorityColor,
  formatDate,
} from '@/lib/dashboard-utils'

// ── getGreeting ─────────────────────────────────────────────────────────────

describe('getGreeting', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "Good morning" before noon', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 7, 9, 0)) // 9:00 AM
    expect(getGreeting()).toBe('Good morning')
  })

  it('returns "Good afternoon" between noon and 6pm', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 7, 14, 0)) // 2:00 PM
    expect(getGreeting()).toBe('Good afternoon')
  })

  it('returns "Good evening" after 6pm', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 7, 20, 0)) // 8:00 PM
    expect(getGreeting()).toBe('Good evening')
  })

  it('returns "Good evening" at midnight (edge)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 7, 0, 0))
    expect(getGreeting()).toBe('Good evening')
  })

  it('returns "Good afternoon" at exactly noon', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 7, 12, 0))
    expect(getGreeting()).toBe('Good afternoon')
  })

  it('returns "Good evening" at exactly 6pm', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 7, 18, 0))
    expect(getGreeting()).toBe('Good evening')
  })
})

// ── getStatusLabel ──────────────────────────────────────────────────────────

describe('getStatusLabel', () => {
  it('maps OPEN to "Open"', () => {
    expect(getStatusLabel('OPEN')).toBe('Open')
  })

  it('maps IN_PROGRESS to "In Progress"', () => {
    expect(getStatusLabel('IN_PROGRESS')).toBe('In Progress')
  })

  it('maps RESOLVED to "Resolved"', () => {
    expect(getStatusLabel('RESOLVED')).toBe('Resolved')
  })

  it('returns raw value for unknown status', () => {
    expect(getStatusLabel('CUSTOM_STATUS')).toBe('CUSTOM_STATUS')
  })
})

// ── getPriorityColor ────────────────────────────────────────────────────────

describe('getPriorityColor', () => {
  it('maps CRITICAL to red', () => {
    expect(getPriorityColor('CRITICAL')).toBe('bg-red-100 text-red-700')
  })

  it('maps HIGH to red', () => {
    expect(getPriorityColor('HIGH')).toBe('bg-red-100 text-red-700')
  })

  it('maps NORMAL to yellow', () => {
    expect(getPriorityColor('NORMAL')).toBe('bg-yellow-100 text-yellow-700')
  })

  it('maps LOW to green', () => {
    expect(getPriorityColor('LOW')).toBe('bg-green-100 text-green-700')
  })

  it('maps unknown priority to slate', () => {
    expect(getPriorityColor('UNKNOWN')).toBe('bg-slate-100 text-slate-700')
  })
})

// ── formatDate ──────────────────────────────────────────────────────────────

describe('formatDate', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "Today" for same-day dates', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 7, 15, 0))
    expect(formatDate('2026-04-07T10:00:00')).toBe('Today')
  })

  it('returns "Yesterday" for previous day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 7, 15, 0))
    expect(formatDate('2026-04-06T10:00:00')).toBe('Yesterday')
  })

  it('returns "X days ago" for 2-6 days ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 7, 15, 0))
    expect(formatDate('2026-04-04T10:00:00')).toBe('3 days ago')
  })

  it('returns formatted date for 7+ days ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 14, 15, 0))
    const result = formatDate('2026-04-01T10:00:00')
    // "Apr 1" format (locale-dependent)
    expect(result).toMatch(/Apr/)
    expect(result).toMatch(/1/)
  })
})
