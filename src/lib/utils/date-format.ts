/**
 * Date formatting utilities for public-facing pages.
 */

import { format, isSameMonth, isSameYear, isSameDay } from 'date-fns'

/**
 * Format a date/time with the viewer's timezone abbreviation.
 *
 * Produces strings like "Apr 8, 2026, 2:45 PM CDT" — the Intl API appends the
 * short timezone name automatically so users can see their local zone.
 *
 * Use this for any timestamp displayed in admin, IT, or maintenance surfaces
 * where "when did this happen" matters. Prefer this over bare `.toLocaleString()`
 * and `.toLocaleDateString()` calls on server-returned ISO strings.
 *
 * TODO (tech-debt): ~30 remaining call sites still use `.toLocaleString()` /
 * `.toLocaleDateString()` directly and should be migrated to this helper.
 * Current coverage: IT ticket lists + detail, IT activity feed, notification
 * bell, and maintenance ticket timestamps.
 */
export function formatDateTimeWithTz(
  iso: string | Date | null | undefined,
  timezone?: string
): string {
  if (iso === null || iso === undefined) return ''
  const date = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(date.getTime())) return ''
  const tz =
    timezone ||
    (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined)
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: tz,
      timeZoneName: 'short',
    }).format(date)
  } catch {
    // Fallback if the timezone identifier is invalid.
    return date.toLocaleString()
  }
}

/**
 * Format a date (no time) with the viewer's timezone.
 * Produces strings like "Apr 8, 2026".
 *
 * When a timestamp's exact time is noise, use this instead of
 * `formatDateTimeWithTz` — but note that the timezone still matters because it
 * determines which calendar day the ISO string falls on.
 */
export function formatDateWithTz(
  iso: string | Date | null | undefined,
  timezone?: string
): string {
  if (iso === null || iso === undefined) return ''
  const date = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(date.getTime())) return ''
  const tz =
    timezone ||
    (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined)
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeZone: tz,
    }).format(date)
  } catch {
    return date.toLocaleDateString()
  }
}

/**
 * Format a date range into a human-readable string.
 *
 * Examples:
 *   - Same day:        "March 15, 2026"
 *   - Same month:      "March 15–18, 2026"
 *   - Same year:       "March 15 – April 2, 2026"
 *   - Different years: "Dec 30, 2025 – Jan 2, 2026"
 */
export function formatDateRange(start: Date, end: Date): string {
  if (isSameDay(start, end)) {
    return format(start, 'MMMM d, yyyy')
  }

  if (isSameMonth(start, end) && isSameYear(start, end)) {
    return `${format(start, 'MMMM d')}–${format(end, 'd, yyyy')}`
  }

  if (isSameYear(start, end)) {
    return `${format(start, 'MMMM d')} – ${format(end, 'MMMM d, yyyy')}`
  }

  return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`
}

/**
 * Format a single date as a short label.
 * e.g. "March 15, 2026"
 */
export function formatDate(date: Date): string {
  return format(date, 'MMMM d, yyyy')
}

/**
 * Format a date with time.
 * e.g. "March 15, 2026 at 9:00 AM"
 */
export function formatDateWithTime(date: Date): string {
  return format(date, "MMMM d, yyyy 'at' h:mm a")
}
