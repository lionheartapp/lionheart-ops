'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Shield, Plus, Edit2, Trash2, X } from 'lucide-react'

interface Role {
  id: string
  name: string
  slug: string
  isSystem: boolean
  _count?: {
    permissions: number
    users: number
  }
}

export default function RolesTab() {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [roleName, setRoleName] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth-token')
    const orgId = localStorage.getItem('org-id')

    return {
      'Authorization': `Bearer ${token}`,
      'X-Organization-ID': orgId || '',
    }
  }

  useEffect(() => {
    loadRoles()
  }, [])

  const loadRoles = async () => {
    try {
      const response = await fetch('/api/settings/roles', {
        headers: getAuthHeaders(),
      })
      
      if (response.ok) {
        const data = await response.json()
        setRoles(data.data || [])
      }
    } catch (error) {
      console.error('Failed to load roles:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRole = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setActionError(null)

    const trimmedName = roleName.trim()
    if (!trimmedName) {
      setActionError('Role name is required')
      return
    }

    setCreateLoading(true)
    try {
      const response = await fetch('/api/settings/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ name: trimmedName }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setActionError(payload?.error?.message || 'Failed to create role')
        return
      }

      setRoleName('')
      setShowCreateModal(false)
      await loadRoles()
    } catch (error) {
      console.error('Failed to create role:', error)
      setActionError('Failed to create role')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleDeleteRole = async (role: Role) => {
    setActionError(null)

    const confirmed = window.confirm(`Delete role \"${role.name}\"? This cannot be undone.`)
    if (!confirmed) return

    setDeletingRoleId(role.id)
    try {
      const response = await fetch(`/api/settings/roles/${role.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setActionError(payload?.error?.message || 'Failed to delete role')
        return
      }

      setRoles((previous) => previous.filter((item) => item.id !== role.id))
    } catch (error) {
      console.error('Failed to delete role:', error)
      setActionError('Failed to delete role')
    } finally {
      setDeletingRoleId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Roles & Permissions</h2>
          <p className="text-sm text-gray-600 mt-1">Manage user roles and their permissions</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Create Role
        </button>
      </div>

      {actionError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="divide-y divide-gray-200 border-y border-gray-200">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="py-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 bg-gray-200 rounded-lg" />
                    <div>
                      <div className="h-5 w-40 bg-gray-200 rounded" />
                      <div className="h-4 w-28 bg-gray-200 rounded mt-2" />
                      <div className="h-4 w-36 bg-gray-200 rounded mt-2" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-gray-200 rounded" />
                    <div className="h-8 w-8 bg-gray-200 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : roles.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-md">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No roles found</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Create your first role
          </button>
        </div>
      ) : (
        <div className="divide-y divide-gray-200 border-y border-gray-200">
          {roles.map((role) => (
            <div
              key={role.id}
              className="py-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <Shield className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">{role.name}</h3>
                      {role.isSystem && (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                          System
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">@{role.slug}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span>{role._count?.permissions || 0} permissions</span>
                      <span>•</span>
                      <span>{role._count?.users || 0} users</span>
                    </div>
                  </div>
                </div>
                
                {!role.isSystem && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="p-2 text-gray-600 hover:bg-blue-50 rounded-lg transition"
                      title="Edit role"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteRole(role)}
                      disabled={deletingRoleId === role.id}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete role"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Create Role</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setRoleName('')
                  setActionError(null)
                }}
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
                aria-label="Close create role modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="space-y-4">
              <div>
                <label htmlFor="role-name" className="mb-1 block text-sm font-medium text-gray-700">
                  Role name
                </label>
                <input
                  id="role-name"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="e.g. Attendance Coordinator"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  disabled={createLoading}
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setRoleName('')
                    setActionError(null)
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  disabled={createLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={createLoading}
                >
                  {createLoading ? 'Creating...' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
