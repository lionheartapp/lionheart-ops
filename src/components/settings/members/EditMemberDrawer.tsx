'use client'

import { useState, useCallback, type FormEvent } from 'react'
import { FloatingInput, FloatingDropdown } from '@/components/ui/FloatingInput'
import DetailDrawer from '@/components/DetailDrawer'
import TeamMultiSelect from './TeamMultiSelect'
import type { ApiUser, TeamOption, RoleOption, CampusOption, SchoolOption } from './types'

interface EditMemberDrawerProps {
  user: ApiUser | null
  onClose: () => void
  onSaved: () => void
  availableRoles: RoleOption[]
  availableTeams: TeamOption[]
  availableCampuses: CampusOption[]
  availableSchools: SchoolOption[]
  rolesLoading: boolean
  getAuthHeaders: () => Record<string, string>
}

export default function EditMemberDrawer({
  user,
  onClose,
  onSaved,
  availableRoles,
  availableTeams,
  availableCampuses,
  availableSchools,
  rolesLoading,
  getAuthHeaders,
}: EditMemberDrawerProps) {
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    jobTitle: '',
    status: 'ACTIVE',
    roleId: '',
    campusId: '',
    schoolId: '',
    teamIds: [] as string[],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Sync form when user changes
  const prevUserId = useState<string | null>(null)
  if (user && user.id !== prevUserId[0]) {
    prevUserId[1](user.id)
    setEditForm({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      jobTitle: user.jobTitle || '',
      status: user.status,
      roleId: user.userRole?.id || '',
      campusId: user.campusId || '',
      schoolId: user.schoolId || '',
      teamIds: user.teams.map((t) => t.team.id),
    })
    setError('')
  }
  if (!user && prevUserId[0] !== null) {
    prevUserId[1](null)
  }

  const handleClose = useCallback(() => {
    if (saving) return
    onClose()
    setError('')
  }, [saving, onClose])

  const handleSubmit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/settings/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          firstName: editForm.firstName.trim() || null,
          lastName: editForm.lastName.trim() || null,
          jobTitle: editForm.jobTitle.trim() || null,
          status: editForm.status,
          ...(editForm.roleId ? { roleId: editForm.roleId } : {}),
          campusId: editForm.campusId || null,
          schoolId: editForm.schoolId || null,
          teamIds: editForm.teamIds,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to update member')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update member')
    } finally {
      setSaving(false)
    }
  }, [user, editForm, getAuthHeaders, onSaved])

  return (
    <DetailDrawer
      isOpen={user !== null}
      onClose={handleClose}
      title={user
        ? `Edit ${[user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || user.email}`
        : 'Edit Member'}
      width="lg"
      footer={
        <div className="space-y-3">
          <button
            type="submit"
            form="edit-member-form"
            className="w-full py-3.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={saving}
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
      <form id="edit-member-form" onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="space-y-5">
          <p className="text-sm text-slate-500">Update how this member appears across the platform.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FloatingInput
              id="edit-firstName"
              label="First name"
              value={editForm.firstName}
              onChange={(e) => setEditForm((p) => ({ ...p, firstName: e.target.value }))}
              disabled={saving}
              autoFocus
            />
            <FloatingInput
              id="edit-lastName"
              label="Last name"
              value={editForm.lastName}
              onChange={(e) => setEditForm((p) => ({ ...p, lastName: e.target.value }))}
              disabled={saving}
            />
          </div>

          <FloatingInput
            id="edit-jobTitle"
            label="Job title (optional)"
            value={editForm.jobTitle}
            onChange={(e) => setEditForm((p) => ({ ...p, jobTitle: e.target.value }))}
            disabled={saving}
          />
        </section>

        <section className="space-y-5">
          <p className="text-sm text-slate-500">Control this member&apos;s role and account status.</p>

          {rolesLoading ? (
            <div className="h-12 rounded-lg border border-slate-200 bg-slate-50 animate-pulse" />
          ) : (
            <FloatingDropdown
              id="edit-roleId"
              label="Role"
              value={editForm.roleId}
              onChange={(v) => setEditForm((p) => ({ ...p, roleId: v }))}
              disabled={saving}
              options={[
                { value: '', label: 'No role assigned' },
                ...availableRoles.map((role) => ({ value: role.id, label: role.name })),
              ]}
            />
          )}

          {availableSchools.length > 0 && (
            <FloatingDropdown
              id="edit-schoolId"
              label="School"
              value={editForm.schoolId}
              onChange={(v) => setEditForm((p) => ({ ...p, schoolId: v }))}
              disabled={saving}
              options={[
                { value: '', label: 'No school assigned' },
                ...availableSchools.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          )}

          {availableCampuses.length > 0 && (
            <FloatingDropdown
              id="edit-campusId"
              label="Campus"
              value={editForm.campusId}
              onChange={(v) => setEditForm((p) => ({ ...p, campusId: v }))}
              disabled={saving}
              options={[
                { value: '', label: 'District / All Campuses' },
                ...availableCampuses.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          )}

          <FloatingDropdown
            id="edit-status"
            label="Status"
            value={editForm.status}
            onChange={(v) => setEditForm((p) => ({ ...p, status: v }))}
            disabled={saving}
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'PENDING', label: 'Pending' },
              { value: 'INACTIVE', label: 'Inactive' },
              { value: 'SUSPENDED', label: 'Suspended' },
            ]}
          />

          <div>
            <label htmlFor="edit-teamIds" className="block text-xs text-slate-500 font-medium mb-1.5">Teams</label>
            {rolesLoading ? (
              <div className="h-12 rounded-lg border border-slate-200 bg-slate-50 animate-pulse" />
            ) : availableTeams.length === 0 ? (
              <p className="text-sm text-slate-400">No teams available</p>
            ) : (
              <TeamMultiSelect
                teams={availableTeams}
                selectedIds={editForm.teamIds}
                onChange={(ids) => setEditForm((p) => ({ ...p, teamIds: ids }))}
                disabled={saving}
              />
            )}
          </div>
        </section>
      </form>
    </DetailDrawer>
  )
}
