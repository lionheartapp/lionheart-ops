import { CreditCard } from 'lucide-react'

/** Manage Subscription — Super Admin only. Placeholder for billing/plan management. */
export default function BillingPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Manage Subscription</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Upgrade or manage your Lionheart plan and add-on modules.
      </p>
      <div className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/30">
        <CreditCard className="w-12 h-12 text-zinc-400 dark:text-zinc-500 mb-4" />
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Subscription management coming soon</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm text-center">
          You&apos;ll be able to upgrade plans, enable add-ons (Water Management, Visual Campus, Advanced Inventory), and manage billing here.
        </p>
      </div>
    </div>
  )
}
