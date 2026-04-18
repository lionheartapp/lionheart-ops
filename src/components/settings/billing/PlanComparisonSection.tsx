'use client'

import { CheckCircle2, Loader2, Mail, Star } from 'lucide-react'
import { getFeatureList, isEnterprisePlan } from '@/lib/plan-features'
import type { Subscription, SubscriptionPlan } from './billing-types'
import { formatCents, buildSalesContactHref } from './billing-types'

interface PlanComparisonSectionProps {
  plans: SubscriptionPlan[]
  currentPlanId: string | null
  currentPlanOrder: number
  subscription: Subscription | null
  checkoutLoading: string | null
  onStartCheckout: (plan: SubscriptionPlan) => void
  onPlanSelect: (plan: SubscriptionPlan) => void
}

export function PlanComparisonSection({
  plans,
  currentPlanId,
  currentPlanOrder,
  subscription,
  checkoutLoading,
  onStartCheckout,
  onPlanSelect,
}: PlanComparisonSectionProps) {
  if (plans.length === 0) return null

  return (
    <section className="ui-glass p-6">
      <div className="flex items-center gap-4 mb-8">
        <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
          <Star className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Available Plans</h3>
          <p className="text-sm text-slate-500 mt-0.5">Compare and switch between plans</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId
          const isUpgrade = plan.displayOrder > currentPlanOrder
          const isDowngrade = !isCurrent && plan.displayOrder < currentPlanOrder && currentPlanOrder > -1
          const isEnterprise = isEnterprisePlan(plan)
          const featureList = getFeatureList(plan.features)
          const isLoadingCheckout = checkoutLoading === plan.id
          // No existing subscription → user is on free trial; clicking a plan
          // should create a Stripe Checkout session instead of changing plans.
          const isInitialCheckout = !subscription && !isEnterprise

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
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-slate-900">
                    {plan.annualPrice
                      ? formatCents(plan.annualPrice)
                      : formatCents(plan.monthlyPrice * 12)}
                  </span>
                  <span className="text-sm text-slate-500">/year</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isEnterprise
                    ? 'Custom pricing available for multi-campus'
                    : `Billed ${formatCents(plan.monthlyPrice)}/month`}
                </p>
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
                ) : isEnterprise ? (
                  <a
                    href={buildSalesContactHref()}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold transition-colors cursor-pointer bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.97]"
                  >
                    <Mail className="w-4 h-4" />
                    Contact Sales
                  </a>
                ) : (
                  <button
                    onClick={() =>
                      isInitialCheckout
                        ? onStartCheckout(plan)
                        : onPlanSelect(plan)
                    }
                    disabled={isLoadingCheckout || checkoutLoading !== null}
                    className={`w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                      isDowngrade
                        ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-[0.97]'
                        : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.97]'
                    }`}
                  >
                    {isLoadingCheckout ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Redirecting…
                      </>
                    ) : isInitialCheckout ? (
                      `Upgrade to ${plan.name}`
                    ) : isUpgrade ? (
                      'Upgrade'
                    ) : isDowngrade ? (
                      'Downgrade'
                    ) : (
                      'Select Plan'
                    )}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
