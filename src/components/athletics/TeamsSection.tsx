'use client'

import { useEffect, useState, useMemo } from 'react'
import { Plus, Search, Edit2, Trash2 } from 'lucide-react'
import { handleAuthResponse } from '@/lib/client-auth'
import DetailDrawer from '@/components/DetailDrawer'
import { FloatingInput, FloatingSelect, FloatingDropdown, type DropdownOption } from '@/components/ui/FloatingInput'
import RowActionMenu from '@/components/RowActionMenu'
import ConfirmDialog from '@/components/ConfirmDialog'

type Sport = {
  id: string
  name: string
  color: string
  seasonType: string
}

type Season = {
  id: string
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
  sport: { id: string; name: string; color: string }
  _count: { teams: number }
}

type Team = {
  id: string
  name: string
  level: string
  coachUserId: string | null
  schoolId: string | null
  sport: { id: string; name: string; color: string }
  season: { id: string; name: string }
  _count: { games: number; practices: number }
}

type User = {
  id: string
  name: string
  email: string
}

type Game = {
  id: string
  athleticTeamId: string
  homeAway: string
  homeScore: number | null
  awayScore: number | null
  isFinal: boolean
}

type TeamRecord = { wins: number; losses: number; ties: number }

function calcTeamRecords(games: Game[]): Record<string, TeamRecord> {
  const records: Record<string, TeamRecord> = {}
  for (const g of games) {
    if (g.homeScore == null || g.awayScore == null || !g.isFinal) continue
    if (!records[g.athleticTeamId]) records[g.athleticTeamId] = { wins: 0, losses: 0, ties: 0 }
    const rec = records[g.athleticTeamId]
    if (g.homeScore === g.awayScore) { rec.ties++; continue }
    const isHome = g.homeAway === 'HOME'
    const homeWon = g.homeScore > g.awayScore
    if ((isHome && homeWon) || (!isHome && !homeWon)) rec.wins++
    else rec.losses++
  }
  return records
}

const LEVEL_LABELS: Record<string, string> = {
  VARSITY: 'Varsity',
  JUNIOR_VARSITY: 'JV',
  FRESHMAN: 'Freshman',
  MIDDLE_SCHOOL: 'Middle School',
}

const LEVEL_STYLES: Record<string, string> = {
  VARSITY: 'bg-indigo-100 text-indigo-700',
  JUNIOR_VARSITY: 'bg-sky-100 text-sky-700',
  FRESHMAN: 'bg-teal-100 text-teal-700',
  MIDDLE_SCHOOL: 'bg-gray-100 text-gray-600',
}

interface TeamsSectionProps {
  activeCampusId: string | null
}

