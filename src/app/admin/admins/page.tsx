'use client'

import { useEffect, useState, useCallback } from 'react'
import { UserPlus, Shield, Trash2, Pencil, X } from 'lucide-react'

type Admin = {
  id: string
  email: string
  name: string | null
  role: 'SUPER_ADMIN' | 'OPERATOR'
  lastLoginAt: string | null
  createdAt: string
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
      role === 'SUPER_ADMIN' ? 'bg-primary-500/10 text-primary-400' : 'bg-slate-700 text-slate-300'
    }`}>
      {role === 'SUPER_ADMIN' ? 'Super Admin' : 'Operator'}
    </span>
  )
}

export default function AdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<{ email: string; password: string; name: string; role: 'SUPER_ADMIN' | 'OPERATOR' }>({ email: '', password: '', name: '', role: 'OPERATOR' })
  const [editForm, setEditForm] = useState<{ name: string; role: 'SUPER_ADMIN' | 'OPERATOR'; password: string }>({ name: '', role: 'OPERATOR', password: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const headers = useCallback(() => ({
    Authorization: `Bearer ${localStorage.getItem('platform-token')}`,
    'Content-Type': 'application/json',
  }), [])

  const fetchAdmins = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/platform/admins', { headers: { Authorization: `Bearer ${localStorage.getItem('platform-token')}` } })
      const data = await res.json()
      if (data.ok) setAdmins(data.data)
    } catch (err) {
      console.error('Failed to fetch admins:', err)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAdmins() }, [fetchAdmins])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/platform/admins', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error?.message || 'Failed to create admin')
      } else {
        setShowCreate(false)
        setForm({ email: '', password: '', name: '', role: 'OPERATOR' })
        fetchAdmins()
      }
    } catch (err) {
      setError('Network error')
    }
    setSaving(false)
  }

  const handleUpdate = async (id: string) => {
    setError('')
    setSaving(true)
    const body: Record<string, string> = {}
    if (editForm.name) body.name = editForm.name
    if (editForm.role) body.role = editForm.role
    if (editForm.password) body.password = editForm.password

    try {
      const res = await fetch(`/api/platform/admins/${id}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error?.message || 'Failed to update admin')
      } else {
        setEditId(null)
        fetchAdmins()
      }
    } catch (err) {
      setError('Network error')
    }
    setSaving(false)
  }

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Delete admin ${email}? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/platform/admins/${id}`, {
        method: 'DELETE',
        headers: headers(),
      })
      const data = await res.json()
      if (!data.ok) {
        alert(data.error?.message || 'Failed to delete admin')
      } else {
        fetchAdmins()
      }
    } catch (err) {
      alert('Network error')
    }
  }

  const currentAdminId = (() => {
    try {
      const stored = localStorage.getItem('platform-admin')
      return stored ? JSON.parse(stored).id : null
    } catch { return null }
  })()

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 rounded-full border-2 border-slate-700 border-t-primary-500 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-sm">{admins.length} admin{admins.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <UserPlus size={16} /> Add Admin
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2"><UserPlus size={18} /> New Admin</h3>
            <button onClick={() => { setShowCreate(false); setError('') }} className="p-1 hover:bg-slate-800 rounded-lg transition-colors">
              <X size={18} className="text-slate-400" />
            </button>
          </div>
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Name"
              className="ui-input-bordered"
            />
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email"
              className="ui-input-bordered"
              required
            />
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Password (min 8 chars)"
              className="ui-input-bordered"
              required
              minLength={8}
            />
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as 'SUPER_ADMIN' | 'OPERATOR' })}
              className="ui-select"
            >
              <option value="OPERATOR">Operator</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {saving ? 'Creating...' : 'Create Admin'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Admin list */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-left">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium hidden sm:table-cell">Role</th>
              <th className="px-5 py-3 font-medium hidden md:table-cell">Last Login</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {admins.map((admin) => (
              <tr key={admin.id}>
                {editId === admin.id ? (
                  <>
                    <td className="px-5 py-3">
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="ui-input-bordered w-full text-sm"
                        placeholder="Name"
                      />
                    </td>
                    <td className="px-5 py-3 text-slate-400">{admin.email}</td>
                    <td className="px-5 py-3 hidden sm:table-cell">
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value as 'SUPER_ADMIN' | 'OPERATOR' })}
                        className="ui-select text-sm"
                      >
                        <option value="OPERATOR">Operator</option>
                        <option value="SUPER_ADMIN">Super Admin</option>
                      </select>
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      <input
                        type="password"
                        value={editForm.password}
                        onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                        className="ui-input-bordered w-full text-sm"
                        placeholder="New password (optional)"
                      />
                    </td>
                    <td className="px-5 py-3 text-right space-x-2">
                      <button
                        onClick={() => handleUpdate(admin.id)}
                        disabled={saving}
                        className="px-3 py-1 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
                      >
                        Save
                      </button>
                      <button onClick={() => setEditId(null)} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-lg transition-colors">
                        Cancel
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-5 py-3 font-medium">
                      {admin.name || '—'}
                      {admin.id === currentAdminId && <span className="ml-2 text-xs text-slate-500">(you)</span>}
                    </td>
                    <td className="px-5 py-3 text-slate-400">{admin.email}</td>
                    <td className="px-5 py-3 hidden sm:table-cell"><RoleBadge role={admin.role} /></td>
                    <td className="px-5 py-3 hidden md:table-cell text-slate-500">
                      {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-5 py-3 text-right space-x-1">
                      <button
                        onClick={() => {
                          setEditId(admin.id)
                          setEditForm({ name: admin.name || '', role: admin.role, password: '' })
                          setError('')
                        }}
                        className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Pencil size={14} className="text-slate-400" />
                      </button>
                      {admin.id !== currentAdminId && (
                        <button
                          onClick={() => handleDelete(admin.id, admin.email)}
                          className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} className="text-red-400" />
                        </button>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && editId && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  )
}
