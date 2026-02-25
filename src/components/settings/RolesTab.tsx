'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Shield, Plus, Edit2, Trash2 } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import DetailDrawer from '@/components/DetailDrawer'

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

interface PermissionOption {
  id: string
  resource: string
  action: string
  scope: string
  description?: string | null
}

interface RoleUserSummary {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  userRole?: {
    id: string
    name: string
  } | null
}

type RolesTabProps = {
  onDirtyChange?: (isDirty: boolean) => void
}

export default function RolesTab({ onDirtyChange }: RolesTabProps = {}) {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [roleName, setRoleName] = useState('')
  const [permissions, setPermissions] = useState<PermissionOption[]>([])
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([])
  const [permissionsLoading, setPermissionsLoading] = useState(false)
  const [permissionsError, setPermissionsError] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)
  const [editRole, setEditRole] = useState<Role | null>(null)
  const [editRoleName, setEditRoleName] = useState('')
  const [editPermissionIds, setEditPermissionIds] = useState<string[]>([])
  const [editInitialPermissionIds, setEditInitialPermissionIds] = useState<string[]>([])
  const [editLoading, setEditLoading] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null)
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null)
  const [reassignRoleId, setReassignRoleId] = useState('')
  const [roleUsers, setRoleUsers] = useState<RoleUserSummary[]>([])
  const [roleUsersLoading, setRoleUsersLoading] = useState(false)
  const [roleUserReassignments, setRoleUserReassignments] = useState<Record<string, string>>({})
  const [actionError, setActionError] = useState<string | null>(null)

  const hasCreateDraft = showCreateModal && (roleName.trim().length > 0 || selectedPermissionIds.length > 0)
  const hasEditNameDraft = Boolean(editRole) && editRoleName.trim() !== (editRole?.name || '').trim()
  const hasEditPermissionDraft =
    editPermissionIds.length !== editInitialPermissionIds.length ||
    [...editPermissionIds].sort().join('|') !== [...editInitialPermissionIds].sort().join('|')
  const hasEditDraft = Boolean(editRole) && (hasEditNameDraft || hasEditPermissionDraft)
  const hasUnsavedChanges = hasCreateDraft || hasEditDraft

  useEffect(() => {
    onDirtyChange?.(hasUnsavedChanges)
  }, [hasUnsavedChanges, onDirtyChange])

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
    loadPermissions()
  }, [])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasUnsavedChanges])

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

  const loadPermissions = async () => {
    setPermissionsLoading(true)
    setPermissionsError(null)

    try {
      const response = await fetch('/api/settings/permissions', {
        headers: getAuthHeaders(),
      })

      if (!response.ok) {
        setPermissionsError('Failed to load permissions')
        return
      }

      const data = await response.json()
      setPermissions(data.data || [])
    } catch (error) {
      console.error('Failed to load permissions:', error)
      setPermissionsError('Failed to load permissions')
    } finally {
      setPermissionsLoading(false)
    }
  }

  const openCreateDrawer = () => {
    setActionError(null)
    setRoleName('')
    setSelectedPermissionIds([])
    setShowCreateModal(true)
  }

  const closeCreateDrawer = () => {
    if (createLoading) return
    setShowCreateModal(false)
    setRoleName('')
    setSelectedPermissionIds([])
    setActionError(null)
  }

  const openEditDrawer = async (role: Role) => {
    setEditError(null)
    setEditRole(role)
    setEditRoleName(role.name)
    setEditPermissionIds([])
    setEditInitialPermissionIds([])
    setEditLoading(true)

    try {
      const response = await fetch(`/api/settings/roles/${role.id}`, {
        headers: getAuthHeaders(),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setEditError(payload?.error?.message || 'Failed to load role details')
        return
      }

      const nextPermissionIds = payload?.data?.permissionIds || []
      setEditPermissionIds(nextPermissionIds)
      setEditInitialPermissionIds(nextPermissionIds)
    } catch (error) {
      console.error('Failed to load role details:', error)
      setEditError('Failed to load role details')
    } finally {
      setEditLoading(false)
    }
  }

  const closeEditDrawer = () => {
    if (editSaving) return
    setEditRole(null)
    setEditRoleName('')
    setEditPermissionIds([])
    setEditInitialPermissionIds([])
    setEditError(null)
  }

  const togglePermission = (permissionId: string) => {
    setSelectedPermissionIds((previous) =>
      previous.includes(permissionId)
        ? previous.filter((id) => id !== permissionId)
        : [...previous, permissionId]
    )
  }

  const toggleEditPermission = (permissionId: string) => {
    setEditPermissionIds((previous) =>
      previous.includes(permissionId)
        ? previous.filter((id) => id !== permissionId)
        : [...previous, permissionId]
    )
  }

  const setGroupPermissions = (permissionIds: string[], shouldSelect: boolean) => {
    setSelectedPermissionIds((previous) => {
      const next = new Set(previous)
      if (shouldSelect) {
        permissionIds.forEach((id) => next.add(id))
      } else {
        permissionIds.forEach((id) => next.delete(id))
      }
      return Array.from(next)
    })
  }

  const setEditGroupPermissions = (permissionIds: string[], shouldSelect: boolean) => {
    setEditPermissionIds((previous) => {
      const next = new Set(previous)
      if (shouldSelect) {
        permissionIds.forEach((id) => next.add(id))
      } else {
        permissionIds.forEach((id) => next.delete(id))
      }
      return Array.from(next)
    })
  }

  const groupedPermissions = useMemo(() => {
    const resourceLabels: Record<string, string> = {
      tickets: 'Tickets',
      events: 'Events',
      inventory: 'Inventory',
      settings: 'Settings',
      users: 'Users',
      roles: 'Roles',
      teams: 'Teams',
    }

    const filtered = permissions.filter((permission) => permission.resource !== '*')
    const byResource = new Map<string, PermissionOption[]>()

    filtered.forEach((permission) => {
      const list = byResource.get(permission.resource) || []
      list.push(permission)
      byResource.set(permission.resource, list)
    })

    const ordered: Array<{
      resource: string
      label: string
      permissions: PermissionOption[]
    }> = []

    Object.keys(resourceLabels).forEach((resource) => {
      const list = byResource.get(resource)
      if (list && list.length > 0) {
        ordered.push({
          resource,
          label: resourceLabels[resource],
          permissions: list,
        })
        byResource.delete(resource)
      }
    })

    for (const [resource, list] of byResource) {
      ordered.push({
        resource,
        label: resource,
        permissions: list,
      })
    }

    ordered.forEach((group) => {
      group.permissions.sort((a, b) => {
        const actionDiff = a.action.localeCompare(b.action)
        if (actionDiff !== 0) return actionDiff
        return a.scope.localeCompare(b.scope)
      })
    })

    return ordered
  }, [permissions])

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
        body: JSON.stringify({
          name: trimmedName,
          permissionIds: selectedPermissionIds,
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setActionError(payload?.error?.message || 'Failed to create role')
        return
      }

      setRoleName('')
      setSelectedPermissionIds([])
      setShowCreateModal(false)
      await loadRoles()
    } catch (error) {
      console.error('Failed to create role:', error)
      setActionError('Failed to create role')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleEditRole = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editRole) return

    setEditError(null)
    const trimmedName = editRoleName.trim()
    if (!trimmedName) {
      setEditError('Role name is required')
      return
    }

    setEditSaving(true)
    try {
      const response = await fetch(`/api/settings/roles/${editRole.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          name: trimmedName,
          permissionIds: editPermissionIds,
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setEditError(payload?.error?.message || 'Failed to update role')
        return
      }

      setEditRole(null)
      setEditRoleName('')
      setEditPermissionIds([])
      setEditInitialPermissionIds([])
      await loadRoles()
    } catch (error) {
      console.error('Failed to update role:', error)
      setEditError('Failed to update role')
    } finally {
      setEditSaving(false)
    }
  }

  const handleDeleteRole = (role: Role) => {
    setActionError(null)
    setRoleToDelete(role)
  }

  const loadRoleUsers = async (roleId: string) => {
    setRoleUsersLoading(true)
    try {
      const response = await fetch(`/api/settings/users?roleId=${roleId}`, {
        headers: getAuthHeaders(),
      })

      if (!response.ok) {
        setRoleUsers([])
        return
      }

      const payload = await response.json().catch(() => null)
      setRoleUsers(payload?.data || [])
    } catch (error) {
      console.error('Failed to load role users:', error)
      setRoleUsers([])
    } finally {
      setRoleUsersLoading(false)
    }
  }

  const availableReassignRoles = useMemo(() => {
    if (!roleToDelete) return []
    return roles.filter((role) => role.id !== roleToDelete.id)
  }, [roles, roleToDelete])

  useEffect(() => {
    if (!roleToDelete) {
      setReassignRoleId('')
      setRoleUsers([])
      setRoleUserReassignments({})
      return
    }

    if ((roleToDelete._count?.users || 0) > 0) {
      setReassignRoleId(availableReassignRoles[0]?.id || '')
      loadRoleUsers(roleToDelete.id)
    } else {
      setReassignRoleId('')
      setRoleUsers([])
      setRoleUserReassignments({})
    }
  }, [roleToDelete, availableReassignRoles])

  const confirmDeleteRole = async () => {
    if (!roleToDelete) return

    setActionError(null)
    const assignedUsers = roleToDelete._count?.users || 0
    if (assignedUsers > 0 && !reassignRoleId) {
      setActionError('Select a role to reassign users before deleting.')
      return
    }

    setDeletingRoleId(roleToDelete.id)

    try {
      const userReassignments = Object.entries(roleUserReassignments)
        .filter(([, roleId]) => roleId)
        .map(([userId, roleId]) => ({ userId, roleId }))

      const response = await fetch(`/api/settings/roles/${roleToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          reassignRoleId: reassignRoleId || null,
          userReassignments,
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setActionError(payload?.error?.message || 'Failed to delete role')
        setRoleToDelete(null)
        return
      }

      setRoles((previous) => previous.filter((item) => item.id !== roleToDelete.id))
      setRoleToDelete(null)
    } catch (error) {
      console.error('Failed to delete role:', error)
      setActionError('Failed to delete role')
      setRoleToDelete(null)
    } finally {
      setDeletingRoleId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Roles & Permissions</h2>
          <p className="text-sm text-gray-600 mt-1">Manage user roles and their permissions</p>
        </div>
        <button
          onClick={openCreateDrawer}
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
            onClick={openCreateDrawer}
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
                      onClick={() => openEditDrawer(role)}
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

      <DetailDrawer
        isOpen={showCreateModal}
        onClose={closeCreateDrawer}
        title="Create Role"
        width="lg"
      >
        <form onSubmit={handleCreateRole} className="space-y-6">
          {actionError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {actionError}
            </div>
          )}

          <section className="space-y-4">
            <div className="border-b border-gray-200 pb-3">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                Naming the Role
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                This name appears in user profiles, filters, and activity logs.
              </p>
            </div>

            <div>
              <label htmlFor="role-name" className="mb-1 block text-sm font-medium text-gray-700">
                Role name
              </label>
              <input
                id="role-name"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="e.g. Attendance Coordinator"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
                disabled={createLoading}
                autoFocus
              />
            </div>
          </section>

          <section className="space-y-4">
            <div className="border-b border-gray-200 pb-3">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                Permissions
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Choose what this role can do. You can update permissions later.
              </p>
            </div>

            {permissionsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-16 rounded-lg border border-gray-200 bg-gray-50" />
                ))}
              </div>
            ) : permissionsError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {permissionsError}
              </div>
            ) : (
              <div className="space-y-4">
                {groupedPermissions.map((group) => {
                  const groupIds = group.permissions.map((permission) => permission.id)
                  const selectedInGroup = groupIds.filter((id) => selectedPermissionIds.includes(id))
                  return (
                    <div key={group.resource} className="rounded-lg border border-gray-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-gray-900">{group.label}</h4>
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <button
                            type="button"
                            onClick={() => setGroupPermissions(groupIds, true)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            Select all
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            type="button"
                            onClick={() => setGroupPermissions(groupIds, false)}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {group.permissions.map((permission) => {
                          const label = permission.description
                            ? permission.description
                            : `${permission.resource}:${permission.action}${
                                permission.scope && permission.scope !== 'global'
                                  ? `:${permission.scope}`
                                  : ''
                              }`

                          return (
                            <label
                              key={permission.id}
                              className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <input
                                type="checkbox"
                                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                checked={selectedPermissionIds.includes(permission.id)}
                                onChange={() => togglePermission(permission.id)}
                              />
                              <span className="flex-1">
                                <span className="block font-medium text-gray-900">{label}</span>
                                <span className="block text-xs text-gray-500">
                                  {permission.resource} • {permission.action}
                                  {permission.scope && permission.scope !== 'global'
                                    ? ` • ${permission.scope}`
                                    : ''}
                                </span>
                              </span>
                            </label>
                          )
                        })}
                      </div>
                      <p className="mt-3 text-xs text-gray-500">
                        {selectedInGroup.length} of {group.permissions.length} selected
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <div className="flex items-center justify-end gap-2 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={closeCreateDrawer}
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
      </DetailDrawer>

      <DetailDrawer
        isOpen={editRole !== null}
        onClose={closeEditDrawer}
        title={editRole ? `Edit ${editRole.name}` : 'Edit Role'}
        width="lg"
      >
        {editLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-16 rounded-lg border border-gray-200 bg-gray-50" />
            ))}
          </div>
        ) : (
          <form onSubmit={handleEditRole} className="space-y-6">
            {editError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {editError}
              </div>
            )}

            <section className="space-y-4">
              <div className="border-b border-gray-200 pb-3">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Naming the Role
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Update how this role appears across the platform.
                </p>
              </div>

              <div>
                <label htmlFor="edit-role-name" className="mb-1 block text-sm font-medium text-gray-700">
                  Role name
                </label>
                <input
                  id="edit-role-name"
                  value={editRoleName}
                  onChange={(e) => setEditRoleName(e.target.value)}
                  placeholder="e.g. Attendance Coordinator"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
                  disabled={editSaving}
                  autoFocus
                />
              </div>
            </section>

            <section className="space-y-4">
              <div className="border-b border-gray-200 pb-3">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Permissions
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Adjust what this role can access.
                </p>
              </div>

              {permissionsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-16 rounded-lg border border-gray-200 bg-gray-50" />
                  ))}
                </div>
              ) : permissionsError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {permissionsError}
                </div>
              ) : (
                <div className="space-y-4">
                  {groupedPermissions.map((group) => {
                    const groupIds = group.permissions.map((permission) => permission.id)
                    const selectedInGroup = groupIds.filter((id) => editPermissionIds.includes(id))
                    return (
                      <div key={group.resource} className="rounded-lg border border-gray-200 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-sm font-semibold text-gray-900">{group.label}</h4>
                          <div className="flex items-center gap-2 text-xs font-medium">
                            <button
                              type="button"
                              onClick={() => setEditGroupPermissions(groupIds, true)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              Select all
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              type="button"
                              onClick={() => setEditGroupPermissions(groupIds, false)}
                              className="text-gray-500 hover:text-gray-700"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {group.permissions.map((permission) => {
                            const label = permission.description
                              ? permission.description
                              : `${permission.resource}:${permission.action}${
                                  permission.scope && permission.scope !== 'global'
                                    ? `:${permission.scope}`
                                    : ''
                                }`

                            return (
                              <label
                                key={permission.id}
                                className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <input
                                  type="checkbox"
                                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  checked={editPermissionIds.includes(permission.id)}
                                  onChange={() => toggleEditPermission(permission.id)}
                                  disabled={editSaving}
                                />
                                <span className="flex-1">
                                  <span className="block font-medium text-gray-900">{label}</span>
                                  <span className="block text-xs text-gray-500">
                                    {permission.resource} • {permission.action}
                                    {permission.scope && permission.scope !== 'global'
                                      ? ` • ${permission.scope}`
                                      : ''}
                                  </span>
                                </span>
                              </label>
                            )
                          })}
                        </div>
                        <p className="mt-3 text-xs text-gray-500">
                          {selectedInGroup.length} of {group.permissions.length} selected
                        </p>
                      </div>
                    )}
                  )}
                </div>
              )}
            </section>

            <div className="flex items-center justify-end gap-2 border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={closeEditDrawer}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                disabled={editSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
                disabled={editSaving}
              >
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </DetailDrawer>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={roleToDelete !== null}
        onClose={() => setRoleToDelete(null)}
        onConfirm={confirmDeleteRole}
        title="Delete Role"
        message={`Are you sure you want to delete "${roleToDelete?.name}"? This action cannot be undone.`}
        requireText="DELETE"
        confirmText="Delete Role"
        variant="danger"
        isLoading={deletingRoleId !== null}
        confirmDisabled={
          (roleToDelete?._count?.users || 0) > 0 &&
          !reassignRoleId &&
          Object.values(roleUserReassignments).every((value) => !value)
        }
      >
        {roleToDelete && (roleToDelete._count?.users || 0) > 0 && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-medium">
              This role has {roleToDelete._count?.users} assigned users.
            </p>
            {availableReassignRoles.length > 0 ? (
              <div className="mt-3">
                <label htmlFor="reassign-role" className="mb-1 block text-sm font-medium text-amber-900">
                  Move users to
                </label>
                <select
                  id="reassign-role"
                  value={reassignRoleId}
                  onChange={(event) => setReassignRoleId(event.target.value)}
                  className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-amber-400 focus:outline-none"
                >
                  <option value="">Select a role</option>
                  {availableReassignRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Reassign individually
                  </p>
                  {roleUsersLoading ? (
                    <div className="mt-2 space-y-2">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="h-10 rounded-md bg-amber-100" />
                      ))}
                    </div>
                  ) : roleUsers.length === 0 ? (
                    <p className="mt-2 text-sm text-amber-700">
                      No assigned users found.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {roleUsers.map((user) => {
                        const displayName = [user.firstName, user.lastName]
                          .filter(Boolean)
                          .join(' ')
                        return (
                          <div key={user.id} className="flex flex-col gap-2 rounded-lg bg-white p-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-medium text-amber-900">
                                {displayName || user.email}
                              </p>
                              <p className="text-xs text-amber-700">{user.email}</p>
                            </div>
                            <select
                              value={roleUserReassignments[user.id] || ''}
                              onChange={(event) =>
                                setRoleUserReassignments((previous) => ({
                                  ...previous,
                                  [user.id]: event.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-amber-400 focus:outline-none sm:w-56"
                            >
                              <option value="">Use bulk role</option>
                              {availableReassignRoles.map((role) => (
                                <option key={role.id} value={role.id}>
                                  {role.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm">
                Create another role before deleting so users can be reassigned.
              </p>
            )}
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}
