'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'

export interface SpecialDayData {
  id: string
  name: string
  date: string
  type: 'HOLIDAY' | 'EARLY_DISMISSAL' | 'LATE_START' | 'TESTING' | 'PROFESSIONAL_DEVELOPMENT' | 'OTHER'
  affectsSchedule: boolean
  notes?: string | null
}

export interface BellSchedulePeriodData {
  id: string
  name: string
  startTime: string
  endTime: string
  periodType: string
  sortOrder: number
}

export interface BellScheduleData {
  id: string
  name: string
  isDefault: boolean
  periods: BellSchedulePeriodData[]
}

export interface DayScheduleAssignmentData {
  id: string
  date: string
  bellSchedule: BellScheduleData
}

export function useSpecialDays(start: Date, end: Date, enabled = true) {
  return useQuery<SpecialDayData[]>({
    queryKey: ['special-days', start.toISOString(), end.toISOString()],
    queryFn: () => {
      const params = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      })
      return fetchApi(`/api/academic/special-days?${params}`)
    },
    enabled,
    staleTime: 5 * 60_000,
  })
}

export function useDaySchedule(date: Date, enabled = true) {
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return useQuery<DayScheduleAssignmentData | null>({
    queryKey: ['day-schedule', dateStr],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateStr,
        endDate: dateStr,
      })
      const assignments: DayScheduleAssignmentData[] = await fetchApi(`/api/academic/day-schedules?${params}`)
      return assignments.length > 0 ? assignments[0] : null
    },
    enabled,
    staleTime: 10 * 60_000,
  })
}

export const SPECIAL_DAY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  HOLIDAY: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  EARLY_DISMISSAL: { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' },
  LATE_START: { bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
  TESTING: { bg: '#fefce8', text: '#ca8a04', border: '#fef08a' },
  PROFESSIONAL_DEVELOPMENT: { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
  OTHER: { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' },
}
