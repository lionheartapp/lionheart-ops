'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  Download,
  ExternalLink,
  Loader2,
  Star,
} from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface Subscription {
  id: string
  organizationId: string
  planId: string
  stripeSubscriptionId: string | null
  stripeCustomerId: string | null
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'PAUSED'
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  trialEndsAt: string | null
  plan: SubscriptionPlan
}

interface InvoiceItem {
  id: string
  date: string
  amount: number
  currency: string
  status: string
  pdfUrl: string | null
  description: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCents(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function daysRemaining(iso: string | null): number | null {
  if (!iso) return null
  const diff = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function getStatusConfig(status: Subscription['status']) {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Active', className: 'bg-green-100 text-green-700', icon: CheckCircle2 }
    case 'TRIALING':
      return { label: 'Trial', className: 'bg-blue-100 text-blue-700', icon: Clock }
    case 'PAST_DUE':
      return { label: 'Past Due', className: 'bg-red-100 text-red-700', icon: AlertCircle }
    case 'CANCELED':
      return { label: 'Canceled', className: 'bg-slate-100 text-slate-700', icon: XCircle }
    case 'PAUSED':
      return { label: 'Paused', className: 'bg-yellow-100 text-yellow-700', icon: Clock }
    default:
      return { label: status, className: 'bg-slate-100 text-slate-700', icon: Clock }
  }
}

function getInvoiceStatusConfig(status: string) {
  switch (status) {
    case 'SUCCEEDED':
      return { label: 'Paid', className: 'bg-green-100 text-green-700' }
    case 'FAILED':
      return { label: 'Failed', className: 'bg-red-100 text-red-700' }
    case 'PENDING':
      return { label: 'Pending', className: 'bg-yellow-100 text-yellow-700' }
    case 'REFUNDED':
      return { label: 'Refunded', className: 'bg-slate-100 text-slate-700' }
    default:
      return { label: status, className: 'bg-slate-100 text-slate-700' }
  }
}

function getFeatureList(features: Record<string, unknown> | null): string[] {
  if (!features) return []
  return Object.entries(features).map(([key, value]) => {
    const label = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (s) => s.toUpperCase())
      .trim()
    if (typeof value === 'boolean') return value ? label : `No ${label}`
    if (typeof value === 'number') return `${label}: ${value}`
    return `${label}: ${value}`
  })
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function BillingTabSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Current plan skeleton */}
      <div className="bg-gradient-to-br from-primary-50/80 to-primary-100/80 border border-primary-200/30 rounded-2xl p-6 h-36" />
      {/* Plan cards skeleton */}
      <div>
        <div className="h-6 w-40 bg-slate-200 rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 h-52" />
          ))}
        </div>
      </div>
      {/* Invoice table skeleton */}
      <div>
        <div className="h-6 w-40 bg-slate-200 rounded mb-4" />
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 border-b border-slate-100 px-6 flex items-center gap-4">
              <div className="h-4 w-24 bg-slate-200 rounded" />
              <div className="h-4 flex-1 bg-slate-100 rounded" />
              <div className="h-4 w-16 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BillingTab() {
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [invoices, setInvoices] = useState<InvoiceItem[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(true)
  const [stripeConfigured, setStripeConfigured] = useState(true)

  // Plan change dialog state
  const [changingToPlan, setChangingToPlan] = useState<SubscriptionPlan | null>(null)
  const [proratedPreview, setProratedPreview] = useState<{
    amount: number
    description: string
  } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [changePlanLoading, setChangePlanLoading] = useState(false)
  const [changePlanError, setChangePlanError] = useState('')

  // Portal button state
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null

  const getHeaders = useCallback((): HeadersInit => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    return headers
  }, [token])

  // Fetch current subscription + plans
  useEffect(() => {
    const fetchBilling = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/settings/billing', {
          headers: getHeaders(),
        })
        const data = await res.json()
        if (data.ok) {
          setSubscription(data.data.subscription)
          setPlans(data.data.plans)
          // If no plans and no subscription, Stripe likely not configured
          if (!data.data.subscription && data.data.plans.length === 0) {
            setStripeConfigured(false)
          }
        } else if (
          data.error?.message?.includes('not yet configured') ||
          data.error?.code === 'SERVICE_UNAVAILABLE'
        ) {
          setStripeConfigured(false)
        }
      } catch {
        setStripeConfigured(false)
      } finally {
        setLoading(false)
      }
    }
    fetchBilling()
  }, [getHeaders])

  // Fetch invoices separately
  useEffect(() => {
    const fetchInvoices = async () => {
      setInvoicesLoading(true)
      try {
        const res = await fetch('/api/settings/billing/invoices', {
          headers: getHeaders(),
        })
        const data = await res.json()
        if (data.ok) {
          setInvoices(data.data.invoices)
        }
      } catch {
        // silently fail — invoice list is non-critical
      } finally {
        setInvoicesLoading(false)
      }
    }
    fetchInvoices()
  }, [getHeaders])

  // Open plan change dialog and fetch preview
  const handlePlanSelect = async (plan: SubscriptionPlan) => {
    setChangingToPlan(plan)
    setChangePlanError('')
    setProratedPreview(null)
    setPreviewLoading(true)

    try {
      const res = await fetch('/api/settings/billing/change-plan', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ planId: plan.id, preview: true }),
      })
      const data = await res.json()
      if (data.ok) {
        setProratedPreview({
          amount: data.data.amount,
          description: data.data.description,
        })
      } else {
        setProratedPreview({
          amount: plan.monthlyPrice,
          description: `You will be charged ${formatCents(plan.monthlyPrice)}/month for the ${plan.name} plan.`,
        })
      }
    } catch {
      setProratedPreview({
        amount: plan.monthlyPrice,
        description: `You will be charged ${formatCents(plan.monthlyPrice)}/month for the ${plan.name} plan.`,
      })
    } finally {
      setPreviewLoading(false)
    }
  }

  // Confirm plan change
  const handleConfirmPlanChange = async () => {
    if (!changingToPlan) return
    setChangePlanLoading(true)
    setChangePlanError('')

    try {
      const res = await fetch('/api/settings/billing/change-plan', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ planId: changingToPlan.id, preview: false }),
      })
      const data = await res.json()
      if (data.ok) {
        setSubscription(data.data.subscription)
        setChangingToPlan(null)
        setProratedPreview(null)
      } else {
        setChangePlanError(data.error?.message || 'Failed to change plan. Please try again.')
      }
    } catch {
      setChangePlanError('An unexpected error occurred. Please try again.')
    } finally {
      setChangePlanLoading(false)
    }
  }

  // Open Stripe Customer Portal
  const handleManagePayment = async () => {
    setPortalLoading(true)
    setPortalError('')

    try {
      const res = await fetch('/api/settings/billing/portal', {
        method: 'POST',
        headers: getHeaders(),
      })
      const data = await res.json()
      if (data.ok && data.data?.url) {
        window.open(data.data.url, '_blank')
      } else {
        const msg = data.error?.message || 'Failed to open billing portal.'
        setPortalError(msg)
        setTimeout(() => setPortalError(''), 5000)
      }
    } catch {
      setPortalError('An unexpected error occurred. Please try again.')
      setTimeout(() => setPortalError(''), 5000)
    } finally {
      setPortalLoading(false)
    }
  }

  if (loading) {
    return <BillingTabSkeleton />
  }

  if (!stripeConfigured) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <CreditCard className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Billing Not Configured</h3>
        <p className="text-slate-500 max-w-sm">
          Billing is not yet configured for this organization. Contact your administrator.
        </p>
      </div>
    )
  }

  const currentPlanId = subscription?.planId ?? null
  const currentPlanOrder = plans.find((p) => p.id === currentPlanId)?.displayOrder ?? -1
  const statusConfig = subscription ? getStatusConfig(subscription.status) : null
  const StatusIcon = statusConfig?.icon ?? null
  const trialDaysLeft = subscription?.status === 'TRIALING'
    ? daysRemaining(subscription.trialEndsAt)
    : null

  return (
    <div className="space-y-8">

      {/* ── Current Plan ─────────────────────────────────────────────────────── */}
      <section className="ui-glass p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Current Plan</h3>
            <p className="text-xs text-slate-500">Your active subscription details</p>
          </div>
        </div>

        {subscription ? (
          <div className="bg-gradient-to-br from-primary-50/80 to-primary-100/80 backdrop-blur-sm border border-primary-200/30 rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-slate-900">{subscription.plan.name}</h3>
                  {statusConfig && StatusIcon && (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.className}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {statusConfig.label}
                    </span>
                  )}
                </div>

                <div className="text-3xl font-bold text-slate-900">
                  {subscription.plan.monthlyPrice > 0
                    ? `${formatCents(subscription.plan.monthlyPrice)}/mo`
                    : 'Free'}
                </div>

                {subscription.status === 'TRIALING' && (
                  <p className="text-sm text-primary-700">
                    Trial ends {formatDate(subscription.trialEndsAt)}
                    {trialDaysLeft !== null && ` (${trialDaysLeft} ${trialDaysLeft === 1 ? 'day' : 'days'} remaining)`}
                  </p>
                )}

                {subscription.currentPeriodEnd && subscription.status !== 'CANCELED' && (
                  <p className="text-sm text-slate-600">
                    {subscription.cancelAtPeriodEnd ? 'Cancels' : 'Renews'} on{' '}
                    <span className="font-medium">{formatDate(subscription.currentPeriodEnd)}</span>
                  </p>
                )}
              </div>

              <div className="text-sm text-slate-500 shrink-0">
                Billing cycle: <span className="font-medium text-slate-700">Monthly</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="ui-glass p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-900">No active plan</h3>
              <p className="text-sm text-slate-500 mt-1">Select a plan below to get started.</p>
            </div>
          </div>
        )}
      </section>

      {/* ── Plan Comparison ───────────────────────────────────────────────────── */}
      {plans.length > 0 && (
        <section className="ui-glass p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
              <Star className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Available Plans</h3>
              <p className="text-xs text-slate-500">Compare and switch between plans</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlanId
              const isUpgrade = plan.displayOrder > currentPlanOrder
              const isDowngrade = !isCurrent && plan.displayOrder < currentPlanOrder && currentPlanOrder > -1
              const featureList = getFeatureList(plan.features)

              return (
                <div
                  key={plan.id}
                  className={`relative bg-white rounded-2xl p-6 flex flex-col gap-4 transition-all duration-200 ${
                    isCurrent
                      ? 'border-2 border-primary-500 shadow-md'
                      : 'border border-slate-200 hover:shadow-md hover:border-slate-300'
                  }`}
                >
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-primary-500 text-white text-xs font-semibold shadow-sm">
                        <Star className="w-3 h-3" />
                        Current Plan
                      </span>
                    </div>
                  )}

                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">{plan.name}</h3>
                    <div className="mt-1">
                      <span className="text-2xl font-bold text-slate-900">
                        {plan.monthlyPrice > 0 ? formatCents(plan.monthlyPrice) : 'Free'}
                      </span>
                      {plan.monthlyPrice > 0 && (
                        <span className="text-sm text-slate-500">/mo</span>
                      )}
                    </div>
                    {plan.annualPrice && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatCents(plan.annualPrice)}/yr (save {Math.round((1 - plan.annualPrice / (plan.monthlyPrice * 12)) * 100)}%)
                      </p>
                    )}
                  </div>

                  {featureList.length > 0 && (
                    <ul className="flex-1 space-y-1.5">
                      {featureList.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-auto pt-2">
                    {isCurrent ? (
                      <div className="text-center text-sm text-primary-600 font-medium py-2">
                        Your current plan
                      </div>
                    ) : (
                      <button
                        onClick={() => handlePlanSelect(plan)}
                        className={`w-full py-2.5 rounded-full text-sm font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                          isUpgrade
                            ? 'bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.97]'
                            : isDowngrade
                            ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-[0.97]'
                            : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.97]'
                        }`}
                      >
                        {isUpgrade ? 'Upgrade' : isDowngrade ? 'Downgrade' : 'Select Plan'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Payment Method ────────────────────────────────────────────────────── */}
      <section className="ui-glass p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-500 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Payment Method</h3>
            <p className="text-xs text-slate-500">Manage your billing details</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-medium text-slate-900">Manage your payment method securely</p>
            <p className="text-sm text-slate-500">Update card details, billing address, and more via Stripe.</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <button
              onClick={handleManagePayment}
              disabled={portalLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              {portalLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4" />
              )}
              Manage Payment Method
            </button>
            {portalError && (
              <p className="text-red-600 text-sm mt-1 max-w-xs text-right">{portalError}</p>
            )}
          </div>
        </div>
      </section>

      {/* ── Invoice History ───────────────────────────────────────────────────── */}
      <section className="ui-glass p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Download className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Invoice History</h3>
            <p className="text-xs text-slate-500">View and download past invoices</p>
          </div>
        </div>

        {invoicesLoading ? (
          <div className="ui-glass-table">
            <div className="animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 border-b border-slate-100 px-6 flex items-center gap-4">
                  <div className="h-4 w-24 bg-slate-200 rounded" />
                  <div className="h-4 flex-1 bg-slate-100 rounded" />
                  <div className="h-4 w-16 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          </div>
        ) : invoices.length === 0 ? (
          <div className="ui-glass p-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <CreditCard className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-500 font-medium">No invoices yet</p>
            <p className="text-slate-400 text-sm mt-1">Your billing history will appear here.</p>
          </div>
        ) : (
          <div className="ui-glass-table">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((invoice) => {
                  const invoiceStatus = getInvoiceStatusConfig(invoice.status)
                  return (
                    <tr key={invoice.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-700 whitespace-nowrap">
                        {formatDate(invoice.date)}
                      </td>
                      <td className="px-6 py-4 text-slate-600 max-w-xs truncate">
                        {invoice.description || '—'}
                      </td>
                      <td className="px-6 py-4 text-slate-900 font-medium whitespace-nowrap">
                        {formatCents(invoice.amount, invoice.currency)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${invoiceStatus.className}`}>
                          {invoiceStatus.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {invoice.pdfUrl ? (
                          <a
                            href={invoice.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-700 transition-colors text-xs font-medium cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            PDF
                          </a>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Plan Change Confirmation Dialog ──────────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!changingToPlan}
        onClose={() => {
          if (!changePlanLoading) {
            setChangingToPlan(null)
            setProratedPreview(null)
            setChangePlanError('')
          }
        }}
        onConfirm={handleConfirmPlanChange}
        title={`Change to ${changingToPlan?.name ?? ''}`}
        message={
          previewLoading
            ? 'Calculating proration...'
            : changePlanError
            ? changePlanError
            : proratedPreview?.description ??
              `Switch from ${subscription?.plan.name ?? 'your current plan'} to ${changingToPlan?.name ?? ''}?`
        }
        confirmText={changePlanLoading ? 'Changing...' : 'Confirm Change'}
        cancelText="Cancel"
        variant="info"
        isLoading={changePlanLoading || previewLoading}
        loadingText={previewLoading ? 'Loading preview...' : 'Changing plan...'}
        confirmDisabled={previewLoading || changePlanLoading}
      />
    </div>
  )
}
