/**
 * Trial & subscription date helpers.
 *
 * Shared by TrialBanner and BillingTab so the "days remaining" math
 * stays consistent across the UI.
 */

/**
 * Number of whole days remaining until an ISO date string.
 *
 * Returns `null` when no date is provided, and `0` (never negative)
 * when the date is in the past. Rounding is ceil, so anything less
 * than 24h still reports "1 day" until the instant it expires.
 */
export function daysRemaining(iso: string | null | undefined): number | null {
  if (!iso) return null
  const diff = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

/**
 * Format an ISO date as a long human-readable date (e.g. "April 22, 2026").
 * Used in banner copy — keep aligned with BillingTab.formatDate.
 */
export function formatTrialDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
