'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Plus, MoreHorizontal, Search, Pencil, Trash2, X, Check, ChevronDown } from 'lucide-react'
import { fadeInUp, staggerContainer, listItem } from '@/lib/animations'
import {
  useEventTeam,
  useAddTeamMembersBatch,
  useUpdateTeamMember,
  useRemoveTeamMember,
} from '@/lib/hooks/useEventTeam'
import type { EventTeamMember } from '@/lib/hooks/useEventTeam'
import { PRESET_TEAM_ROLES, EVENT_MEMBER_PERMISSION_KEYS, EVENT_MEMBER_PERMISSION_META } from '@/lib/types/event-project'
import type { EventMemberPermissionKey } from '@/lib/types/event-project'
import DetailDrawer from '@/components/DetailDrawer'
import ConfirmDialog from '@/components/ConfirmDialog'
import { fetchApi } from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'

interface EventPeopleTabProps {
  eventProjectId: string
  createdById?: string
}

// ─── User Search Types ──────────────────────────────────────────────────────

interface OrgUser {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  avatar: string | null
  jobTitle: string | null
}

/** A staged member to add (lives only in drawer state). */
interface StagedMember {
  user: OrgUser
  role: string
  notes: string
}

function getUserName(user: { firstName: string | null; lastName: string | null }): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unnamed'
}

