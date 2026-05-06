'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { EVENT_MEMBER_PERMISSION_KEYS, EVENT_MEMBER_PERMISSION_META } from '@/lib/types/event-project'
import type { EventMemberPermissionKey, UpdateEventTeamMemberInput } from '@/lib/types/event-project'
import type { EventTeamMember } from '@/lib/hooks/useEventTeam'
import { Textarea } from '@/components/ui/Textarea'
import DetailDrawer from '@/components/DetailDrawer'
import { getUserName } from './people-types'
import { RolePicker } from './RolePicker'

interface EditRoleDrawerProps {
  isOpen: boolean
  onClose: () => void
  member: EventTeamMember
  eventCustomRoles: string[]
  onSave: (data: UpdateEventTeamMemberInput) => void
  isSubmitting: boolean
  isOwner?: boolean
}

export function EditRoleDrawer({ isOpen, onClose, member, eventCustomRoles, onSave, isSubmitting, isOwner }: EditRoleDrawerProps) {
  const [role, setRole] = useState(member.role)
  const [notes, setNotes] = useState(member.notes ?? '')
  const [permissions, setPermissions] = useState<Record<EventMemberPermissionKey, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const key of EVENT_MEMBER_PERMISSION_KEYS) {
      initial[key] = member[key] ?? false
    }
    return initial as Record<EventMemberPermissionKey, boolean>
  })

  const canSave = role.trim().length > 0 && !isSubmitting

  const togglePermission = (key: EventMemberPermissionKey) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleAll = (on: boolean) => {
    const updated: Record<string, boolean> = {}
    for (const key of EVENT_MEMBER_PERMISSION_KEYS) updated[key] = on
    setPermissions(updated as Record<EventMemberPermissionKey, boolean>)
  }

  const allOn = EVENT_MEMBER_PERMISSION_KEYS.every((k) => permissions[k])
  const allOff = EVENT_MEMBER_PERMISSION_KEYS.every((k) => !permissions[k])

  const handleSubmit = () => {
    if (!canSave) return
    onSave({
      role: role.trim(),
      notes: notes.trim() || null,
      ...permissions,
    })
  }

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Member \u2014 ${getUserName(member.user)}`}
      footer={
        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-full bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-all duration-200 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSave}
            className="px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <RolePicker
          value={role}
          onChange={setRole}
          eventCustomRoles={eventCustomRoles}
        />

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Notes <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any specific responsibilities or notes..."
            rows={3}
            maxLength={500}
          />
        </div>

        {/* Event Permissions */}
        {!isOwner && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">Event Permissions</label>
                <p className="text-xs text-slate-400 mt-0.5">Default is viewer (read-only). Toggle on what they need.</p>
              </div>
              <button
                type="button"
                onClick={() => toggleAll(allOn ? false : true)}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer transition-colors"
              >
                {allOn ? 'Clear all' : 'Select all'}
              </button>
            </div>
            <div className="space-y-1">
              {EVENT_MEMBER_PERMISSION_KEYS.map((key) => {
                const meta = EVENT_MEMBER_PERMISSION_META[key]
                const isOn = permissions[key]
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => togglePermission(key)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                      isOn
                        ? 'border-blue-200 bg-blue-50/60'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${
                      isOn ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'
                    }`}>
                      {isOn && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-slate-900">{meta.label}</p>
                      <p className="text-xs text-slate-400">{meta.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
            {allOff && (
              <p className="text-xs text-slate-400 mt-2 px-1">
                This member can view the event overview, schedule, and their assigned tasks.
              </p>
            )}
          </div>
        )}
      </div>
    </DetailDrawer>
  )
}
