import { describe, it, expect } from 'vitest'

// Mock api-client since queries.ts imports fetchApi
vi.mock('@/lib/api-client', () => ({
  fetchApi: vi.fn(),
  getAuthHeaders: vi.fn(() => ({})),
}))

import { vi } from 'vitest'
import { queryKeys, queryOptions } from '@/lib/queries'

// ── queryKeys structure ─────────────────────────────────────────────────────

describe('queryKeys', () => {
  it('tickets.all is a readonly array starting with "tickets"', () => {
    expect(queryKeys.tickets.all).toEqual(['tickets'])
  })

  it('tickets.list includes limit parameter', () => {
    const key = queryKeys.tickets.list(20)
    expect(key).toEqual(['tickets', { limit: 20 }])
  })

  it('tickets.list with undefined limit', () => {
    const key = queryKeys.tickets.list()
    expect(key).toEqual(['tickets', { limit: undefined }])
  })

  it('calendarEvents.range includes calendarIds joined and date range', () => {
    const key = queryKeys.calendarEvents.range(['cal-1', 'cal-2'], '2026-04-01', '2026-04-30')
    expect(key).toEqual(['calendar-events', 'cal-1,cal-2', '2026-04-01', '2026-04-30'])
  })

  it('athleticsDashboard.campus with campusId', () => {
    const key = queryKeys.athleticsDashboard.campus('campus-1')
    expect(key).toEqual(['athletics-dashboard', 'campus-1'])
  })

  it('athleticsDashboard.campus without campusId defaults to "all"', () => {
    const key = queryKeys.athleticsDashboard.campus(null)
    expect(key).toEqual(['athletics-dashboard', 'all'])
  })

  it('athleticsTeams.filtered uses empty strings for undefined params', () => {
    const key = queryKeys.athleticsTeams.filtered()
    expect(key).toEqual(['athletics-teams', { sportId: '', seasonId: '' }])
  })

  it('athleticsTeams.filtered with specific values', () => {
    const key = queryKeys.athleticsTeams.filtered('sport-1', 'season-1')
    expect(key).toEqual(['athletics-teams', { sportId: 'sport-1', seasonId: 'season-1' }])
  })

  it('itTickets.filtered with filters', () => {
    const key = queryKeys.itTickets.filtered({ status: 'OPEN', priority: 'HIGH' })
    expect(key).toEqual(['it-tickets', { status: 'OPEN', priority: 'HIGH' }])
  })

  it('itTickets.filtered without filters defaults to empty object', () => {
    const key = queryKeys.itTickets.filtered()
    expect(key).toEqual(['it-tickets', {}])
  })

  it('itTicketDetail.byId returns unique key per ID', () => {
    const key1 = queryKeys.itTicketDetail.byId('abc')
    const key2 = queryKeys.itTicketDetail.byId('xyz')
    expect(key1).not.toEqual(key2)
    expect(key1).toEqual(['it-ticket', 'abc'])
  })

  it('notifications keys include unread count variant', () => {
    expect(queryKeys.notifications.unreadCount).toEqual(['notifications', 'unread-count'])
  })

  it('notifications.list with cursor', () => {
    const key = queryKeys.notifications.list('cursor-123')
    expect(key).toEqual(['notifications', { cursor: 'cursor-123' }])
  })

  it('itReports.annual includes from/to/schoolId', () => {
    const key = queryKeys.itReports.annual('2025-09-01', '2026-06-30', 'school-1')
    expect(key).toEqual(['it-report-annual', { from: '2025-09-01', to: '2026-06-30', schoolId: 'school-1' }])
  })

  it('all queryKeys have unique base keys', () => {
    const topLevelKeys = Object.keys(queryKeys)
    expect(topLevelKeys.length).toBeGreaterThan(10) // sanity check
    expect(new Set(topLevelKeys).size).toBe(topLevelKeys.length)
  })
})

// ── queryOptions structure ──────────────────────────────────────────────────

describe('queryOptions', () => {
  it('tickets returns queryKey, queryFn, and staleTime', () => {
    const opts = queryOptions.tickets(5)
    expect(opts.queryKey).toEqual(queryKeys.tickets.list(5))
    expect(typeof opts.queryFn).toBe('function')
    expect(opts.staleTime).toBe(5 * 60 * 1000)
  })

  it('tickets defaults to limit 10', () => {
    const opts = queryOptions.tickets()
    expect(opts.queryKey).toEqual(queryKeys.tickets.list(10))
  })

  it('permissions has 10-minute staleTime', () => {
    const opts = queryOptions.permissions()
    expect(opts.staleTime).toBe(10 * 60 * 1000)
  })

  it('itTickets has 30-second staleTime', () => {
    const opts = queryOptions.itTickets()
    expect(opts.staleTime).toBe(30_000)
  })

  it('calendarEvents uses range key', () => {
    const opts = queryOptions.calendarEvents(['cal-1'], '2026-04-01', '2026-04-30')
    expect(opts.queryKey).toEqual(queryKeys.calendarEvents.range(['cal-1'], '2026-04-01', '2026-04-30'))
  })

  it('athleticsTeams filters are reflected in key', () => {
    const opts = queryOptions.athleticsTeams('sport-1', 'season-1')
    expect(opts.queryKey).toEqual(queryKeys.athleticsTeams.filtered('sport-1', 'season-1'))
  })

  it('all option factories produce objects with required keys', () => {
    const factories = [
      () => queryOptions.tickets(),
      () => queryOptions.calendars(),
      () => queryOptions.permissions(),
      () => queryOptions.roles(),
      () => queryOptions.teams(),
      () => queryOptions.members(),
      () => queryOptions.campuses(),
      () => queryOptions.modules(),
    ]

    for (const factory of factories) {
      const opts = factory()
      expect(opts).toHaveProperty('queryKey')
      expect(opts).toHaveProperty('queryFn')
      expect(opts).toHaveProperty('staleTime')
      expect(Array.isArray(opts.queryKey)).toBe(true)
      expect(typeof opts.queryFn).toBe('function')
      expect(typeof opts.staleTime).toBe('number')
    }
  })
})
