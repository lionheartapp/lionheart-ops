'use client'

/**
 * TrialBanner
 *
 * Persistent top-of-app banner that surfaces trial/billing state for the
 * current organization. Rendered in two variants depending on whether the
 * current user has billing permissions:
 *
 *   • canManageBilling → big banner with "Pick a plan" CTA to settings
 *   • otherwise         → compact informational banner, no CTA
 *
 * State rendered:
 *   • In-trial (> 7 days)       aurora gradient, sparkles
 *   • In-trial (3–7 days)       aurora gradient, clock
 *   • In-trial (<= 3 days)      amber, clock, urgency copy
 *   • Trial expired (read-only) red, lock
 *   • PAST_DUE                  red, "update payment"
 *   • CANCELED                  red, "subscription canceled" + deletion date
 *   • ACTIVE / PAUSED / unknown nothing (silent)
 *
 * Data fetched from /api/trial-status (no permission gate — every user
 * can fetch their own org's trial state). If the request fails the
 * banner silently renders nothing rather than blocking the UI.
 */

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Clock, Lock, Sparkles } from 'lucide-react'
import { fetchApi } from '@/lib/api-client'
import { formatTrialDate } from '@/lib/trial-utils'

/**
 * Height of the banner in px. Exposed to the rest of the app via the
 * --trial-banner-h CSS custom property so the fixed Sidebar + any other
 * position:fixed chrome can offset itself instead of being covered.
 */
const BANNER_HEIGHT_PX = 44

// ─── Types ───────────────────────────────────────────────────────────────────

type SubscriptionStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'PAUSED'

interface TrialSubscription {
  status: SubscriptionStatus
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  scheduledDeleteAt: string | null
}

interface TrialInfo {
  endsAt: string | null
  daysLeft: number | null
  inTrial: boolean
  expired: boolean
  readOnly: boolean
  paid: boolean
}

interface TrialStatusData {
  trial: TrialInfo
  subscription: TrialSubscription | null
  canManageBilling: boolean
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BILLING_LINK = '/settings?tab=billing'

/** Aurora gradient — matches brand Aurora in globals.css / ImpersonationBanner. */
const AURORA_GRADIENT = 'linear-gradient(90deg, #3B82F6 0%, #6366F1 100%)'

/** Urgent amber — used when trial has 3 or fewer days remaining. */
const AMBER_GRADIENT = 'linear-gradient(90deg, #F59E0B 0%, #F97316 100%)'

/** Critical red — used for trial-expired, past-due, canceled. */
const RED_GRADIENT = 'linear-gradient(90deg, #DC2626 0%, #B91C1C 100%)'

// ─── Presentation ────────────────────────────────────────────────────────────

interface BannerView {
  background: string
  Icon: typeof Sparkles
  message: React.ReactNode
  buttonLabel: string
}

function getBannerView(
  trial: TrialInfo,
  subscription: TrialSubscription | null
): BannerView | null {
  // Paid + active → the org is a real customer; nothing to show.
  if (trial.paid && subscription?.status === 'ACTIVE') {
    return null
  }

  // PAST_DUE takes priority over trial state.
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

  // Explicit cancelation.
  if (subscription?.status === 'CANCELED') {
    const deletionDate = subscription.scheduledDeleteAt ?? subscription.currentPeriodEnd
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

  // Trial ended → workspace is read-only.
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

  // Inside the free trial — render the countdown.
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
          Everything&rsquo;s unlocked. No card required.
        </>
      ),
      buttonLabel: 'See Plans',
    }
  }

  return null
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TrialBanner() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => setEnabled(true), 10_000)
    return () => window.clearTimeout(timeout)
  }, [])

  const { data, isError } = useQuery<TrialStatusData | null>({
    queryKey: ['trial-status'],
    queryFn: async () => {
      try {
        // fetchApi unwraps the { ok, data } envelope and returns the inner
        // data directly — or throws on !ok. Swallow errors so the banner
        // hides silently rather than blocking the shell.
        return await fetchApi<TrialStatusData>('/api/trial-status')
      } catch {
        return null
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
    enabled,
  })

  // Compute the view first so the effect can observe whether the banner
  // is rendered. When visible, we publish the banner height as a CSS
  // custom property so the fixed Sidebar can shift down to match.
  const view = !isError && data ? getBannerView(data.trial, data.subscription) : null
  const isVisible = view !== null

  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.style.setProperty(
      '--trial-banner-h',
      isVisible ? `${BANNER_HEIGHT_PX}px` : '0px'
    )
    return () => {
      root.style.setProperty('--trial-banner-h', '0px')
    }
  }, [isVisible])

  if (!view) return null

  const { background, Icon, message, buttonLabel } = view
  const showCta = data?.canManageBilling ?? false

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
      className="relative z-50 flex-shrink-0 w-full text-white shadow-sm"
      style={{ background, minHeight: `${BANNER_HEIGHT_PX}px` }}
    >
      <div
        className="flex items-center justify-center gap-3 px-4 py-2.5 text-sm"
        style={{ minHeight: `${BANNER_HEIGHT_PX}px` }}
      >
        <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        <span className="flex-1 sm:flex-none text-center sm:text-left">
          {message}
        </span>
        {showCta && (
          <Link
            href={BILLING_LINK}
            className="ml-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          >
            {buttonLabel}
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
    </motion.div>
  )
}
