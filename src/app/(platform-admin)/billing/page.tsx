'use client'

import { useEffect, useState } from 'react'
import { CreditCard, TrendingUp, DollarSign } from 'lucide-react'

export default function BillingPage() {
  const [payments, setPayments] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('platform-token')
    fetch('/api/platform/payments?perPage=50', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setPayments(data.data.payments)
          setTotal(data.data.total)
        }
        setLoading(false)
      })
  }, [])

  const totalRevenue = payments.filter(p => p.status === 'SUCCEEDED').reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 text-zinc-400 mb-2"><DollarSign size={16} /> Total Revenue</div>
          <p className="text-2xl font-bold">${(totalRevenue / 100).toFixed(2)}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 text-zinc-400 mb-2"><CreditCard size={16} /> Transactions</div>
          <p className="text-2xl font-bold">{total}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 text-zinc-400 mb-2"><TrendingUp size={16} /> Successful</div>
          <p className="text-2xl font-bold">{payments.filter(p => p.status === 'SUCCEEDED').length}</p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800"><h2 className="font-semibold">Recent Payments</h2></div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 text-left">
              <th className="px-5 py-3 font-medium">School</th>
              <th className="px-5 py-3 font-medium">Amount</th>
              <th className="px-5 py-3 font-medium">Plan</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium hidden sm:table-cell">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-zinc-500">Loading...</td></tr>
            ) : payments.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-zinc-500">No payments yet</td></tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-3">{p.organization?.name || '—'}</td>
                  <td className="px-5 py-3 font-medium">${(p.amount / 100).toFixed(2)}</td>
                  <td className="px-5 py-3 text-zinc-400">{p.subscription?.plan?.name || '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${p.status === 'SUCCEEDED' ? 'bg-green-500/10 text-green-400' : p.status === 'FAILED' ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 hidden sm:table-cell text-zinc-400">{new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
