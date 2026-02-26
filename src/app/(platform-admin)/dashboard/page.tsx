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
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-zinc-400">{label}</span>
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

    Promise.all([
      fetch('/api/platform/organizations?perPage=5', { headers }).then(r => r.json()),
      fetch('/api/platform/support-tickets?status=OPEN&perPage=1', { headers }).then(r => r.json()),
      fetch('/api/platform/subscriptions?perPage=1', { headers }).then(r => r.json()),
    ]).then(([orgsRes, ticketsRes, subsRes]) => {
      const orgs = orgsRes.ok ? orgsRes.data : { organizations: [], total: 0 }
      const tickets = ticketsRes.ok ? ticketsRes.data : { total: 0 }
      const subs = subsRes.ok ? subsRes.data : { subscriptions: [], total: 0 }

      const activeCount = orgs.organizations.filter((o: any) => o.onboardingStatus === 'ACTIVE').length
      const trialCount = orgs.organizations.filter((o: any) =>
        o.subscriptions?.[0]?.status === 'TRIALING'
      ).length

      setStats({
        totalOrgs: orgs.total,
        activeOrgs: activeCount,
        trialOrgs: trialCount,
        openTickets: tickets.total,
        mrr: 0,
        totalUsers: orgs.organizations.reduce((sum: number, o: any) => sum + (o._count?.users || 0), 0),
      })
      setRecentOrgs(orgs.organizations)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-zinc-500">Loading dashboard...</div></div>
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Total Schools" value={stats?.totalOrgs || 0} icon={School} color="bg-blue-500/10 text-blue-400" />
        <StatCard label="Active" value={stats?.activeOrgs || 0} icon={TrendingUp} color="bg-green-500/10 text-green-400" />
        <StatCard label="On Trial" value={stats?.trialOrgs || 0} icon={Clock} color="bg-yellow-500/10 text-yellow-400" />
        <StatCard label="Open Tickets" value={stats?.openTickets || 0} icon={LifeBuoy} color="bg-orange-500/10 text-orange-400" />
        <StatCard label="MRR" value="$0" icon={CreditCard} color="bg-purple-500/10 text-purple-400" />
        <StatCard label="Total Users" value={stats?.totalUsers || 0} icon={Users} color="bg-cyan-500/10 text-cyan-400" />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
        <div className="px-5 py-4 border-b border-zinc-800">
          <h2 className="font-semibold">Recent Schools</h2>
        </div>
        <div className="divide-y divide-zinc-800">
          {recentOrgs.length === 0 ? (
            <p className="px-5 py-8 text-center text-zinc-500">No schools yet</p>
          ) : (
            recentOrgs.map((org: any) => (
              <div key={org.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium">{org.name}</p>
                  <p className="text-sm text-zinc-500">{org.slug} &middot; {org._count?.users || 0} users</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  org.onboardingStatus === 'ACTIVE' ? 'bg-green-500/10 text-green-400' :
                  org.onboardingStatus === 'SIGNED_UP' ? 'bg-blue-500/10 text-blue-400' :
                  org.onboardingStatus === 'SUSPENDED' ? 'bg-red-500/10 text-red-400' :
                  'bg-zinc-700 text-zinc-300'
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
