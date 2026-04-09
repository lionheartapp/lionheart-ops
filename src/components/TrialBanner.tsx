'use client'

/**
 * TrialBanner
 *
 * Persistent top-of-app banner that surfaces billing state for the
 * current organization. Renders in four visual modes:
 *
 *   • TRIALING  → aurora gradient (amber/red when <=3 days / 0 days)
 *   • PAST_DUE  → red, "update payment method"
 *   • CANCELED  → red, "subscription canceled" (with deletion date if known)
 *   • otherwise → nothing (ACTIVE / PAUSED / no subscription)
 *
 * Data is fetched via TanStack Query from `/api/settings/billing`.
 * If the request fails (billing not configured, network error, 401)
 * the banner silently renders nothing rather than blocking the UI.
 *
 * TODO(future): add "Snooze for 24h" / "Snooze for 3 days" dismiss
 * affordance. Intentionally omitted per requirement — trial banner
 * must stay visible until the user takes action.
 */

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Clock, Sparkles } from 'lucide-react'
import { fetchApi } from '@/lib/api-client'
import { daysRemaining, formatTrialDate } from '@/lib/trial-utils'

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
  /**
   * Optional — populated when the org is scheduled for deletion.
   * Not currently part of the Subscription schema; kept here so the
   * banner is ready once that field is added.
   */
  scheduledDeleteAt?: string | null
}

interface BillingResponse {
  ok: boolean
  data?: {
    subscription: BillingSubscription | null
    plans: unknown[]
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

function getBannerView(subscription: BillingSubscription): BannerView | null {
  const { status, trialEndsAt, currentPeriodEnd, scheduledDeleteAt } =
    subscription

  if (status === 'TRIALING') {
    const days = daysRemaining(trialEndsAt)

    // No trial end date → don't show (can't compute anything meaningful)
    if (days === null) return null

    if (days === 0) {
      return {
        background: RED_GRADIENT,
        Icon: AlertTriangle,
        message: (
          <>
            <strong className="font-semibold">Trial ends today.</strong>{' '}
            Add a payment method to keep your workspace active.
          </>
        ),
        buttonLabel: 'Add Payment',
      }
    }

    if (days <= 3) {
      return {
        background: AMBER_GRADIENT,
        Icon: Clock,
        message: (
          <>
            <strong className="font-semibold">
              Free trial — {days} {days === 1 ? 'day' : 'days'} remaining.
            </strong>{' '}
            Upgrade now to avoid service interruption.
          </>
        ),
        buttonLabel: 'Upgrade Now',
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
          Pick a plan whenever you&rsquo;re ready.
        </>
      ),
      buttonLabel: 'Manage Plan',
    }
  }

  if (status === 'PAST_DUE') {
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

  if (status === 'CANCELED') {
    // Prefer an explicit deletion date; fall back to the current period end
    // (Stripe's typical grace window), then a generic message.
    const deletionDate = scheduledDeleteAt ?? currentPeriodEnd
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

  // ACTIVE, PAUSED, or anything else → no banner
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

  if (isError || !data?.ok || !data.data?.subscription) return null

  const view = getBannerView(data.data.subscription)
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
