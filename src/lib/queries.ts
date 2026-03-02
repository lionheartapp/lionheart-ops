/**
 * Centralized query keys & option factories.
 *
 * Every query in the app should use these factories so that:
 *  1. Keys stay consistent between pages and the prefetcher.
 *  2. Prefetch and runtime queries share the same queryFn + staleTime.
 *  3. Keys are easy to invalidate by prefix (e.g. queryKeys.tickets.all).
 *
 * Pattern inspired by TkDodo's "Effective React Query Keys":
 * https://tkdodo.eu/blog/effective-react-query-keys
 */

import { fetchApi } from '@/lib/api-client'

// ─── Query Keys ────────────────────────────────────────────────────────
export const queryKeys = {
  // Dashboard
  tickets: {
    all: ['tickets'] as const,
    list: (limit?: number) => ['tickets', { limit }] as const,
  },

  // Calendar
  calendars: {
    all: ['calendars'] as const,
  },
  calendarEvents: {
    all: ['calendar-events'] as const,
    range: (calendarIds: string[], start: string, end: string) =>
      ['calendar-events', calendarIds.join(','), start, end] as const,
  },

  // Settings / Org
  permissions: {
    all: ['permissions'] as const,
  },
  schoolInfo: {
    all: ['school-info'] as const,
  },
  orgLogo: {
    all: ['org-logo'] as const,
  },
  roles: {
    all: ['roles'] as const,
  },
  teams: {
    all: ['teams'] as const,
  },
  members: {
    all: ['members'] as const,
  },
  campuses: {
    all: ['campuses'] as const,
  },
} as const

// ─── Query Option Factories ────────────────────────────────────────────
// Each factory returns the full options object (queryKey + queryFn + staleTime)
// usable by both useQuery() and queryClient.prefetchQuery().

export const queryOptions = {
  tickets: (limit = 10) => ({
    queryKey: queryKeys.tickets.list(limit),
    queryFn: () =>
      fetchApi<{ tickets: unknown[] } | unknown[]>(`/api/tickets?limit=${limit}`),
    staleTime: 5 * 60 * 1000, // 5 minutes — ticket data doesn't change every second
  }),

  calendars: () => ({
    queryKey: queryKeys.calendars.all,
    queryFn: () => fetchApi<unknown[]>('/api/calendars'),
    staleTime: 60 * 1000, // 1 minute
  }),

  permissions: () => ({
    queryKey: queryKeys.permissions.all,
    queryFn: () => fetchApi<{ canManageWorkspace: boolean }>('/api/auth/permissions'),
    staleTime: 10 * 60 * 1000, // 10 minutes — permissions rarely change mid-session
  }),

  schoolInfo: () => ({
    queryKey: queryKeys.schoolInfo.all,
    queryFn: () => fetchApi<Record<string, unknown>>('/api/onboarding/school-info'),
    staleTime: 10 * 60 * 1000,
  }),

  roles: () => ({
    queryKey: queryKeys.roles.all,
    queryFn: () => fetchApi<unknown[]>('/api/settings/roles'),
    staleTime: 5 * 60 * 1000,
  }),

  teams: () => ({
    queryKey: queryKeys.teams.all,
    queryFn: () => fetchApi<unknown[]>('/api/settings/teams'),
    staleTime: 5 * 60 * 1000,
  }),

  members: () => ({
    queryKey: queryKeys.members.all,
    queryFn: () => fetchApi<unknown[]>('/api/settings/members'),
    staleTime: 5 * 60 * 1000,
  }),

  campuses: () => ({
    queryKey: queryKeys.campuses.all,
    queryFn: () => fetchApi<unknown[]>('/api/settings/campus'),
    staleTime: 5 * 60 * 1000,
  }),
} as const
