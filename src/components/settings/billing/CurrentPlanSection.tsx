'use client'

import { CreditCard, AlertCircle, AlertTriangle, Sparkles } from 'lucide-react'
import type { Subscription, TrialInfo } from './billing-types'
import { formatCents, formatDate, daysRemaining, getStatusConfig } from './billing-types'

interface CurrentPlanSectionProps {
  subscription: Subscription | null
  trial: TrialInfo | null
  checkoutError: string
}

export function CurrentPlanSection({ subscription, trial, checkoutError }: CurrentPlanSectionProps) {
  const statusConfig = subscription ? getStatusConfig(subscription.status) : null
  const StatusIcon = statusConfig?.icon ?? null

  return (
    <section className="ui-glass p-6">
      <div className="flex items-center gap-4 mb-8">
        <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Current Plan</h3>
          <p className="text-sm text-slate-500 mt-0.5">Your active subscription details</p>
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
      ) : trial?.expired ? (
        <div className="bg-gradient-to-br from-red-50 to-red-100/70 border border-red-200 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-bold text-slate-900">Free trial ended</h3>
              <p className="text-sm text-slate-700 mt-1">
                Your workspace is in read-only mode. Pick a plan below to keep editing.
                You won&apos;t lose any data.
              </p>
            </div>
          </div>
        </div>
      ) : trial?.inTrial ? (
        <div className="bg-gradient-to-br from-primary-50 to-indigo-100 border border-primary-200 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-primary-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-bold text-slate-900">Free trial</h3>
                <div className="mt-1 text-3xl font-bold text-slate-900">
                  {trial.daysLeft !== null
                    ? `${trial.daysLeft} ${trial.daysLeft === 1 ? 'day' : 'days'} remaining`
                    : 'Active'}
                </div>
                {trial.endsAt && (
                  <p className="text-sm text-slate-700 mt-1">
                    Trial ends {formatDate(trial.endsAt)}. No card required until you pick a plan.
                  </p>
                )}
              </div>
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

      {checkoutError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{checkoutError}</p>
        </div>
      )}
    </section>
  )
}
