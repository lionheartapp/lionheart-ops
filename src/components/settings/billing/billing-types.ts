import { CheckCircle2, Clock, AlertCircle, XCircle } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SubscriptionPlan {
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

export interface Subscription {
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

export interface InvoiceItem {
  id: string
  date: string
  amount: number
  currency: string
  status: string
  pdfUrl: string | null
  description: string | null
}

export interface TrialInfo {
  startedAt: string | null
  endsAt: string | null
  daysLeft: number | null
  inTrial: boolean
  expired: boolean
  paid: boolean
  readOnly: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatCents(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function daysRemaining(iso: string | null): number | null {
  if (!iso) return null
  const diff = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export function getStatusConfig(status: Subscription['status']) {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Active', className: 'bg-green-50 text-green-600 ring-1 ring-green-200', icon: CheckCircle2 }
    case 'TRIALING':
      return { label: 'Trial', className: 'bg-blue-50 text-blue-600 ring-1 ring-blue-200', icon: Clock }
    case 'PAST_DUE':
      return { label: 'Past Due', className: 'bg-red-50 text-red-600 ring-1 ring-red-200', icon: AlertCircle }
    case 'CANCELED':
      return { label: 'Canceled', className: 'bg-slate-50 text-slate-400 ring-1 ring-slate-200', icon: XCircle }
    case 'PAUSED':
      return { label: 'Paused', className: 'bg-yellow-50 text-yellow-600 ring-1 ring-yellow-200', icon: Clock }
    default:
      return { label: status, className: 'bg-slate-50 text-slate-400 ring-1 ring-slate-200', icon: Clock }
  }
}

export function getInvoiceStatusConfig(status: string) {
  switch (status) {
    case 'SUCCEEDED':
      return { label: 'Paid', className: 'bg-green-50 text-green-600 ring-1 ring-green-200' }
    case 'FAILED':
      return { label: 'Failed', className: 'bg-red-50 text-red-600 ring-1 ring-red-200' }
    case 'PENDING':
      return { label: 'Pending', className: 'bg-yellow-50 text-yellow-600 ring-1 ring-yellow-200' }
    case 'REFUNDED':
      return { label: 'Refunded', className: 'bg-slate-50 text-slate-400 ring-1 ring-slate-200' }
    default:
      return { label: status, className: 'bg-slate-50 text-slate-400 ring-1 ring-slate-200' }
  }
}

// Enterprise contact-sales target — kept in sync with onboarding/plan/page.tsx.
export const SALES_EMAIL = 'sales@lionheartapp.com'

export function buildSalesMailto(orgName: string): string {
  const subject = encodeURIComponent('Enterprise plan inquiry')
  const body = encodeURIComponent(
    `Hi Lionheart team,\n\nI'd like to talk about the Enterprise plan${orgName ? ` for ${orgName}` : ''}.\n\nThanks,\n`
  )
  return `mailto:${SALES_EMAIL}?subject=${subject}&body=${body}`
}
