'use client'

import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react'
import { Plus, RefreshCw, UserCog, Edit2, Trash2, UserMinus, UserCheck, Shield, ChevronDown, X, Search } from 'lucide-react'
import { handleAuthResponse } from '@/lib/client-auth'
import DetailDrawer from '@/components/DetailDrawer'
import ConfirmDialog from '@/components/ConfirmDialog'
import RowActionMenu from '@/components/RowActionMenu'
import PermissionToggleList, { type PermissionItem } from '@/components/settings/PermissionToggleList'

interface ApiUser {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  avatar: string | null
  jobTitle: string | null
  status: string
  createdAt: string
  teams: { team: { id: string; name: string; slug: string } }[]
  userRole: { id: string; name: string; slug: string } | null
}

interface TeamOption {
  id: string
  name: string
  slug: string
}

interface RoleOption {
  id: string
  name: string
  slug: string
}

type MembersTabProps = { onDirtyChange?: (isDirty: boolean) => void }

const STATUS_TABS = [
  { label: 'All users', value: 'all' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Inactive', value: 'INACTIVE' },
]

function getInitials(firstName: string | null, lastName: string | null, email: string) {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase()
  if (firstName) return firstName[0].toUpperCase()
  return email[0].toUpperCase()
}

function getAvatarColor(id: string) {
  const colors = [
    'bg-primary-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500',
    'bg-teal-500', 'bg-green-500', 'bg-orange-500', 'bg-red-500',
  ]
  const index = id.charCodeAt(0) % colors.length
  return colors[index]
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    PENDING: 'bg-yellow-100 text-yellow-700',
    INACTIVE: 'bg-gray-100 text-gray-500',
    SUSPENDED: 'bg-red-100 text-red-700',
  }
  const label = status.charAt(0) + status.slice(1).toLowerCase()
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {label}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Searchable Team Multi-Select Dropdown ───────────────────────────────────

function TeamMultiSelect({
  teams,
  selectedIds,
  onChange,
  disabled,
}: {
  teams: TeamOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Focus search when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 0)
    } else {
      setQuery('')
    }
  }, [open])

  const filtered = teams.filter((t) =>
    t.name.toLowerCase().includes(query.toLowerCase())
  )

  const selectedTeams = teams.filter((t) => selectedIds.includes(t.id))

  const toggleTeam = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    )
  }

  const removeTeam = (id: string) => {
    onChange(selectedIds.filter((x) => x !== id))
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-left text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:cursor-not-allowed flex items-center justify-between gap-2 ${
          selectedIds.length === 0 ? 'text-gray-400' : 'text-gray-900'
        }`}
        style={{ minHeight: '40px' }}
      >
        <span className="truncate">
          {selectedIds.length === 0
            ? 'Select teams…'
            : `${selectedIds.length} team${selectedIds.length !== 1 ? 's' : ''} selected`}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </button>

      {/* Selected team chips */}
      {selectedTeams.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedTeams.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-medium"
            >
              {t.name}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeTeam(t.id)}
                  className="hover:text-primary-900 transition"
                  style={{ minHeight: 'auto' }}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-modal mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search teams…"
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                style={{ minHeight: 'auto' }}
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">No teams found</p>
            ) : (
              filtered.map((team) => {
                const isSelected = selectedIds.includes(team.id)
                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => toggleTeam(team.id)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-gray-50 transition ${
                      isSelected ? 'text-primary-700 bg-primary-50/50' : 'text-gray-700'
                    }`}
                    style={{ minHeight: 'auto' }}
                  >
                    <span
                      className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                        isSelected
                          ? 'bg-primary-600 border-primary-600'
                          : 'border-gray-300'
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span>{team.name}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const MembersTab = (_props: MembersTabProps) => {
  const [users, setUsers] = useState<ApiUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusTab, setStatusTab] = useState('all')
  const [search, setSearch] = useState('')

  // ─── Edit member state ────────────────────────────────────────────────────
  const [editUser, setEditUser] = useState<ApiUser | null>(null)
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    jobTitle: '',
    status: 'ACTIVE',
    roleId: '',
    teamIds: [] as string[],
  })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [availableRoles, setAvailableRoles] = useState<RoleOption[]>([])
  const [availableTeams, setAvailableTeams] = useState<TeamOption[]>([])
  const [rolesLoading, setRolesLoading] = useState(false)

  // ─── Remove member state ──────────────────────────────────────────────────
  const [userToRemove, setUserToRemove] = useState<ApiUser | null>(null)
  const [removingUserId, setRemovingUserId] = useState<string | null>(null)

  // ─── Manage permissions state ───────────────────────────────────────────────
  const [permUser, setPermUser] = useState<ApiUser | null>(null)
  const [permLoading, setPermLoading] = useState(false)
  const [permSaving, setPermSaving] = useState(false)
  const [permError, setPermError] = useState('')
  const [permItems, setPermItems] = useState<PermissionItem[]>([])
  const [permSelectedIds, setPermSelectedIds] = useState<string[]>([])
  const [permRoleName, setPermRoleName] = useState<string | null>(null)
  const [permRolePermIds, setPermRolePermIds] = useState<Set<string>>(new Set())

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null

  const getAuthHeaders = useCallback(() => ({
    Authorization: `Bearer ${token}`,
    'X-Organization-ID': typeof window !== 'undefined' ? (localStorage.getItem('org-id') || '') : '',
  }), [token])

  const fetchUsers = useCallback(async () => {
    if (!token) {
      setError('No auth token found. Please log in again.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/settings/users', {
        headers: getAuthHeaders(),
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data?.error?.message || 'Failed to load members')
      }
      setUsers(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    const handleAvatarUpdated = () => { fetchUsers() }
    window.addEventListener('avatar-updated', handleAvatarUpdated)
    return () => window.removeEventListener('avatar-updated', handleAvatarUpdated)
  }, [fetchUsers])

  // ─── Roles for edit dropdown ──────────────────────────────────────────────
  const loadRolesAndTeams = useCallback(async () => {
    setRolesLoading(true)
    try {
      const [rolesRes, teamsRes] = await Promise.all([
        fetch('/api/settings/roles', { headers: getAuthHeaders() }),
        fetch('/api/settings/teams', { headers: getAuthHeaders() }),
      ])
      if (handleAuthResponse(rolesRes)) return
      if (handleAuthResponse(teamsRes)) return
      const rolesData = await rolesRes.json()
      const teamsData = await teamsRes.json()
      if (rolesRes.ok && rolesData.ok) setAvailableRoles(rolesData.data || [])
      if (teamsRes.ok && teamsData.ok) setAvailableTeams(teamsData.data || [])
    } catch (e) {
      console.error('Failed to load roles/teams:', e)
    } finally {
      setRolesLoading(false)
    }
  }, [getAuthHeaders])

  // ─── Edit member ──────────────────────────────────────────────────────────
  const openEditUser = useCallback(async (u: ApiUser) => {
    setEditUser(u)
    setEditForm({
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      jobTitle: u.jobTitle || '',
      status: u.status,
      roleId: u.userRole?.id || '',
      teamIds: u.teams.map((t) => t.team.id),
    })
    setEditError('')
    await loadRolesAndTeams()
  }, [loadRolesAndTeams])

  const closeEditUser = () => {
    if (editSaving) return
    setEditUser(null)
    setEditError('')
  }

  const handleEditUser = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editUser) return
    setEditSaving(true)
    setEditError('')
    try {
      const res = await fetch(`/api/settings/users/${editUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          firstName: editForm.firstName.trim() || null,
          lastName: editForm.lastName.trim() || null,
          jobTitle: editForm.jobTitle.trim() || null,
          status: editForm.status,
          ...(editForm.roleId ? { roleId: editForm.roleId } : {}),
          teamIds: editForm.teamIds,
        }),
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to update member')
      setEditUser(null)
      await fetchUsers()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update member')
    } finally {
      setEditSaving(false)
    }
  }

  // ─── Toggle status ────────────────────────────────────────────────────────
  const handleToggleStatus = useCallback(async (u: ApiUser) => {
    const newStatus = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    try {
      const res = await fetch(`/api/settings/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ status: newStatus }),
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to update status')
      await fetchUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    }
  }, [fetchUsers, getAuthHeaders])

  // ─── Remove member ────────────────────────────────────────────────────────
  const confirmRemoveUser = async () => {
    if (!userToRemove) return
    setRemovingUserId(userToRemove.id)
    try {
      const res = await fetch(`/api/settings/users/${userToRemove.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to remove member')
      setUserToRemove(null)
      await fetchUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member')
      setUserToRemove(null)
    } finally {
      setRemovingUserId(null)
    }
  }

  // ─── Manage permissions ──────────────────────────────────────────────────
  const openManagePermissions = useCallback(async (u: ApiUser) => {
    setPermUser(u)
    setPermLoading(true)
    setPermError('')
    try {
      const res = await fetch(`/api/settings/users/${u.id}/permissions`, {
        headers: getAuthHeaders(),
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to load permissions')

      const perms: PermissionItem[] = data.data.permissions
      setPermItems(perms)
      setPermSelectedIds(perms.filter((p: PermissionItem) => p.status === 'inherited' || p.status === 'granted').map((p: PermissionItem) => p.id))
      setPermRoleName(data.data.roleName)
      // Track which permissions come from the role (for computing overrides on save)
      setPermRolePermIds(new Set(perms.filter((p: PermissionItem) => p.status === 'inherited' || p.status === 'revoked' && false).map((p: PermissionItem) => p.id)))
      // Actually, compute role perms: inherited ones and revoked ones (revoked means role has it but user override removed it)
      const roleIds = new Set<string>()
      perms.forEach((p: PermissionItem) => {
        if (p.status === 'inherited' || p.status === 'revoked') {
          roleIds.add(p.id)
        }
      })
      setPermRolePermIds(roleIds)
    } catch (err) {
      setPermError(err instanceof Error ? err.message : 'Failed to load permissions')
    } finally {
      setPermLoading(false)
    }
  }, [getAuthHeaders])

  const closeManagePermissions = () => {
    if (permSaving) return
    setPermUser(null)
    setPermItems([])
    setPermSelectedIds([])
    setPermError('')
  }

  const saveManagePermissions = async () => {
    if (!permUser) return
    setPermSaving(true)
    setPermError('')
    try {
      // Compute overrides: only permissions that differ from role defaults
      const overrides: { permissionId: string; granted: boolean }[] = []

      permItems.forEach((perm) => {
        const isSelected = permSelectedIds.includes(perm.id)
        const roleHasIt = permRolePermIds.has(perm.id)

        if (isSelected && !roleHasIt) {
          // User has it but role doesn't → grant override
          overrides.push({ permissionId: perm.id, granted: true })
        } else if (!isSelected && roleHasIt) {
          // Role has it but user doesn't → revoke override
          overrides.push({ permissionId: perm.id, granted: false })
        }
        // If selected matches role → no override needed
      })

      const res = await fetch(`/api/settings/users/${permUser.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ overrides }),
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to save permissions')
      setPermUser(null)
      setPermItems([])
      setPermSelectedIds([])
    } catch (err) {
      setPermError(err instanceof Error ? err.message : 'Failed to save permissions')
    } finally {
      setPermSaving(false)
    }
  }

  const filtered = users.filter((u) => {
    const matchesStatus = statusTab === 'all' || u.status === statusTab
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      `${u.firstName ?? ''} ${u.lastName ?? ''}`.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.userRole?.name ?? '').toLowerCase().includes(q)
    return matchesStatus && matchesSearch
  })

  const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-400'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-semibold text-gray-900">
            <UserCog className="w-6 h-6 text-primary-600" />
            Members
          </h2>
          <p className="text-sm text-gray-500 mt-1">Manage your organization's users and their roles</p>
        </div>
        <button className="bg-primary-600 text-white px-5 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-700 text-sm font-medium transition">
          <Plus className="w-4 h-4" /> Invite user
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={fetchUsers}
            className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800 font-medium"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      )}

      {/* Status Tabs */}
      <div className="mb-4 flex gap-2 flex-wrap">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setStatusTab(t.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
              statusTab === t.value
                ? 'bg-primary-50 border-primary-500 text-primary-700'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t.label}
            {t.value !== 'all' && (
              <span className="ml-1.5 text-xs text-gray-400">
                ({users.filter((u) => u.status === t.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <div className="flex items-center gap-2 p-4 border-b border-gray-100">
          <input
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            placeholder="Search by name, email or role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Loading members…</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b bg-gray-50">
                <th className="py-3 px-4 text-left font-medium">Name</th>
                <th className="py-3 px-4 text-left font-medium">Role</th>
                <th className="py-3 px-4 text-left font-medium">Status</th>
                <th className="py-3 px-4 text-left font-medium">Teams</th>
                <th className="py-3 px-4 text-left font-medium">Date added</th>
                <th className="py-3 pl-4 pr-10 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-gray-400">
                    {search ? 'No members match your search.' : 'No members found.'}
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="border-b last:border-b-0 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {u.avatar ? (
                          <img
                            src={u.avatar}
                            alt={`${u.firstName} ${u.lastName}`}
                            className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <span className={`inline-flex items-center justify-center h-8 w-8 rounded-full text-white text-xs font-bold flex-shrink-0 ${getAvatarColor(u.id)}`}>
                            {getInitials(u.firstName, u.lastName, u.email)}
                          </span>
                        )}
                        <div>
                          <div className="font-medium text-gray-900">
                            {[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}
                          </div>
                          <div className="text-xs text-gray-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-700 capitalize">
                      {u.userRole?.name ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {u.teams.length > 0
                        ? u.teams.map((t) => t.team.name).join(', ')
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{formatDate(u.createdAt)}</td>
                    <td className="py-3 pl-4 pr-10">
                      <div className="flex justify-end">
                        <RowActionMenu
                          items={[
                            {
                              label: 'Edit',
                              icon: <Edit2 className="w-4 h-4" />,
                              onClick: () => openEditUser(u),
                            },
                            {
                              label: 'Manage Permissions',
                              icon: <Shield className="w-4 h-4" />,
                              onClick: () => openManagePermissions(u),
                            },
                            {
                              label: u.status === 'ACTIVE' ? 'Deactivate' : 'Activate',
                              icon: u.status === 'ACTIVE'
                                ? <UserMinus className="w-4 h-4" />
                                : <UserCheck className="w-4 h-4" />,
                              onClick: () => handleToggleStatus(u),
                            },
                            {
                              label: 'Remove',
                              icon: <Trash2 className="w-4 h-4" />,
                              onClick: () => setUserToRemove(u),
                              variant: 'danger',
                            },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── Edit Member Drawer ─────────────────────────────────────────────── */}
      <DetailDrawer
        isOpen={editUser !== null}
        onClose={closeEditUser}
        title={editUser
          ? `Edit ${[editUser.firstName, editUser.lastName].filter(Boolean).join(' ') || editUser.email}`
          : 'Edit Member'}
        width="lg"
      >
        <form onSubmit={handleEditUser} className="p-8 space-y-6">
          {editError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {editError}
            </div>
          )}

          <section className="space-y-4">
            <div className="border-b border-gray-200 pb-3">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Personal Info</h3>
              <p className="mt-1 text-sm text-gray-500">Update how this member appears across the platform.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="edit-firstName" className={labelClass}>First name</label>
                <input
                  id="edit-firstName"
                  value={editForm.firstName}
                  onChange={(e) => setEditForm((p) => ({ ...p, firstName: e.target.value }))}
                  placeholder="First name"
                  className={inputClass}
                  disabled={editSaving}
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="edit-lastName" className={labelClass}>Last name</label>
                <input
                  id="edit-lastName"
                  value={editForm.lastName}
                  onChange={(e) => setEditForm((p) => ({ ...p, lastName: e.target.value }))}
                  placeholder="Last name"
                  className={inputClass}
                  disabled={editSaving}
                />
              </div>
            </div>

            <div>
              <label htmlFor="edit-jobTitle" className={labelClass}>Job title <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                id="edit-jobTitle"
                value={editForm.jobTitle}
                onChange={(e) => setEditForm((p) => ({ ...p, jobTitle: e.target.value }))}
                placeholder="e.g. Head Teacher, IT Administrator"
                className={inputClass}
                disabled={editSaving}
              />
            </div>
          </section>

          <section className="space-y-4">
            <div className="border-b border-gray-200 pb-3">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Access & Status</h3>
              <p className="mt-1 text-sm text-gray-500">Control this member's role and account status.</p>
            </div>

            <div>
              <label htmlFor="edit-roleId" className={labelClass}>Role</label>
              {rolesLoading ? (
                <div className="h-10 rounded-lg border border-gray-200 bg-gray-50 animate-pulse" />
              ) : (
                <select
                  id="edit-roleId"
                  value={editForm.roleId}
                  onChange={(e) => setEditForm((p) => ({ ...p, roleId: e.target.value }))}
                  className={inputClass}
                  disabled={editSaving}
                >
                  <option value="">No role assigned</option>
                  {availableRoles.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label htmlFor="edit-status" className={labelClass}>Status</label>
              <select
                id="edit-status"
                value={editForm.status}
                onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                className={inputClass}
                disabled={editSaving}
              >
                <option value="ACTIVE">Active</option>
                <option value="PENDING">Pending</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>

            <div>
              <label htmlFor="edit-teamIds" className={labelClass}>Teams</label>
              {rolesLoading ? (
                <div className="h-10 rounded-lg border border-gray-200 bg-gray-50 animate-pulse" />
              ) : availableTeams.length === 0 ? (
                <p className="text-sm text-gray-400">No teams available</p>
              ) : (
                <TeamMultiSelect
                  teams={availableTeams}
                  selectedIds={editForm.teamIds}
                  onChange={(ids) => setEditForm((p) => ({ ...p, teamIds: ids }))}
                  disabled={editSaving}
                />
              )}
            </div>
          </section>

          <div className="flex items-center justify-end gap-2 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={closeEditUser}
              className="px-4 py-2 min-h-[40px] border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
              disabled={editSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 min-h-[40px] bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={editSaving}
            >
              {editSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </DetailDrawer>

      {/* ─── Manage Permissions Drawer ─────────────────────────────────────── */}
      <DetailDrawer
        isOpen={permUser !== null}
        onClose={closeManagePermissions}
        title="User Permissions"
        width="lg"
      >
        <div className="flex flex-col" style={{ margin: '-1rem -1.5rem', height: 'calc(100% + 2rem)' }}>
          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* User identity header */}
            {permUser && (
              <div className="flex items-center gap-4">
                {permUser.avatar ? (
                  <img
                    src={permUser.avatar}
                    alt={`${permUser.firstName} ${permUser.lastName}`}
                    className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <span className={`inline-flex items-center justify-center h-12 w-12 rounded-full text-white text-sm font-bold flex-shrink-0 ${getAvatarColor(permUser.id)}`}>
                    {getInitials(permUser.firstName, permUser.lastName, permUser.email)}
                  </span>
                )}
                <div>
                  <p className="text-base font-semibold text-gray-900">
                    {[permUser.firstName, permUser.lastName].filter(Boolean).join(' ') || permUser.email}
                  </p>
                  <p className="text-sm text-gray-500">{permUser.email}</p>
                </div>
              </div>
            )}

            {/* Role info banner */}
            <div className="rounded-lg bg-primary-50 border border-primary-200 px-4 py-3">
              <p className="text-sm text-primary-800">
                <span className="font-medium">Role:</span> {permRoleName || 'No role assigned'}
              </p>
              <p className="text-xs text-primary-600 mt-0.5">
                Permission list will change when you select a different role for this user
              </p>
            </div>

            {permError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {permError}
              </div>
            )}

            {/* Permission toggle list */}
            <PermissionToggleList
              permissions={permItems}
              selectedIds={permSelectedIds}
              onToggle={(id) => {
                setPermSelectedIds((prev) =>
                  prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                )
                // Update the item status for visual feedback
                setPermItems((prev) =>
                  prev.map((p) => {
                    if (p.id !== id) return p
                    const willBeSelected = !permSelectedIds.includes(id)
                    const roleHasIt = permRolePermIds.has(id)
                    let newStatus: 'inherited' | 'granted' | 'revoked' | 'none'
                    if (willBeSelected && roleHasIt) newStatus = 'inherited'
                    else if (willBeSelected && !roleHasIt) newStatus = 'granted'
                    else if (!willBeSelected && roleHasIt) newStatus = 'revoked'
                    else newStatus = 'none'
                    return { ...p, status: newStatus }
                  })
                )
              }}
              mode="user"
              loading={permLoading}
              disabled={permSaving}
            />
          </div>

          {/* Pinned footer */}
          <div className="flex-shrink-0 flex items-center justify-end gap-2 border-t border-gray-200 px-6 py-4 bg-white">
            <button
              type="button"
              onClick={closeManagePermissions}
              className="px-4 py-2 min-h-[40px] border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
              disabled={permSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveManagePermissions}
              className="px-4 py-2 min-h-[40px] bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={permSaving || permLoading}
            >
              {permSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </DetailDrawer>

      {/* ─── Remove Member Confirm ──────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={userToRemove !== null}
        onClose={() => setUserToRemove(null)}
        onConfirm={confirmRemoveUser}
        title="Remove Member"
        message={`Are you sure you want to remove ${[userToRemove?.firstName, userToRemove?.lastName].filter(Boolean).join(' ') || userToRemove?.email} from the organization? This action cannot be undone.`}
        requireText="DELETE"
        confirmText="Remove Member"
        variant="danger"
        isLoading={removingUserId !== null}
      />
    </div>
  )
}

export default MembersTab
