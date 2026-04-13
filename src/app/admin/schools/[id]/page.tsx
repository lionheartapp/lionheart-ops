'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Users, CreditCard, Calendar, Shield, AlertTriangle, RotateCcw } from 'lucide-react'

export default function SchoolDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [org, setOrg] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmAction, setConfirmAction] = useState<{ status: string; label: string } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

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
    // Destructive actions need confirmation
    if (status === 'SUSPENDED' || status === 'CHURNED') {
      setConfirmAction({ status, label: status === 'SUSPENDED' ? 'Suspend' : 'Mark as Churned' })
      return
    }
    await executeStatusChange(status)
  }

  const executeStatusChange = async (status: string) => {
    setActionLoading(true)
    const token = localStorage.getItem('platform-token')
    const res = await fetch(`/api/platform/organizations/${params.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboardingStatus: status }),
    })
    const data = await res.json()
    if (data.ok) setOrg({ ...org, ...data.data })
    setConfirmAction(null)
    setActionLoading(false)
  }

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" /></div>
  if (!org) return <div className="text-slate-500 text-center py-12">Organization not found</div>

  return (
    <div className="space-y-6">
      <button onClick={() => router.push('/admin/schools')} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-100 transition-colors">
        <ArrowLeft size={16} /> Back to schools
      </button>

      <div className="flex flex-wrap gap-4 items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">{org.name}</h2>
          <p className="text-slate-400">{org.slug} &middot; {org.institutionType}</p>
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

      {/* Quick action buttons */}
      <div className="flex flex-wrap gap-2">
        {org.onboardingStatus === 'ACTIVE' && (
          <button
            onClick={() => handleStatusChange('SUSPENDED')}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm font-medium rounded-lg transition-colors"
          >
            <AlertTriangle size={16} /> Suspend Organization
          </button>
        )}
        {org.onboardingStatus === 'SUSPENDED' && (
          <button
            onClick={() => executeStatusChange('ACTIVE')}
            disabled={actionLoading}
            className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-400 hover:bg-green-500/20 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <RotateCcw size={16} /> Reactivate
          </button>
        )}
      </div>

      {/* Confirmation modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{confirmAction.label} {org.name}?</h3>
                <p className="text-sm text-slate-400">
                  {confirmAction.status === 'SUSPENDED'
                    ? 'All users will lose access immediately. You can reactivate later.'
                    : 'This marks the organization as churned.'}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => executeStatusChange(confirmAction.status)}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : `Yes, ${confirmAction.label}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-2"><Users size={16} /> Users</div>
          <p className="text-xl font-bold">{org._count?.users || 0}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-2"><CreditCard size={16} /> Plan</div>
          <p className="text-xl font-bold">{org.subscriptions?.[0]?.plan?.name || 'None'}</p>
          <p className="text-xs text-slate-500 mt-1">{org.subscriptions?.[0]?.status || 'No subscription'}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-2"><Calendar size={16} /> Joined</div>
          <p className="text-xl font-bold">{new Date(org.createdAt).toLocaleDateString()}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-2"><Shield size={16} /> Schools</div>
          <p className="text-xl font-bold">{org._count?.schools || 0}</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="font-semibold mb-3">Contact</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div><span className="text-slate-500">Principal:</span> <span>{org.principalName || '—'}</span></div>
          <div><span className="text-slate-500">Email:</span> <span>{org.principalEmail || '—'}</span></div>
          <div><span className="text-slate-500">Phone:</span> <span>{org.phone || '—'}</span></div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h3 className="font-semibold">Users ({users.length})</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-left">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium hidden sm:table-cell">Role</th>
              <th className="px-5 py-3 font-medium hidden sm:table-cell">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-5 py-3">{u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.name || '—'}</td>
                <td className="px-5 py-3 text-slate-400">{u.email}</td>
                <td className="px-5 py-3 hidden sm:table-cell text-slate-400">{u.userRole?.name || '—'}</td>
                <td className="px-5 py-3 hidden sm:table-cell">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${u.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400' : 'bg-slate-700 text-slate-300'}`}>
                    {u.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {org.payments?.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h3 className="font-semibold">Recent Payments</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-left">
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {org.payments.map((p: any) => (
                <tr key={p.id}>
                  <td className="px-5 py-3 font-medium">${(p.amount / 100).toFixed(2)}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${p.status === 'SUCCEEDED' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-400">{new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
