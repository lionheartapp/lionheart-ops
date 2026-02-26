'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ChevronLeft, ChevronRight, Building2 } from 'lucide-react'

export default function SchoolsPage() {
  const router = useRouter()
  const [orgs, setOrgs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const perPage = 25

  const fetchOrgs = useCallback(async () => {
    setLoading(true)
    const token = localStorage.getItem('platform-token')
    const params = new URLSearchParams({ page: String(page), perPage: String(perPage) })
    if (search) params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)

    const res = await fetch(`/api/platform/organizations?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data.ok) {
      setOrgs(data.data.organizations)
      setTotal(data.data.total)
    }
    setLoading(false)
  }, [page, search, statusFilter])

  useEffect(() => { fetchOrgs() }, [fetchOrgs])

  const totalPages = Math.ceil(total / perPage)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search schools..."
            className="ui-input pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="ui-select w-auto"
        >
          <option value="">All statuses</option>
          <option value="SIGNED_UP">Signed Up</option>
          <option value="ONBOARDING">Onboarding</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="CHURNED">Churned</option>
        </select>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 text-left">
              <th className="px-5 py-3 font-medium">School</th>
              <th className="px-5 py-3 font-medium hidden md:table-cell">Type</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium hidden sm:table-cell">Plan</th>
              <th className="px-5 py-3 font-medium hidden lg:table-cell">Users</th>
              <th className="px-5 py-3 font-medium hidden lg:table-cell">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-zinc-500">Loading...</td></tr>
            ) : orgs.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-zinc-500">No schools found</td></tr>
            ) : (
              orgs.map((org) => (
                <tr
                  key={org.id}
                  onClick={() => router.push(`/schools/${org.id}`)}
                  className="hover:bg-zinc-800/50 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                        <Building2 size={16} className="text-zinc-400" />
                      </div>
                      <div>
                        <p className="font-medium">{org.name}</p>
                        <p className="text-xs text-zinc-500">{org.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell text-zinc-400">{org.institutionType}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      org.onboardingStatus === 'ACTIVE' ? 'bg-green-500/10 text-green-400' :
                      org.onboardingStatus === 'SIGNED_UP' ? 'bg-blue-500/10 text-blue-400' :
                      org.onboardingStatus === 'ONBOARDING' ? 'bg-yellow-500/10 text-yellow-400' :
                      org.onboardingStatus === 'SUSPENDED' ? 'bg-red-500/10 text-red-400' :
                      'bg-zinc-700 text-zinc-300'
                    }`}>
                      {org.onboardingStatus}
                    </span>
                  </td>
                  <td className="px-5 py-3 hidden sm:table-cell text-zinc-400">
                    {org.subscriptions?.[0]?.plan?.name || 'No plan'}
                  </td>
                  <td className="px-5 py-3 hidden lg:table-cell text-zinc-400">{org._count?.users || 0}</td>
                  <td className="px-5 py-3 hidden lg:table-cell text-zinc-400">
                    {new Date(org.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-400">
          <span>Showing {((page - 1) * perPage) + 1}–{Math.min(page * perPage, total)} of {total}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg hover:bg-zinc-800 disabled:opacity-30">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg hover:bg-zinc-800 disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
