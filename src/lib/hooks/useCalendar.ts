'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback } from 'react'

// ─── Types ─────────────────────────────────────────────────────────────

export type CalendarViewType = 'month' | 'week' | 'day' | 'agenda'

export interface CalendarEventData {
  id: string
  calendarId: string
  title: string
  description?: string | null
  startTime: string
  endTime: string
  timezone: string
  isAllDay: boolean
  calendarStatus: string
  rrule?: string | null
  parentEventId?: string | null
  isException?: boolean
  locationText?: string | null
  categoryId?: string | null
  metadata?: Record<string, unknown> | null
  calendar: {
    id: string
    name: string
    color: string
    calendarType: string
  }
  category?: {
    id: string
    name: string
    color: string
    icon?: string | null
  } | null
  building?: { id: string; name: string } | null
  area?: { id: string; name: string } | null
  createdBy?: {
    id: string
    name?: string | null
    firstName?: string | null
    lastName?: string | null
    email: string
    avatar?: string | null
  } | null
  attendees?: Array<{
    id: string
    responseStatus: string
    user: {
      id: string
      name?: string | null
      firstName?: string | null
      lastName?: string | null
      avatar?: string | null
    }
  }>
}

export interface CalendarData {
  id: string
  name: string
  slug: string
  calendarType: string
  color: string
  visibility: string
  requiresApproval: boolean
  isDefault: boolean
  isActive: boolean
  campus?: { id: string; name: string } | null
  school?: { id: string; name: string } | null
  _count: { events: number; subscriptions: number }
}

// ─── API helpers ───────────────────────────────────────────────────────

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...options?.headers },
  })
  const json = await res.json()
  if (!json.ok) throw new Error(json.error?.message || 'API Error')
  return json.data
}

// ─── Hooks ─────────────────────────────────────────────────────────────

export function useCalendars() {
  return useQuery<CalendarData[]>({
    queryKey: ['calendars'],
    queryFn: () => fetchApi('/api/calendars'),
    staleTime: 60_000,
  })
}

export function useCalendarEvents(
  calendarIds: string[],
  start: Date,
  end: Date,
  enabled = true
) {
  return useQuery<CalendarEventData[]>({
    queryKey: ['calendar-events', calendarIds.join(','), start.toISOString(), end.toISOString()],
    queryFn: () => {
      const params = new URLSearchParams({
        calendarIds: calendarIds.join(','),
        start: start.toISOString(),
        end: end.toISOString(),
      })
      return fetchApi(`/api/calendar-events?${params}`)
    },
    enabled: enabled && calendarIds.length > 0,
    staleTime: 60_000,
    gcTime: 600_000,
  })
}

export function useCreateCalendar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetchApi('/api/calendars', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendars'] })
    },
  })
}

export function useUpdateCalendar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      fetchApi(`/api/calendars/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendars'] })
    },
  })
}

export function useDeleteCalendar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      fetchApi(`/api/calendars/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendars'] })
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
    },
  })
}

export function useCreateEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetchApi('/api/calendar-events', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
    },
  })
}

export function useUpdateEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      fetchApi(`/api/calendar-events/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
    },
  })
}

export function useDeleteEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      fetchApi(`/api/calendar-events/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
    },
  })
}

// ─── Calendar navigation state ─────────────────────────────────────────

export function useCalendarNavigation() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<CalendarViewType>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('calendar-view') as CalendarViewType) || 'month'
    }
    return 'month'
  })

  const changeView = useCallback((newView: CalendarViewType) => {
    setView(newView)
    if (typeof window !== 'undefined') {
      localStorage.setItem('calendar-view', newView)
    }
  }, [])

  const goToToday = useCallback(() => setCurrentDate(new Date()), [])

  const goNext = useCallback(() => {
    setCurrentDate((prev) => {
      const next = new Date(prev)
      if (view === 'month') next.setMonth(next.getMonth() + 1)
      else if (view === 'week') next.setDate(next.getDate() + 7)
      else next.setDate(next.getDate() + 1)
      return next
    })
  }, [view])

  const goPrev = useCallback(() => {
    setCurrentDate((prev) => {
      const next = new Date(prev)
      if (view === 'month') next.setMonth(next.getMonth() - 1)
      else if (view === 'week') next.setDate(next.getDate() - 7)
      else next.setDate(next.getDate() - 1)
      return next
    })
  }, [view])

  // Compute date range for the current view
  const getDateRange = useCallback((): { start: Date; end: Date } => {
    const start = new Date(currentDate)
    const end = new Date(currentDate)

    if (view === 'month') {
      start.setDate(1)
      start.setDate(start.getDate() - start.getDay()) // Start from Sunday
      end.setMonth(end.getMonth() + 1, 0)
      end.setDate(end.getDate() + (6 - end.getDay())) // End on Saturday
      end.setHours(23, 59, 59, 999)
    } else if (view === 'week') {
      start.setDate(start.getDate() - start.getDay())
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59, 999)
    } else {
      // day or agenda
      start.setHours(0, 0, 0, 0)
      if (view === 'agenda') {
        end.setDate(end.getDate() + 30)
      }
      end.setHours(23, 59, 59, 999)
    }

    return { start, end }
  }, [currentDate, view])

  return {
    currentDate,
    setCurrentDate,
    view,
    changeView,
    goToToday,
    goNext,
    goPrev,
    getDateRange,
  }
}
