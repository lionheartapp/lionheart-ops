'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Users, Plus, Edit2, Trash2 } from 'lucide-react'
import { handleAuthResponse } from '@/lib/client-auth'
import ConfirmDialog from '@/components/ConfirmDialog'
import DetailDrawer from '@/components/DetailDrawer'
import RowActionMenu from '@/components/RowActionMenu'

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

type TeamsTabProps = {
  onDirtyChange?: (isDirty: boolean) => void
}

export default function TeamsTab({ onDirtyChange }: TeamsTabProps = {}) {
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

  const hasCreateDraft = showCreateModal && (teamName.trim().length > 0 || teamDescription.trim().length > 0)
  const hasEditDraft =
    Boolean(editTeam) &&
    (
      editTeamName.trim() !== (editTeam?.name || '').trim() ||
      editTeamDescription.trim() !== (editTeam?.description || '').trim()
    )
  const hasUnsavedChanges = hasCreateDraft || hasEditDraft

  useEffect(() => {
    onDirtyChange?.(hasUnsavedChanges)
  }, [hasUnsavedChanges, onDirtyChange])

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

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasUnsavedChanges])

  const loadTeams = async () => {
    try {
      const response = await fetch('/api/settings/teams', {
        headers: getAuthHeaders(),
      })
      if (handleAuthResponse(response)) return

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
      if (handleAuthResponse(response)) return

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
      if (handleAuthResponse(response)) return

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
      if (handleAuthResponse(response)) return

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
      if (handleAuthResponse(response)) return

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
      if (handleAuthResponse(response)) return

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
          <h2 className="flex items-center gap-3 text-2xl font-semibold text-gray-900">
            <Users className="w-6 h-6 text-blue-600" />
            Teams
          </h2>
          <p className="text-sm text-gray-600 mt-1">Organize users into teams for better collaboration</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 min-h-[40px] text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Create Team
        </button>
      </div>

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {loading ? (
          <div className="animate-pulse p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4 py-2">
                <div className="h-4 w-40 bg-gray-200 rounded" />
                <div className="h-4 w-56 bg-gray-200 rounded flex-1" />
                <div className="h-4 w-12 bg-gray-200 rounded" />
                <div className="h-6 w-16 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        ) : teams.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm mb-2">No teams found.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Create your first team
            </button>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b bg-gray-50">
                <th className="py-3 px-4 text-left font-medium">Team</th>
                <th className="py-3 px-4 text-left font-medium">Description</th>
                <th className="py-3 px-4 text-left font-medium">Members</th>
                <th className="py-3 pl-4 pr-10 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-900">{team.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">@{team.slug}</div>
                  </td>
                  <td className="py-3 px-4 text-gray-500">
                    {team.description || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-3 px-4 text-gray-600">{team._count?.members || 0}</td>
                  <td className="py-3 pl-4 pr-10">
                    <div className="flex justify-end">
                      <RowActionMenu
                        items={[
                          {
                            label: 'Edit',
                            icon: <Edit2 className="w-4 h-4" />,
                            onClick: () => openEditDrawer(team),
                          },
                          {
                            label: 'Delete',
                            icon: <Trash2 className="w-4 h-4" />,
                            onClick: () => handleDeleteTeam(team),
                            variant: 'danger',
                            disabled: deletingTeamId === team.id,
                          },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <DetailDrawer
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setTeamName('')
          setTeamDescription('')
          setActionError(null)
        }}
        title="Create Team"
        width="lg"
      >
        <form onSubmit={handleCreateTeam} className="p-8 space-y-6">
          {actionError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {actionError}
            </div>
          )}

          <section className="space-y-4">
            <div className="border-b border-gray-200 pb-3">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Team Details</h3>
            </div>

            <div>
              <label htmlFor="team-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                Team name
              </label>
              <input
                id="team-name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. Front Office"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={createLoading}
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="team-description" className="block text-sm font-medium text-gray-700 mb-1.5">
                Description <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="team-description"
                value={teamDescription}
                onChange={(e) => setTeamDescription(e.target.value)}
                placeholder="What this team is responsible for"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows={4}
                disabled={createLoading}
              />
            </div>
          </section>

          <div className="flex items-center justify-end gap-2 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(false)
                setTeamName('')
                setTeamDescription('')
                setActionError(null)
              }}
              className="px-4 py-2 min-h-[40px] border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
              disabled={createLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 min-h-[40px] bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={createLoading}
            >
              {createLoading ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        </form>
      </DetailDrawer>

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
          <form onSubmit={handleEditTeam} className="p-8 space-y-6">
            {editError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
                <label htmlFor="edit-team-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Team name
                </label>
                <input
                  id="edit-team-name"
                  value={editTeamName}
                  onChange={(e) => setEditTeamName(e.target.value)}
                  placeholder="e.g. Front Office"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                <label htmlFor="edit-team-description" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Description (optional)
                </label>
                <textarea
                  id="edit-team-description"
                  value={editTeamDescription}
                  onChange={(e) => setEditTeamDescription(e.target.value)}
                  placeholder="What this team is responsible for"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={4}
                  disabled={editSaving}
                />
              </div>
            </section>

            <div className="flex items-center justify-end gap-2 border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={closeEditDrawer}
                className="px-4 py-2 min-h-[40px] border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
                disabled={editSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 min-h-[40px] bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
