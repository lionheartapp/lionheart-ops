'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Shield, Plus, Edit2, Trash2 } from 'lucide-react'
import { handleAuthResponse } from '@/lib/client-auth'
import { queryOptions, queryKeys } from '@/lib/queries'
import { FloatingInput } from '@/components/ui/FloatingInput'
import ConfirmDialog from '@/components/ConfirmDialog'
import DetailDrawer from '@/components/DetailDrawer'
import RowActionMenu from '@/components/RowActionMenu'
import PermissionToggleList from '@/components/settings/PermissionToggleList'
import { IllustrationTeam } from '@/components/illustrations'

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
  const queryClient = useQueryClient()

  // ─── Cached queries ─────────────────────────────────────────────────────
  const { data: rolesData, isLoading: loading } = useQuery(queryOptions.roles())
  const roles = (rolesData ?? []) as Role[]

  const { data: permissionsData, isLoading: permissionsLoading, error: permissionsQueryError } = useQuery(queryOptions.settingsPermissions())
  const permissions = (permissionsData ?? []) as PermissionOption[]
  const permissionsError = permissionsQueryError?.message ?? null

  const invalidateRoles = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.roles.all })
  }

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [roleName, setRoleName] = useState('')
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([])
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
      if (handleAuthResponse(response)) return

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
      if (handleAuthResponse(response)) return

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setActionError(payload?.error?.message || 'Failed to create role')
        return
      }

      setRoleName('')
      setSelectedPermissionIds([])
      setShowCreateModal(false)
      invalidateRoles()
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
      if (handleAuthResponse(response)) return

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setEditError(payload?.error?.message || 'Failed to update role')
        return
      }

      setEditRole(null)
      setEditRoleName('')
      setEditPermissionIds([])
      setEditInitialPermissionIds([])
      invalidateRoles()
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
      if (handleAuthResponse(response)) return

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
      if (handleAuthResponse(response)) return

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setActionError(payload?.error?.message || 'Failed to delete role')
        setRoleToDelete(null)
        return
      }

      invalidateRoles()
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
      <div className="ui-glass p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Roles</h3>
              <p className="text-xs text-slate-500">Define roles and permissions</p>
            </div>
          </div>
          <button
            onClick={openCreateDrawer}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-slate-900 text-white rounded-full hover:bg-slate-800 transition self-start sm:self-auto flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            Create Role
          </button>
        </div>
      </div>

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <div className="ui-glass-table overflow-x-auto">
        {loading ? (
          <div className="animate-pulse">
            <div className="flex items-center gap-4 p-4 border-b border-slate-100 bg-slate-50">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-4 bg-slate-200 rounded flex-1" />
              ))}
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-slate-100 last:border-b-0">
                <div className="flex-1">
                  <div className="h-4 w-32 bg-slate-200 rounded" />
                  <div className="h-3 w-20 bg-slate-100 rounded mt-1.5" />
                </div>
                <div className="h-4 w-10 bg-slate-200 rounded flex-1" />
                <div className="h-4 w-10 bg-slate-200 rounded flex-1" />
                <div className="flex gap-2 flex-1 justify-end">
                  <div className="h-8 w-8 bg-slate-200 rounded" />
                  <div className="h-8 w-8 bg-slate-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : roles.length === 0 ? (
          <div className="text-center py-16">
            <IllustrationTeam className="w-48 h-40 mx-auto mb-2" />
            <p className="text-base font-semibold text-slate-700 mb-1">No roles found</p>
            <p className="text-sm text-slate-500 mb-4">Define roles to control what your team members can access.</p>
            <button
              onClick={openCreateDrawer}
              className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors active:scale-[0.97] cursor-pointer"
            >
              Create First Role
            </button>
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="sm:hidden divide-y divide-slate-100">
              {roles.map((role) => (
                <div key={role.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 text-sm">{role.name}</span>
                      {role.isSystem && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded">System</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span>{role._count?.permissions || 0} permissions</span>
                      <span>{role._count?.users || 0} members</span>
                    </div>
                  </div>
                  {!role.isSystem && (
                    <RowActionMenu
                      items={[
                        { label: 'Edit', icon: <Edit2 className="w-4 h-4" />, onClick: () => openEditDrawer(role) },
                        { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleDeleteRole(role), variant: 'danger', disabled: deletingRoleId === role.id },
                      ]}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <table className="min-w-full text-sm hidden sm:table">
              <thead>
                <tr className="text-slate-500 border-b bg-slate-50">
                  <th className="py-3 px-4 text-left font-medium">Role</th>
                  <th className="py-3 px-4 text-left font-medium">Permissions</th>
                  <th className="py-3 px-4 text-left font-medium">Members</th>
                  <th className="py-3 pl-4 pr-10 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{role.name}</span>
                        {role.isSystem && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded">
                            System
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">@{role.slug}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{role._count?.permissions || 0}</td>
                    <td className="py-3 px-4 text-slate-600">{role._count?.users || 0}</td>
                    <td className="py-3 pl-4 pr-10">
                      <div className="flex justify-end">
                        {!role.isSystem && (
                          <RowActionMenu
                            items={[
                              {
                                label: 'Edit',
                                icon: <Edit2 className="w-4 h-4" />,
                                onClick: () => openEditDrawer(role),
                              },
                              {
                                label: 'Delete',
                                icon: <Trash2 className="w-4 h-4" />,
                                onClick: () => handleDeleteRole(role),
                                variant: 'danger',
                                disabled: deletingRoleId === role.id,
                              },
                            ]}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <DetailDrawer
        isOpen={showCreateModal}
        onClose={closeCreateDrawer}
        title="Create Role"
        width="lg"
        footer={
          <div className="space-y-3">
            <button
              type="submit"
              form="create-role-form"
              className="w-full py-3.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={createLoading}
            >
              {createLoading ? 'Creating...' : 'Create Role'}
            </button>
            <button
              type="button"
              onClick={closeCreateDrawer}
              className="w-full text-sm text-slate-500 hover:text-slate-700 transition py-1"
              disabled={createLoading}
            >
              Cancel
            </button>
          </div>
        }
      >
        <form id="create-role-form" onSubmit={handleCreateRole} className="space-y-6">
          {actionError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {actionError}
            </div>
          )}

          <section className="space-y-4">
            <p className="text-sm text-slate-500">
              This name appears in user profiles, filters, and activity logs.
            </p>

            <FloatingInput
              id="role-name"
              label="Role name"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              disabled={createLoading}
              autoFocus
            />
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-xs text-slate-400 uppercase tracking-wide font-medium">
                Permissions
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Choose what this role can do. You can update permissions later.
              </p>
            </div>

            {permissionsError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {permissionsError}
              </div>
            ) : (
              <PermissionToggleList
                permissions={permissions}
                selectedIds={selectedPermissionIds}
                onToggle={togglePermission}
                mode="role"
                loading={permissionsLoading}
                disabled={createLoading}
              />
            )}
          </section>
        </form>
      </DetailDrawer>

      <DetailDrawer
        isOpen={editRole !== null}
        onClose={closeEditDrawer}
        title={editRole ? `Edit ${editRole.name}` : 'Edit Role'}
        width="lg"
        footer={
          !editLoading ? (
            <div className="space-y-3">
              <button
                type="submit"
                form="edit-role-form"
                className="w-full py-3.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                disabled={editSaving}
              >
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={closeEditDrawer}
                className="w-full text-sm text-slate-500 hover:text-slate-700 transition py-1"
                disabled={editSaving}
              >
                Cancel
              </button>
            </div>
          ) : undefined
        }
      >
        {editLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-16 rounded-lg border border-slate-200 bg-slate-50" />
            ))}
          </div>
        ) : (
          <form id="edit-role-form" onSubmit={handleEditRole} className="space-y-6">
            {editError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {editError}
              </div>
            )}

            <section className="space-y-4">
              <p className="text-sm text-slate-500">
                Update how this role appears across the platform.
              </p>

              <FloatingInput
                id="edit-role-name"
                label="Role name"
                value={editRoleName}
                onChange={(e) => setEditRoleName(e.target.value)}
                disabled={editSaving}
                autoFocus
              />
            </section>

            <section className="space-y-4">
              <div>
                <h3 className="text-xs text-slate-400 uppercase tracking-wide font-medium">
                  Permissions
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Adjust what this role can access.
                </p>
              </div>

              {permissionsError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {permissionsError}
                </div>
              ) : (
                <PermissionToggleList
                  permissions={permissions}
                  selectedIds={editPermissionIds}
                  onToggle={toggleEditPermission}
                  mode="role"
                  loading={permissionsLoading}
                  disabled={editSaving}
                />
              )}
            </section>
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
                <label htmlFor="reassign-role" className="mb-1.5 block text-sm font-medium text-amber-900">
                  Move users to
                </label>
                <select
                  id="reassign-role"
                  value={reassignRoleId}
                  onChange={(event) => setReassignRoleId(event.target.value)}
                  className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none"
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
                              aria-label="Reassign users to role"
                              value={roleUserReassignments[user.id] || ''}
                              onChange={(event) =>
                                setRoleUserReassignments((previous) => ({
                                  ...previous,
                                  [user.id]: event.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none sm:w-56"
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
