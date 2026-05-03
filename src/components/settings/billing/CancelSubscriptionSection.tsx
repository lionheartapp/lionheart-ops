'use client'

import { Ban, Loader2 } from 'lucide-react'
import type { Subscription } from './billing-types'
import { formatDate } from './billing-types'

interface CancelSubscriptionSectionProps {
  subscription: Subscription
  cancelError: string
  // UX-003: surface reactivate failures alongside cancel failures.
  reactivateError?: string
  reactivateLoading: boolean
  onCancelClick: () => void
  onReactivate: () => void
}

export function CancelSubscriptionSection({
  subscription,
  cancelError,
  reactivateError = '',
  reactivateLoading,
  onCancelClick,
  onReactivate,
}: CancelSubscriptionSectionProps) {
  if (subscription.status !== 'TRIALING' && subscription.status !== 'ACTIVE') {
    return null
  }

  return (
    <section className="ui-glass p-6">
      <div className="flex items-center gap-4 mb-8">
        <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center">
          <Ban className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Cancel Subscription</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            {subscription.cancelAtPeriodEnd
              ? `Your subscription will end on ${formatDate(subscription.currentPeriodEnd)}.`
              : `You'll keep access until ${formatDate(subscription.currentPeriodEnd)}.`}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-sm text-slate-600">
          {subscription.cancelAtPeriodEnd
            ? 'Changed your mind? Reactivate your subscription to continue service.'
            : 'Cancel at the end of the current billing period. You can reactivate any time before the end date.'}
        </p>
        {subscription.cancelAtPeriodEnd ? (
          <button
            onClick={onReactivate}
            disabled={reactivateLoading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer active:scale-[0.97] shrink-0"
          >
            {reactivateLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Reactivate
          </button>
        ) : (
          <button
            onClick={onCancelClick}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer active:scale-[0.97] shrink-0"
          >
            Cancel Subscription
          </button>
        )}
      </div>
      {cancelError && (
        <p className="mt-3 text-sm text-red-600">{cancelError}</p>
      )}
      {reactivateError && (
        <p className="mt-3 text-sm text-red-600">{reactivateError}</p>
      )}
    </section>
  )
}
