'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Users, Plus, Edit2, Trash2, X } from 'lucide-react'

interface Team {
  id: string
  name: string
  slug: string
  description?: string
  _count?: {
    members: number
  }
}

export default function TeamsTab() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [teamDescription, setTeamDescription] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null)
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

  const handleDeleteTeam = async (team: Team) => {
    setActionError(null)

    const confirmed = window.confirm(`Delete team \"${team.name}\"? This cannot be undone.`)
    if (!confirmed) return

    setDeletingTeamId(team.id)
    try {
      const response = await fetch(`/api/settings/teams/${team.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setActionError(payload?.error?.message || 'Failed to delete team')
        return
      }

      setTeams((previous) => previous.filter((item) => item.id !== team.id))
    } catch (error) {
      console.error('Failed to delete team:', error)
      setActionError('Failed to delete team')
    } finally {
      setDeletingTeamId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Teams</h2>
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
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
    </div>
  )
}
