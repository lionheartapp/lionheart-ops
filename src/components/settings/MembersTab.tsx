'use client'

import { useState, useEffect } from 'react'
import { Search, Plus, MoreVertical, UserCog, X } from 'lucide-react'

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

  const formatSchoolScope = (scope: Member['schoolScope']) => {
    return scope.replace('_', ' ')
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Members</h2>
          <p className="text-sm text-gray-500 mt-1">Manage members</p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Member
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search members"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="settings-search-input"
          />
        </div>
        
        <select
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
          className="ui-select"
        >
          <option value="">All Teams</option>
          {teams.map(team => (
            <option key={team.slug} value={team.slug}>{team.name}</option>
          ))}
        </select>

        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="ui-select"
        >
          <option value="">All Roles</option>
          {roles.map(role => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="ui-select"
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="PENDING">Pending</option>
        </select>

        <select
          value={filterSchoolScope}
          onChange={(e) => setFilterSchoolScope(e.target.value)}
          className="ui-select"
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
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Copy Link
            </button>
            <button
              onClick={() => setLatestSetupLink('')}
              className="px-3 py-1 text-xs border border-blue-300 text-blue-700 rounded hover:bg-blue-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Members Grid */}
      {(loading || metadataLoading) ? (
        <div className="text-center py-12 text-gray-500">Loading members...</div>
      ) : members.length === 0 ? (
        <div className="text-center py-12">
          <UserCog className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No members found</p>
          <button onClick={openCreateModal} className="mt-4 text-blue-600 hover:text-blue-700 font-medium">
            Add your first member
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {members.map((member) => (
            <div
              key={member.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              {/* Status Badge & Menu */}
              <div className="flex justify-between items-start mb-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(member.status)}`}>
                  {member.status === 'ACTIVE' ? '✓ Active' : member.status}
                </span>
                <button className="ui-icon-muted">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>

              {/* Avatar & Name */}
              <div className="flex flex-col items-center text-center mb-4">
                {member.avatar ? (
                  <img
                    src={member.avatar}
                    alt={`${member.firstName} ${member.lastName}`}
                    className="w-16 h-16 rounded-full mb-2 object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mb-2">
                    <span className="text-xl font-semibold text-gray-600">
                      {getInitials(member.firstName, member.lastName)}
                    </span>
                  </div>
                )}
                <h3 className="font-semibold text-gray-900">
                  {member.firstName} {member.lastName}
                </h3>
                <p className="text-sm text-blue-600">{member.jobTitle || member.userRole?.name || 'No Role'}</p>
              </div>

              {/* Employment Info */}
              <div className="flex flex-wrap gap-1 justify-center mb-3">
                {member.teamIds.length > 0 && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                    {getMemberTeams(member.teamIds).split(', ')[0]}
                  </span>
                )}
                {member.employmentType && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                    {member.employmentType.replace('_', ' ')}
                  </span>
                )}
                <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                  {formatSchoolScope(member.schoolScope)}
                </span>
              </div>

              {/* Contact Info */}
              <div className="space-y-1 text-sm text-gray-600 mb-3">
                <p className="truncate">Email: {member.email}</p>
                {member.phone && <p>Phone: {member.phone}</p>}
              </div>

              {/* Footer */}
              <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-500">
                  Joint: {formatDate(member.createdAt)}
                </span>
                <button
                  onClick={() => openDetailsDrawer(member.id)}
                  className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                >
                  Details
                </button>
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
              <button type="button" onClick={closeCreateModal} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={form.firstName}
                onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
                placeholder="First name"
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                value={form.lastName}
                onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
                placeholder="Last name"
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="Email"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="Phone (optional)"
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                value={form.jobTitle}
                onChange={(e) => setForm((prev) => ({ ...prev, jobTitle: e.target.value }))}
                placeholder="Job title"
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <select
              value={form.schoolScope}
              onChange={(e) => setForm((prev) => ({ ...prev, schoolScope: e.target.value as 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL' | 'GLOBAL' }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select Role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>

              <select
                value={form.employmentType}
                onChange={(e) => setForm((prev) => ({ ...prev, employmentType: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
              <button type="button" onClick={closeCreateModal} className="px-4 py-2 border border-gray-300 rounded-lg">Cancel</button>
              <button type="submit" disabled={isCreating} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
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
              <button onClick={closeDrawer} className="text-gray-500 hover:text-gray-700">
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
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    value={selectedMember.lastName || ''}
                    onChange={(e) => setSelectedMember({ ...selectedMember, lastName: e.target.value })}
                    placeholder="Last name"
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <input
                  type="email"
                  value={selectedMember.email}
                  onChange={(e) => setSelectedMember({ ...selectedMember, email: e.target.value })}
                  placeholder="Email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />

                <input
                  value={selectedMember.phone || ''}
                  onChange={(e) => setSelectedMember({ ...selectedMember, phone: e.target.value })}
                  placeholder="Phone"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />

                <input
                  value={selectedMember.jobTitle || ''}
                  onChange={(e) => setSelectedMember({ ...selectedMember, jobTitle: e.target.value })}
                  placeholder="Job title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />

                <select
                  value={selectedMember.schoolScope}
                  onChange={(e) => setSelectedMember({ ...selectedMember, schoolScope: e.target.value as Member['schoolScope'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">No Role</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>

                  <select
                    value={selectedMember.employmentType || 'FULL_TIME'}
                    onChange={(e) => setSelectedMember({ ...selectedMember, employmentType: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
                  <button onClick={closeDrawer} className="px-4 py-2 border border-gray-300 rounded-lg">Close</button>
                  <button
                    onClick={handleSaveDrawer}
                    disabled={isSavingDrawer}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                  >
                    {isSavingDrawer ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
