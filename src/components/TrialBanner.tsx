'use client'

/**
 * TrialBanner
 *
 * Persistent top-of-app banner that surfaces billing state for the
 * current organization. Renders these visual modes:
 *
 *   • In-trial (> 7 days)      → aurora gradient, "X days remaining"
 *   • In-trial (3–7 days)      → aurora gradient, urgency copy
 *   • In-trial (<= 3 days)     → amber, "upgrade now"
 *   • Trial expired (read-only)→ red, "workspace is read-only"
 *   • PAST_DUE                 → red, "update payment method"
 *   • CANCELED                 → red, "subscription canceled" (with deletion date if known)
 *   • Paid + active            → nothing
 *
 * Data is fetched via TanStack Query from `/api/settings/billing`.
 * If the request fails (billing not configured, network error, 401)
 * the banner silently renders nothing rather than blocking the UI.
 */

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Clock, Lock, Sparkles } from 'lucide-react'
import { fetchApi } from '@/lib/api-client'
import { formatTrialDate } from '@/lib/trial-utils'

// ─── Types ───────────────────────────────────────────────────────────────────

type SubscriptionStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'PAUSED'

interface BillingSubscription {
  id: string
  status: SubscriptionStatus
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  scheduledDeleteAt?: string | null
}

interface BillingTrial {
  startedAt: string | null
  endsAt: string | null
  daysLeft: number | null
  inTrial: boolean
  expired: boolean
  paid: boolean
  readOnly: boolean
}

interface BillingResponse {
  ok: boolean
  data?: {
    subscription: BillingSubscription | null
    plans: unknown[]
    trial: BillingTrial
  }
  error?: { code?: string; message?: string }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BILLING_LINK = '/settings?tab=billing'

/** Aurora gradient — matches brand Aurora in globals.css / ImpersonationBanner. */
const AURORA_GRADIENT =
  'linear-gradient(90deg, #3B82F6 0%, #6366F1 100%)'

/** Urgent amber — used when trial has 3 or fewer days remaining. */
const AMBER_GRADIENT =
  'linear-gradient(90deg, #F59E0B 0%, #F97316 100%)'

/** Critical red — used for trial-expired, past-due, canceled. */
const RED_GRADIENT =
  'linear-gradient(90deg, #DC2626 0%, #B91C1C 100%)'

// ─── Presentation ────────────────────────────────────────────────────────────

interface BannerView {
  background: string
  Icon: typeof Sparkles
  message: React.ReactNode
  buttonLabel: string
}

function getBannerView(
  trial: BillingTrial,
  subscription: BillingSubscription | null
): BannerView | null {
  // Paid + active subscription → the org is a real customer; nothing to show.
  if (trial.paid && subscription?.status === 'ACTIVE') {
    return null
  }

  // PAST_DUE takes priority over trial state — paying customer with a
  // failing card needs to fix it now.
  if (subscription?.status === 'PAST_DUE') {
    return {
      background: RED_GRADIENT,
      Icon: AlertTriangle,
      message: (
        <>
          <strong className="font-semibold">Payment failed.</strong>{' '}
          Update your payment method to avoid service interruption.
        </>
      ),
      buttonLabel: 'Update Payment',
    }
  }

  // Explicit cancelation state (user hit Cancel + Stripe webhook fired).
  if (subscription?.status === 'CANCELED') {
    const deletionDate =
      subscription.scheduledDeleteAt ?? subscription.currentPeriodEnd
    const message = deletionDate ? (
      <>
        <strong className="font-semibold">Subscription canceled.</strong>{' '}
        Your data will be deleted on {formatTrialDate(deletionDate)}.
      </>
    ) : (
      <>
        <strong className="font-semibold">Subscription canceled.</strong>{' '}
        Reactivate to keep access to your workspace.
      </>
    )
    return {
      background: RED_GRADIENT,
      Icon: AlertTriangle,
      message,
      buttonLabel: 'Reactivate',
    }
  }

  // Trial ended, workspace is read-only until they pick a plan.
  if (trial.readOnly) {
    return {
      background: RED_GRADIENT,
      Icon: Lock,
      message: (
        <>
          <strong className="font-semibold">Free trial ended.</strong>{' '}
          Your workspace is read-only — pick a plan to keep editing.
        </>
      ),
      buttonLabel: 'Choose Plan',
    }
  }

  // Still inside the free trial — render the countdown.
  if (trial.inTrial && trial.daysLeft !== null) {
    const days = trial.daysLeft

    if (days <= 3) {
      return {
        background: AMBER_GRADIENT,
        Icon: Clock,
        message: (
          <>
            <strong className="font-semibold">
              Free trial — {days} {days === 1 ? 'day' : 'days'} remaining.
            </strong>{' '}
            Pick a plan now to avoid read-only mode.
          </>
        ),
        buttonLabel: 'Upgrade Now',
      }
    }

    if (days <= 7) {
      return {
        background: AURORA_GRADIENT,
        Icon: Clock,
        message: (
          <>
            <strong className="font-semibold">
              Free trial — {days} days remaining.
            </strong>{' '}
            Pick a plan whenever you&rsquo;re ready.
          </>
        ),
        buttonLabel: 'Choose Plan',
      }
    }

    return {
      background: AURORA_GRADIENT,
      Icon: Sparkles,
      message: (
        <>
          <strong className="font-semibold">
            Free trial — {days} days remaining.
          </strong>{' '}
          Everything&rsquo;s unlocked. No card required until day {days === 30 ? 31 : '31'}.
        </>
      ),
      buttonLabel: 'See Plans',
    }
  }

  // No trial info + no sub (legacy org or plan not yet picked but no trial
  // data) → render nothing.
  return null
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TrialBanner() {
  const { data, isError } = useQuery<BillingResponse>({
    queryKey: ['billing', 'trial-banner'],
    queryFn: () =>
      fetchApi<BillingResponse>('/api/settings/billing').catch((error) => {
        // Swallow non-auth errors so the banner silently hides rather
        // than blocking the shell. 401 is already handled inside fetchApi.
        return {
          ok: false,
          error: { message: (error as Error)?.message },
        } satisfies BillingResponse
      }),
    // Refresh every 5 minutes — trial day count ticks down slowly,
    // and subscription state changes are rare.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  })

  if (isError || !data?.ok || !data.data) return null

  const view = getBannerView(data.data.trial, data.data.subscription)
  if (!view) return null

  const { background, Icon, message, buttonLabel } = view

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className="relative z-50 flex-shrink-0 w-full text-white shadow-sm"
      style={{ background }}
    >
      <div className="flex items-center justify-center gap-3 px-4 py-2.5 text-sm min-h-[44px]">
        <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        <span className="flex-1 sm:flex-none text-center sm:text-left">
          {message}
        </span>
        <Link
          href={BILLING_LINK}
          className="ml-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        >
          {buttonLabel}
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>
    </motion.div>
  )
}
