import { useState } from 'react'
import { Check, Download, CreditCard } from 'lucide-react'

const PLANS = {
  starter: {
    name: 'Starter',
    subtitle: 'Small private schools',
    monthly: 199,
    annual: 2000,
    students: 'Up to 300 Students',
    features: ['Maintenance & IT Tickets', 'Basic Calendar', 'Basic User Management'],
  },
  pro: {
    name: 'Pro',
    subtitle: 'Standard K-12 Campus',
    monthly: 499,
    annual: 5500,
    students: 'Up to 1,000 Students',
    features: ['Water Management Module', 'Inventory Tracking', 'Smart Event AI (Unlimited)', 'Visual Repair Assistant (50 uses/mo)'],
  },
  enterprise: {
    name: 'Enterprise',
    subtitle: 'Multi-site Districts',
    monthly: null,
    annual: '10k+',
    students: 'Unlimited Students',
    features: ['Visual Campus (3D Matterport)', 'Monthly AI Budget Reports', 'Unlimited AI Usage', 'Dedicated Support Manager'],
  },
}

export default function SubscriptionSettings() {
  const [billingCycle, setBillingCycle] = useState('monthly') // 'monthly' or 'annual'

  const invoices = [
    { id: 1, date: 'Oct 01, 2025', plan: 'Pro Plan', amount: '$499.00', status: 'Paid' },
    { id: 2, date: 'Sep 01, 2025', plan: 'Pro Plan', amount: '$499.00', status: 'Paid' },
    { id: 3, date: 'Aug 01, 2025', plan: 'Pro Plan', amount: '$499.00', status: 'Paid' },
  ]

  const formatPrice = (plan) => {
    if (billingCycle === 'annual') {
      if (plan.annual === '10k+') return '$10k+'
      if (plan.annual === 5500) return '$5.5k'
      if (plan.annual === 2000) return '$2k'
      return `$${plan.annual?.toLocaleString() ?? plan.annual}`
    }
    if (plan.monthly == null) return 'Custom'
    return `$${plan.monthly}`
  }

  const formatPeriod = (plan) => {
    if (plan.monthly == null) return '/yr'
    return billingCycle === 'annual' ? '/yr' : '/month'
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Billing & Subscription</h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          Site license pricing based on student enrollment. Manage your school&apos;s plan, payment methods, and billing history.
        </p>
      </div>

      {/* Billing cycle toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setBillingCycle('monthly')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
            billingCycle === 'monthly'
              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setBillingCycle('annual')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
            billingCycle === 'annual'
              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}
        >
          Annual
        </button>
        <span className="text-xs text-emerald-600 dark:text-emerald-400 ml-1">Save with annual billing</span>
      </div>

      {/* Usage Meter */}
      <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative w-12 h-12 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-zinc-100 dark:text-zinc-700"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="text-emerald-500"
                strokeDasharray="65, 100"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Pro Plan Active</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">2,450 / 3,000 Students Enrolled</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 bg-zinc-900 dark:bg-white rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100"
          >
            Edit Details
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Starter Tier */}
        <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex flex-col">
          <div className="mb-4">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Starter</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Small private schools (&lt;300 students)</p>
          </div>
          <div className="mb-6">
            <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{formatPrice(PLANS.starter)}</span>
            <span className="text-zinc-500 dark:text-zinc-400">{formatPeriod(PLANS.starter)}</span>
          </div>
          <button
            type="button"
            className="w-full py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 mb-6"
          >
            Downgrade
          </button>
          <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400 flex-1">
            <li className="flex gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" /> {PLANS.starter.students}
            </li>
            {PLANS.starter.features.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" /> {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Pro Tier (Highlighted) */}
        <div className="p-6 rounded-2xl border-2 border-emerald-500 bg-white dark:bg-zinc-800 flex flex-col relative shadow-xl shadow-emerald-500/10">
          <div className="absolute top-0 right-0 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl">
            MOST POPULAR
          </div>
          <div className="mb-4">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Pro</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Standard K-12 schools</p>
          </div>
          <div className="mb-6">
            <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{formatPrice(PLANS.pro)}</span>
            <span className="text-zinc-500 dark:text-zinc-400">{formatPeriod(PLANS.pro)}</span>
          </div>
          <button
            type="button"
            className="w-full py-2.5 rounded-lg bg-zinc-900 dark:bg-white text-sm font-medium text-white dark:text-zinc-900 mb-6"
          >
            Current Plan
          </button>
          <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400 flex-1">
            <li className="flex gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" /> {PLANS.pro.students}
            </li>
            {PLANS.pro.features.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" /> {f.includes('AI') ? <strong>{f}</strong> : f}
              </li>
            ))}
          </ul>
        </div>

        {/* Enterprise Tier */}
        <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex flex-col">
          <div className="mb-4">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Enterprise</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Multi-site / Districts</p>
          </div>
          <div className="mb-6">
            <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Custom</span>
            <span className="text-zinc-500 dark:text-zinc-400"> (from $10k/yr)</span>
          </div>
          <button
            type="button"
            className="w-full py-2.5 rounded-lg bg-emerald-600 text-sm font-medium text-white hover:bg-emerald-700 mb-6"
          >
            Upgrade Plan
          </button>
          <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400 flex-1">
            <li className="flex gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" /> {PLANS.enterprise.students}
            </li>
            {PLANS.enterprise.features.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" /> {f.includes('Visual') ? <strong>{f}</strong> : f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Billing History Table */}
      <div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Billing history</h3>
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden bg-white dark:bg-zinc-800">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="px-6 py-3 font-medium">Invoice</th>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Plan</th>
                <th className="px-6 py-3 font-medium">Amount</th>
                <th className="px-6 py-3 font-medium text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">Invoice #{invoice.id + 2024}</span>
                  </td>
                  <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">{invoice.date}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400">
                      {invoice.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100 font-medium">{invoice.amount}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                      aria-label="Download invoice"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
