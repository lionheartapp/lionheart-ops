'use client'

import { useEffect, useState } from 'react'
import { Check, X, Edit2 } from 'lucide-react'

export default function PlansPage() {
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('platform-token')
    fetch('/api/platform/plans', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (data.ok) setPlans(data.data); setLoading(false) })
  }, [])

  if (loading) return <div className="text-zinc-500 text-center py-12">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((plan) => (
          <div key={plan.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-lg">{plan.name}</h3>
                <p className="text-zinc-500 text-sm">{plan.slug}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs ${plan.isActive ? 'bg-green-500/10 text-green-400' : 'bg-zinc-700 text-zinc-300'}`}>
                {plan.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-3xl font-bold mb-1">
              {plan.monthlyPrice === 0 ? 'Free' : `$${(plan.monthlyPrice / 100).toFixed(0)}`}
              {plan.monthlyPrice > 0 && <span className="text-sm font-normal text-zinc-500">/mo</span>}
            </p>
            {plan.trialDays > 0 && (
              <p className="text-sm text-zinc-400 mb-3">{plan.trialDays}-day free trial</p>
            )}
            <div className="mt-4 pt-4 border-t border-zinc-800">
              <p className="text-xs text-zinc-500 mb-2">Features</p>
              <div className="space-y-1 text-sm">
                {plan.features && typeof plan.features === 'object' && Object.entries(plan.features as Record<string, unknown>).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2 text-zinc-400">
                    {val === true ? <Check size={14} className="text-green-400" /> : val === false ? <X size={14} className="text-zinc-600" /> : null}
                    <span>{key}: {typeof val === 'boolean' ? '' : val === -1 ? 'Unlimited' : String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-zinc-500 mt-3">{plan._count?.subscriptions || 0} subscribers</p>
          </div>
        ))}
      </div>
    </div>
  )
}
