'use client'

import { useEffect, useState } from 'react'
import { School, CreditCard, LifeBuoy, TrendingUp, Users, Clock } from 'lucide-react'

type Stats = {
  totalOrgs: number
  activeOrgs: number
  trialOrgs: number
  openTickets: number
  mrr: number
  totalUsers: number
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-slate-400">{label}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentOrgs, setRecentOrgs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('platform-token')
    if (!token) return

    const headers = { Authorization: `Bearer ${token}` }

    fetch('/api/platform/stats', { headers })
      .then(r => r.json())
      .then(res => {
        if (res.ok) {
          const d = res.data
          setStats({
            totalOrgs: d.totalOrgs,
            activeOrgs: d.activeOrgs,
            trialOrgs: d.trialOrgs,
            openTickets: d.openTickets,
            mrr: d.mrr,
            totalUsers: d.totalUsers,
          })
          setRecentOrgs(d.recentOrgs)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-slate-500">Loading dashboard...</div></div>
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Total Schools" value={stats?.totalOrgs || 0} icon={School} color="bg-primary-500/10 text-primary-400" />
        <StatCard label="Active" value={stats?.activeOrgs || 0} icon={TrendingUp} color="bg-green-500/10 text-green-400" />
        <StatCard label="On Trial" value={stats?.trialOrgs || 0} icon={Clock} color="bg-yellow-500/10 text-yellow-400" />
        <StatCard label="Open Tickets" value={stats?.openTickets || 0} icon={LifeBuoy} color="bg-orange-500/10 text-orange-400" />
        <StatCard label="MRR" value={`$${((stats?.mrr || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={CreditCard} color="bg-purple-500/10 text-purple-400" />
        <StatCard label="Total Users" value={stats?.totalUsers || 0} icon={Users} color="bg-cyan-500/10 text-cyan-400" />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="font-semibold">Recent Schools</h2>
        </div>
        <div className="divide-y divide-slate-800">
          {recentOrgs.length === 0 ? (
            <p className="px-5 py-8 text-center text-slate-500">No schools yet</p>
          ) : (
            recentOrgs.map((org: any) => (
              <div key={org.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium">{org.name}</p>
                  <p className="text-sm text-slate-500">{org.slug} &middot; {org._count?.users || 0} users</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  org.onboardingStatus === 'ACTIVE' ? 'bg-green-500/10 text-green-400' :
                  org.onboardingStatus === 'SIGNED_UP' ? 'bg-primary-500/10 text-primary-400' :
                  org.onboardingStatus === 'SUSPENDED' ? 'bg-red-500/10 text-red-400' :
                  'bg-slate-700 text-slate-300'
                }`}>
                  {org.onboardingStatus}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
