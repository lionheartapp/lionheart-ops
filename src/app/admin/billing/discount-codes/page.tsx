'use client'

import { useEffect, useState } from 'react'
import { Tag, Plus, Copy } from 'lucide-react'
import { FloatingDropdown } from '@/components/ui/FloatingInput'
import { Input } from '@/components/ui/Input'

export default function DiscountCodesPage() {
  const [codes, setCodes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ code: '', type: 'PERCENTAGE', value: '', maxRedemptions: '', description: '', validUntil: '' })
  const [creating, setCreating] = useState(false)

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
    setCreating(true)
    try {
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
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">
          <Plus size={16} /> New Code
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Code</label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="SUMMER25" className="ui-input-bordered" required />
            </div>
            <div>
              <FloatingDropdown
                label="Type"
                value={form.type}
                onChange={(value) => setForm({ ...form, type: value })}
                options={[
                  { value: 'PERCENTAGE', label: 'Percentage (%)' },
                  { value: 'FIXED_AMOUNT', label: 'Fixed Amount ($)' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Value</label>
              <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder={form.type === 'PERCENTAGE' ? '20' : '1000'} className="ui-input-bordered" required />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Max Redemptions</label>
              <Input type="number" value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} placeholder="Unlimited" className="ui-input-bordered" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Valid Until</label>
              <Input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} className="ui-input-bordered" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Description</label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Summer promo" className="ui-input-bordered" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">Cancel</button>
            <button type="submit" disabled={creating} className="px-4 py-2 rounded-lg bg-primary-500 text-white text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed">{creating ? 'Creating...' : 'Create Code'}</button>
          </div>
        </form>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-left">
              <th className="px-5 py-3 font-medium">Code</th>
              <th className="px-5 py-3 font-medium">Discount</th>
              <th className="px-5 py-3 font-medium">Redemptions</th>
              <th className="px-5 py-3 font-medium hidden sm:table-cell">Expires</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500"><div className="w-6 h-6 mx-auto rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" /></td></tr>
            ) : codes.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500"><Tag size={24} className="mx-auto mb-2 text-slate-600" />No discount codes yet</td></tr>
            ) : (
              codes.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3 font-mono font-medium">{c.code}</td>
                  <td className="px-5 py-3">{c.type === 'PERCENTAGE' ? `${c.value}%` : `$${(c.value / 100).toFixed(2)}`}</td>
                  <td className="px-5 py-3 text-slate-400">{c.currentRedemptions}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''}</td>
                  <td className="px-5 py-3 hidden sm:table-cell text-slate-400">{c.validUntil ? new Date(c.validUntil).toLocaleDateString() : 'Never'}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${c.isActive ? 'bg-green-500/10 text-green-400' : 'bg-slate-700 text-slate-300'}`}>
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
