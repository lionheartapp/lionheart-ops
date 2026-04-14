'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Users, CreditCard, Calendar, Shield, AlertTriangle, RotateCcw, Trash2, Gift, CheckCircle } from 'lucide-react'
import { FloatingDropdown } from '@/components/ui/FloatingInput'

export default function SchoolDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [org, setOrg] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmAction, setConfirmAction] = useState<{ status: string; label: string } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteSlug, setDeleteSlug] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  // Modules
  const [orgModules, setOrgModules] = useState<Array<{ id: string; moduleId: string; campusId: string | null; planTier: string | null }>>([])
  const [orgCampuses, setOrgCampuses] = useState<Array<{ id: string; name: string; isActive: boolean }>>([])
  const [togglingModule, setTogglingModule] = useState<string | null>(null)
  // Grant add-on modal
  const [grantAddonModule, setGrantAddonModule] = useState<{ id: string; name: string } | null>(null)
  const [addonGrantForm, setAddonGrantForm] = useState({ type: 'free' as 'free' | 'discount', discountPercent: 50, months: 12, note: '' })
  const [addonGranting, setAddonGranting] = useState(false)
  const [addonGrantSuccess, setAddonGrantSuccess] = useState('')
  const [addonGrantError, setAddonGrantError] = useState('')
  // Grant access
  const [showGrantModal, setShowGrantModal] = useState(false)
  const [grantForm, setGrantForm] = useState({ type: 'free' as 'free' | 'discount', discountPercent: 50, months: 12, note: '' })
  const [granting, setGranting] = useState(false)
  const [grantSuccess, setGrantSuccess] = useState('')
  const [grantError, setGrantError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('platform-token')
    const headers = { Authorization: `Bearer ${token}` }

    Promise.all([
      fetch(`/api/platform/organizations/${params.id}`, { headers }).then(r => r.json()),
      fetch(`/api/platform/organizations/${params.id}/users`, { headers }).then(r => r.json()),
      fetch(`/api/platform/organizations/${params.id}/modules`, { headers }).then(r => r.json()),
    ]).then(([orgRes, usersRes, modulesRes]) => {
      if (orgRes.ok) setOrg(orgRes.data)
      if (usersRes.ok) setUsers(usersRes.data)
      if (modulesRes.ok) {
        setOrgModules(modulesRes.data.modules)
        setOrgCampuses(modulesRes.data.campuses)
      }
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

  const handleAddonGrant = async () => {
    if (!grantAddonModule) return
    setAddonGrantError('')
    setAddonGrantSuccess('')
    setAddonGranting(true)
    const token = localStorage.getItem('platform-token')
    try {
      const res = await fetch(`/api/platform/organizations/${params.id}/grant-addon`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId: grantAddonModule.id, ...addonGrantForm }),
      })
      const data = await res.json()
      if (!data.ok) {
        setAddonGrantError(data.error?.message || 'Failed to grant add-on')
      } else {
        setAddonGrantSuccess(data.data.label + ` (until ${new Date(data.data.endsAt).toLocaleDateString()}) — ${data.data.campusesEnabled} campus${data.data.campusesEnabled !== 1 ? 'es' : ''}`)
        // Refresh modules
        const modRes = await fetch(`/api/platform/organizations/${params.id}/modules`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.json())
        if (modRes.ok) setOrgModules(modRes.data.modules)
        setTimeout(() => { setGrantAddonModule(null); setAddonGrantSuccess('') }, 2500)
      }
    } catch {
      setAddonGrantError('Network error')
    }
    setAddonGranting(false)
  }

  const handleModuleToggle = async (moduleId: string, enabled: boolean, campusId?: string) => {
    const key = campusId ? `${moduleId}:${campusId}` : moduleId
    setTogglingModule(key)
    const token = localStorage.getItem('platform-token')
    try {
      const res = await fetch(`/api/platform/organizations/${params.id}/modules`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, enabled, campusId }),
      })
      const data = await res.json()
      if (data.ok) {
        // Refresh modules
        const modRes = await fetch(`/api/platform/organizations/${params.id}/modules`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.json())
        if (modRes.ok) setOrgModules(modRes.data.modules)
      }
    } catch (err) {
      console.error('Failed to toggle module:', err)
    }
    setTogglingModule(null)
  }

  const handleGrant = async () => {
    setGrantError('')
    setGrantSuccess('')
    setGranting(true)
    const token = localStorage.getItem('platform-token')
    try {
      const res = await fetch(`/api/platform/organizations/${params.id}/grant-access`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(grantForm),
      })
      const data = await res.json()
      if (!data.ok) {
        setGrantError(data.error?.message || 'Failed to grant access')
      } else {
        setGrantSuccess(data.data.label + ` (until ${new Date(data.data.endsAt).toLocaleDateString()})`)
        setOrg({ ...org, onboardingStatus: 'ACTIVE' })
        setTimeout(() => { setShowGrantModal(false); setGrantSuccess('') }, 2500)
      }
    } catch {
      setGrantError('Network error')
    }
    setGranting(false)
  }

  const handleDelete = async () => {
    setDeleteError('')
    setDeleting(true)
    const token = localStorage.getItem('platform-token')
    try {
      const res = await fetch(`/api/platform/organizations/${params.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmSlug: deleteSlug }),
      })
      const data = await res.json()
      if (!data.ok) {
        setDeleteError(data.error?.message || 'Failed to delete')
        setDeleting(false)
        return
      }
      router.push('/admin/schools')
    } catch {
      setDeleteError('Network error')
      setDeleting(false)
    }
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
        <FloatingDropdown
          label="Status"
          value={org.onboardingStatus}
          onChange={(value) => handleStatusChange(value)}
          options={[
            { value: 'SIGNED_UP', label: 'Signed Up' },
            { value: 'ONBOARDING', label: 'Onboarding' },
            { value: 'ACTIVE', label: 'Active' },
            { value: 'SUSPENDED', label: 'Suspended' },
            { value: 'CHURNED', label: 'Churned' },
          ]}
        />
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
        <button
          onClick={() => { setShowGrantModal(true); setGrantError(''); setGrantSuccess('') }}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 text-sm font-medium rounded-lg transition-colors"
        >
          <Gift size={16} /> Grant Access
        </button>
        <button
          onClick={() => { setShowDeleteModal(true); setDeleteSlug(''); setDeleteError('') }}
          className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm font-medium rounded-lg transition-colors"
        >
          <Trash2 size={16} /> Delete Permanently
        </button>
      </div>

      {/* Grant access modal */}
      {showGrantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            {grantSuccess ? (
              <div className="flex flex-col items-center py-4 gap-3">
                <CheckCircle size={40} className="text-green-400" />
                <p className="text-green-400 font-medium text-center">{grantSuccess}</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <Gift size={20} className="text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Grant Access</h3>
                    <p className="text-sm text-slate-400">Give {org.name} free or discounted access</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Access Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setGrantForm({ ...grantForm, type: 'free' })}
                        className={`px-4 py-3 rounded-lg text-sm font-medium border transition-colors ${
                          grantForm.type === 'free'
                            ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                            : 'border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        100% Free
                      </button>
                      <button
                        onClick={() => setGrantForm({ ...grantForm, type: 'discount' })}
                        className={`px-4 py-3 rounded-lg text-sm font-medium border transition-colors ${
                          grantForm.type === 'discount'
                            ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                            : 'border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        Discount %
                      </button>
                    </div>
                  </div>

                  {grantForm.type === 'discount' && (
                    <div>
                      <label className="block text-sm text-slate-400 mb-1.5">Discount Percentage</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={grantForm.discountPercent}
                          onChange={(e) => setGrantForm({ ...grantForm, discountPercent: parseInt(e.target.value) || 0 })}
                          min={1}
                          max={99}
                          className="flex-1 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-purple-500 transition-colors"
                        />
                        <span className="text-slate-400 text-sm">% off</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">Duration</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[3, 6, 12, 24].map((m) => (
                        <button
                          key={m}
                          onClick={() => setGrantForm({ ...grantForm, months: m })}
                          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                            grantForm.months === m
                              ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                              : 'border-slate-700 text-slate-400 hover:border-slate-600'
                          }`}
                        >
                          {m >= 12 ? `${m / 12}yr` : `${m}mo`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">Note (optional)</label>
                    <input
                      type="text"
                      value={grantForm.note}
                      onChange={(e) => setGrantForm({ ...grantForm, note: e.target.value })}
                      placeholder="e.g., Beta partner, conference sponsor"
                      className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>

                  {grantError && <p className="text-red-400 text-sm">{grantError}</p>}
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowGrantModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGrant}
                    disabled={granting}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {granting ? 'Granting...' : grantForm.type === 'free'
                      ? `Grant ${grantForm.months >= 12 ? `${grantForm.months / 12} Year` : `${grantForm.months} Month`} Free`
                      : `Grant ${grantForm.discountPercent}% Off for ${grantForm.months >= 12 ? `${grantForm.months / 12}yr` : `${grantForm.months}mo`}`
                    }
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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

      {/* Grant add-on modal */}
      {grantAddonModule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            {addonGrantSuccess ? (
              <div className="flex flex-col items-center py-4 gap-3">
                <CheckCircle size={40} className="text-green-400" />
                <p className="text-green-400 font-medium text-center">{addonGrantSuccess}</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <Gift size={20} className="text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Grant {grantAddonModule.name}</h3>
                    <p className="text-sm text-slate-400">Give {org.name} free or discounted {grantAddonModule.name}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Access Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setAddonGrantForm({ ...addonGrantForm, type: 'free' })}
                        className={`px-4 py-3 rounded-lg text-sm font-medium border transition-colors ${
                          addonGrantForm.type === 'free'
                            ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                            : 'border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        100% Free
                      </button>
                      <button
                        onClick={() => setAddonGrantForm({ ...addonGrantForm, type: 'discount' })}
                        className={`px-4 py-3 rounded-lg text-sm font-medium border transition-colors ${
                          addonGrantForm.type === 'discount'
                            ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                            : 'border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        Discount %
                      </button>
                    </div>
                  </div>

                  {addonGrantForm.type === 'discount' && (
                    <div>
                      <label className="block text-sm text-slate-400 mb-1.5">Discount Percentage</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={addonGrantForm.discountPercent}
                          onChange={(e) => setAddonGrantForm({ ...addonGrantForm, discountPercent: parseInt(e.target.value) || 0 })}
                          min={1} max={99}
                          className="flex-1 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-purple-500 transition-colors"
                        />
                        <span className="text-slate-400 text-sm">% off</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">Duration</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[3, 6, 12, 24].map((m) => (
                        <button
                          key={m}
                          onClick={() => setAddonGrantForm({ ...addonGrantForm, months: m })}
                          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                            addonGrantForm.months === m
                              ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                              : 'border-slate-700 text-slate-400 hover:border-slate-600'
                          }`}
                        >
                          {m >= 12 ? `${m / 12}yr` : `${m}mo`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">Note (optional)</label>
                    <input
                      type="text"
                      value={addonGrantForm.note}
                      onChange={(e) => setAddonGrantForm({ ...addonGrantForm, note: e.target.value })}
                      placeholder="e.g., Beta partner, conference demo"
                      className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>

                  {addonGrantError && <p className="text-red-400 text-sm">{addonGrantError}</p>}
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setGrantAddonModule(null)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleAddonGrant}
                    disabled={addonGranting}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {addonGranting ? 'Granting...' : addonGrantForm.type === 'free'
                      ? `Grant ${grantAddonModule.name} Free for ${addonGrantForm.months >= 12 ? `${addonGrantForm.months / 12}yr` : `${addonGrantForm.months}mo`}`
                      : `Grant ${addonGrantForm.discountPercent}% Off for ${addonGrantForm.months >= 12 ? `${addonGrantForm.months / 12}yr` : `${addonGrantForm.months}mo`}`
                    }
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 size={20} className="text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Delete {org.name}?</h3>
                <p className="text-sm text-red-400/80">This permanently deletes all data — users, events, tickets, everything. This cannot be undone.</p>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm text-slate-400 mb-2">
                Type <span className="font-mono text-slate-200 bg-slate-800 px-1.5 py-0.5 rounded">{org.slug}</span> to confirm
              </label>
              <input
                type="text"
                value={deleteSlug}
                onChange={(e) => setDeleteSlug(e.target.value)}
                placeholder={org.slug}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-colors"
                autoFocus
              />
              {deleteError && <p className="text-red-400 text-sm mt-2">{deleteError}</p>}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteSlug !== org.slug || deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete Forever'}
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

      {/* Add-On Modules */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><Shield size={16} /> Add-On Modules</h3>
        {(() => {
          const AVAILABLE_MODULES = [
            { id: 'athletics', name: 'Athletics', description: 'Sports teams, schedules, seasons, rosters', scope: 'campus' as const },
            { id: 'maintenance', name: 'Maintenance', description: 'Facility work orders, PM schedules, assets', scope: 'campus' as const },
            { id: 'it-helpdesk', name: 'IT Help Desk', description: 'Device management, tickets, provisioning', scope: 'campus' as const },
            { id: 'av-production', name: 'A/V Production', description: 'Audio/visual equipment and event production', scope: 'campus' as const },
            { id: 'planning-season', name: 'Event Planning', description: 'Advanced event planning with budgets and logistics', scope: 'org' as const },
          ]

          return (
            <div className="space-y-3">
              {AVAILABLE_MODULES.map((mod) => {
                const isOrgEnabled = orgModules.some(m => m.moduleId === mod.id && !m.campusId)
                const enabledCampusIds = orgModules.filter(m => m.moduleId === mod.id && m.campusId).map(m => m.campusId)

                return (
                  <div key={mod.id} className="border border-slate-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{mod.name}</span>
                        <span className="text-xs text-slate-500">{mod.description}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setGrantAddonModule({ id: mod.id, name: mod.name })
                            setAddonGrantForm({ type: 'free', discountPercent: 50, months: 12, note: '' })
                            setAddonGrantError('')
                            setAddonGrantSuccess('')
                          }}
                          className="px-2.5 py-1 text-xs font-medium text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 rounded-full transition-colors"
                        >
                          Grant
                        </button>
                        {mod.scope === 'org' && (
                          <button
                            onClick={() => handleModuleToggle(mod.id, !isOrgEnabled)}
                            disabled={togglingModule === mod.id}
                            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                              isOrgEnabled
                                ? 'bg-green-500/10 text-green-400 hover:bg-red-500/10 hover:text-red-400'
                                : 'bg-slate-700 text-slate-300 hover:bg-green-500/10 hover:text-green-400'
                            } ${togglingModule === mod.id ? 'opacity-50' : ''}`}
                          >
                            {togglingModule === mod.id ? '...' : isOrgEnabled ? 'Enabled' : 'Disabled'}
                          </button>
                        )}
                      </div>
                    </div>

                    {mod.scope === 'campus' && orgCampuses.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {orgCampuses.map((campus) => {
                          const campusEnabled = enabledCampusIds.includes(campus.id)
                          const key = `${mod.id}:${campus.id}`
                          return (
                            <button
                              key={campus.id}
                              onClick={() => handleModuleToggle(mod.id, !campusEnabled, campus.id)}
                              disabled={togglingModule === key}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                                campusEnabled
                                  ? 'border-green-500/30 bg-green-500/10 text-green-400 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400'
                                  : 'border-slate-700 text-slate-400 hover:border-green-500/30 hover:bg-green-500/10 hover:text-green-400'
                              } ${togglingModule === key ? 'opacity-50' : ''}`}
                            >
                              {campus.name} {campusEnabled ? '✓' : ''}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {mod.scope === 'campus' && orgCampuses.length === 0 && (
                      <p className="text-xs text-slate-500 mt-1">No campuses configured for this school</p>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })()}
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
