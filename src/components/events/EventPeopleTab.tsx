'use client'

import { useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Users, Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { fadeInUp } from '@/lib/animations'
import {
  useEventTeam,
  useAddTeamMembersBatch,
  useUpdateTeamMember,
  useRemoveTeamMember,
} from '@/lib/hooks/useEventTeam'
import type { EventTeamMember } from '@/lib/hooks/useEventTeam'
import { PRESET_TEAM_ROLES, EVENT_MEMBER_PERMISSION_KEYS } from '@/lib/types/event-project'
import ConfirmDialog from '@/components/ConfirmDialog'
import { getUserName, getInitials } from './people/people-types'
import { EventInvitationsSection } from './EventInvitationsSection'
import { useAuth } from '@/lib/hooks/useAuth'
import { TeamSkeleton } from './people/TeamSkeleton'
import { AddMembersDrawer } from './people/AddMembersDrawer'
import { EditRoleDrawer } from './people/EditRoleDrawer'

interface EventPeopleTabProps {
  eventProjectId: string
  createdById?: string
}

export function EventPeopleTab({ eventProjectId, createdById }: EventPeopleTabProps) {
  const { user } = useAuth()
  const { data: members, isLoading } = useEventTeam(eventProjectId)
  const batchAdd = useAddTeamMembersBatch(eventProjectId)
  const updateMutation = useUpdateTeamMember(eventProjectId)
  const removeMutation = useRemoveTeamMember(eventProjectId)

  const [showAddDrawer, setShowAddDrawer] = useState(false)
  const [editingMember, setEditingMember] = useState<EventTeamMember | null>(null)
  const [removingMember, setRemovingMember] = useState<EventTeamMember | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  // Collect custom roles already used on this event (for role chip suggestions)
  const eventCustomRoles = useMemo(() => {
    if (!members) return []
    const presetSet = new Set<string>(PRESET_TEAM_ROLES)
    const customs = new Set<string>()
    for (const m of members) {
      if (!presetSet.has(m.role)) customs.add(m.role)
    }
    return Array.from(customs).sort()
  }, [members])

  const handleRemoveConfirm = useCallback(() => {
    if (!removingMember) return
    removeMutation.mutate(removingMember.id, {
      onSuccess: () => setRemovingMember(null),
    })
  }, [removingMember, removeMutation])

  // Sort: pin event creator to top, rest by createdAt ascending
  const sorted = useMemo(() => {
    const raw = members ?? []
    if (!createdById) return raw
    return [...raw].sort((a, b) => {
      const aIsOwner = a.userId === createdById ? 1 : 0
      const bIsOwner = b.userId === createdById ? 1 : 0
      if (aIsOwner !== bIsOwner) return bIsOwner - aIsOwner
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
  }, [members, createdById])

  const teamMembers = sorted

  // Progressive disclosure — show first 50 items, expand on demand
  const INITIAL_DISPLAY_LIMIT = 50
  const [showAll, setShowAll] = useState(false)
  const visibleMembers = showAll ? teamMembers : teamMembers.slice(0, INITIAL_DISPLAY_LIMIT)
  const hasMore = teamMembers.length > INITIAL_DISPLAY_LIMIT

  if (isLoading) return <TeamSkeleton />

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Team Members {teamMembers.length > 0 && `(${teamMembers.length})`}
            </h3>
            <p className="text-xs text-slate-500">Staff assigned to this event</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddDrawer(true)}
          className="px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all duration-200 flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Members
        </button>
      </div>

      {/* Invited People (RSVP) */}
      {user?.id && (
        <div className="mb-6">
          <EventInvitationsSection
            eventProjectId={eventProjectId}
            currentUserId={user.id}
          />
        </div>
      )}

      {/* Empty State */}
      {teamMembers.length === 0 ? (
        <motion.div variants={fadeInUp} className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7 text-blue-500" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-2">No team members yet</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-4">
            Add coordinators, volunteers, and staff to organize your event team.
          </p>
          <button
            onClick={() => setShowAddDrawer(true)}
            className="px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all duration-200 cursor-pointer"
          >
            Add First Member
          </button>
        </motion.div>
      ) : (
        /* Table */
        <div className="ui-glass-table">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Member</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Notes</th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleMembers.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50/50 transition-colors duration-150">
                  {/* Member */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {member.user.avatar ? (
                        <img
                          src={member.user.avatar}
                          alt={getUserName(member.user)}
                          className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                          {getInitials(member.user)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-900 truncate">{getUserName(member.user)}</p>
                          {createdById && member.userId === createdById && (
                            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full flex-shrink-0">Owner</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate">
                          {member.user.jobTitle ? `${member.user.jobTitle} · ` : ''}{member.user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  {/* Role */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
                        {member.role}
                      </span>
                      {(() => {
                        const isOwner = createdById && member.userId === createdById
                        if (isOwner) return null
                        const permCount = EVENT_MEMBER_PERMISSION_KEYS.filter(k => member[k]).length
                        return permCount > 0 ? (
                          <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                            {permCount} perm{permCount !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-full">
                            Viewer
                          </span>
                        )
                      })()}
                    </div>
                  </td>
                  {/* Notes */}
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {member.notes ? (
                      <p className="text-xs text-slate-500 line-clamp-1 max-w-xs">{member.notes}</p>
                    ) : (
                      <span className="text-xs text-slate-300">&mdash;</span>
                    )}
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === member.id ? null : member.id)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors duration-200 cursor-pointer"
                      >
                        <MoreHorizontal className="w-4 h-4 text-slate-400" />
                      </button>
                      {openMenuId === member.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute right-0 top-8 z-20 ui-glass-dropdown py-1 min-w-[140px]">
                            <button
                              onClick={() => { setEditingMember(member); setOpenMenuId(null) }}
                              className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Edit Member
                            </button>
                            <button
                              onClick={() => { setRemovingMember(member); setOpenMenuId(null) }}
                              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Remove
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasMore && !showAll && (
            <div className="px-4 py-3 border-t border-gray-100 text-center">
              <button
                onClick={() => setShowAll(true)}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors duration-200 cursor-pointer"
              >
                Show all ({teamMembers.length})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add Members Drawer */}
      <AddMembersDrawer
        isOpen={showAddDrawer}
        onClose={() => setShowAddDrawer(false)}
        existingUserIds={teamMembers.map((m) => m.userId)}
        eventCustomRoles={eventCustomRoles}
        onSubmit={(staged) => {
          const items = staged.map((s) => ({
            userId: s.user.id,
            role: s.role,
            notes: s.notes.trim() || undefined,
          }))
          batchAdd.mutate(items, {
            onSettled: () => setShowAddDrawer(false),
          })
        }}
        isSubmitting={batchAdd.isPending}
      />

      {/* Edit Member Drawer */}
      {editingMember && (
        <EditRoleDrawer
          isOpen={!!editingMember}
          onClose={() => setEditingMember(null)}
          member={editingMember}
          eventCustomRoles={eventCustomRoles}
          isOwner={!!createdById && editingMember.userId === createdById}
          onSave={(data) => {
            updateMutation.mutate(
              { memberId: editingMember.id, ...data },
              { onSuccess: () => setEditingMember(null) },
            )
          }}
          isSubmitting={updateMutation.isPending}
        />
      )}

      {/* Remove Confirmation */}
      <ConfirmDialog
        isOpen={!!removingMember}
        onClose={() => setRemovingMember(null)}
        onConfirm={handleRemoveConfirm}
        title="Remove Team Member"
        message={`Remove ${removingMember ? getUserName(removingMember.user) : ''} from the event team? They won't be notified.`}
        confirmText="Remove"
        variant="danger"
        isLoading={removeMutation.isPending}
      />
    </motion.div>
  )
}
