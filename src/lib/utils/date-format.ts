/**
 * Date formatting utilities for public-facing pages.
 */

import { format, isSameMonth, isSameYear, isSameDay } from 'date-fns'

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
