'use client'

import { useState, useCallback, useEffect } from 'react'
import DetailDrawer from '@/components/DetailDrawer'
import PermissionToggleList, { type PermissionItem } from '@/components/settings/PermissionToggleList'
import { handleAuthResponse } from '@/lib/client-auth'
import { getInitials, getDisplayName, getAvatarColor, type ApiUser } from './types'

interface MemberPermissionsDrawerProps {
  user: ApiUser | null
  onClose: () => void
  getAuthHeaders: () => Record<string, string>
}

export default function MemberPermissionsDrawer({
  user,
  onClose,
  getAuthHeaders,
}: MemberPermissionsDrawerProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [permItems, setPermItems] = useState<PermissionItem[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [roleName, setRoleName] = useState<string | null>(null)
  const [rolePermIds, setRolePermIds] = useState<Set<string>>(new Set())

  // Load permissions when user changes
  useEffect(() => {
    if (!user) return
    let cancelled = false

    const loadPermissions = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/settings/users/${user.id}/permissions`, {
          headers: getAuthHeaders(),
        })
        if (handleAuthResponse(res)) return
        const data = await res.json()
        if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to load permissions')

        if (cancelled) return
        const perms: PermissionItem[] = data.data.permissions
        setPermItems(perms)
        setSelectedIds(perms.filter((p) => p.status === 'inherited' || p.status === 'granted').map((p) => p.id))
        setRoleName(data.data.roleName)

        const roleIds = new Set<string>()
        perms.forEach((p) => {
          if (p.status === 'inherited' || p.status === 'revoked') {
            roleIds.add(p.id)
          }
        })
        setRolePermIds(roleIds)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load permissions')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadPermissions()
    return () => { cancelled = true }
  }, [user, getAuthHeaders])

  const handleClose = useCallback(() => {
    if (saving) return
    onClose()
    setPermItems([])
    setSelectedIds([])
    setError('')
  }, [saving, onClose])

  const handleSave = useCallback(async () => {
    if (!user) return
    setSaving(true)
    setError('')
    try {
      const overrides: { permissionId: string; granted: boolean }[] = []

      permItems.forEach((perm) => {
        const isSelected = selectedIds.includes(perm.id)
        const roleHasIt = rolePermIds.has(perm.id)

        if (isSelected && !roleHasIt) {
          overrides.push({ permissionId: perm.id, granted: true })
        } else if (!isSelected && roleHasIt) {
          overrides.push({ permissionId: perm.id, granted: false })
        }
      })

      const res = await fetch(`/api/settings/users/${user.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ overrides }),
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to save permissions')
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save permissions')
    } finally {
      setSaving(false)
    }
  }, [user, permItems, selectedIds, rolePermIds, getAuthHeaders, handleClose])

  const handleToggle = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
    setPermItems((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p
        const willBeSelected = !selectedIds.includes(id)
        const roleHasIt = rolePermIds.has(id)
        let newStatus: 'inherited' | 'granted' | 'revoked' | 'none'
        if (willBeSelected && roleHasIt) newStatus = 'inherited'
        else if (willBeSelected && !roleHasIt) newStatus = 'granted'
        else if (!willBeSelected && roleHasIt) newStatus = 'revoked'
        else newStatus = 'none'
        return { ...p, status: newStatus }
      })
    )
  }, [selectedIds, rolePermIds])

  return (
    <DetailDrawer
      isOpen={user !== null}
      onClose={handleClose}
      title="User Permissions"
      width="lg"
      footer={
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleSave}
            className="w-full py-3.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={saving || loading}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="w-full text-sm text-slate-500 hover:text-slate-700 transition py-1"
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* User identity header */}
        {user && (
          <div className="flex items-center gap-4">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={getDisplayName(user) ?? user.email}
                className="h-12 w-12 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <span className={`inline-flex items-center justify-center h-12 w-12 rounded-full text-white text-sm font-bold flex-shrink-0 ${getAvatarColor(user.id)}`}>
                {getInitials(user.firstName, user.lastName, user.email, user.name)}
              </span>
            )}
            <div>
              <p className="text-base font-semibold text-slate-900">
                {getDisplayName(user) || user.email}
              </p>
              <p className="text-sm text-slate-500">{user.email}</p>
            </div>
          </div>
        )}

        {/* Role info banner */}
        <div className="rounded-lg bg-primary-50 border border-primary-200 px-4 py-3">
          <p className="text-sm text-primary-800">
            <span className="font-medium">Role:</span> {roleName || 'No role assigned'}
          </p>
          <p className="text-xs text-primary-600 mt-0.5">
            Permission list will change when you select a different role for this user
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Permission toggle list */}
        <PermissionToggleList
          permissions={permItems}
          selectedIds={selectedIds}
          onToggle={handleToggle}
          mode="user"
          loading={loading}
          disabled={saving}
        />
      </div>
    </DetailDrawer>
  )
}
