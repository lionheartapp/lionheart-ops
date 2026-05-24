'use client'

import { useState, useCallback, useEffect, type FormEvent } from 'react'
import { RefreshCw } from 'lucide-react'
import { FloatingInput, FloatingDropdown } from '@/components/ui/FloatingInput'
import DetailDrawer from '@/components/DetailDrawer'
import TeamMultiSelect from './TeamMultiSelect'
import { handleAuthResponse } from '@/lib/client-auth'
import type { RoleOption, TeamOption, CampusOption, SchoolOption } from './types'

interface InviteMemberDrawerProps {
  isOpen: boolean
  onClose: () => void
  onInvited: () => void
  availableRoles: RoleOption[]
  availableTeams: TeamOption[]
  availableCampuses: CampusOption[]
  availableSchools: SchoolOption[]
  rolesLoading: boolean
  getAuthHeaders: () => Record<string, string>
}

const EMPTY_FORM = {
  email: '',
  firstName: '',
  lastName: '',
  jobTitle: '',
  roleId: '',
  schoolId: '',
  campusId: '',
  teamIds: [] as string[],
}

export default function InviteMemberDrawer({
  isOpen,
  onClose,
  onInvited,
  availableRoles,
  availableTeams,
  availableCampuses,
  availableSchools,
  rolesLoading,
  getAuthHeaders,
}: InviteMemberDrawerProps) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Auto-default school when there's only one
  useEffect(() => {
    if (availableSchools.length === 1 && !form.schoolId) {
      setForm((p) => ({ ...p, schoolId: availableSchools[0].id }))
    }
  }, [availableSchools, form.schoolId])

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM)
    setError('')
  }, [])

  const handleClose = useCallback(() => {
    onClose()
    resetForm()
  }, [onClose, resetForm])

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!form.email.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/settings/users', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          firstName: form.firstName.trim() || undefined,
          lastName: form.lastName.trim() || undefined,
          jobTitle: form.jobTitle.trim() || undefined,
          roleId: form.roleId || undefined,
          schoolId: form.schoolId || undefined,
          campusId: form.campusId || undefined,
          teamIds: form.teamIds.length > 0 ? form.teamIds : undefined,
        }),
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data?.error?.message || 'Failed to invite user')
      }
      onInvited()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite user')
    } finally {
      setSaving(false)
    }
  }, [form, getAuthHeaders, onInvited, handleClose])

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={handleClose}
      title="Invite Member"
      width="lg"
      footer={
        <div className="space-y-3">
          <button
            type="submit"
            form="invite-member-form"
            disabled={saving || !form.email.trim()}
            className="w-full py-3.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
            Send Invite
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="w-full text-sm text-slate-500 hover:text-slate-700 transition py-1"
          >
            Cancel
          </button>
        </div>
      }
    >
      <form id="invite-member-form" onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="space-y-5">
          <p className="text-sm text-slate-500">Set up how this member appears across the platform.</p>

          <FloatingInput
            id="invite-email"
            label="Email address"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FloatingInput
              id="invite-firstName"
              label="First name"
              value={form.firstName}
              onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
            />
            <FloatingInput
              id="invite-lastName"
              label="Last name"
              value={form.lastName}
              onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
            />
          </div>

          <FloatingInput
            id="invite-jobTitle"
            label="Job title (optional)"
            value={form.jobTitle}
            onChange={(e) => setForm((p) => ({ ...p, jobTitle: e.target.value }))}
          />
        </section>

        <section className="space-y-5">
          <p className="text-sm text-slate-500">Control this member&apos;s role and account status.</p>

          {rolesLoading ? (
            <div className="h-12 rounded-lg border border-slate-200 bg-slate-50 animate-pulse" />
          ) : (
            <FloatingDropdown
              id="invite-roleId"
              label="Role"
              value={form.roleId}
              onChange={(v) => setForm((p) => ({ ...p, roleId: v }))}
              options={[
                { value: '', label: 'Default role' },
                ...availableRoles.map((r) => ({ value: r.id, label: r.name })),
              ]}
            />
          )}

          {availableSchools.length > 0 && (
            <FloatingDropdown
              id="invite-schoolId"
              label="School"
              value={form.schoolId}
              onChange={(v) => setForm((p) => ({ ...p, schoolId: v }))}
              options={[
                { value: '', label: 'No school assigned' },
                ...availableSchools.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          )}

          {availableCampuses.length > 0 && (
            <FloatingDropdown
              id="invite-campusId"
              label="Campus"
              value={form.campusId}
              onChange={(v) => setForm((p) => ({ ...p, campusId: v }))}
              options={[
                { value: '', label: 'District / All Campuses' },
                ...availableCampuses.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          )}

          <div>
            <label htmlFor="invite-teamIds" className="block text-xs text-slate-500 font-medium mb-1.5">Teams</label>
            {rolesLoading ? (
              <div className="h-12 rounded-lg border border-slate-200 bg-slate-50 animate-pulse" />
            ) : availableTeams.length === 0 ? (
              <p className="text-sm text-slate-400">No teams available</p>
            ) : (
              <TeamMultiSelect
                teams={availableTeams}
                selectedIds={form.teamIds}
                onChange={(ids) => setForm((p) => ({ ...p, teamIds: ids }))}
              />
            )}
          </div>
        </section>
      </form>
    </DetailDrawer>
  )
}
