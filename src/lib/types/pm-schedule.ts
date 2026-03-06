/**
 * PM Schedule client-safe types and constants.
 *
 * This file is safe to import in client components ('use client').
 * It does NOT import from @/lib/db or any server-only module.
 */

// ─── Recurrence Types ─────────────────────────────────────────────────────────

export const PM_RECURRENCE_TYPES = [
  'DAILY',
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'SEMIANNUAL',
  'ANNUAL',
  'CUSTOM',
] as const

export type PmRecurrenceType = typeof PM_RECURRENCE_TYPES[number]

export const PM_RECURRENCE_LABELS: Record<PmRecurrenceType, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Bi-Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  SEMIANNUAL: 'Semi-Annual',
  ANNUAL: 'Annual',
  CUSTOM: 'Custom',
}

// ─── PM Calendar Event type (mirrors server-side PmCalendarEvent) ────────────

export interface PmCalendarEvent {
  id: string
  title: string
  start: string
  end: string
  color: 'blue' | 'red' | 'green'
  assetName: string | null
  locationName: string | null
  recurrenceType: string
  isActive: boolean
}
