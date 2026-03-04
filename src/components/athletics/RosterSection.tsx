'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Search, Users, Trash2, Edit2 } from 'lucide-react'
import { handleAuthResponse } from '@/lib/client-auth'
import { FloatingInput, FloatingDropdown, type DropdownOption } from '@/components/ui/FloatingInput'
import DetailDrawer from '@/components/DetailDrawer'
import ConfirmDialog from '@/components/ConfirmDialog'
import RowActionMenu from '@/components/RowActionMenu'

interface Team {
  id: string
  name: string
  level: string
  schoolId: string | null
  sport: { id: string; name: string; color: string }
  season: { id: string; name: string }
}

interface RosterPlayer {
  id: string
  athleticTeamId: string
  firstName: string
  lastName: string
  jerseyNumber: string | null
  position: string | null
  grade: string | null
  height: string | null
  weight: string | null
  userId: string | null
  isActive: boolean
  user: { id: string; firstName: string | null; lastName: string | null; email: string } | null
  athleticTeam: { id: string; name: string; sport: { name: string; color: string } }
}

interface OrgUser {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
}

interface RosterSectionProps {
  activeCampusId: string | null
  canWrite?: boolean
  canManageUsers?: boolean
}

export default function RosterSection({ activeCampusId, canWrite = false, canManageUsers = false }: RosterSectionProps) {
  const [teams, setTeams] = useState<Team[]>([])
  const [roster, setRoster] = useState<RosterPlayer[]>([])
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingRoster, setLoadingRoster] = useState(false)

  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [search, setSearch] = useState('')

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<RosterPlayer | null>(null)

  // Form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [jerseyNumber, setJerseyNumber] = useState('')
  const [position, setPosition] = useState('')
  const [grade, setGrade] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [linkedUserId, setLinkedUserId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null

  // ─── Data fetching ─────────────────────────────────────────────────

  const fetchTeams = async () => {
    if (!token) return
    try {
      const res = await fetch('/api/athletics/teams', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (data.ok) setTeams(data.data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  const fetchRoster = async (teamId: string) => {
    if (!token || !teamId) return
    setLoadingRoster(true)
    try {
      const res = await fetch(`/api/athletics/roster?teamId=${teamId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (data.ok) setRoster(data.data)
    } catch {
      // silent
    } finally {
      setLoadingRoster(false)
    }
  }

  const fetchUsers = async () => {
    if (!token || !canManageUsers) return
    try {
      const res = await fetch('/api/settings/users', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (data.ok) setOrgUsers(data.data)
    } catch {
      // silent
    }
  }

  useEffect(() => {
    fetchTeams()
    if (canManageUsers) fetchUsers()
  }, [canManageUsers]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedTeamId) {
      fetchRoster(selectedTeamId)
    } else {
      setRoster([])
    }
  }, [selectedTeamId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Campus-filtered teams ─────────────────────────────────────────

  const displayTeams = useMemo(() => {
    if (!activeCampusId) return teams
    return teams.filter((t) => !t.schoolId || t.schoolId === activeCampusId)
  }, [teams, activeCampusId])

  const teamOptions: DropdownOption[] = useMemo(() => {
    return displayTeams.map((t) => ({
      value: t.id,
      label: `${t.name} — ${t.sport.name}`,
      color: t.sport.color,
    }))
  }, [displayTeams])

  useEffect(() => {
    if (selectedTeamId && !displayTeams.find((t) => t.id === selectedTeamId)) {
      setSelectedTeamId('')
    }
  }, [displayTeams, selectedTeamId])

  // ─── Filtered roster ───────────────────────────────────────────────

  const filteredRoster = useMemo(() => {
    if (!search.trim()) return roster
    const q = search.toLowerCase()
    return roster.filter((p) =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
      p.jerseyNumber?.includes(q) ||
      p.position?.toLowerCase().includes(q)
    )
  }, [roster, search])

  // ─── Drawer handlers ──────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null)
    setFirstName('')
    setLastName('')
    setJerseyNumber('')
    setPosition('')
    setGrade('')
    setHeight('')
    setWeight('')
    setLinkedUserId('')
    setError('')
    setDrawerOpen(true)
  }

  const openEdit = (player: RosterPlayer) => {
    setEditing(player)
    setFirstName(player.firstName)
    setLastName(player.lastName)
    setJerseyNumber(player.jerseyNumber || '')
    setPosition(player.position || '')
    setGrade(player.grade || '')
    setHeight(player.height || '')
    setWeight(player.weight || '')
    setLinkedUserId(player.userId || '')
    setError('')
    setDrawerOpen(true)
  }

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required')
      return
    }

    setSaving(true)
    setError('')

    try {
      const body: Record<string, unknown> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        jerseyNumber: jerseyNumber.trim() || null,
        position: position.trim() || null,
        grade: grade.trim() || null,
        height: height.trim() || null,
        weight: weight.trim() || null,
        userId: linkedUserId || null,
      }

      let res: Response
      if (editing) {
        res = await fetch(`/api/athletics/roster/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        })
      } else {
        body.athleticTeamId = selectedTeamId
        res = await fetch('/api/athletics/roster', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        })
      }

      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (!data.ok) {
        setError(data.error?.message || 'Failed to save')
        return
      }

      setDrawerOpen(false)
      fetchRoster(selectedTeamId)
    } catch {
      setError('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/athletics/roster/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (handleAuthResponse(res)) return
      setDeleteTarget(null)
      fetchRoster(selectedTeamId)
    } catch {
      // silent
    } finally {
      setDeleting(false)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  const userOptions: DropdownOption[] = [
    { value: '', label: 'No linked user' },
    ...orgUsers.map((u) => ({
      value: u.id,
      label: `${u.firstName || ''} ${u.lastName || ''} (${u.email})`.trim(),
    })),
  ]

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
        <div className="w-full sm:w-64">
          <FloatingDropdown
            id="roster-team"
            label="Select Team"
            value={selectedTeamId}
            onChange={setSelectedTeamId}
            options={[{ value: '', label: 'Choose a team...' }, ...teamOptions]}
          />
        </div>

        <div className="relative w-full sm:w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players..."
            disabled={!selectedTeamId}
            className="w-full pl-9 pr-3 py-3.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900/10 transition-colors disabled:opacity-50 disabled:bg-gray-50"
          />
        </div>

        {canWrite && (
          <button
            type="button"
            onClick={openCreate}
            disabled={!selectedTeamId}
            title={!selectedTeamId ? 'Select a team first' : undefined}
            className="flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition sm:ml-auto disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Add Player
          </button>
        )}
      </div>

      {/* Content */}
      {!selectedTeamId ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h2 className="text-lg font-medium text-gray-700 mb-1">Select a team</h2>
          <p className="text-sm text-gray-500">Choose a team above to manage its roster</p>
        </div>
      ) : loadingRoster ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredRoster.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h2 className="text-lg font-medium text-gray-700 mb-1">
            {roster.length === 0 ? 'No players on this roster' : 'No matching players'}
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            {roster.length === 0 ? 'Get started by adding a player' : 'Try a different search'}
          </p>
          {roster.length === 0 && (
            <button
              type="button"
              onClick={openCreate}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Add a player
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Position</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Grade</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Ht/Wt</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Linked User</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredRoster.map((player) => (
                  <tr key={player.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      {player.jerseyNumber || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {player.firstName} {player.lastName}
                      </div>
                      {!player.isActive && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-medium">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{player.position || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{player.grade || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">
                      {player.height || player.weight
                        ? `${player.height || '—'} / ${player.weight || '—'}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">
                      {player.user
                        ? `${player.user.firstName || ''} ${player.user.lastName || ''}`.trim() || player.user.email
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RowActionMenu
                        items={[
                          { label: 'Edit', icon: <Edit2 className="w-4 h-4" />, onClick: () => openEdit(player) },
                          {
                            label: 'Delete',
                            icon: <Trash2 className="w-4 h-4" />,
                            onClick: () => setDeleteTarget({ id: player.id, name: `${player.firstName} ${player.lastName}` }),
                            variant: 'danger',
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-100 px-4 py-2.5 text-xs text-gray-500">
            {filteredRoster.length} player{filteredRoster.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Create/Edit drawer */}
      <DetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Player' : 'Add Player'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FloatingInput id="first-name" label="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <FloatingInput id="last-name" label="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <FloatingInput id="jersey-number" label="Jersey Number" value={jerseyNumber} onChange={(e) => setJerseyNumber(e.target.value)} />
          <FloatingInput id="position" label="Position" value={position} onChange={(e) => setPosition(e.target.value)} />
          <FloatingInput id="grade" label="Grade" value={grade} onChange={(e) => setGrade(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <FloatingInput id="height" label="Height" value={height} onChange={(e) => setHeight(e.target.value)} />
            <FloatingInput id="weight" label="Weight" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
          <FloatingDropdown
            id="linked-user"
            label="Link to User (optional)"
            value={linkedUserId}
            onChange={setLinkedUserId}
            options={userOptions}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              disabled={saving}
              className="flex-1 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : editing ? 'Update Player' : 'Add Player'}
            </button>
          </div>
        </div>
      </DetailDrawer>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Player"
        message={`Are you sure you want to remove ${deleteTarget?.name} from the roster? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        isLoading={deleting}
        loadingText="Deleting..."
      />
    </div>
  )
}
