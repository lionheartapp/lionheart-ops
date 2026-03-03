'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'

interface SearchUser {
  id: string
  firstName?: string | null
  lastName?: string | null
  email: string
  avatar?: string | null
  jobTitle?: string | null
}

interface SearchEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  isAllDay: boolean
  calendar: { name: string; color: string }
}

interface SearchTicket {
  id: string
  title: string
  status: string
  priority: string
}

interface SearchLocation {
  id: string
  name: string
}

export interface SearchResults {
  users: SearchUser[]
  events: SearchEvent[]
  tickets: SearchTicket[]
  locations: SearchLocation[]
}

export function useGlobalSearch(query: string) {
  return useQuery<SearchResults>({
    queryKey: ['global-search', query],
    queryFn: () => fetchApi(`/api/search?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
    staleTime: 30_000,
  })
}
