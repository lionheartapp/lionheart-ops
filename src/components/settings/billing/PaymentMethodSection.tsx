'use client'

import { CreditCard, ExternalLink, Loader2 } from 'lucide-react'

interface PaymentMethodSectionProps {
  portalLoading: boolean
  portalError: string
  onManagePayment: () => void
}

export function PaymentMethodSection({ portalLoading, portalError, onManagePayment }: PaymentMethodSectionProps) {
  return (
    <section className="ui-glass p-6">
      <div className="flex items-center gap-4 mb-8">
        <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-slate-500 to-slate-500 flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Payment Method</h3>
          <p className="text-sm text-slate-500 mt-0.5">Manage your billing details</p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="font-medium text-slate-900">Manage your payment method securely</p>
          <p className="text-sm text-slate-500">Update card details, billing address, and more via Stripe.</p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <button
            onClick={onManagePayment}
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
  )
}
