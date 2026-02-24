'use client'

import { useState, useEffect } from 'react'
import { Search, Plus, MoreVertical, UserCog, X, Eye, Trash2 } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'

interface Member {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  schoolScope: 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL' | 'GLOBAL'
  avatar: string | null
  jobTitle: string | null
  employmentType: string | null
  phone: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING'
  createdAt: string
  userRole: {
    id: string
    name: string
  } | null
  teamIds: string[]
}

interface Team {
  slug: string
  name: string
}

interface Role {
  id: string
  name: string
}

export default function MembersTab() {
  const [members, setMembers] = useState<Member[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [metadataLoading, setMetadataLoading] = useState(true)
  const [hasLoadedMembers, setHasLoadedMembers] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterTeam, setFilterTeam] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSchoolScope, setFilterSchoolScope] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [isSavingDrawer, setIsSavingDrawer] = useState(false)
  const [drawerError, setDrawerError] = useState('')
  const [latestSetupLink, setLatestSetupLink] = useState('')
  const [openMenuMemberId, setOpenMenuMemberId] = useState<string | null>(null)
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null)
  const [isDeletingMember, setIsDeletingMember] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    schoolScope: 'GLOBAL' as 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL' | 'GLOBAL',
    phone: '',
    jobTitle: '',
    employmentType: 'FULL_TIME',
    provisioningMode: 'ADMIN_CREATE',
    roleId: '',
    teamIds: [] as string[],
  })

  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
    const headers: Record<string, string> = {}
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
    return headers
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)

    return () => clearTimeout(timeout)
  }, [searchQuery])

  useEffect(() => {
    if (!openMenuMemberId) return

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (target.closest(`[data-member-menu-id="${openMenuMemberId}"]`)) return
      setOpenMenuMemberId(null)
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenuMemberId(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [openMenuMemberId])

  const fetchMetadata = async () => {
    try {
      const [teamsRes, rolesRes] = await Promise.all([
        fetch('/api/settings/teams', { headers: getAuthHeaders() }),
        fetch('/api/settings/roles', { headers: getAuthHeaders() }),
      ])

      if (teamsRes.ok) {
        const data = await teamsRes.json()
        setTeams(data.data || [])
      }
      if (rolesRes.ok) {
        const data = await rolesRes.json()
        setRoles(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch metadata:', error)
    } finally {
      setMetadataLoading(false)
    }
  }

  const fetchMembers = async () => {
    if (!hasLoadedMembers) {
      setLoading(true)
    }

    try {
      const params = new URLSearchParams()
      if (debouncedSearchQuery) params.append('search', debouncedSearchQuery)
      if (filterRole) params.append('roleId', filterRole)
      if (filterTeam) params.append('teamSlug', filterTeam)
      if (filterStatus) params.append('status', filterStatus)
      if (filterSchoolScope) params.append('schoolScope', filterSchoolScope)

      const membersRes = await fetch(`/api/settings/users?${params}`, { headers: getAuthHeaders() })

      if (membersRes.ok) {
        const data = await membersRes.json()
        setMembers(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch members:', error)
    } finally {
      setLoading(false)
      setHasLoadedMembers(true)
    }
  }

  useEffect(() => {
    fetchMetadata()
  }, [])

  useEffect(() => {
    fetchMembers()
  }, [filterRole, filterTeam, filterStatus, filterSchoolScope, debouncedSearchQuery])

  const openCreateModal = () => {
    setCreateError('')
    setForm({
      firstName: '',
      lastName: '',
      email: '',
      schoolScope: 'GLOBAL',
      phone: '',
      jobTitle: '',
      employmentType: 'FULL_TIME',
      provisioningMode: 'ADMIN_CREATE',
      roleId: roles[0]?.id || '',
      teamIds: [],
    })
    setIsCreateOpen(true)
  }

  const closeCreateModal = () => {
    if (!isCreating) {
      setIsCreateOpen(false)
      setCreateError('')
    }
  }

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')

    if (!form.firstName || !form.lastName || !form.email || !form.roleId) {
      setCreateError('First name, last name, email, and role are required.')
      return
    }

    setIsCreating(true)
    try {
      const res = await fetch('/api/settings/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          ...form,
          provisioningMode: 'ADMIN_CREATE',
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.ok) {
        setCreateError(data?.error?.message || 'Failed to create member')
        return
      }

      const setupLink = data?.data?.setup?.setupLink
      if (typeof setupLink === 'string' && setupLink.length > 0) {
        setLatestSetupLink(setupLink)
      }

      setIsCreateOpen(false)
      await fetchMembers()
    } catch {
      setCreateError('Failed to create member')
    } finally {
      setIsCreating(false)
    }
  }

  const openDetailsDrawer = async (memberId: string) => {
    setSelectedMemberId(memberId)
    setIsDrawerOpen(true)
    setDrawerLoading(true)
    setDrawerError('')

    try {
      const res = await fetch(`/api/settings/users/${memberId}`, { headers: getAuthHeaders() })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setDrawerError(data?.error?.message || 'Failed to load member details')
        return
      }
      setSelectedMember(data.data)
    } catch {
      setDrawerError('Failed to load member details')
    } finally {
      setDrawerLoading(false)
    }
  }

  const handleSaveDrawer = async () => {
    if (!selectedMemberId || !selectedMember) return

    setIsSavingDrawer(true)
    setDrawerError('')
    try {
      const res = await fetch(`/api/settings/users/${selectedMemberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          firstName: selectedMember.firstName,
          lastName: selectedMember.lastName,
          email: selectedMember.email,
          schoolScope: selectedMember.schoolScope,
          phone: selectedMember.phone,
          jobTitle: selectedMember.jobTitle,
          employmentType: selectedMember.employmentType,
          roleId: selectedMember.userRole?.id,
          teamIds: selectedMember.teamIds,
          status: selectedMember.status,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.ok) {
        setDrawerError(data?.error?.message || 'Failed to save member')
        return
      }

      setSelectedMember(data.data)
      await fetchMembers()
    } catch {
      setDrawerError('Failed to save member')
    } finally {
      setIsSavingDrawer(false)
    }
  }

  const closeDrawer = () => {
    if (!isSavingDrawer) {
      setIsDrawerOpen(false)
      setSelectedMemberId(null)
      setSelectedMember(null)
      setDrawerError('')
    }
  }

  const openDeleteDialog = (member: Member) => {
    setDeleteError('')
    setOpenMenuMemberId(null)
    setMemberToDelete(member)
  }

  const closeDeleteDialog = () => {
    if (!isDeletingMember) {
      setMemberToDelete(null)
      setDeleteError('')
    }
  }

  const handleDeleteMember = async () => {
    if (!memberToDelete) return

    setIsDeletingMember(true)
    setDeleteError('')

    try {
      const res = await fetch(`/api/settings/users/${memberToDelete.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      const data = await res.json().catch(() => null)

      if (!res.ok || !data?.ok) {
        setDeleteError(data?.error?.message || 'Failed to delete member')
        return
      }

      setMembers((previous) => previous.filter((member) => member.id !== memberToDelete.id))
      setMemberToDelete(null)
      setOpenMenuMemberId(null)
    } catch {
      setDeleteError('Failed to delete member')
    } finally {
      setIsDeletingMember(false)
    }
  }

  const toggleTeamInCreate = (slug: string) => {
    setForm((prev) => ({
      ...prev,
      teamIds: prev.teamIds.includes(slug)
        ? prev.teamIds.filter((teamId) => teamId !== slug)
        : [...prev.teamIds, slug],
    }))
  }

  const toggleTeamInDrawer = (slug: string) => {
    if (!selectedMember) return
    const nextTeamIds = selectedMember.teamIds.includes(slug)
      ? selectedMember.teamIds.filter((teamId) => teamId !== slug)
      : [...selectedMember.teamIds, slug]

    setSelectedMember({ ...selectedMember, teamIds: nextTeamIds })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800'
      case 'INACTIVE':
        return 'bg-orange-100 text-orange-800'
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
  }

  const formatEmploymentType = (value: string | null) => {
    if (!value) return 'Unspecified'
    return value
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase())
  }

  const formatSchoolScope = (scope: Member['schoolScope']) => {
    return scope
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase())
  }

  const getMemberTeams = (teamIds: string[]) => {
    return teamIds
      .map(slug => teams.find(t => t.slug === slug)?.name || slug)
      .join(', ')
  }

  const getInitials = (firstName: string | null, lastName: string | null) => {
    const first = firstName?.[0] || ''
    const last = lastName?.[0] || ''
    return (first + last).toUpperCase() || '?'
  }

  const getFullName = (member: Member) => {
    const fullName = `${member.firstName || ''} ${member.lastName || ''}`.trim()
    return fullName || 'Unnamed Member'
  }

  const renderMemberSkeletons = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-3xl border border-gray-200 bg-white animate-pulse">
          <div className="relative h-64 bg-gray-200">
            <div className="absolute left-4 top-4 h-8 w-20 rounded-full bg-white/70" />
            <div className="absolute right-4 top-4 h-12 w-12 rounded-full bg-white/70" />
          </div>
          <div className="space-y-4 p-5">
            <div className="h-8 w-28 rounded-full bg-gray-200" />
            <div className="space-y-3">
              <div className="h-8 w-1/2 rounded bg-gray-200" />
              <div className="h-6 w-2/3 rounded bg-gray-200" />
            </div>
            <div className="h-6 w-3/4 rounded bg-gray-200" />
            <div className="flex gap-2">
              <div className="h-7 w-24 rounded-full bg-gray-200" />
              <div className="h-7 w-24 rounded-full bg-gray-200" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Members</h2>
          <p className="text-sm text-gray-600 mt-1">Manage members</p>
        </div>
        <button
          onClick={openCreateModal}
          className="min-h-[44px] px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Member
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search members"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search members"
            className="settings-search-input h-11"
          />
        </div>
        
        <select
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
          aria-label="Filter members by team"
          className="ui-select min-h-[44px]"
        >
          <option value="">All Teams</option>
          {teams.map(team => (
            <option key={team.slug} value={team.slug}>{team.name}</option>
          ))}
        </select>

        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          aria-label="Filter members by role"
          className="ui-select min-h-[44px]"
        >
          <option value="">All Roles</option>
          {roles.map(role => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          aria-label="Filter members by status"
          className="ui-select min-h-[44px]"
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="PENDING">Pending</option>
        </select>

        <select
          value={filterSchoolScope}
          onChange={(e) => setFilterSchoolScope(e.target.value)}
          aria-label="Filter members by school scope"
          className="ui-select min-h-[44px]"
        >
          <option value="">All Scopes</option>
          <option value="ELEMENTARY">Elementary School</option>
          <option value="MIDDLE_SCHOOL">Middle School</option>
          <option value="HIGH_SCHOOL">High School</option>
          <option value="GLOBAL">Global</option>
        </select>
      </div>

      {latestSetupLink && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-900 font-medium">Welcome link generated</p>
          <p className="text-xs text-blue-800 break-all mt-1">{latestSetupLink}</p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(latestSetupLink)}
              className="min-h-[44px] px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Copy Link
            </button>
            <button
              onClick={() => setLatestSetupLink('')}
              className="min-h-[44px] px-3 py-1 text-xs border border-blue-300 text-blue-700 rounded hover:bg-blue-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {deleteError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{deleteError}</p>
        </div>
      )}

      {/* Members Grid */}
      {(loading || metadataLoading) ? (
        renderMemberSkeletons()
      ) : members.length === 0 ? (
        <div className="text-center py-12">
          <UserCog className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No members found</p>
          <button onClick={openCreateModal} className="mt-4 min-h-[44px] px-2 text-blue-600 hover:text-blue-700 font-medium">
            Add your first member
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {members.map((member) => (
            <div
              key={member.id}
              className="overflow-hidden rounded-3xl border border-gray-200 bg-white"
            >
              <div className="relative h-56 bg-gray-100 sm:h-64">
                {member.avatar ? (
                  <img
                    src={member.avatar}
                    alt={getFullName(member)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gray-200">
                    <span className="text-4xl font-semibold text-gray-600 sm:text-5xl">
                      {getInitials(member.firstName, member.lastName)}
                    </span>
                  </div>
                )}

                <div className="absolute left-4 top-4">
                  <span className={`inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium ${getStatusColor(member.status)}`}>
                    {member.status === 'ACTIVE' ? 'Active' : member.status}
                  </span>
                </div>

                <div
                  data-member-menu-id={member.id}
                  className="absolute right-4 top-4"
                  onMouseEnter={() => setOpenMenuMemberId(member.id)}
                  onMouseLeave={() => setOpenMenuMemberId((current) => (current === member.id ? null : current))}
                >
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={openMenuMemberId === member.id}
                    aria-label={`Open actions for ${getFullName(member)}`}
                    onClick={() => setOpenMenuMemberId((current) => (current === member.id ? null : member.id))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setOpenMenuMemberId((current) => (current === member.id ? null : member.id))
                      }
                    }}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-gray-600 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 sm:h-12 sm:w-12"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>

                  {openMenuMemberId === member.id && (
                    <div
                      role="menu"
                      aria-label={`Actions for ${getFullName(member)}`}
                      className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setOpenMenuMemberId(null)
                          openDetailsDrawer(member.id)
                        }}
                        className="flex min-h-[44px] w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                      >
                        <Eye className="h-4 w-4" />
                        View Details
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => openDeleteDialog(member)}
                        className="flex min-h-[44px] w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 focus:bg-red-50 focus:outline-none"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete {member.firstName || 'Member'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div>
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-4 py-1.5 text-sm font-medium text-blue-700">
                    {formatEmploymentType(member.employmentType)}
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl lg:text-4xl">
                    {getFullName(member)}
                  </h3>
                  <p className="text-base text-gray-900 break-all sm:text-lg lg:text-2xl">
                    <span className="font-semibold">Email:</span> {member.email}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                    {formatSchoolScope(member.schoolScope)}
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                    {member.jobTitle || member.userRole?.name || 'No Role'}
                  </span>
                  {member.teamIds.length > 0 && (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                      {getMemberTeams(member.teamIds).split(', ')[0]}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                  <span className="text-xs text-gray-500">Joined: {formatDate(member.createdAt)}</span>
                  <button
                    onClick={() => openDetailsDrawer(member.id)}
                    className="min-h-[44px] rounded-lg bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600"
                  >
                    Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeCreateModal} />
          <form onSubmit={handleCreateMember} className="relative bg-white w-full max-w-xl rounded-lg border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Add Member</h3>
              <button type="button" onClick={closeCreateModal} className="min-h-[44px] min-w-[44px] text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={form.firstName}
                onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
                placeholder="First name"
                aria-label="First name"
                className="h-11 px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                value={form.lastName}
                onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
                placeholder="Last name"
                aria-label="Last name"
                className="h-11 px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="Email"
              aria-label="Email"
              className="h-11 w-full px-3 py-2 border border-gray-300 rounded-lg"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="Phone (optional)"
                aria-label="Phone"
                className="h-11 px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                value={form.jobTitle}
                onChange={(e) => setForm((prev) => ({ ...prev, jobTitle: e.target.value }))}
                placeholder="Job title"
                aria-label="Job title"
                className="h-11 px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <select
              value={form.schoolScope}
              onChange={(e) => setForm((prev) => ({ ...prev, schoolScope: e.target.value as 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL' | 'GLOBAL' }))}
              aria-label="School scope"
              className="ui-select w-full min-h-[44px]"
            >
              <option value="ELEMENTARY">Elementary School</option>
              <option value="MIDDLE_SCHOOL">Middle School</option>
              <option value="HIGH_SCHOOL">High School</option>
              <option value="GLOBAL">Global</option>
            </select>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={form.roleId}
                onChange={(e) => setForm((prev) => ({ ...prev, roleId: e.target.value }))}
                aria-label="Role"
                className="ui-select min-h-[44px]"
              >
                <option value="">Select Role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>

              <select
                value={form.employmentType}
                onChange={(e) => setForm((prev) => ({ ...prev, employmentType: e.target.value }))}
                aria-label="Employment type"
                className="ui-select min-h-[44px]"
              >
                <option value="FULL_TIME">Full Time</option>
                <option value="PART_TIME">Part Time</option>
                <option value="CONTRACTOR">Contractor</option>
                <option value="INTERN">Intern</option>
                <option value="VOLUNTEER">Volunteer</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provisioning Mode</label>
              <select
                value={form.provisioningMode}
                onChange={(e) => setForm((prev) => ({ ...prev, provisioningMode: e.target.value }))}
                aria-label="Provisioning mode"
                className="ui-select w-full min-h-[44px]"
              >
                <option value="ADMIN_CREATE">Super Admin Creator (Active immediately)</option>
                <option value="INVITE_ONLY">Invite-Only / Self-Signup (Pending)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Active users can log in once password is set. Pending users need admin activation.
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Teams</p>
              <div className="grid grid-cols-2 gap-2">
                {teams.map((team) => (
                  <label key={team.slug} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.teamIds.includes(team.slug)}
                      onChange={() => toggleTeamInCreate(team.slug)}
                    />
                    {team.name}
                  </label>
                ))}
              </div>
            </div>

            {createError && <p className="text-sm text-red-600">{createError}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeCreateModal} className="min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg">Cancel</button>
              <button type="submit" disabled={isCreating} className="min-h-[44px] px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {isCreating ? 'Creating...' : 'Create Member'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isDrawerOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={closeDrawer} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white border-l border-gray-200 shadow-xl p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Member Details</h3>
              <button onClick={closeDrawer} className="min-h-[44px] min-w-[44px] text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {drawerLoading ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : !selectedMember ? (
              <p className="text-sm text-red-600">{drawerError || 'Unable to load member.'}</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={selectedMember.firstName || ''}
                    onChange={(e) => setSelectedMember({ ...selectedMember, firstName: e.target.value })}
                    placeholder="First name"
                    aria-label="First name"
                    className="h-11 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    value={selectedMember.lastName || ''}
                    onChange={(e) => setSelectedMember({ ...selectedMember, lastName: e.target.value })}
                    placeholder="Last name"
                    aria-label="Last name"
                    className="h-11 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <input
                  type="email"
                  value={selectedMember.email}
                  onChange={(e) => setSelectedMember({ ...selectedMember, email: e.target.value })}
                  placeholder="Email"
                  aria-label="Email"
                  className="h-11 w-full px-3 py-2 border border-gray-300 rounded-lg"
                />

                <input
                  value={selectedMember.phone || ''}
                  onChange={(e) => setSelectedMember({ ...selectedMember, phone: e.target.value })}
                  placeholder="Phone"
                  aria-label="Phone"
                  className="h-11 w-full px-3 py-2 border border-gray-300 rounded-lg"
                />

                <input
                  value={selectedMember.jobTitle || ''}
                  onChange={(e) => setSelectedMember({ ...selectedMember, jobTitle: e.target.value })}
                  placeholder="Job title"
                  aria-label="Job title"
                  className="h-11 w-full px-3 py-2 border border-gray-300 rounded-lg"
                />

                <select
                  value={selectedMember.schoolScope}
                  onChange={(e) => setSelectedMember({ ...selectedMember, schoolScope: e.target.value as Member['schoolScope'] })}
                  aria-label="School scope"
                  className="ui-select w-full min-h-[44px]"
                >
                  <option value="ELEMENTARY">Elementary School</option>
                  <option value="MIDDLE_SCHOOL">Middle School</option>
                  <option value="HIGH_SCHOOL">High School</option>
                  <option value="GLOBAL">Global</option>
                </select>

                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={selectedMember.userRole?.id || ''}
                    onChange={(e) => setSelectedMember({
                      ...selectedMember,
                      userRole: {
                        id: e.target.value,
                        name: roles.find((role) => role.id === e.target.value)?.name || 'No Role',
                      },
                    })}
                    aria-label="Role"
                    className="ui-select min-h-[44px]"
                  >
                    <option value="">No Role</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>

                  <select
                    value={selectedMember.employmentType || 'FULL_TIME'}
                    onChange={(e) => setSelectedMember({ ...selectedMember, employmentType: e.target.value })}
                    aria-label="Employment type"
                    className="ui-select min-h-[44px]"
                  >
                    <option value="FULL_TIME">Full Time</option>
                    <option value="PART_TIME">Part Time</option>
                    <option value="CONTRACTOR">Contractor</option>
                    <option value="INTERN">Intern</option>
                    <option value="VOLUNTEER">Volunteer</option>
                  </select>
                </div>

                <select
                  value={selectedMember.status}
                  onChange={(e) => setSelectedMember({ ...selectedMember, status: e.target.value as Member['status'] })}
                  aria-label="Status"
                  className="ui-select w-full min-h-[44px]"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="PENDING">Pending</option>
                </select>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Teams</p>
                  <div className="grid grid-cols-1 gap-2">
                    {teams.map((team) => (
                      <label key={team.slug} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={selectedMember.teamIds.includes(team.slug)}
                          onChange={() => toggleTeamInDrawer(team.slug)}
                        />
                        {team.name}
                      </label>
                    ))}
                  </div>
                </div>

                {drawerError && <p className="text-sm text-red-600">{drawerError}</p>}

                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={closeDrawer} className="min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg">Close</button>
                  <button
                    onClick={handleSaveDrawer}
                    disabled={isSavingDrawer}
                    className="min-h-[44px] px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                  >
                    {isSavingDrawer ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={memberToDelete !== null}
        onClose={closeDeleteDialog}
        onConfirm={handleDeleteMember}
        title="Delete Member"
        message={`Are you sure you want to delete ${memberToDelete?.firstName || 'this member'}? This action cannot be undone.`}
        confirmText={`Delete ${memberToDelete?.firstName || 'Member'}`}
        variant="danger"
        isLoading={isDeletingMember}
      />
    </div>
  )
}
