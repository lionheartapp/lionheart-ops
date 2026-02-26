'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Users, CreditCard, Calendar, Shield } from 'lucide-react'

export default function SchoolDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [org, setOrg] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('platform-token')
    const headers = { Authorization: `Bearer ${token}` }

    Promise.all([
      fetch(`/api/platform/organizations/${params.id}`, { headers }).then(r => r.json()),
      fetch(`/api/platform/organizations/${params.id}/users`, { headers }).then(r => r.json()),
    ]).then(([orgRes, usersRes]) => {
      if (orgRes.ok) setOrg(orgRes.data)
      if (usersRes.ok) setUsers(usersRes.data)
      setLoading(false)
    })
  }, [params.id])

  const handleStatusChange = async (status: string) => {
    const token = localStorage.getItem('platform-token')
    const res = await fetch(`/api/platform/organizations/${params.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboardingStatus: status }),
    })
    const data = await res.json()
    if (data.ok) setOrg({ ...org, ...data.data })
  }

  if (loading) return <div className="text-zinc-500 text-center py-12">Loading...</div>
  if (!org) return <div className="text-zinc-500 text-center py-12">Organization not found</div>

  return (
    <div className="space-y-6">
      <button onClick={() => router.push('/schools')} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
        <ArrowLeft size={16} /> Back to schools
      </button>

      <div className="flex flex-wrap gap-4 items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">{org.name}</h2>
          <p className="text-zinc-400">{org.slug} &middot; {org.institutionType}</p>
        </div>
        <select
          value={org.onboardingStatus}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="ui-select w-auto"
        >
          <option value="SIGNED_UP">Signed Up</option>
          <option value="ONBOARDING">Onboarding</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="CHURNED">Churned</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-zinc-400 mb-2"><Users size={16} /> Users</div>
          <p className="text-xl font-bold">{org._count?.users || 0}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-zinc-400 mb-2"><CreditCard size={16} /> Plan</div>
          <p className="text-xl font-bold">{org.subscriptions?.[0]?.plan?.name || 'None'}</p>
          <p className="text-xs text-zinc-500 mt-1">{org.subscriptions?.[0]?.status || 'No subscription'}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-zinc-400 mb-2"><Calendar size={16} /> Joined</div>
          <p className="text-xl font-bold">{new Date(org.createdAt).toLocaleDateString()}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-zinc-400 mb-2"><Shield size={16} /> Schools</div>
          <p className="text-xl font-bold">{org._count?.schools || 0}</p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="font-semibold mb-3">Contact</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div><span className="text-zinc-500">Principal:</span> <span>{org.principalName || '—'}</span></div>
          <div><span className="text-zinc-500">Email:</span> <span>{org.principalEmail || '—'}</span></div>
          <div><span className="text-zinc-500">Phone:</span> <span>{org.phone || '—'}</span></div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800">
          <h3 className="font-semibold">Users ({users.length})</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 text-left">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium hidden sm:table-cell">Role</th>
              <th className="px-5 py-3 font-medium hidden sm:table-cell">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-5 py-3">{u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.name || '—'}</td>
                <td className="px-5 py-3 text-zinc-400">{u.email}</td>
                <td className="px-5 py-3 hidden sm:table-cell text-zinc-400">{u.userRole?.name || '—'}</td>
                <td className="px-5 py-3 hidden sm:table-cell">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${u.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400' : 'bg-zinc-700 text-zinc-300'}`}>
                    {u.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {org.payments?.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800">
            <h3 className="font-semibold">Recent Payments</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-left">
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {org.payments.map((p: any) => (
                <tr key={p.id}>
                  <td className="px-5 py-3 font-medium">${(p.amount / 100).toFixed(2)}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${p.status === 'SUCCEEDED' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-zinc-400">{new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