export default function TeamsSection({ activeCampusId }: TeamsSectionProps) {
  const [teams, setTeams] = useState<Team[]>([])
  const [sports, setSports] = useState<Sport[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [allGames, setAllGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Filter state
  const [filterSportId, setFilterSportId] = useState('')
  const [filterSeasonId, setFilterSeasonId] = useState('')

  // Create/Edit drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState({
    name: '',
    sportId: '',
    seasonId: '',
    level: 'VARSITY',
    coachUserId: '',
  })

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null)
  const [deleting, setDeleting] = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null

  // ─── Data Fetching ──────────────────────────────────────────────────

  const fetchTeams = async () => {
    if (!token) return
    try {
      const params = new URLSearchParams()
      if (filterSportId) params.set('sportId', filterSportId)
      if (filterSeasonId) params.set('seasonId', filterSeasonId)
      const res = await fetch(`/api/athletics/teams?${params.toString()}`, {
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

  const fetchSports = async () => {
    if (!token) return
    try {
      const res = await fetch('/api/athletics/sports', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (data.ok) setSports(data.data)
    } catch {
      // silent
    }
  }

  const fetchSeasons = async (sportId?: string) => {
    if (!token) return
    try {
      const params = sportId ? `?sportId=${sportId}` : ''
      const res = await fetch(`/api/athletics/seasons${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (data.ok) setSeasons(data.data)
    } catch {
      // silent
    }
  }

  const fetchUsers = async () => {
    if (!token) return
    try {
      const res = await fetch('/api/settings/users', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (data.ok) setUsers(data.data)
    } catch {
      // silent
    }
  }

  const fetchGames = async () => {
    if (!token) return
    try {
      const res = await fetch('/api/athletics/games', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (data.ok) setAllGames(data.data)
    } catch {
      // silent
    }
  }

  useEffect(() => {
    fetchSports()
    fetchSeasons()
    fetchUsers()
    fetchGames()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoading(true)
    fetchTeams()
  }, [filterSportId, filterSeasonId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset season filter when sport filter changes
  useEffect(() => {
    setFilterSeasonId('')
  }, [filterSportId])

  // ─── Derived Data ──────────────────────────────────────────────────

  // Filter seasons by selected sport for the filter bar
  const filteredSeasons = useMemo(() => {
    if (!filterSportId) return seasons
    return seasons.filter((s) => s.sport.id === filterSportId)
  }, [seasons, filterSportId])

  // Form seasons filtered by form sport
  const formSeasons = useMemo(() => {
    if (!form.sportId) return seasons
    return seasons.filter((s) => s.sport.id === form.sportId)
  }, [seasons, form.sportId])

  // Client-side campus filter
  const displayTeams = useMemo(() => {
    let result = teams
    if (activeCampusId) {
      result = result.filter((t) => t.schoolId === activeCampusId)
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.sport.name.toLowerCase().includes(q) ||
          t.season.name.toLowerCase().includes(q)
      )
    }
    return result
  }, [teams, activeCampusId, search])

  // Per-team season records
  const teamRecords = useMemo(() => calcTeamRecords(allGames), [allGames])

  // Dropdown options
  const sportOptions: DropdownOption[] = sports.map((s) => ({
    value: s.id,
    label: s.name,
    color: s.color,
  }))

  const seasonOptions: DropdownOption[] = formSeasons.map((s) => ({
    value: s.id,
    label: s.name,
  }))

  const coachOptions: DropdownOption[] = users.map((u) => ({
    value: u.id,
    label: u.name || u.email,
  }))

  // ─── Drawer Handlers ───────────────────────────────────────────────

  const openCreate = () => {
    setEditingTeam(null)
    setForm({ name: '', sportId: '', seasonId: '', level: 'VARSITY', coachUserId: '' })
    setFormError('')
    setDrawerOpen(true)
  }

  const openEdit = (team: Team) => {
    setEditingTeam(team)
    setForm({
      name: team.name,
      sportId: team.sport.id,
      seasonId: team.season.id,
      level: team.level,
      coachUserId: team.coachUserId || '',
    })
    setFormError('')
    setDrawerOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Team name is required'); return }
    if (!form.sportId) { setFormError('Sport is required'); return }
    if (!form.seasonId) { setFormError('Season is required'); return }

    setSaving(true)
    setFormError('')

    try {
      if (editingTeam) {
        // Update
        const res = await fetch(`/api/athletics/teams/${editingTeam.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: form.name.trim(),
            level: form.level,
            coachUserId: form.coachUserId || null,
          }),
        })
        if (handleAuthResponse(res)) return
        const data = await res.json()
        if (!data.ok) { setFormError(data.error?.message || 'Failed to update team'); return }
      } else {
        // Create
        const res = await fetch('/api/athletics/teams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: form.name.trim(),
            sportId: form.sportId,
            seasonId: form.seasonId,
            level: form.level,
            coachUserId: form.coachUserId || undefined,
            schoolId: activeCampusId || undefined,
          }),
        })
        if (handleAuthResponse(res)) return
        const data = await res.json()
        if (!data.ok) { setFormError(data.error?.message || 'Failed to create team'); return }
      }

      setDrawerOpen(false)
      fetchTeams()
    } catch {
      setFormError('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/athletics/teams/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (handleAuthResponse(res)) return
      setDeleteTarget(null)
      fetchTeams()
    } catch {
      // silent
    } finally {
      setDeleting(false)
    }
  }

  // When sport changes in form, reset seasonId
  const handleFormSportChange = (sportId: string) => {
    setForm({ ...form, sportId, seasonId: '' })
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search teams..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400/10"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterSportId}
            onChange={(e) => setFilterSportId(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
          >
            <option value="">All Sports</option>
            {sports.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={filterSeasonId}
            onChange={(e) => setFilterSeasonId(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
          >
            <option value="">All Seasons</option>
            {filteredSeasons.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition"
        >
          <Plus className="w-4 h-4" />
          Add Team
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : displayTeams.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">
            {search || filterSportId || filterSeasonId ? 'No teams match your filters' : 'No teams created yet'}
          </p>
          {!search && !filterSportId && !filterSeasonId && (
            <button
              type="button"
              onClick={openCreate}
              className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Create your first team
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Team</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Sport</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider hidden sm:table-cell">Season</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Level</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider hidden md:table-cell">Coach</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider hidden lg:table-cell">Record</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider hidden lg:table-cell">G/P</th>
                <th className="w-12 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayTeams.map((team) => {
                const coach = users.find((u) => u.id === team.coachUserId)
                return (
                  <tr key={team.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: team.sport.color }}
                        />
                        <span className="font-medium text-gray-900">{team.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{team.sport.name}</td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{team.season.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${LEVEL_STYLES[team.level] || 'bg-gray-100 text-gray-600'}`}>
                        {LEVEL_LABELS[team.level] || team.level}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                      {coach ? coach.name || coach.email : '—'}
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      {(() => {
                        const rec = teamRecords[team.id]
                        if (!rec) return <span className="text-gray-400">—</span>
                        return (
                          <span className="text-sm font-medium text-gray-700">
                            <span className="text-green-600">{rec.wins}</span>
                            {'-'}
                            <span className="text-red-500">{rec.losses}</span>
                            {rec.ties > 0 && <>{'-'}<span className="text-gray-500">{rec.ties}</span></>}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500 hidden lg:table-cell">
                      {team._count.games}/{team._count.practices}
                    </td>
                    <td className="px-2 py-3">
                      <RowActionMenu
                        items={[
                          {
                            label: 'Edit',
                            icon: <Edit2 className="w-4 h-4" />,
                            onClick: () => openEdit(team),
                          },
                          {
                            label: 'Delete',
                            icon: <Trash2 className="w-4 h-4" />,
                            onClick: () => setDeleteTarget(team),
                            variant: 'danger',
                          },
                        ]}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Team Drawer */}
      <DetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingTeam ? 'Edit Team' : 'New Team'}
        width="lg"
      >
        <div className="space-y-5">
          <FloatingInput
            id="team-name"
            label="Team Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />

          <FloatingDropdown
            id="team-sport"
            label="Sport"
            value={form.sportId}
            onChange={handleFormSportChange}
            options={sportOptions}
            required
            disabled={!!editingTeam}
          />

          <FloatingDropdown
            id="team-season"
            label="Season"
            value={form.seasonId}
            onChange={(v) => setForm({ ...form, seasonId: v })}
            options={seasonOptions}
            required
            disabled={!!editingTeam}
          />

          <FloatingSelect
            id="team-level"
            label="Level"
            value={form.level}
            onChange={(e) => setForm({ ...form, level: e.target.value })}
          >
            <option value="VARSITY">Varsity</option>
            <option value="JUNIOR_VARSITY">Junior Varsity</option>
            <option value="FRESHMAN">Freshman</option>
            <option value="MIDDLE_SCHOOL">Middle School</option>
          </FloatingSelect>

          <FloatingDropdown
            id="team-coach"
            label="Coach"
            value={form.coachUserId}
            onChange={(v) => setForm({ ...form, coachUserId: v })}
            options={[{ value: '', label: 'No coach assigned' }, ...coachOptions]}
          />

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3.5 text-sm font-semibold text-white bg-gray-900 rounded-full hover:bg-gray-800 disabled:opacity-50 transition"
          >
            {saving ? 'Saving...' : editingTeam ? 'Update Team' : 'Create Team'}
          </button>
        </div>
      </DetailDrawer>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Team"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This will remove all associated games and practices.`}
        requireText={deleteTarget?.name}
        confirmText="Delete"
        variant="danger"
        isLoading={deleting}
        loadingText="Deleting..."
      />
    </div>
  )
}
