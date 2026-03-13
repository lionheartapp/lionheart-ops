'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'
import type { CalendarEventData } from '@/lib/hooks/useCalendar'

export interface MeetWithPerson {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  avatar: string | null
  jobTitle: string | null
  color: string
}

export interface PeopleSearchResult {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  avatar: string | null
  jobTitle: string | null
}

export const MEET_WITH_COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#f43f5e']

export function usePeopleSearch(query: string) {
  return useQuery<PeopleSearchResult[]>({
    queryKey: ['people-search', query],
    queryFn: () => fetchApi(`/api/calendar/people-search?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
    staleTime: 30_000,
  })
}

/** Fetches all org members — used for the attendee dropdown in meeting mode */
export function useAllPeople() {
  return useQuery<PeopleSearchResult[]>({
    queryKey: ['people-all'],
    queryFn: () => fetchApi('/api/calendar/people-search'),
    staleTime: 60_000,
  })
}

export function useUserSchedule(userId: string | null, start: Date, end: Date) {
  return useQuery<CalendarEventData[]>({
    queryKey: ['user-schedule', userId, start.toISOString(), end.toISOString()],
    queryFn: () => {
      const params = new URLSearchParams({
        userId: userId!,
        start: start.toISOString(),
        end: end.toISOString(),
      })
      return fetchApi(`/api/calendar/user-schedule?${params}`)
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  })
}
