'use client'

/**
 * Plan Picker (upgrade flow)
 *
 * Standalone full-width plan picker. Used as an upgrade destination from
 * the trial banner, the in-app expiry prompt, and reminder emails. New
 * signups do NOT go through this page — they get a 30-day no-card trial
 * that starts at org creation, and only hit this page when they're ready
 * to commit to a paid plan.
 *
 * Enterprise is a "Contact sales" button (no self-serve Stripe checkout)
 * because schools at that price tier go through procurement anyway.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Check, Loader2, AlertCircle, Mail, Sparkles } from 'lucide-react'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'
import { getFeatureList, isEnterprisePlan } from '@/lib/plan-features'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SubscriptionPlan {
  id: string
  name: string
  slug: string
  stripePriceId: string | null
  monthlyPrice: number
  annualPrice: number | null
  features: Record<string, unknown> | null
  trialDays: number
  isActive: boolean
  displayOrder: number
}

interface BillingResponse {
  subscription: unknown
  plans: SubscriptionPlan[]
}

interface CheckoutResponse {
  url: string
  sessionId: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatAnnualPrice(plan: SubscriptionPlan): string {
  // Prefer explicit annualPrice, otherwise derive from monthly (cents).
  const cents =
    plan.annualPrice && plan.annualPrice > 0
      ? plan.annualPrice
      : plan.monthlyPrice * 12
  const dollars = Math.round(cents / 100)
  return `$${dollars.toLocaleString('en-US')}`
}

function formatMonthlyPrice(plan: SubscriptionPlan): string {
  const dollars = Math.round(plan.monthlyPrice / 100)
  return `$${dollars.toLocaleString('en-US')}/mo`
}

function isProPlan(plan: SubscriptionPlan): boolean {
  const slug = plan.slug.toLowerCase()
  return slug === 'pro' || slug.includes('pro')
}

/**
 * Href for the Enterprise "Contact sales" CTA.
 * Routes users to the on-site contact form (no email addresses exposed).
 */
