'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Users, Plus, Edit2, Trash2, X } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import DetailDrawer from '@/components/DetailDrawer'

interface Team {
  id: string
  name: string
  slug: string
  description?: string
  _count?: {
    members: number
  }
}

interface TeamUserSummary {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
}

export default function TeamsTab() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [teamDescription, setTeamDescription] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [editTeam, setEditTeam] = useState<Team | null>(null)
  const [editTeamName, setEditTeamName] = useState('')
  const [editTeamDescription, setEditTeamDescription] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null)
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null)
  const [reassignTeamId, setReassignTeamId] = useState('')
  const [teamUsers, setTeamUsers] = useState<TeamUserSummary[]>([])
  const [teamUsersLoading, setTeamUsersLoading] = useState(false)
  const [teamUserReassignments, setTeamUserReassignments] = useState<Record<string, string>>({})
  const [actionError, setActionError] = useState<string | null>(null)

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth-token')
    const orgId = localStorage.getItem('org-id')

    return {
      'Authorization': `Bearer ${token}`,
      'X-Organization-ID': orgId || '',
    }
  }

  useEffect(() => {
    loadTeams()
  }, [])

  const loadTeams = async () => {
    try {
      const response = await fetch('/api/settings/teams', {
        headers: getAuthHeaders(),
      })
      
      if (response.ok) {
        const data = await response.json()
        setTeams(data.data || [])
      }
    } catch (error) {
      console.error('Failed to load teams:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTeam = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setActionError(null)

    const trimmedName = teamName.trim()
    if (!trimmedName) {
      setActionError('Team name is required')
      return
    }

    setCreateLoading(true)
    try {
      const response = await fetch('/api/settings/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          name: trimmedName,
          description: teamDescription.trim() || null,
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setActionError(payload?.error?.message || 'Failed to create team')
        return
      }

      setTeamName('')
      setTeamDescription('')
      setShowCreateModal(false)
      await loadTeams()
    } catch (error) {
      console.error('Failed to create team:', error)
      setActionError('Failed to create team')
    } finally {
      setCreateLoading(false)
    }
  }

  const openEditDrawer = async (team: Team) => {
    setEditError(null)
    setEditTeam(team)
    setEditTeamName(team.name)
    setEditTeamDescription(team.description || '')
    setEditLoading(true)

    try {
      const response = await fetch(`/api/settings/teams/${team.id}`, {
        headers: getAuthHeaders(),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setEditError(payload?.error?.message || 'Failed to load team details')
        return
      }

      setEditTeamName(payload?.data?.name || team.name)
      setEditTeamDescription(payload?.data?.description || '')
    } catch (error) {
      console.error('Failed to load team details:', error)
      setEditError('Failed to load team details')
    } finally {
      setEditLoading(false)
    }
  }

  const closeEditDrawer = () => {
    if (editSaving) return
    setEditTeam(null)
    setEditTeamName('')
    setEditTeamDescription('')
    setEditError(null)
  }

  const handleEditTeam = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editTeam) return

    setEditError(null)
    const trimmedName = editTeamName.trim()
    if (!trimmedName) {
      setEditError('Team name is required')
      return
    }

    setEditSaving(true)
    try {
      const response = await fetch(`/api/settings/teams/${editTeam.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          name: trimmedName,
          description: editTeamDescription.trim() || null,
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setEditError(payload?.error?.message || 'Failed to update team')
        return
      }

      setEditTeam(null)
      setEditTeamName('')
      setEditTeamDescription('')
      await loadTeams()
    } catch (error) {
      console.error('Failed to update team:', error)
      setEditError('Failed to update team')
    } finally {
      setEditSaving(false)
    }
  }

  const handleDeleteTeam = (team: Team) => {
    setActionError(null)
    setTeamToDelete(team)
  }

  const loadTeamUsers = async (slug: string) => {
    setTeamUsersLoading(true)
    try {
      const response = await fetch(`/api/settings/users?teamSlug=${slug}`, {
        headers: getAuthHeaders(),
      })

      if (!response.ok) {
        setTeamUsers([])
        return
      }

      const payload = await response.json().catch(() => null)
      setTeamUsers(payload?.data || [])
    } catch (error) {
      console.error('Failed to load team members:', error)
      setTeamUsers([])
    } finally {
      setTeamUsersLoading(false)
    }
  }

  const availableReassignTeams = useMemo(() => {
    if (!teamToDelete) return []
    return teams.filter((team) => team.id !== teamToDelete.id)
  }, [teams, teamToDelete])

  useEffect(() => {
    if (!teamToDelete) {
      setReassignTeamId('')
      setTeamUsers([])
      setTeamUserReassignments({})
      return
    }

    if ((teamToDelete._count?.members || 0) > 0) {
      setReassignTeamId(availableReassignTeams[0]?.id || '')
      loadTeamUsers(teamToDelete.slug)
    } else {
      setReassignTeamId('')
      setTeamUsers([])
      setTeamUserReassignments({})
    }
  }, [teamToDelete, availableReassignTeams])

  const confirmDeleteTeam = async () => {
    if (!teamToDelete) return

    setActionError(null)
    const assignedMembers = teamToDelete._count?.members || 0
    if (assignedMembers > 0 && !reassignTeamId) {
      setActionError('Select a team to reassign members before deleting.')
      return
    }

    setDeletingTeamId(teamToDelete.id)

    try {
      const userReassignments = Object.entries(teamUserReassignments)
        .filter(([, teamId]) => teamId)
        .map(([userId, teamId]) => ({ userId, teamId }))

      const response = await fetch(`/api/settings/teams/${teamToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          reassignTeamId: reassignTeamId || null,
          userReassignments,
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setActionError(payload?.error?.message || 'Failed to delete team')
        setTeamToDelete(null)
        return
      }

      setTeams((previous) => previous.filter((item) => item.id !== teamToDelete.id))
      setTeamToDelete(null)
    } catch (error) {
      console.error('Failed to delete team:', error)
      setActionError('Failed to delete team')
      setTeamToDelete(null)
    } finally {
      setDeletingTeamId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Teams</h2>
          <p className="text-sm text-gray-600 mt-1">Organize users into teams for better collaboration</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Create Team
        </button>
      </div>

      {actionError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="divide-y divide-gray-200 border-y border-gray-200">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="py-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="h-12 w-12 bg-gray-200 rounded-lg" />
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-gray-200 rounded" />
                    <div className="h-8 w-8 bg-gray-200 rounded" />
                  </div>
                </div>
                <div className="h-5 w-40 bg-gray-200 rounded mb-2" />
                <div className="h-4 w-28 bg-gray-200 rounded mb-2" />
                <div className="h-4 w-2/3 bg-gray-200 rounded mb-2" />
                <div className="h-4 w-20 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : teams.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-md">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No teams found</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Create your first team
          </button>
        </div>
      ) : (
        <div className="divide-y divide-gray-200 border-y border-gray-200">
          {teams.map((team) => (
            <div
              key={team.id}
              className="py-5"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-purple-50 rounded-lg">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditDrawer(team)}
                    className="p-2 text-gray-600 hover:bg-blue-50 rounded-lg transition"
                    title="Edit team"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteTeam(team)}
                    disabled={deletingTeamId === team.id}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Delete team"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{team.name}</h3>
              <p className="text-sm text-gray-600 mb-3">@{team.slug}</p>
              {team.description && (
                <p className="text-sm text-gray-500 mb-3">{team.description}</p>
              )}
              <div className="text-sm text-gray-500">
                {team._count?.members || 0} members
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Create Team</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setTeamName('')
                  setTeamDescription('')
                  setActionError(null)
                }}
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
                aria-label="Close create team modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label htmlFor="team-name" className="mb-1 block text-sm font-medium text-gray-700">
                  Team name
                </label>
                <input
                  id="team-name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. Front Office"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
                  disabled={createLoading}
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="team-description" className="mb-1 block text-sm font-medium text-gray-700">
                  Description (optional)
                </label>
                <textarea
                  id="team-description"
                  value={teamDescription}
                  onChange={(e) => setTeamDescription(e.target.value)}
                  placeholder="What this team is responsible for"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
                  rows={3}
                  disabled={createLoading}
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setTeamName('')
                    setTeamDescription('')
                    setActionError(null)
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  disabled={createLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={createLoading}
                >
                  {createLoading ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DetailDrawer
        isOpen={editTeam !== null}
        onClose={closeEditDrawer}
        title={editTeam ? `Edit ${editTeam.name}` : 'Edit Team'}
        width="lg"
      >
        {editLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-16 rounded-lg border border-gray-200 bg-gray-50" />
            ))}
          </div>
        ) : (
          <form onSubmit={handleEditTeam} className="space-y-6">
            {editError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {editError}
              </div>
            )}

            <section className="space-y-4">
              <div className="border-b border-gray-200 pb-3">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Naming the Team
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Update how this team appears in assignments and filters.
                </p>
              </div>

              <div>
                <label htmlFor="edit-team-name" className="mb-1 block text-sm font-medium text-gray-700">
                  Team name
                </label>
                <input
                  id="edit-team-name"
                  value={editTeamName}
                  onChange={(e) => setEditTeamName(e.target.value)}
                  placeholder="e.g. Front Office"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
                  disabled={editSaving}
                  autoFocus
                />
              </div>
            </section>

            <section className="space-y-4">
              <div className="border-b border-gray-200 pb-3">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Description
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Add context for what this team handles.
                </p>
              </div>

              <div>
                <label htmlFor="edit-team-description" className="mb-1 block text-sm font-medium text-gray-700">
                  Description (optional)
                </label>
                <textarea
                  id="edit-team-description"
                  value={editTeamDescription}
                  onChange={(e) => setEditTeamDescription(e.target.value)}
                  placeholder="What this team is responsible for"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
                  rows={4}
                  disabled={editSaving}
                />
              </div>
            </section>

            <div className="flex items-center justify-end gap-2 border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={closeEditDrawer}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                disabled={editSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
                disabled={editSaving}
              >
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </DetailDrawer>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={teamToDelete !== null}
        onClose={() => setTeamToDelete(null)}
        onConfirm={confirmDeleteTeam}
        title="Delete Team"
        message={`Are you sure you want to delete "${teamToDelete?.name}"? This action cannot be undone.`}
        requireText="DELETE"
        confirmText="Delete Team"
        variant="danger"
        isLoading={deletingTeamId !== null}
        confirmDisabled={
          (teamToDelete?._count?.members || 0) > 0 &&
          !reassignTeamId &&
          Object.values(teamUserReassignments).every((value) => !value)
        }
      >
        {teamToDelete && (teamToDelete._count?.members || 0) > 0 && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-medium">
              This team has {teamToDelete._count?.members} assigned members.
            </p>
            {availableReassignTeams.length > 0 ? (
              <div className="mt-3">
                <label htmlFor="reassign-team" className="mb-1 block text-sm font-medium text-amber-900">
                  Move members to
                </label>
                <select
                  id="reassign-team"
                  value={reassignTeamId}
                  onChange={(event) => setReassignTeamId(event.target.value)}
                  className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-amber-400 focus:outline-none"
                >
                  <option value="">Select a team</option>
                  {availableReassignTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Reassign individually
                  </p>
                  {teamUsersLoading ? (
                    <div className="mt-2 space-y-2">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="h-10 rounded-md bg-amber-100" />
                      ))}
                    </div>
                  ) : teamUsers.length === 0 ? (
                    <p className="mt-2 text-sm text-amber-700">
                      No assigned members found.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {teamUsers.map((user) => {
                        const displayName = [user.firstName, user.lastName]
                          .filter(Boolean)
                          .join(' ')
                        return (
                          <div key={user.id} className="flex flex-col gap-2 rounded-lg bg-white p-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-medium text-amber-900">
                                {displayName || user.email}
                              </p>
                              <p className="text-xs text-amber-700">{user.email}</p>
                            </div>
                            <select
                              value={teamUserReassignments[user.id] || ''}
                              onChange={(event) =>
                                setTeamUserReassignments((previous) => ({
                                  ...previous,
                                  [user.id]: event.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-amber-400 focus:outline-none sm:w-56"
                            >
                              <option value="">Use bulk team</option>
                              {availableReassignTeams.map((team) => (
                                <option key={team.id} value={team.id}>
                                  {team.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm">
                Create another team before deleting so members can be reassigned.
              </p>
            )}
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}