function getInitials(user: { firstName: string | null; lastName: string | null }): string {
  const first = user.firstName?.charAt(0) ?? ''
  const last = user.lastName?.charAt(0) ?? ''
  return (first + last).toUpperCase() || '?'
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function EventPeopleTab({ eventProjectId, createdById }: EventPeopleTabProps) {
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
              {teamMembers.map((member) => (
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
              { memberId: editingMember.id, ...data } as any,
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

// ─── Skeleton ───────────────────────────────────────────────────────────────

function TeamSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 animate-pulse" />
          <div>
            <div className="w-32 h-4 bg-slate-100 animate-pulse rounded" />
            <div className="w-48 h-3 bg-slate-100 animate-pulse rounded mt-1" />
          </div>
        </div>
        <div className="w-32 h-10 bg-slate-100 animate-pulse rounded-full" />
      </div>
      <div className="ui-glass-table">
        <div className="px-4 py-3 border-b border-gray-200 flex gap-8">
          <div className="w-40 h-3 bg-slate-100 animate-pulse rounded" />
          <div className="w-16 h-3 bg-slate-100 animate-pulse rounded" />
          <div className="w-20 h-3 bg-slate-100 animate-pulse rounded hidden sm:block" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-3 border-b border-gray-50">
            <div className="w-9 h-9 rounded-full bg-slate-100 animate-pulse flex-shrink-0" />
            <div className="flex-1">
              <div className="w-28 h-4 bg-slate-100 animate-pulse rounded" />
              <div className="w-40 h-3 bg-slate-100 animate-pulse rounded mt-1" />
            </div>
            <div className="w-20 h-5 bg-slate-100 animate-pulse rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Role Picker (shared between Add + Edit drawers) ────────────────────────

interface RolePickerProps {
  value: string
  onChange: (role: string) => void
  eventCustomRoles: string[]
}

function RolePicker({ value, onChange, eventCustomRoles }: RolePickerProps) {
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customText, setCustomText] = useState('')
  const allPresets = PRESET_TEAM_ROLES as readonly string[]
  const isPreset = allPresets.includes(value) || eventCustomRoles.includes(value)

  // On mount, if current value is not a preset/event-custom, show custom input
  useEffect(() => {
    if (value && !allPresets.includes(value) && !eventCustomRoles.includes(value)) {
      setShowCustomInput(true)
      setCustomText(value)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCustomConfirm = () => {
    const trimmed = customText.trim()
    if (trimmed) {
      onChange(trimmed)
      setShowCustomInput(false)
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">Role</label>
      <div className="flex flex-wrap gap-2">
        {PRESET_TEAM_ROLES.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => { onChange(preset); setShowCustomInput(false) }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer ${
              !showCustomInput && value === preset
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {preset}
          </button>
        ))}
        {/* Event-specific custom roles as chips */}
        {eventCustomRoles.map((cr) => (
          <button
            key={cr}
            type="button"
            onClick={() => { onChange(cr); setShowCustomInput(false) }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer border border-dashed ${
              !showCustomInput && value === cr
                ? 'bg-blue-600 text-white border-transparent'
                : 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50'
            }`}
          >
            {cr}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setShowCustomInput(true)
            setCustomText('')
            onChange('')
          }}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer ${
            showCustomInput
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          + Custom
        </button>
      </div>
      {showCustomInput && (
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCustomConfirm() } }}
            placeholder="Enter custom role..."
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none transition-all"
            maxLength={100}
            autoFocus
          />
          <button
            type="button"
            onClick={handleCustomConfirm}
            disabled={!customText.trim()}
            className="px-3 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <Check className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── User Search Dropdown ───────────────────────────────────────────────────

interface UserSearchDropdownProps {
  excludeIds: Set<string>
  onSelect: (user: OrgUser) => void
  placeholder?: string
}

function UserSearchDropdown({ excludeIds, onSelect, placeholder }: UserSearchDropdownProps) {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (value: string) => {
    setSearch(value)
    setIsOpen(true)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setDebouncedSearch(value), 300)
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch users — empty search returns all, typed search filters server-side
  const { data: searchResults, isLoading: isSearching } = useQuery<OrgUser[]>({
    queryKey: ['user-search-dropdown', debouncedSearch],
    queryFn: async () => {
      const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''
      const res = await fetchApi<{ data: OrgUser[]; total: number }>(
        `/api/settings/users?limit=20${searchParam}`,
      )
      return Array.isArray(res) ? res : res.data ?? []
    },
    enabled: isOpen,
    staleTime: 30_000,
  })

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          placeholder={placeholder ?? 'Search by name or email...'}
          className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none transition-all"
        />
        <button
          onClick={() => {
            if (search) { setSearch(''); setDebouncedSearch('') }
            setIsOpen(!isOpen)
            if (!isOpen) inputRef.current?.focus()
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-slate-100 cursor-pointer"
        >
          {search ? (
            <X className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          )}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-30 left-0 right-0 mt-1 max-h-52 overflow-y-auto ui-glass-dropdown divide-y divide-gray-100"
          >
            {isSearching ? (
              <div className="px-4 py-3 text-sm text-slate-400">Searching...</div>
            ) : searchResults && searchResults.length > 0 ? (
              searchResults.map((user) => {
                const isExcluded = excludeIds.has(user.id)
                return (
                  <button
                    key={user.id}
                    onClick={() => {
                      if (!isExcluded) {
                        onSelect(user)
                        setSearch('')
                        setDebouncedSearch('')
                        setIsOpen(false)
                      }
                    }}
                    disabled={isExcluded}
                    className={`w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors ${
                      isExcluded
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    {user.avatar ? (
                      <img src={user.avatar} alt={getUserName(user)} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-semibold">
                        {getInitials(user)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{getUserName(user)}</p>
                      <p className="text-xs text-slate-400 truncate">{user.email}</p>
                    </div>
                    {isExcluded && (
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full flex-shrink-0">Added</span>
                    )}
                  </button>
                )
              })
            ) : (
              <div className="px-4 py-3 text-sm text-slate-400">No users found</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Add Members Drawer (multi-add) ─────────────────────────────────────────

interface AddMembersDrawerProps {
  isOpen: boolean
  onClose: () => void
  existingUserIds: string[]
  eventCustomRoles: string[]
  onSubmit: (staged: StagedMember[]) => void
  isSubmitting: boolean
}

function AddMembersDrawer({
  isOpen,
  onClose,
  existingUserIds,
  eventCustomRoles,
  onSubmit,
  isSubmitting,
}: AddMembersDrawerProps) {
  const [staged, setStaged] = useState<StagedMember[]>([])
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  // IDs that are already on the team OR staged in this session
  const excludeIds = useMemo(() => {
    const set = new Set(existingUserIds)
    for (const s of staged) set.add(s.user.id)
    return set
  }, [existingUserIds, staged])

  // Collect custom roles from staged members + existing event customs
  const allCustomRoles = useMemo(() => {
    const presetSet = new Set<string>(PRESET_TEAM_ROLES)
    const customs = new Set(eventCustomRoles)
    for (const s of staged) {
      if (s.role && !presetSet.has(s.role)) customs.add(s.role)
    }
    return Array.from(customs).sort()
  }, [eventCustomRoles, staged])

  const handleAddUser = (user: OrgUser) => {
    const newMember: StagedMember = { user, role: '', notes: '' }
    setStaged((prev) => [...prev, newMember])
    setExpandedIdx(staged.length) // expand the newly added one
  }

  const handleRemoveStaged = (idx: number) => {
    setStaged((prev) => prev.filter((_, i) => i !== idx))
    setExpandedIdx(null)
  }

  const handleUpdateStaged = (idx: number, updates: Partial<StagedMember>) => {
    setStaged((prev) => prev.map((s, i) => (i === idx ? { ...s, ...updates } : s)))
  }

  const allHaveRoles = staged.length > 0 && staged.every((s) => s.role.trim().length > 0)

  const handleSubmit = () => {
    if (!allHaveRoles || isSubmitting) return
    onSubmit(staged)
  }

  const handleClose = useCallback(() => {
    setStaged([])
    setExpandedIdx(null)
    onClose()
  }, [onClose])

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Team Members"
      width="lg"
      footer={
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">
            {staged.length === 0
              ? 'Search to add members'
              : `${staged.length} member${staged.length === 1 ? '' : 's'} staged`}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="px-5 py-2.5 rounded-full bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-all duration-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!allHaveRoles || isSubmitting}
              className="px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting
                ? 'Adding...'
                : `Add ${staged.length || ''} Member${staged.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* User search dropdown */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Search for members to add
          </label>
          <UserSearchDropdown
            excludeIds={excludeIds}
            onSelect={handleAddUser}
          />
        </div>

        {/* Staged members list */}
        {staged.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">
              Members to add ({staged.length})
            </p>
            <AnimatePresence initial={false}>
              {staged.map((s, idx) => (
                <motion.div
                  key={s.user.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border border-gray-200 rounded-xl overflow-hidden"
                >
                  {/* Collapsed row */}
                  <div
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                  >
                    {s.user.avatar ? (
                      <img src={s.user.avatar} alt={getUserName(s.user)} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">
                        {getInitials(s.user)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{getUserName(s.user)}</p>
                      {s.role ? (
                        <span className="text-xs text-blue-600">{s.role}</span>
                      ) : (
                        <span className="text-xs text-amber-600">Select a role</span>
                      )}
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                        expandedIdx === idx ? 'rotate-180' : ''
                      }`}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveStaged(idx) }}
                      className="p-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4 text-slate-400 hover:text-red-500" />
                    </button>
                  </div>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {expandedIdx === idx && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-gray-100 px-3 py-3 space-y-3 bg-slate-50/50"
                      >
                        <RolePicker
                          value={s.role}
                          onChange={(role) => handleUpdateStaged(idx, { role })}
                          eventCustomRoles={allCustomRoles}
                        />
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Notes <span className="text-slate-400 font-normal">(optional)</span>
                          </label>
                          <textarea
                            value={s.notes}
                            onChange={(e) => handleUpdateStaged(idx, { notes: e.target.value })}
                            placeholder="Responsibilities, notes..."
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none transition-all resize-none"
                            maxLength={500}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </DetailDrawer>
  )
}

// ─── Edit Role Drawer ───────────────────────────────────────────────────────

interface EditRoleDrawerProps {
  isOpen: boolean
  onClose: () => void
  member: EventTeamMember
  eventCustomRoles: string[]
  onSave: (data: Record<string, unknown>) => void
  isSubmitting: boolean
  isOwner?: boolean
}

function EditRoleDrawer({ isOpen, onClose, member, eventCustomRoles, onSave, isSubmitting, isOwner }: EditRoleDrawerProps) {
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
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any specific responsibilities or notes..."
            rows={3}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none transition-all resize-none"
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
