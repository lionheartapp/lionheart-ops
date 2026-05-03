'use client'

import { useState, useEffect, useCallback } from 'react'
import { CreditCard } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import type { Subscription, SubscriptionPlan, InvoiceItem, TrialInfo } from './billing/billing-types'
import { formatCents, formatDate } from './billing/billing-types'
import { BillingTabSkeleton } from './billing/BillingTabSkeleton'
import { CurrentPlanSection } from './billing/CurrentPlanSection'
import { PlanComparisonSection } from './billing/PlanComparisonSection'
import { PaymentMethodSection } from './billing/PaymentMethodSection'
import { InvoiceHistorySection } from './billing/InvoiceHistorySection'
import { CancelSubscriptionSection } from './billing/CancelSubscriptionSection'
import { DangerZoneSection } from './billing/DangerZoneSection'

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BillingTab() {
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [trial, setTrial] = useState<TrialInfo | null>(null)
  const [invoices, setInvoices] = useState<InvoiceItem[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(true)
  const [stripeConfigured, setStripeConfigured] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState('')

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

  // Cancel subscription state
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [reactivateLoading, setReactivateLoading] = useState(false)
  // UX-003: previously the reactivate failure was silently swallowed
  // ("// noop — button will re-enable on error"). Track the error for display.
  const [reactivateError, setReactivateError] = useState('')

  // Delete organization state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [orgName, setOrgName] = useState('')

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
          setTrial(data.data.trial ?? null)
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

  // Kick off Stripe Checkout for a plan the user has no subscription for yet.
  const handleStartCheckout = async (plan: SubscriptionPlan) => {
    setCheckoutLoading(plan.id)
    setCheckoutError('')
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ planId: plan.id }),
      })
      const data = await res.json()
      if (data.ok && data.data?.url) {
        window.location.href = data.data.url
        return
      }
      setCheckoutError(data.error?.message || 'Failed to start checkout. Please try again.')
    } catch {
      setCheckoutError('An unexpected error occurred. Please try again.')
    } finally {
      setCheckoutLoading(null)
    }
  }

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

  // Fetch current org name for the delete-confirmation input
  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const res = await fetch('/api/settings/school-info', { headers: getHeaders() })
        const data = await res.json()
        if (data.ok && data.data?.name) setOrgName(data.data.name)
      } catch {
        // non-critical — delete dialog will show a placeholder message
      }
    }
    fetchOrg()
  }, [getHeaders])

  // Cancel subscription (at period end)
  const handleCancelSubscription = async () => {
    setCancelLoading(true)
    setCancelError('')
    try {
      const res = await fetch('/api/settings/billing/cancel', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ immediate: false }),
      })
      const data = await res.json()
      if (data.ok) {
        setSubscription(data.data.subscription)
        setCancelConfirmOpen(false)
      } else {
        setCancelError(data.error?.message || 'Failed to cancel subscription.')
      }
    } catch {
      setCancelError('An unexpected error occurred. Please try again.')
    } finally {
      setCancelLoading(false)
    }
  }

  // Reactivate a scheduled-to-cancel subscription
  // UX-003: surface server errors instead of swallowing them. The previous
  // catch was empty so a failed reactivation looked identical to a successful
  // one (the spinner stopped and nothing else changed).
  const handleReactivate = async () => {
    setReactivateLoading(true)
    setReactivateError('')
    try {
      const res = await fetch('/api/settings/billing/reactivate', {
        method: 'POST',
        headers: getHeaders(),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        setSubscription(data.data.subscription)
      } else {
        const msg =
          data?.error?.message ||
          'Failed to reactivate the subscription. Please try again or contact support.'
        setReactivateError(msg)
      }
    } catch (err) {
      setReactivateError(
        err instanceof Error ? err.message : 'Failed to reactivate the subscription.'
      )
    } finally {
      setReactivateLoading(false)
    }
  }

  // Delete organization (30-day grace period)
  const handleDeleteOrganization = async () => {
    if (deleteConfirmationText.trim() !== orgName) {
      setDeleteError('Organization name does not match.')
      return
    }
    setDeleteLoading(true)
    setDeleteError('')
    try {
      const res = await fetch('/api/settings/organization/delete', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ confirmationText: deleteConfirmationText.trim() }),
      })
      const data = await res.json()
      if (data.ok) {
        setDeleteDialogOpen(false)
        // Log out and redirect after a beat so the user sees the confirmation
        setTimeout(() => {
          try {
            localStorage.removeItem('auth-token')
          } catch {
            // ignore
          }
          window.location.href = '/login'
        }, 5000)
      } else {
        setDeleteError(data.error?.message || 'Failed to delete organization.')
      }
    } catch {
      setDeleteError('An unexpected error occurred. Please try again.')
    } finally {
      setDeleteLoading(false)
    }
  }

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

  return (
    <div className="space-y-8">
      <CurrentPlanSection
        subscription={subscription}
        trial={trial}
        checkoutError={checkoutError}
      />

      <PlanComparisonSection
        plans={plans}
        currentPlanId={currentPlanId}
        currentPlanOrder={currentPlanOrder}
        subscription={subscription}
        checkoutLoading={checkoutLoading}
        onStartCheckout={handleStartCheckout}
        onPlanSelect={handlePlanSelect}
      />

      <PaymentMethodSection
        portalLoading={portalLoading}
        portalError={portalError}
        onManagePayment={handleManagePayment}
      />

      <InvoiceHistorySection
        invoices={invoices}
        invoicesLoading={invoicesLoading}
      />

      {subscription && (
        <CancelSubscriptionSection
          subscription={subscription}
          cancelError={cancelError}
          reactivateError={reactivateError}
          reactivateLoading={reactivateLoading}
          onCancelClick={() => setCancelConfirmOpen(true)}
          onReactivate={handleReactivate}
        />
      )}

      <DangerZoneSection
        orgName={orgName}
        deleteDialogOpen={deleteDialogOpen}
        deleteConfirmationText={deleteConfirmationText}
        deleteLoading={deleteLoading}
        deleteError={deleteError}
        onOpenDialog={() => {
          setDeleteDialogOpen(true)
          setDeleteConfirmationText('')
          setDeleteError('')
        }}
        onCloseDialog={() => {
          if (!deleteLoading) {
            setDeleteDialogOpen(false)
            setDeleteConfirmationText('')
            setDeleteError('')
          }
        }}
        onConfirmationTextChange={(text) => {
          setDeleteConfirmationText(text)
          setDeleteError('')
        }}
        onDeleteOrganization={handleDeleteOrganization}
      />

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

      {/* ── Cancel Subscription Confirmation Dialog ──────────────────────────── */}
      <ConfirmDialog
        isOpen={cancelConfirmOpen}
        onClose={() => {
          if (!cancelLoading) {
            setCancelConfirmOpen(false)
            setCancelError('')
          }
        }}
        onConfirm={handleCancelSubscription}
        title="Cancel Subscription?"
        message={`Your subscription will remain active until ${formatDate(subscription?.currentPeriodEnd ?? null)}. You can reactivate any time before then. Are you sure?`}
        confirmText={cancelLoading ? 'Canceling...' : 'Yes, Cancel'}
        cancelText="Keep Subscription"
        variant="warning"
        isLoading={cancelLoading}
        loadingText="Canceling subscription..."
        confirmDisabled={cancelLoading}
      />
    </div>
  )
}
