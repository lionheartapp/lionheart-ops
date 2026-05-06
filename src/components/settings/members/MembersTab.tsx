'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCw, UserCog, Download } from 'lucide-react'
import { handleAuthResponse } from '@/lib/client-auth'
import { logger } from '@/lib/logger'
import { useToast } from '@/components/Toast'
import { queryOptions, queryKeys } from '@/lib/queries'
import { useActiveSchool } from '@/lib/hooks/useActiveSchool'
import ConfirmDialog from '@/components/ConfirmDialog'
import MemberListTable from './MemberListTable'
import EditMemberDrawer from './EditMemberDrawer'
import InviteMemberDrawer from './InviteMemberDrawer'
import MemberPermissionsDrawer from './MemberPermissionsDrawer'
import type { ApiUser, TeamOption, RoleOption, CampusOption, SchoolOption } from './types'

type MembersTabProps = { onDirtyChange?: (isDirty: boolean) => void }

const STATUS_TABS = [
  { label: 'All users', value: 'all' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Inactive', value: 'INACTIVE' },
]

// F-002: stable empty-array references. The previous `data ?? []` pattern
// returned a new array on every render before the query resolved, churning
// downstream useMemo/useEffect deps and triggering "Maximum update depth
// exceeded" loops. See TeamsTab for the canonical writeup.
const EMPTY_USERS: readonly ApiUser[] = []
const EMPTY_ROLE_OPTIONS: readonly RoleOption[] = []
const EMPTY_TEAM_OPTIONS: readonly TeamOption[] = []
const EMPTY_CAMPUS_OPTIONS: readonly CampusOption[] = []
const EMPTY_SCHOOL_OPTIONS: readonly SchoolOption[] = []

const MembersTab = (_props: MembersTabProps) => {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Global "school viewpoint" — when set, narrow the list to members of that
  // school. Users without a school (district-level admins) stay visible so
  // org-wide owners aren't accidentally hidden.
  const { activeSchoolId, activeSchoolLabel } = useActiveSchool()

  // ─── Cached queries ─────────────────────────────────────────────────────
  const { data: usersData, isLoading: loading, error: usersError } = useQuery(queryOptions.members())
  const users = (usersData as ApiUser[] | undefined) ?? (EMPTY_USERS as ApiUser[])
  const error = usersError?.message ?? ''

  const { data: rolesData, isLoading: rolesLoading } = useQuery(queryOptions.roles())
  const availableRoles = (rolesData as RoleOption[] | undefined) ?? (EMPTY_ROLE_OPTIONS as RoleOption[])

  const { data: teamsData } = useQuery(queryOptions.teams())
  const availableTeams = (teamsData as TeamOption[] | undefined) ?? (EMPTY_TEAM_OPTIONS as TeamOption[])

  const { data: campusesData } = useQuery(queryOptions.campuses())
  const availableCampuses = (campusesData as CampusOption[] | undefined) ?? (EMPTY_CAMPUS_OPTIONS as CampusOption[])

  const { data: schoolsData } = useQuery(queryOptions.schools())
  const availableSchools = (schoolsData as SchoolOption[] | undefined) ?? (EMPTY_SCHOOL_OPTIONS as SchoolOption[])

  const invalidateMembers = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.members.all })
  }, [queryClient])

  const [statusTab, setStatusTab] = useState('all')
  const [search, setSearch] = useState('')

  // ─── Modal state ────────────────────────────────────────────────────────
  const [editUser, setEditUser] = useState<ApiUser | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [permUser, setPermUser] = useState<ApiUser | null>(null)
  const [userToRemove, setUserToRemove] = useState<ApiUser | null>(null)
  const [removingUserId, setRemovingUserId] = useState<string | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null

  const getAuthHeaders = useCallback(() => ({
    Authorization: `Bearer ${token}`,
    'X-Organization-ID': typeof window !== 'undefined' ? (localStorage.getItem('org-id') || '') : '',
  }), [token])

  useEffect(() => {
    const handleAvatarUpdated = () => { invalidateMembers() }
    window.addEventListener('avatar-updated', handleAvatarUpdated)
    return () => window.removeEventListener('avatar-updated', handleAvatarUpdated)
  }, [invalidateMembers])

  // ─── Toggle status ──────────────────────────────────────────────────────
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
      invalidateMembers()
      toast(`Member ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`, 'success')
    } catch (err) {
      logger.error({ error: String(err) }, 'Failed to update member status')
      toast(err instanceof Error ? err.message : 'Failed to update member status', 'error')
    }
  }, [invalidateMembers, getAuthHeaders, toast])

  // ─── Remove member ──────────────────────────────────────────────────────
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
      toast('Member removed successfully', 'success')
      setUserToRemove(null)
      invalidateMembers()
    } catch (err) {
      logger.error({ error: String(err) }, 'Failed to remove member')
      toast(err instanceof Error ? err.message : 'Failed to remove member', 'error')
      setUserToRemove(null)
    } finally {
      setRemovingUserId(null)
    }
  }

  // Status + search + school filter. School matches against either the
  // user's campusId (typical assignment) or schoolId (institution-level
  // assignment), since the active selection is one or the other depending
  // on org structure. Users with neither field set are treated as
  // district/org-wide and remain visible.
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return users.filter((u) => {
      const matchesStatus = statusTab === 'all' || u.status === statusTab
      const matchesSearch =
        !q ||
        `${u.firstName ?? ''} ${u.lastName ?? ''}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.userRole?.name ?? '').toLowerCase().includes(q)
      const matchesSchool =
        !activeSchoolId ||
        u.campusId === activeSchoolId ||
        u.schoolId === activeSchoolId ||
        (!u.campusId && !u.schoolId)
      return matchesStatus && matchesSearch && matchesSchool
    })
  }, [users, statusTab, search, activeSchoolId])

  return (
    <div className="space-y-6">
      {/* Header — full-width, flush top */}
      <div className="-mx-4 sm:-mx-8 px-4 sm:px-8 py-5 bg-white/60 backdrop-blur-sm border-b border-slate-200/60">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
              <UserCog className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Members</h3>
              <p className="text-sm text-slate-500 mt-0.5">Manage organization members</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto flex-shrink-0">
          <button
            onClick={() => {
              const params = new URLSearchParams()
              if (statusTab !== 'all') params.set('status', statusTab)
              const qs = params.toString()
              window.open(`/api/settings/export/users${qs ? `?${qs}` : ''}`, '_blank')
            }}
            className="px-4 py-2.5 rounded-full border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.97] transition-colors duration-200 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => setShowInvite(true)}
            className="bg-slate-900 text-white px-5 py-2.5 rounded-full flex items-center gap-2 hover:bg-slate-800 text-sm font-semibold transition"
          >
            <Plus className="w-4 h-4" /> Invite user
          </button>
        </div>
        </div>

        {/* Status Tabs */}
        <div className="mt-5 pt-5 border-t border-slate-200/60">
          <div className="inline-flex gap-1 rounded-full bg-slate-100 p-1">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setStatusTab(t.value)}
            className={`relative px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 cursor-pointer ${
              statusTab === t.value
                ? 'text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {statusTab === t.value && (
              <motion.div
                layoutId="memberStatusPill"
                className="absolute inset-0 rounded-full bg-slate-900"
                transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.8 }}
              />
            )}
            <span className="relative z-10">
              {t.label}
              {t.value !== 'all' && (
                <span className={`ml-1.5 text-xs transition-colors duration-200 ${
                  statusTab === t.value ? 'text-slate-300' : 'text-slate-400'
                }`}>
                  ({users.filter((u) => u.status === t.value).length})
                </span>
              )}
            </span>
          </button>
        ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={invalidateMembers}
            className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800 font-medium"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      )}

      {/* Table */}
      <div className="ui-glass-table overflow-x-auto">
        <div className="flex items-center gap-2 p-4 border-b border-slate-100">
          <input type="search"
            className="flex-1 ui-input"
            placeholder="Search by name, email or role…"
            aria-label="Search members"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <MemberListTable
          users={filtered}
          loading={loading}
          search={search}
          onEditUser={setEditUser}
          onManagePermissions={setPermUser}
          onToggleStatus={handleToggleStatus}
          onRemoveUser={setUserToRemove}
        />
      </div>

      {/* Drawers & Dialogs */}
      <EditMemberDrawer
        user={editUser}
        onClose={() => setEditUser(null)}
        onSaved={() => { setEditUser(null); invalidateMembers() }}
        availableRoles={availableRoles}
        availableTeams={availableTeams}
        availableCampuses={availableCampuses}
        availableSchools={availableSchools}
        rolesLoading={rolesLoading}
        getAuthHeaders={getAuthHeaders}
      />

      <MemberPermissionsDrawer
        user={permUser}
        onClose={() => setPermUser(null)}
        getAuthHeaders={getAuthHeaders}
      />

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

      <InviteMemberDrawer
        isOpen={showInvite}
        onClose={() => setShowInvite(false)}
        onInvited={invalidateMembers}
        availableRoles={availableRoles}
        rolesLoading={rolesLoading}
        getAuthHeaders={getAuthHeaders}
      />
    </div>
  )
}

export default MembersTab
