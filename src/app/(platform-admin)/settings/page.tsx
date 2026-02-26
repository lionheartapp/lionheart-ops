'use client'

import { useEffect, useState } from 'react'
import { Shield } from 'lucide-react'

export default function SettingsPage() {
  const [admin, setAdmin] = useState<any>(null)

  useEffect(() => {
    const stored = localStorage.getItem('platform-admin')
    if (stored) setAdmin(JSON.parse(stored))
  }, [])

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Shield size={18} /> Admin Profile</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-zinc-800">
            <span className="text-zinc-400">Name</span>
            <span>{admin?.name || '—'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-zinc-800">
            <span className="text-zinc-400">Email</span>
            <span>{admin?.email}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-zinc-800">
            <span className="text-zinc-400">Role</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-primary-500/10 text-primary-400">{admin?.role}</span>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="font-semibold mb-4">Environment</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-zinc-800">
            <span className="text-zinc-400">Stripe</span>
            <span className="text-zinc-500">Not configured</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-zinc-400">Version</span>
            <span className="text-zinc-500">1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  )
}
