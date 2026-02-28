'use client'

import { useEffect, useState } from 'react'
import { Tag, Plus, Copy } from 'lucide-react'

export default function DiscountCodesPage() {
  const [codes, setCodes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ code: '', type: 'PERCENTAGE', value: '', maxRedemptions: '', description: '', validUntil: '' })

  const fetchCodes = async () => {
    const token = localStorage.getItem('platform-token')
    const res = await fetch('/api/platform/discount-codes', { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (data.ok) setCodes(data.data.codes)
    setLoading(false)
  }

  useEffect(() => { fetchCodes() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = localStorage.getItem('platform-token')
    await fetch('/api/platform/discount-codes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        value: parseInt(form.value),
        maxRedemptions: form.maxRedemptions ? parseInt(form.maxRedemptions) : null,
        validUntil: form.validUntil || null,
      }),
    })
    setShowCreate(false)
    setForm({ code: '', type: 'PERCENTAGE', value: '', maxRedemptions: '', description: '', validUntil: '' })
    fetchCodes()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm transition-colors">
          <Plus size={16} /> New Code
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Code</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="SUMMER25" className="ui-input" required />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="ui-select">
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED_AMOUNT">Fixed Amount ($)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Value</label>
              <input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder={form.type === 'PERCENTAGE' ? '20' : '1000'} className="ui-input" required />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Max Redemptions</label>
              <input type="number" value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} placeholder="Unlimited" className="ui-input" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Valid Until</label>
              <input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} className="ui-input" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Description</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Summer promo" className="ui-input" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-primary-500 text-white text-sm">Create Code</button>
          </div>
        </form>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 text-left">
              <th className="px-5 py-3 font-medium">Code</th>
              <th className="px-5 py-3 font-medium">Discount</th>
              <th className="px-5 py-3 font-medium">Redemptions</th>
              <th className="px-5 py-3 font-medium hidden sm:table-cell">Expires</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-zinc-500">Loading...</td></tr>
            ) : codes.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-zinc-500"><Tag size={24} className="mx-auto mb-2 text-zinc-600" />No discount codes yet</td></tr>
            ) : (
              codes.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3 font-mono font-medium">{c.code}</td>
                  <td className="px-5 py-3">{c.type === 'PERCENTAGE' ? `${c.value}%` : `$${(c.value / 100).toFixed(2)}`}</td>
                  <td className="px-5 py-3 text-zinc-400">{c.currentRedemptions}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''}</td>
                  <td className="px-5 py-3 hidden sm:table-cell text-zinc-400">{c.validUntil ? new Date(c.validUntil).toLocaleDateString() : 'Never'}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${c.isActive ? 'bg-green-500/10 text-green-400' : 'bg-zinc-700 text-zinc-300'}`}>
                      {c.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