function buildSalesContactHref(): string {
  return '/contact?topic=sales'
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function OnboardingPlanPage() {
  const router = useRouter()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  // Fetch plans from the existing /api/settings/billing endpoint.
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await fetchApi<BillingResponse>('/api/settings/billing')
        if (cancelled) return
        // Only show purchasable plans: active + non-zero price.
        // (The "Free Trial" plan — if any — would have monthlyPrice: 0.)
        const purchasable = data.plans
          .filter((p) => p.isActive && p.monthlyPrice > 0)
          .sort((a, b) => a.displayOrder - b.displayOrder)
        setPlans(purchasable)
      } catch (err) {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : 'Failed to load plans')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const proPlanId = useMemo(
    () => plans.find((p) => isProPlan(p))?.id ?? null,
    [plans]
  )

  async function handleSelectPlan(planId: string) {
    setSelectedPlanId(planId)
    setCheckoutError(null)

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({ planId }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(
          json?.error?.message ?? 'Failed to start checkout. Please try again.'
        )
      }
      const { url } = json.data as CheckoutResponse
      // Hard navigation to Stripe Checkout.
      window.location.href = url
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Something went wrong')
      setSelectedPlanId(null)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
          Choose your plan
        </h1>
        <p className="mt-3 text-base text-slate-600">
          Pick a plan to keep your workspace active after your 30-day free trial.
          {' '}Cancel anytime from settings.
        </p>
      </div>

      {loading && <PlanSkeleton />}

      {!loading && loadError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-5 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-red-900">Couldn&apos;t load plans</p>
            <p className="text-red-700 mt-1">{loadError}</p>
            <button
              type="button"
              onClick={() => {
                setLoadError(null)
                setLoading(true)
                // Trigger a fresh fetch
                setTimeout(() => {
                  // eslint-disable-next-line @typescript-eslint/no-floating-promises
                  ;(async () => {
                    try {
                      const data = await fetchApi<BillingResponse>('/api/settings/billing')
                      setPlans(
                        data.plans
                          .filter((p) => p.isActive && p.monthlyPrice > 0)
                          .sort((a, b) => a.displayOrder - b.displayOrder)
                      )
                    } catch (err) {
                      setLoadError(err instanceof Error ? err.message : 'Failed to load plans')
                    } finally {
                      setLoading(false)
                    }
                  })()
                }, 0)
              }}
              className="mt-3 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-700 transition-colors cursor-pointer"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {!loading && !loadError && plans.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">
            No plans are configured yet. Please contact support to get started.
          </p>
        </div>
      )}

      {!loading && !loadError && plans.length > 0 && (
        <>
          {checkoutError && (
            <div
              role="alert"
              className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{checkoutError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {plans.map((plan, idx) => {
              const isFeatured = plan.id === proPlanId
              const isEnterprise = isEnterprisePlan(plan)
              const isSelected = selectedPlanId === plan.id
              const isAnyLoading = selectedPlanId !== null
              const features = getFeatureList(plan.features)

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: idx * 0.06, ease: [0.25, 0.1, 0.25, 1] }}
                  className={`relative rounded-2xl p-6 flex flex-col ${
                    isFeatured
                      ? 'bg-gradient-to-br from-primary-50 to-indigo-100 border-2 border-primary-400 shadow-lg shadow-primary-200/40'
                      : 'bg-white border border-slate-200'
                  }`}
                >
                  {isFeatured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-primary-600 to-indigo-600 text-white text-xs font-semibold rounded-full shadow-md">
                        <Sparkles className="w-3 h-3" />
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                    <div className="mt-3 flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold text-slate-900">
                        {formatAnnualPrice(plan)}
                      </span>
                      <span className="text-sm text-slate-500">/year</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {isEnterprise
                        ? 'Custom pricing available for multi-campus'
                        : `Billed ${formatMonthlyPrice(plan)}`}
                    </p>
                  </div>

                  {features.length > 0 && (
                    <ul className="space-y-2.5 mb-6 flex-1">
                      {features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm text-slate-700">
                          <Check
                            className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                              isFeatured ? 'text-primary-600' : 'text-emerald-600'
                            }`}
                          />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {isEnterprise ? (
                    <a
                      href={buildSalesContactHref()}
                      className="w-full mt-auto px-4 py-3 rounded-full font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer bg-slate-900 text-white hover:bg-slate-800"
                    >
                      <Mail className="w-4 h-4" />
                      Contact Sales
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={isAnyLoading}
                      aria-busy={isSelected}
                      className={`w-full mt-auto px-4 py-3 rounded-full font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                        isFeatured
                          ? 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-primary-300/50 hover:-translate-y-0.5'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Redirecting to checkout…
                        </>
                      ) : (
                        `Upgrade to ${plan.name}`
                      )}
                    </button>
                  )}
                </motion.div>
              )
            })}
          </div>

          <p className="mt-8 text-center text-xs text-slate-500">
            Paid plans are billed through Stripe. You can cancel anytime from settings.
          </p>
        </>
      )}
    </div>
  )
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function PlanSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-200 bg-white p-6 animate-pulse"
        >
          <div className="h-5 w-24 bg-slate-200 rounded mb-4" />
          <div className="h-8 w-32 bg-slate-200 rounded mb-2" />
          <div className="h-3 w-40 bg-slate-100 rounded mb-6" />
          <div className="space-y-2 mb-6">
            <div className="h-3 w-full bg-slate-100 rounded" />
            <div className="h-3 w-5/6 bg-slate-100 rounded" />
            <div className="h-3 w-4/6 bg-slate-100 rounded" />
            <div className="h-3 w-5/6 bg-slate-100 rounded" />
          </div>
          <div className="h-11 w-full bg-slate-200 rounded-full" />
        </div>
      ))}
    </div>
  )
}
