/**
 * Trial & subscription date helpers.
 *
 * Shared by TrialBanner, BillingTab, org registration, the read-only
 * enforcement in `withAuth`, and the reminder cron so the trial math
 * stays consistent across the app.
 */

/** Length of the no-card free trial new orgs get at signup. */
export const TRIAL_DURATION_DAYS = 30

/**
 * Number of days before trial end at which we send reminder emails.
 * Day 21 (of 30) = 9 days remaining → first reminder.
 * Day 28 (of 30) = 2 days remaining → final reminder.
 */
export const TRIAL_REMINDER_DAYS_REMAINING = [9, 2] as const

/** Compute the trial end date from a start timestamp. */
export function computeTrialEndDate(startedAt: Date): Date {
  const end = new Date(startedAt)
  end.setUTCDate(end.getUTCDate() + TRIAL_DURATION_DAYS)
  return end
}

/**
 * Number of whole days remaining until an ISO date string.
 *
 * Returns `null` when no date is provided, and `0` (never negative)
 * when the date is in the past. Rounding is ceil, so anything less
 * than 24h still reports "1 day" until the instant it expires.
 */
export function daysRemaining(iso: string | Date | null | undefined): number | null {
  if (!iso) return null
  const endMs = iso instanceof Date ? iso.getTime() : new Date(iso).getTime()
  const diff = endMs - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

/**
 * Format an ISO date as a long human-readable date (e.g. "April 22, 2026").
 * Used in banner copy — keep aligned with BillingTab.formatDate.
 */
export function formatTrialDate(iso: string | Date | null | undefined): string {
  if (!iso) return '—'
  const date = iso instanceof Date ? iso : new Date(iso)
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Trial state machine ───────────────────────────────────────────────────

/**
 * Subscription statuses that count as "paid, full access". Anything else
 * (TRIALING, CANCELED, PAUSED, null) means we fall back to the org's
 * trial window for read-only enforcement.
 */
const PAID_STATUSES = new Set(['ACTIVE', 'PAST_DUE'])

export interface TrialStateInput {
  /** Organization.trialEndsAt — null for legacy orgs created before trials shipped. */
  trialEndsAt: Date | string | null | undefined
  /** Latest Subscription.status, if any. */
  subscriptionStatus?: string | null
}

export interface TrialState {
  /** True when the org still has a live free trial (no paid sub yet). */
  inTrial: boolean
  /** Days remaining on the free trial (null if no trial set). */
  daysLeft: number | null
  /** True when the free trial has run out AND no paid subscription is active. */
  expired: boolean
  /** True when the org has a paid subscription — full access regardless of trial dates. */
  paid: boolean
  /**
   * True when the caller should be blocked from mutating the workspace:
   * trial expired, no active subscription. Legacy orgs (trialEndsAt=null)
   * are never forced read-only — they pre-date this system.
   */
  readOnly: boolean
}

/**
 * Derive the full trial/subscription state from an org + its latest subscription.
 * This is the single source of truth for "can this org still edit?".
 */
export function getTrialState(input: TrialStateInput): TrialState {
  const paid =
    typeof input.subscriptionStatus === 'string' &&
    PAID_STATUSES.has(input.subscriptionStatus)

  if (paid) {
    return { inTrial: false, daysLeft: null, expired: false, paid: true, readOnly: false }
  }

  const daysLeft = daysRemaining(input.trialEndsAt ?? null)

  // Legacy org with no trial dates set → treat as active (no enforcement).
  if (daysLeft === null) {
    return { inTrial: false, daysLeft: null, expired: false, paid: false, readOnly: false }
  }

  const expired = daysLeft === 0
  return {
    inTrial: !expired,
    daysLeft,
    expired,
    paid: false,
    readOnly: expired,
  }
}
