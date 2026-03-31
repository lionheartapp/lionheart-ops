'use client'

import { useState, useCallback, type FormEvent } from 'react'
import { RefreshCw } from 'lucide-react'
import { FloatingInput, FloatingDropdown } from '@/components/ui/FloatingInput'
import DetailDrawer from '@/components/DetailDrawer'
import { handleAuthResponse } from '@/lib/client-auth'
import type { RoleOption } from './types'

interface InviteMemberDrawerProps {
  isOpen: boolean
  onClose: () => void
  onInvited: () => void
  availableRoles: RoleOption[]
  rolesLoading: boolean
  getAuthHeaders: () => Record<string, string>
}

export default function InviteMemberDrawer({
  isOpen,
  onClose,
  onInvited,
  availableRoles,
  rolesLoading,
  getAuthHeaders,
}: InviteMemberDrawerProps) {
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', roleId: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const resetForm = useCallback(() => {
    setForm({ email: '', firstName: '', lastName: '', roleId: '' })
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
          roleId: form.roleId || undefined,
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
      width="md"
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
      <form id="invite-member-form" onSubmit={handleSubmit} className="space-y-5">
        <FloatingInput
          id="invite-email"
          label="Email address"
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          autoFocus
        />
        <div className="grid grid-cols-2 gap-4">
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
        <FloatingDropdown
          id="invite-roleId"
          label="Role"
          value={form.roleId}
          onChange={(v) => setForm((p) => ({ ...p, roleId: v }))}
          options={
            rolesLoading
              ? [{ value: '', label: 'Loading roles...' }]
              : [
                  { value: '', label: 'Default role' },
                  ...availableRoles.map((r) => ({ value: r.id, label: r.name })),
                ]
          }
          disabled={rolesLoading}
        />

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>
    </DetailDrawer>
  )
}
